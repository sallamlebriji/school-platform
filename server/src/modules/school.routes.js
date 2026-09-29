'use strict';
/**
 * Structure de l'établissement et personnes :
 * niveaux, matières, salles, classes, enseignants, utilisateurs, élèves (fiche 360°), parents.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op, fn, col } = require('sequelize');
const { z } = require('zod');
const M = require('../models');
const { sequelize } = M;
const { crudRouter, idParam } = require('../core/crud');
const { requirePerm } = require('../middlewares/auth');
const { validate, auditRead } = require('../middlewares/common');
const { asyncHandler, notFound, forbidden, badRequest } = require('../core/errors');
const scope = require('../services/scope');
const grading = require('../services/grading');
const { decrypt } = require('../services/security');
const { can } = require('../config/permissions');

const r = express.Router();
const str = (max = 160) => z.string().trim().min(1).max(max);
const optId = z.coerce.number().int().positive().nullable().optional();

// ---------- Référentiels simples ----------
r.use('/levels', crudRouter({ model: M.Level, resource: 'levels', defaultSort: 'position', createSchema: z.object({ name: str(40), cycle: z.enum(['Maternelle', 'Primaire', 'Collège', 'Lycée']), position: z.number().int().default(0) }) }));
r.use('/subjects', crudRouter({ model: M.Subject, resource: 'subjects', defaultSort: 'name', search: ['name'], createSchema: z.object({ name: str(80), shortName: str(20), coefficient: z.number().min(0).max(20).default(1), color: z.string().max(9).optional() }) }));
r.use('/rooms', crudRouter({ model: M.Room, resource: 'rooms', defaultSort: 'name', createSchema: z.object({ name: str(40), capacity: z.number().int().positive().optional() }) }));

// ---------- Utilisateurs (administration des comptes) ----------
const userSchema = z.object({
  role: z.enum(['admin', 'staff', 'accountant', 'teacher', 'nurse', 'parent', 'student', 'driver']),
  email: z.string().email().transform(s => s.toLowerCase()), firstName: str(80), lastName: str(80),
  phone: z.string().max(30).optional(), password: z.string().min(10).optional(),
});
r.use('/users', crudRouter({
  model: M.User, resource: 'users', search: ['email', 'firstName', 'lastName'], filters: ['role', 'status'],
  readPerm: 'users:read', writePerm: 'users:write', createSchema: userSchema,
  updateSchema: userSchema.partial().extend({ status: z.enum(['active', 'invited', 'disabled']).optional() }),
  beforeCreate: async (req, data) => {
    const { password, ...rest } = data;
    return { ...rest, status: password ? 'active' : 'invited', passwordHash: password ? await bcrypt.hash(password, 12) : null };
  },
}));

// ---------- Enseignants ----------
const teacherInclude = [{ model: M.User, as: 'user' }, { model: M.Subject, as: 'subject' }];
r.get('/teachers', requirePerm('teachers:read'), asyncHandler(async (req, res) => {
  const where = req.query.subjectId ? { subjectId: req.query.subjectId } : {};
  const teachers = await M.Teacher.findAll({ where, include: teacherInclude, order: [[{ model: M.User, as: 'user' }, 'lastName', 'ASC']] });
  const counts = await M.ClassSubject.findAll({ attributes: ['teacherId', [fn('COUNT', col('id')), 'classes']], group: ['teacherId'], raw: true });
  const byT = Object.fromEntries(counts.map(c => [c.teacherId, Number(c.classes)]));
  res.json({ data: teachers.map(t => ({ ...t.toJSON(), classCount: byT[t.id] || 0 })) });
}));
r.get('/teachers/:id', requirePerm('teachers:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const t = await M.Teacher.findByPk(req.params.id, { include: teacherInclude });
  if (!t) throw notFound();
  const classes = await M.ClassSubject.findAll({ where: { teacherId: t.id }, include: [{ model: M.Class, as: 'class' }, { model: M.Subject, as: 'subject' }] });
  res.json({ ...t.toJSON(), classes });
}));
r.post('/teachers', requirePerm('teachers:write'), validate({ body: userSchema.omit({ role: true }).extend({ subjectId: optId, hiredOn: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const { subjectId, hiredOn, password, ...u } = req.body;
  const teacher = await sequelize.transaction(async transaction => {
    const user = await M.User.create({ ...u, role: 'teacher', status: password ? 'active' : 'invited', passwordHash: password ? await bcrypt.hash(password, 12) : null }, { transaction });
    return M.Teacher.create({ userId: user.id, subjectId, hiredOn }, { transaction });
  });
  res.status(201).json(await M.Teacher.findByPk(teacher.id, { include: teacherInclude }));
}));
r.patch('/teachers/:id', requirePerm('teachers:write'), validate({ params: idParam, body: z.object({ subjectId: optId, status: z.enum(['active', 'absent', 'left']).optional() }) }), asyncHandler(async (req, res) => {
  const t = await M.Teacher.findByPk(req.params.id); if (!t) throw notFound();
  res.json(await t.update(req.body));
}));

// ---------- Classes ----------
r.get('/classes', requirePerm('classes:read'), asyncHandler(async (req, res) => {
  const allowed = await scope.allowedClassIds(req.user);
  const where = allowed === null ? {} : { id: { [Op.in]: allowed.length ? allowed : [0] } };
  if (req.query.levelId) where.levelId = req.query.levelId;
  const classes = await M.Class.findAll({
    where, order: [[{ model: M.Level, as: 'level' }, 'position', 'ASC'], ['name', 'ASC']],
    include: [{ model: M.Level, as: 'level' }, { model: M.Room, as: 'room' }, { model: M.Teacher, as: 'mainTeacher', include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] }],
  });
  const stats = await M.Student.findAll({ attributes: ['classId', 'gender', [fn('COUNT', col('id')), 'n']], where: { status: 'enrolled' }, group: ['classId', 'gender'], raw: true });
  res.json({
    data: classes.map(c => {
      const s = stats.filter(x => Number(x.classId) === Number(c.id));
      const girls = s.filter(x => x.gender === 'F').reduce((a, x) => a + Number(x.n), 0);
      return { ...c.toJSON(), studentCount: s.reduce((a, x) => a + Number(x.n), 0), girls };
    }),
  });
}));
r.get('/classes/:id', requirePerm('classes:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await scope.assertClassAccess(req.user, req.params.id);
  const c = await M.Class.findByPk(req.params.id, {
    include: [
      { model: M.Level, as: 'level' }, { model: M.Room, as: 'room' },
      { model: M.Student, as: 'students', separate: true, order: [['lastName', 'ASC']] },
      { model: M.ClassSubject, as: 'classSubjects', include: [{ model: M.Subject, as: 'subject' }, { model: M.Teacher, as: 'teacher', include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] }] },
    ],
  });
  if (!c) throw notFound();
  const averages = ['parent', 'student'].includes(req.user.role) ? null : await grading.classAverages(c.id, Number(req.query.term) || 1);
  res.json({ ...c.toJSON(), averages });
}));
const classSchema = z.object({ levelId: z.coerce.number().int().positive(), name: str(40), schoolYear: z.string().regex(/^\d{4}-\d{4}$/), capacity: z.number().int().positive().default(30), roomId: optId, mainTeacherId: optId });
r.use('/classes', crudRouter({ model: M.Class, resource: 'classes', only: ['create', 'update', 'delete'], createSchema: classSchema, updateSchema: classSchema.partial() }));
r.put('/classes/:id/subjects', requirePerm('classes:write'), validate({ params: idParam, body: z.array(z.object({ subjectId: z.number().int().positive(), teacherId: optId, weeklyHours: z.number().int().min(0).max(15).default(2) })) }), asyncHandler(async (req, res) => {
  await sequelize.transaction(async transaction => {
    await M.ClassSubject.destroy({ where: { classId: req.params.id }, transaction });
    await M.ClassSubject.bulkCreate(req.body.map(x => ({ ...x, classId: req.params.id })), { transaction });
  });
  res.json(await M.ClassSubject.findAll({ where: { classId: req.params.id }, include: [{ model: M.Subject, as: 'subject' }] }));
}));

// ---------- Élèves ----------
const studentSchema = z.object({
  firstName: str(80), lastName: str(80), gender: z.enum(['F', 'M']).optional(), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId: optId, address: z.string().max(255).optional(), usesCanteen: z.boolean().optional(),
  status: z.enum(['enrolled', 'pending', 'left']).optional(),
});
r.get('/students', requirePerm('students:read'), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(200, Number(req.query.limit) || 25);
  const where = { ...(await scope.studentWhere(req.user, 'id')) };
  if (req.query.classId) where.classId = req.query.classId;
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) where[Op.or] = ['firstName', 'lastName', 'matricule'].map(f => ({ [f]: { [Op.like]: `%${req.query.q}%` } }));
  const levelWhere = req.query.cycle ? { cycle: req.query.cycle } : undefined;
  const { rows, count } = await M.Student.findAndCountAll({
    where, limit, offset: (page - 1) * limit, order: [['lastName', 'ASC'], ['firstName', 'ASC']], distinct: true,
    include: [{ model: M.Class, as: 'class', attributes: ['id', 'name'], required: !!levelWhere, include: [{ model: M.Level, as: 'level', attributes: ['name', 'cycle'], where: levelWhere }] }],
  });
  // statut de paiement agrégé
  const ids = rows.map(s => s.id);
  const inv = ids.length ? await M.Invoice.findAll({ attributes: ['studentId', 'status', [fn('COUNT', col('id')), 'n']], where: { studentId: { [Op.in]: ids }, status: { [Op.in]: ['due', 'overdue'] } }, group: ['studentId', 'status'], raw: true }) : [];
  res.json({
    data: rows.map(s => { const x = inv.filter(i => Number(i.studentId) === Number(s.id)); return { ...s.toJSON(), paymentStatus: x.some(i => i.status === 'overdue') ? 'overdue' : x.length ? 'due' : 'paid' }; }),
    total: count, page, limit,
  });
}));

// ---------- Import Excel ----------
const studentImport = require('../services/studentImport');
const { claimFile } = require('./files.routes');
r.get('/students/import/template.xlsx', requirePerm('students:write'), asyncHandler(async (req, res) => {
  const buf = await studentImport.template(await M.Class.findAll({ order: [['name', 'ASC']] }));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="modele-import-eleves.xlsx"');
  res.send(Buffer.from(buf));
}));
r.post('/students/import', requirePerm('students:write'), validate({ body: z.object({ fileId: z.number().int().positive(), commit: z.boolean().default(false) }) }), asyncHandler(async (req, res) => {
  const file = await claimFile(req.user, req.body.fileId, 'import');
  const result = await studentImport.importStudents(file, { commit: req.body.commit, tenantSlug: req.tenant.slug });
  res.status(result.error && !result.rows ? 400 : 200).json(result);
}));

/** Fiche élève 360° */
r.get('/students/:id', requirePerm('students:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await scope.assertStudentAccess(req.user, req.params.id);
  const s = await M.Student.findByPk(req.params.id, {
    include: [
      { model: M.Class, as: 'class', include: [{ model: M.Level, as: 'level' }, { model: M.Teacher, as: 'mainTeacher', include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] }] },
      { model: M.StudentGuardian, as: 'guardianLinks', include: [{ model: M.Guardian, as: 'guardian' }] },
      { model: M.BusAssignment, as: 'busAssignment', include: [{ model: M.Bus, as: 'bus', attributes: ['id', 'lineName', 'plate'] }, { model: M.BusStop, as: 'stop' }] },
    ],
  });
  if (!s) throw notFound();
  const [averages, attendance, invoices, activities, documents] = await Promise.all([
    grading.studentAverages(s),
    M.Attendance.findAll({ where: { studentId: s.id, status: { [Op.ne]: 'present' } }, order: [['onDate', 'DESC']], limit: 50 }),
    can(req.user.role, 'finance:read') ? M.Invoice.findAll({ where: { studentId: s.id }, order: [['dueOn', 'DESC']] }) : [],
    M.ActivityEnrollment.findAll({ where: { studentId: s.id }, include: [{ model: M.Activity, as: 'activity' }] }),
    M.Document.findAll({ where: { studentId: s.id }, order: [['createdAt', 'DESC']] }),
  ]);
  let health = null;
  if (can(req.user.role, 'health:read')) {
    const h = await M.HealthRecord.findOne({ where: { studentId: s.id } });
    if (h) { health = { bloodType: h.bloodType, diet: h.diet, allergies: decrypt(h.allergiesEnc), notes: decrypt(h.notesEnc) }; await auditRead(req, 'Consultation dossier médical', 'health_records', s.id); }
  }
  res.json({ ...s.toJSON(), averages, attendance, invoices, activities, documents, health });
}));

