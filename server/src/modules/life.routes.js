'use strict';
/**
 * Vie scolaire : transport (GPS temps réel, pointage QR/RFID/NFC), cantine,
 * activités, infirmerie (chiffrée), objets perdus, documents, inscriptions.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op, literal } = require('sequelize');
const { z } = require('zod');
const M = require('../models');
const { sequelize } = M;
const { crudRouter, idParam } = require('../core/crud');
const { requirePerm } = require('../middlewares/auth');
const { requireFeature } = require('../middlewares/tenant');
const { validate, auditRead } = require('../middlewares/common');
const { asyncHandler, notFound, forbidden, badRequest, conflict } = require('../core/errors');
const scope = require('../services/scope');
const realtime = require('../services/realtime');
const { notify, parentsByStudent } = require('../services/notifier');
const { encrypt, decrypt } = require('../services/security');
const pdf = require('../services/pdf');
const { claimFile, fileUrl } = require('./files.routes');
const { currentTenantId } = require('../core/context');

const r = express.Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// =====================================================================
// TRANSPORT (plan Premium)
// =====================================================================
const transport = express.Router();
transport.use(requireFeature('transport'));

/** Distance en km (haversine). */
const km = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
/** ETA simple : distance restante le long des arrêts à 22 km/h + retard déclaré. */
function eta(bus, position) {
  const stops = bus.stops.map(s => ({ lat: Number(s.lat), lng: Number(s.lng) }));
  if (!position || !stops.length) return null;
  const p = { lat: Number(position.lat), lng: Number(position.lng) };
  let nearest = 0; stops.forEach((s, i) => { if (km(p, s) < km(p, stops[nearest])) nearest = i; });
  let dist = km(p, stops[nearest]);
  for (let i = nearest; i < stops.length - 1; i++) dist += km(stops[i], stops[i + 1]);
  return { nextStopIndex: nearest, minutesToSchool: Math.round(dist / 22 * 60) + (bus.delayMinutes || 0) };
}
const lastPositions = async busIds => {
  if (!busIds.length) return {};
  const rows = await M.BusPosition.findAll({ where: { busId: { [Op.in]: busIds }, id: { [Op.in]: literal(`(SELECT MAX(id) FROM bus_positions WHERE tenant_id = ${Number(currentTenantId())} GROUP BY bus_id)`) } } });
  return Object.fromEntries(rows.map(p => [p.busId, p]));
};