r.post('/students', requirePerm('students:write'), validate({ body: studentSchema }), asyncHandler(async (req, res) => {
  const year = new Date().getFullYear();
  const count = await M.Student.count();
  const matricule = `${req.tenant.slug.slice(0, 3).toUpperCase()}-${year}-${String(count + 1).padStart(5, '0')}`;
  if (req.body.classId) {
    const c = await M.Class.findByPk(req.body.classId);
    if (!c) throw badRequest('Classe inconnue');
    const n = await M.Student.count({ where: { classId: c.id, status: 'enrolled' } });
    if (n >= c.capacity) throw badRequest(`Capacité maximale atteinte pour ${c.name}`);
  }
  const s = await M.Student.create({ ...req.body, matricule, enrolledOn: new Date() });
  res.status(201).json(s);
}));
r.patch('/students/:id', requirePerm('students:write'), validate({ params: idParam, body: studentSchema.partial() }), asyncHandler(async (req, res) => {
  const s = await M.Student.findByPk(req.params.id); if (!s) throw notFound();
  res.json(await s.update(req.body));
}));
r.delete('/students/:id', requirePerm('students:write'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const s = await M.Student.findByPk(req.params.id); if (!s) throw notFound();
  await s.update({ status: 'left' }); // archivage, jamais de suppression physique du dossier scolaire
  res.status(204).end();
}));