transport.get('/buses', requirePerm('transport:read'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role === 'parent' || req.user.role === 'student') {
    const ids = await scope.allowedStudentIds(req.user);
    const a = await M.BusAssignment.findAll({ where: { studentId: { [Op.in]: ids.length ? ids : [0] } } });
    where.id = { [Op.in]: a.map(x => x.busId).concat(0) };
  }
  if (req.user.role === 'driver') where[Op.or] = [{ driverUserId: req.user.id }, { attendantUserId: req.user.id }];
  const buses = await M.Bus.findAll({ where, include: [{ model: M.BusStop, as: 'stops', separate: true, order: [['position', 'ASC']] }, { model: M.User, as: 'driver', attributes: ['firstName', 'lastName', 'phone'] }, { model: M.User, as: 'attendant', attributes: ['firstName', 'lastName', 'phone'] }] });
  const counts = await M.BusAssignment.findAll({ attributes: ['busId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['busId'], raw: true });
  const pos = await lastPositions(buses.map(b => b.id));
  res.json({ data: buses.map(b => ({ ...b.toJSON(), students: Number((counts.find(c => Number(c.busId) === Number(b.id)) || {}).n || 0), position: pos[b.id] || null, eta: eta(b, pos[b.id]) })) });
}));
transport.get('/buses/:id/students', requirePerm('transport:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (['parent', 'student'].includes(req.user.role)) throw forbidden();
  res.json({ data: await M.BusAssignment.findAll({ where: { busId: req.params.id }, include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName', 'classId'] }, { model: M.BusStop, as: 'stop' }] }) });
}));

/** Position GPS (boîtier ou smartphone de l'accompagnateur). Diffusée en temps réel. */
transport.post('/buses/:id/position', requirePerm('transport:position', 'transport:write'), validate({ params: idParam, body: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), speed: z.number().min(0).max(200).optional() }) }), asyncHandler(async (req, res) => {
  const bus = await M.Bus.findByPk(req.params.id, { include: [{ model: M.BusStop, as: 'stops', separate: true, order: [['position', 'ASC']] }] });
  if (!bus) throw notFound();
  if (req.user.role === 'driver' && ![bus.driverUserId, bus.attendantUserId].map(Number).includes(Number(req.user.id))) throw forbidden();
  const p = await M.BusPosition.create({ busId: bus.id, ...req.body, recordedAt: new Date() });
  if (bus.status !== 'in_service') await bus.update({ status: 'in_service' });
  const e = eta(bus, p);
  realtime.toBus(currentTenantId(), bus.id, 'bus:position', { busId: bus.id, lat: p.lat, lng: p.lng, speed: p.speed, at: p.recordedAt, eta: e });
  // Alerte « bus proche » pour les familles dont l'arrêt est le suivant
  if (e && bus.stops[e.nextStopIndex]) {
    const stop = bus.stops[e.nextStopIndex];
    if (km({ lat: Number(p.lat), lng: Number(p.lng) }, { lat: Number(stop.lat), lng: Number(stop.lng) }) < 1.5) {
      const assigned = await M.BusAssignment.findAll({ where: { busId: bus.id, stopId: stop.id } });
      const parents = await parentsByStudent(assigned.map(a => a.studentId));
      await notify(Object.values(parents).flat(), { kind: 'bus_near', title: 'Le bus scolaire arrive dans quelques minutes.', body: `${bus.lineName} · arrêt ${stop.name}`, link: '/transport' }, { channels: ['push'] });
    }
  }
  res.status(201).json({ ok: true, eta: e });
}));

/** Scan QR / RFID / NFC à la montée ou descente → notification immédiate aux parents. */
transport.post('/boardings', requirePerm('transport:board', 'transport:write'), validate({ body: z.object({ busId: z.number().int().positive(), studentId: z.number().int().positive(), event: z.enum(['board', 'alight']), method: z.enum(['qr', 'rfid', 'nfc', 'manual']) }) }), asyncHandler(async (req, res) => {
  const assign = await M.BusAssignment.findOne({ where: { studentId: req.body.studentId, busId: req.body.busId }, include: [{ model: M.Student, as: 'student' }, { model: M.Bus, as: 'bus' }, { model: M.BusStop, as: 'stop' }] });
  if (!assign) throw badRequest('Élève non affecté à ce bus');
  const b = await M.BusBoarding.create({ ...req.body, recordedAt: new Date() });
  const parents = await parentsByStudent([req.body.studentId]);
  await notify(parents[req.body.studentId] || [], {
    kind: req.body.event, title: `${assign.student.firstName} est ${req.body.event === 'board' ? 'monté(e) dans' : 'descendu(e) du'} bus.`,
    body: `${assign.bus.lineName} · ${assign.stop.name}`, link: '/transport',
  }, { channels: ['push'] });
  res.status(201).json(b);
}));
transport.patch('/buses/:id', requirePerm('transport:write'), validate({ params: idParam, body: z.object({ delayMinutes: z.number().int().min(0).max(180).optional(), status: z.enum(['in_service', 'parked', 'maintenance']).optional() }) }), asyncHandler(async (req, res) => {
  const bus = await M.Bus.findByPk(req.params.id); if (!bus) throw notFound();
  await bus.update(req.body);
  if (req.body.delayMinutes) {
    const assigned = await M.BusAssignment.findAll({ where: { busId: bus.id } });
    const parents = await parentsByStudent(assigned.map(a => a.studentId));
    await notify(Object.values(parents).flat(), { kind: 'bus_delay', title: `Retard du bus : ${bus.lineName}`, body: `Retard estimé : ${req.body.delayMinutes} min`, link: '/transport' }, { channels: ['push', 'sms'] });
  }
  res.json(bus);
}));
crudRouter({ router: transport, model: M.Bus, resource: 'transport', only: ['create', 'delete'], createSchema: z.object({ lineName: z.string().max(80), plate: z.string().max(20), model: z.string().max(60).optional(), capacity: z.number().int().positive(), color: z.string().max(9).optional(), driverUserId: z.number().int().positive().optional(), attendantUserId: z.number().int().positive().optional() }) });
r.use('/transport', transport);

// =====================================================================
// CANTINE
// =====================================================================
r.get('/canteen/menus', requirePerm('canteen:read'), asyncHandler(async (req, res) => {
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to = req.query.to || new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  res.json({ data: await M.CanteenMenu.findAll({ where: { onDate: { [Op.between]: [from, to] } }, order: [['onDate', 'ASC']] }) });
}));
r.use('/canteen/menus', crudRouter({ model: M.CanteenMenu, resource: 'canteen', only: ['create', 'update', 'delete'], createSchema: z.object({ onDate: date, starter: z.string().max(120).optional(), main: z.string().max(120), side: z.string().max(120).optional(), dessert: z.string().max(120).optional(), vegetarian: z.string().max(120).optional() }) }));

// =====================================================================
// ACTIVITÉS
// =====================================================================
const activities = crudRouter({
  model: M.Activity, resource: 'activities', search: ['name', 'place'], filters: ['kind'], defaultSort: 'startsAt',
  createSchema: z.object({ name: z.string().max(120), kind: z.enum(['Club', 'Sport', 'Sortie', 'Voyage', 'Compétition', 'Événement']), capacity: z.number().int().positive().optional(), priceCents: z.number().int().min(0).default(0), startsAt: z.string().optional(), schedule: z.string().max(80).optional(), place: z.string().max(80).optional(), teacherId: z.number().int().positive().optional() }),
});
activities.post('/:id/enroll', requirePerm('activities:enroll', 'activities:write'), validate({ params: idParam, body: z.object({ studentId: z.number().int().positive() }) }), asyncHandler(async (req, res) => {
  await scope.assertStudentAccess(req.user, req.body.studentId);
  const result = await sequelize.transaction(async transaction => {
    const act = await M.Activity.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!act) throw notFound();
    const n = await M.ActivityEnrollment.count({ where: { activityId: act.id }, transaction });
    if (act.capacity && n >= act.capacity) throw conflict('Activité complète');
    const enr = await M.ActivityEnrollment.create({ activityId: act.id, studentId: req.body.studentId, consentAt: req.user.role === 'parent' ? new Date() : null }, { transaction });
    if (act.priceCents > 0) {
      const count = await M.Invoice.count({ transaction });
      await M.Invoice.create({ number: `ACT-${Date.now().toString(36).toUpperCase()}-${count}`, studentId: req.body.studentId, label: act.name, kind: 'activity', dueOn: new Date(Date.now() + 15 * 86400000), amountCents: act.priceCents }, { transaction });
    }
    return enr;
  });
  res.status(201).json(result);
}));
activities.get('/:id/enrollments', requirePerm('activities:write'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ data: await M.ActivityEnrollment.findAll({ where: { activityId: req.params.id }, include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName'] }] }) });
}));
r.use('/activities', activities);

// =====================================================================
// INFIRMERIE — accès restreint (health:*), chiffrement, lecture auditée
// =====================================================================
const health = express.Router();
health.use(requirePerm('health:read', 'health:*'));
health.get('/visits', asyncHandler(async (req, res) => {
  const rows = await M.InfirmaryVisit.findAll({ order: [['visitedAt', 'DESC']], limit: 100, include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName', 'classId'] }] });
  await auditRead(req, 'Consultation registre infirmerie', 'infirmary_visits', 'list');
  res.json({ data: rows.map(v => { const j = v.toJSON(); return { ...j, reason: decrypt(j.reasonEnc), care: decrypt(j.careEnc), reasonEnc: undefined, careEnc: undefined }; }) });
}));
health.post('/visits', requirePerm('health:write', 'health:*'), validate({ body: z.object({ studentId: z.number().int().positive(), kind: z.enum(['visit', 'accident']).default('visit'), reason: z.string().min(2).max(500), care: z.string().max(1000).optional(), notifyParents: z.boolean().default(true) }) }), asyncHandler(async (req, res) => {
  const { reason, care, notifyParents, ...rest } = req.body;
  const v = await M.InfirmaryVisit.create({ ...rest, visitedAt: new Date(), reasonEnc: encrypt(reason), careEnc: encrypt(care), parentsNotified: notifyParents, nurseUserId: req.user.id });
  if (notifyParents) {
    const s = await M.Student.findByPk(req.body.studentId);
    const parents = await parentsByStudent([s.id]);
    // Le contenu médical n'est PAS envoyé dans la notification : seulement une invitation à contacter l'infirmerie.
    await notify(parents[s.id] || [], { kind: 'health', title: `${s.firstName} est passé(e) à l'infirmerie.`, body: 'Contactez l\'infirmerie pour plus d\'informations.', link: '/communication' }, { channels: rest.kind === 'accident' ? ['push', 'sms'] : ['push'] });
  }
  res.status(201).json({ id: v.id });
}));
health.put('/records/:id', requirePerm('health:write', 'health:*'), validate({ params: idParam, body: z.object({ bloodType: z.string().max(4).optional(), allergies: z.string().max(1000).optional(), notes: z.string().max(4000).optional(), diet: z.string().max(40).optional() }) }), asyncHandler(async (req, res) => {
  const studentId = req.params.id;
  const values = { studentId, bloodType: req.body.bloodType, diet: req.body.diet, allergiesEnc: encrypt(req.body.allergies), notesEnc: encrypt(req.body.notes) };
  const existing = await M.HealthRecord.findOne({ where: { studentId } });
  if (existing) await existing.update(values); else await M.HealthRecord.create(values);
  res.json({ ok: true });
}));
r.use('/health', health);

// =====================================================================
// OBJETS PERDUS / TROUVÉS — correspondances par recherche FULLTEXT MySQL
// =====================================================================
// Seul le déclarant ou le personnel peut modifier une déclaration (ex. « récupéré »).
const lost = express.Router();
lost.patch('/:id', requirePerm('lost:write', 'lost:*'), validate({ params: idParam }), asyncHandler(async (req, res, next) => {
  const item = await M.LostItem.findByPk(req.params.id); if (!item) throw notFound();
  if (!['admin', 'staff'].includes(req.user.role) && Number(item.reportedBy) !== Number(req.user.id)) throw forbidden('Seul le déclarant ou la vie scolaire peut modifier cet objet');
  next();
}));
crudRouter({
  router: lost, model: M.LostItem, resource: 'lost', search: ['description', 'place'], filters: ['kind', 'category', 'status'], defaultSort: '-onDate', writePerm: 'lost:write',
  createSchema: z.object({ kind: z.enum(['lost', 'found']), category: z.enum(['Téléphone', 'Sac', 'Cahier', 'Vêtement', 'Lunettes', 'Clés', 'Carte scolaire', 'Accessoires', 'Autre']), description: z.string().min(3).max(255), place: z.string().max(120).optional(), onDate: date, photoFileId: z.number().int().positive().optional() }),
  updateSchema: z.object({ status: z.enum(['open', 'returned']) }),
  beforeCreate: async (req, { photoFileId, ...data }) => {
    const photo = photoFileId ? await claimFile(req.user, photoFileId, 'lost_photo') : null;
    return { ...data, photoUrl: photo ? fileUrl(photo.id) : null, reportedBy: req.user.id };
  },
});
lost.get('/:id/matches', requirePerm('lost:read', 'lost:*'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const item = await M.LostItem.findByPk(req.params.id); if (!item) throw notFound();
  const text = `${item.description} ${item.place || ''}`;
  const score = literal(`MATCH(description, place) AGAINST(${sequelize.escape(text)} IN NATURAL LANGUAGE MODE)`);
  const rows = await M.LostItem.findAll({
    attributes: { include: [[score, 'score']] },
    where: { kind: item.kind === 'lost' ? 'found' : 'lost', category: item.category, status: 'open', id: { [Op.ne]: item.id } },
    order: [[literal('score'), 'DESC']], limit: 5,
  });
  res.json({ data: rows });
}));
r.use('/lost', lost);

// =====================================================================
// DOCUMENTS (génération PDF à l'en-tête de l'école)
// =====================================================================
r.get('/documents', requirePerm('documents:read'), asyncHandler(async (req, res) => {
  const where = await scope.studentWhere(req.user);
  if (req.query.studentId) where.studentId = req.query.studentId;
  res.json({ data: await M.Document.findAll({ where, order: [['createdAt', 'DESC']], limit: 200, include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName'] }] }) });
}));
r.get('/documents/certificate/:id', requirePerm('documents:read', 'students:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await scope.assertStudentAccess(req.user, req.params.id);
  const s = await M.Student.findByPk(req.params.id, { include: [{ model: M.Class, as: 'class' }] }); if (!s) throw notFound();
  const director = await M.User.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']] });
  pdf.certificate(res, req.tenant, s, s.class, director ? `${director.firstName} ${director.lastName}` : null);
}));

// =====================================================================
// INSCRIPTIONS EN LIGNE
// =====================================================================
const APP_FLOW = { new: ['review', 'rejected'], review: ['accepted', 'rejected', 'new'], accepted: ['enrolled', 'review', 'rejected'], enrolled: [], rejected: ['review'] };
const appSchema = z.object({ studentFirstName: z.string().min(1).max(80), studentLastName: z.string().min(1).max(80), birthDate: date.optional(), levelId: z.number().int().positive().optional(), guardianName: z.string().min(2).max(160), guardianPhone: z.string().max(30).optional(), guardianEmail: z.string().email().optional(), source: z.string().max(40).optional() });

/** Formulaire public (sans compte) — monté avant l'authentification. */
const publicEnrollment = express.Router();
publicEnrollment.post('/', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10 }), validate({ body: appSchema }), asyncHandler(async (req, res) => {
  const a = await M.EnrollmentApplication.create({ ...req.body, status: 'new', source: req.body.source || 'Site web', docs: [] });
  const admins = await M.User.findAll({ where: { role: { [Op.in]: ['admin', 'staff'] } }, attributes: ['id'] });
  await notify(admins.map(u => u.id), { kind: 'enrollment', title: 'Nouvelle demande d\'inscription', body: `${a.studentFirstName} ${a.studentLastName}`, link: '/enrollments' });
  res.status(201).json({ id: a.id, status: a.status });
}));

const enrollments = crudRouter({ model: M.EnrollmentApplication, resource: 'enrollments', only: ['list', 'get', 'create'], filters: ['status', 'levelId'], search: ['studentFirstName', 'studentLastName', 'guardianName'], include: [{ model: M.Level, as: 'level' }], createSchema: appSchema });
enrollments.patch('/:id/status', requirePerm('enrollments:write'), validate({ params: idParam, body: z.object({ status: z.enum(['new', 'review', 'accepted', 'enrolled', 'rejected']), classId: z.number().int().positive().optional() }) }), asyncHandler(async (req, res) => {
  const a = await M.EnrollmentApplication.findByPk(req.params.id); if (!a) throw notFound();
  if (!APP_FLOW[a.status].includes(req.body.status)) throw badRequest(`Transition ${a.status} → ${req.body.status} non autorisée`);
  let student = null;
  await sequelize.transaction(async transaction => {
    if (req.body.status === 'enrolled') {
      if (!req.body.classId) throw badRequest('classId requis pour inscrire l\'élève');
      const count = await M.Student.count({ transaction });
      student = await M.Student.create({ firstName: a.studentFirstName, lastName: a.studentLastName, birthDate: a.birthDate || '2015-01-01', classId: req.body.classId, matricule: `${req.tenant.slug.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`, enrolledOn: new Date() }, { transaction });
      const [first, ...rest] = a.guardianName.split(' ');
      const g = await M.Guardian.create({ firstName: first, lastName: rest.join(' ') || a.studentLastName, phone: a.guardianPhone, email: a.guardianEmail, relation: 'Responsable' }, { transaction });
      await M.StudentGuardian.create({ studentId: student.id, guardianId: g.id, isEmergency: true }, { transaction });
    }
    await a.update({ status: req.body.status }, { transaction });
  });
  res.json({ application: a, student });
}));
r.use('/enrollments', enrollments);

module.exports = { router: r, publicEnrollment };