// ---------- Parents / responsables ----------
r.get('/guardians', requirePerm('guardians:read'), asyncHandler(async (req, res) => {
  const where = req.query.q ? { [Op.or]: ['firstName', 'lastName', 'email', 'phone'].map(f => ({ [f]: { [Op.like]: `%${req.query.q}%` } })) } : {};
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Number(req.query.limit) || 25);
  const { rows, count } = await M.Guardian.findAndCountAll({
    where, limit, offset: (page - 1) * limit, distinct: true, order: [['lastName', 'ASC']],
    include: [{ model: M.StudentGuardian, as: 'childLinks', include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName', 'classId'], include: [{ model: M.Class, as: 'class', attributes: ['name'] }] }] }, { model: M.User, as: 'user', attributes: ['id', 'status', 'lastLoginAt'] }],
  });
  res.json({ data: rows, total: count, page, limit });
}));
r.post('/guardians', requirePerm('guardians:write'), validate({ body: z.object({
  firstName: str(80), lastName: str(80), relation: z.string().max(30).optional(), phone: z.string().max(30).optional(),
  email: z.string().email().optional(), job: z.string().max(80).optional(), studentIds: z.array(z.number().int().positive()).default([]), createAccount: z.boolean().default(false),
}) }), asyncHandler(async (req, res) => {
  const { studentIds, createAccount, ...g } = req.body;
  const guardian = await sequelize.transaction(async transaction => {
    let userId = null;
    if (createAccount) {
      if (!g.email) throw badRequest('Email requis pour créer un compte');
      userId = (await M.User.create({ role: 'parent', email: g.email.toLowerCase(), firstName: g.firstName, lastName: g.lastName, phone: g.phone, status: 'invited' }, { transaction })).id;
    }
    const row = await M.Guardian.create({ ...g, userId }, { transaction });
    if (studentIds.length) await M.StudentGuardian.bulkCreate(studentIds.map(studentId => ({ studentId, guardianId: row.id })), { transaction });
    return row;
  });
  res.status(201).json(guardian);
}));
r.use('/guardians', crudRouter({ model: M.Guardian, resource: 'guardians', only: ['get', 'update', 'delete'] }));

module.exports = r;
