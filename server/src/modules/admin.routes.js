'use strict';
/**
 * Finance, communication, calendrier, support, notifications,
 * tableaux de bord, analytics, paramètres de l'établissement, audit, IA.
 */
const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { z } = require('zod');
const M = require('../models');
const { sequelize } = M;
const { crudRouter, idParam } = require('../core/crud');
const { requirePerm, requireRole } = require('../middlewares/auth');
const { requireFeature, invalidateTenantCache } = require('../middlewares/tenant');
const { validate } = require('../middlewares/common');
const { asyncHandler, notFound, forbidden, badRequest } = require('../core/errors');
const scope = require('../services/scope');
const grading = require('../services/grading');
const realtime = require('../services/realtime');
const ai = require('../services/ai');
const pdf = require('../services/pdf');
const { claimFile, fileUrl } = require('./files.routes');
const { notify, parentsByStudent } = require('../services/notifier');
const { can } = require('../config/permissions');
const { currentTenantId } = require('../core/context');
const config = require('../config/env');

const r = express.Router();
const today = () => new Date().toISOString().slice(0, 10);

// =====================================================================
// FINANCE
// =====================================================================
r.get('/finance/invoices', requirePerm('finance:read'), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(200, Number(req.query.limit) || 25);
  const where = { ...(await scope.studentWhere(req.user)) };
  if (req.query.status) where.status = req.query.status;
  if (req.query.studentId) where.studentId = req.query.studentId;
  const studentWhere = req.query.q ? { [Op.or]: [{ firstName: { [Op.like]: `%${req.query.q}%` } }, { lastName: { [Op.like]: `%${req.query.q}%` } }] } : undefined;
  const { rows, count } = await M.Invoice.findAndCountAll({ where, limit, offset: (page - 1) * limit, order: [['dueOn', 'DESC'], ['id', 'DESC']], include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName', 'classId'], where: studentWhere }] });
  res.json({ data: rows, total: count, page, limit });
}));

r.get('/finance/stats', requirePerm('finance:*', 'analytics:read'), asyncHandler(async (req, res) => {
  const byStatus = await M.Invoice.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount_cents')), 'amount']], group: ['status'], raw: true });
  const byMonth = await M.Payment.findAll({ attributes: [[fn('DATE_FORMAT', col('paid_at'), '%Y-%m'), 'month'], [fn('SUM', col('amount_cents')), 'amount']], where: { paidAt: { [Op.gte]: new Date(Date.now() - 365 * 86400000) } }, group: [literal('month')], order: [[literal('month'), 'ASC']], raw: true });
  const byKind = await M.Invoice.findAll({ attributes: ['kind', [fn('SUM', col('amount_cents')), 'amount']], where: { status: 'paid' }, group: ['kind'], raw: true });
  const s = k => byStatus.find(x => x.status === k) || { count: 0, amount: 0 };
  const paid = Number(s('paid').amount || 0), due = Number(s('due').amount || 0), overdue = Number(s('overdue').amount || 0);
  res.json({
    currency: req.tenant.currency, paidCents: paid, dueCents: due, overdueCents: overdue,
    collectionRate: paid + due + overdue ? Math.round(paid / (paid + due + overdue) * 1000) / 10 : null,
    byStatus, byKind, revenueByMonth: byMonth.map(m => ({ month: m.month, amountCents: Number(m.amount) })),
  });
}));

/** Encaissement au guichet (espèces, chèque, virement). Les familles paient via /checkout. */
r.post('/finance/invoices/:id/pay', requirePerm('finance:write'), validate({ params: idParam, body: z.object({ method: z.enum(['card', 'transfer', 'cash', 'cheque', 'direct_debit']), providerRef: z.string().max(80).optional() }) }), asyncHandler(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id); if (!inv) throw notFound();
  await scope.assertStudentAccess(req.user, inv.studentId);
  if (inv.status === 'paid') throw badRequest('Facture déjà réglée');
  const payment = await sequelize.transaction(async transaction => {
    const p = await M.Payment.create({ invoiceId: inv.id, amountCents: inv.amountCents, method: req.body.method, providerRef: req.body.providerRef, paidAt: new Date(), recordedBy: req.user.id }, { transaction });
    await inv.update({ status: 'paid', paidAt: new Date() }, { transaction });
    return p;
  });
  const parents = await parentsByStudent([inv.studentId]);
  await notify(parents[inv.studentId] || [], { kind: 'payment', title: 'Paiement reçu — merci !', body: `${inv.label} · reçu disponible`, link: '/finance' }, { channels: ['email'] });
  res.json({ invoice: inv, payment });
}));

r.post('/finance/reminders', requirePerm('finance:write'), asyncHandler(async (req, res) => {
  const overdue = await M.Invoice.findAll({ where: { status: { [Op.in]: ['due', 'overdue'] }, dueOn: { [Op.lt]: today() } } });
  await M.Invoice.update({ status: 'overdue' }, { where: { status: 'due', dueOn: { [Op.lt]: today() } } });
  const parents = await parentsByStudent([...new Set(overdue.map(i => i.studentId))]);
  let sent = 0;
  for (const inv of overdue) sent += await notify(parents[inv.studentId] || [], { kind: 'payment_due', title: 'Le paiement du mois est en attente.', body: `${inv.label} · échéance ${inv.dueOn}`, link: '/finance' }, { channels: ['email', 'sms'] });
  res.json({ invoices: overdue.length, notifications: sent });
}));

r.get('/finance/invoices/:id/receipt.pdf', requirePerm('finance:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const inv = await M.Invoice.findByPk(req.params.id, { include: [{ model: M.Student, as: 'student' }, { model: M.Payment, as: 'payments' }] }); if (!inv) throw notFound();
  await scope.assertStudentAccess(req.user, inv.studentId);
  if (inv.status !== 'paid') throw badRequest('Reçu disponible après paiement');
  pdf.receipt(res, req.tenant, inv, inv.student, inv.payments[inv.payments.length - 1]);
}));

// =====================================================================
// MESSAGERIE (temps réel)
// =====================================================================
const isMember = (convId, userId) => M.ConversationMember.findOne({ where: { conversationId: convId, userId } });

r.get('/conversations', requirePerm('messages:read', 'messages:*'), asyncHandler(async (req, res) => {
  const mine = await M.ConversationMember.findAll({ where: { userId: req.user.id }, attributes: ['conversationId', 'lastReadAt'] });
  const ids = mine.map(m => m.conversationId);
  const convs = await M.Conversation.findAll({ where: { id: { [Op.in]: ids.concat(0) } }, include: [{ model: M.ConversationMember, as: 'members', include: [{ model: M.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role'] }] }], order: [['updatedAt', 'DESC']] });
  const last = await M.Message.findAll({ where: { id: { [Op.in]: literal(`(SELECT MAX(id) FROM messages WHERE tenant_id = ${Number(currentTenantId())} GROUP BY conversation_id)`) }, conversationId: { [Op.in]: ids.concat(0) } } });
  res.json({ data: convs.map(c => ({ ...c.toJSON(), lastMessage: last.find(m => Number(m.conversationId) === Number(c.id)) || null, lastReadAt: (mine.find(m => Number(m.conversationId) === Number(c.id)) || {}).lastReadAt })) });
}));
r.post('/conversations', requirePerm('messages:write', 'messages:*'), validate({ body: z.object({ userIds: z.array(z.number().int().positive()).min(1).max(200), title: z.string().max(160).optional() }) }), asyncHandler(async (req, res) => {
  const users = await M.User.count({ where: { id: { [Op.in]: req.body.userIds } } });
  if (users !== req.body.userIds.length) throw badRequest('Destinataire inconnu');
  const conv = await sequelize.transaction(async transaction => {
    const c = await M.Conversation.create({ title: req.body.title, kind: req.body.userIds.length > 1 ? 'group' : 'direct' }, { transaction });
    await M.ConversationMember.bulkCreate([...new Set([req.user.id, ...req.body.userIds])].map(userId => ({ conversationId: c.id, userId })), { transaction });
    return c;
  });
  res.status(201).json(conv);
}));
r.get('/conversations/:id/messages', requirePerm('messages:read', 'messages:*'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const member = await isMember(req.params.id, req.user.id); if (!member) throw forbidden();
  await member.update({ lastReadAt: new Date() });
  res.json({ data: await M.Message.findAll({ where: { conversationId: req.params.id }, order: [['id', 'ASC']], limit: 200, include: [{ model: M.User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'role'] }] }) });
}));
r.post('/conversations/:id/messages', requirePerm('messages:write', 'messages:*'), validate({ params: idParam, body: z.object({ body: z.string().trim().min(1).max(5000) }) }), asyncHandler(async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) throw forbidden();
  const msg = await M.Message.create({ conversationId: req.params.id, senderId: req.user.id, body: req.body.body });
  await M.Conversation.update({ updatedAt: new Date() }, { where: { id: req.params.id } });
  const full = await M.Message.findByPk(msg.id, { include: [{ model: M.User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'role'] }] });
  realtime.toConversation(currentTenantId(), req.params.id, 'message', full);
  res.status(201).json(full);
}));

// ---------- Annonces ----------
const announcements = crudRouter({
  model: M.Announcement, resource: 'announcements', defaultSort: '-publishedAt', search: ['title'],
  createSchema: z.object({ title: z.string().min(1).max(160), body: z.string().min(1).max(10000), audience: z.enum(['all', 'parents', 'teachers', 'students', 'staff']).default('all'), channels: z.array(z.enum(['app', 'email', 'push', 'sms'])).default(['app', 'push']), pinned: z.boolean().default(false) }),
  beforeCreate: async (req, data) => ({ ...data, publishedAt: new Date(), authorId: req.user.id }),
  afterCreate: async (req, a) => {
    const roles = { all: undefined, parents: ['parent'], teachers: ['teacher'], students: ['student'], staff: ['admin', 'staff', 'accountant', 'nurse'] }[a.audience];
    const users = await M.User.findAll({ where: { status: 'active', ...(roles ? { role: { [Op.in]: roles } } : {}) }, attributes: ['id'] });
    await notify(users.map(u => u.id), { kind: 'announcement', title: a.title, body: a.body.slice(0, 200), link: '/communication' }, { channels: (a.channels || []).filter(c => c !== 'app') });
  },
});
r.use('/announcements', announcements);

// ---------- Calendrier ----------
r.get('/events', requirePerm('events:read'), asyncHandler(async (req, res) => {
  const from = req.query.from || new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  const to = req.query.to || new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  res.json({ data: await M.Event.findAll({ where: { startsAt: { [Op.between]: [from, to + ' 23:59:59'] } }, order: [['startsAt', 'ASC']] }) });
}));
r.use('/events', crudRouter({ model: M.Event, resource: 'events', only: ['create', 'update', 'delete'], createSchema: z.object({ title: z.string().max(160), kind: z.enum(['Vacances', 'Examen', 'Contrôle', 'Réunion', 'Événement', 'Sortie', 'Activité', 'Conseil']), startsAt: z.string(), endsAt: z.string().optional(), audience: z.string().max(80).default('all') }) }));

// ---------- Support / réclamations ----------
const TK_FLOW = { new: ['in_progress', 'resolved', 'closed'], in_progress: ['resolved', 'closed'], resolved: ['closed', 'in_progress'], closed: [] };
const ticketScope = req => (can(req.user.role, 'users:read') || req.user.role === 'staff' ? {} : { authorId: req.user.id });
r.get('/tickets', requirePerm('tickets:read', 'tickets:*'), asyncHandler(async (req, res) => {
  const where = { ...ticketScope(req) };
  if (req.query.status) where.status = req.query.status;
  res.json({ data: await M.Ticket.findAll({ where, order: [['updatedAt', 'DESC']], include: [{ model: M.User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'role'] }] }) });
}));
r.post('/tickets', requirePerm('tickets:write', 'tickets:*'), validate({ body: z.object({ subject: z.string().min(3).max(200), category: z.string().max(40), priority: z.enum(['low', 'normal', 'high']).default('normal'), body: z.string().min(1).max(5000) }) }), asyncHandler(async (req, res) => {
  const t = await sequelize.transaction(async transaction => {
    const n = await M.Ticket.count({ transaction });
    const tk = await M.Ticket.create({ number: `TK-${String(1000 + n + 1)}`, authorId: req.user.id, category: req.body.category, priority: req.body.priority, subject: req.body.subject }, { transaction });
    await M.TicketMessage.create({ ticketId: tk.id, authorId: req.user.id, body: req.body.body }, { transaction });
    return tk;
  });
  res.status(201).json(t);
}));
r.get('/tickets/:id', requirePerm('tickets:read', 'tickets:*'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const t = await M.Ticket.findOne({ where: { id: req.params.id, ...ticketScope(req) }, include: [{ model: M.User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'role'] }, { model: M.TicketMessage, as: 'messages', separate: true, order: [['id', 'ASC']], include: [{ model: M.User, as: 'author', attributes: ['id', 'firstName', 'lastName', 'role'] }] }] });
  if (!t) throw notFound();
  res.json(t);
}));
r.post('/tickets/:id/messages', requirePerm('tickets:write', 'tickets:*'), validate({ params: idParam, body: z.object({ body: z.string().min(1).max(5000) }) }), asyncHandler(async (req, res) => {
  const t = await M.Ticket.findOne({ where: { id: req.params.id, ...ticketScope(req) } }); if (!t) throw notFound();
  const m = await M.TicketMessage.create({ ticketId: t.id, authorId: req.user.id, body: req.body.body });
  if (Number(t.authorId) !== Number(req.user.id)) await notify([t.authorId], { kind: 'ticket', title: `Réponse à votre demande ${t.number}`, body: req.body.body.slice(0, 200), link: '/support' });
  res.status(201).json(m);
}));
r.patch('/tickets/:id/status', requireRole('admin', 'staff', 'accountant'), validate({ params: idParam, body: z.object({ status: z.enum(['new', 'in_progress', 'resolved', 'closed']) }) }), asyncHandler(async (req, res) => {
  const t = await M.Ticket.findByPk(req.params.id); if (!t) throw notFound();
  if (!TK_FLOW[t.status].includes(req.body.status)) throw badRequest(`Transition ${t.status} → ${req.body.status} non autorisée`);
  await t.update({ status: req.body.status });
  await notify([t.authorId], { kind: 'ticket', title: `Demande ${t.number} : ${{ in_progress: 'en cours', resolved: 'résolue', closed: 'fermée', new: 'rouverte' }[req.body.status]}`, link: '/support' });
  res.json(t);
}));

// ---------- Push navigateur ----------
const channels = require('../services/channels');
const crypto = require('crypto');
r.get('/push/public-key', (req, res) => res.json({ enabled: channels.pushEnabled, publicKey: config.push.publicKey || null }));
r.post('/push/subscribe', validate({ body: z.object({ endpoint: z.string().url().max(700), keys: z.object({ p256dh: z.string().max(255), auth: z.string().max(255) }) }) }), asyncHandler(async (req, res) => {
  const endpointHash = crypto.createHash('sha256').update(req.body.endpoint).digest('hex');
  const existing = await M.PushSubscription.findOne({ where: { endpointHash } });
  const values = { userId: req.user.id, endpoint: req.body.endpoint, endpointHash, p256dh: req.body.keys.p256dh, auth: req.body.keys.auth, userAgent: (req.get('User-Agent') || '').slice(0, 255) };
  if (existing) await existing.update(values); else await M.PushSubscription.create(values);
  res.status(201).json({ ok: true });
}));
r.delete('/push/subscribe', validate({ body: z.object({ endpoint: z.string().url().max(700) }) }), asyncHandler(async (req, res) => {
  const endpointHash = crypto.createHash('sha256').update(req.body.endpoint).digest('hex');
  await M.PushSubscription.destroy({ where: { endpointHash, userId: req.user.id } });
  res.status(204).end();
}));
r.post('/push/test', asyncHandler(async (req, res) => {
  await notify([req.user.id], { kind: 'test', title: 'Notifications activées ✓', body: 'Vous recevrez désormais les alertes de l\'école sur cet appareil.', link: '/' }, { channels: ['push'], wait: true });
  res.json({ ok: true });
}));

// ---------- Historique des envois (direction) ----------
r.get('/notifications/deliveries', requireRole('admin'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.channel) where.channel = req.query.channel;
  if (req.query.status) where.status = req.query.status;
  const [data, stats] = await Promise.all([
    M.NotificationDelivery.findAll({ where, order: [['id', 'DESC']], limit: Math.min(200, Number(req.query.limit) || 100), include: [{ model: M.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role'] }] }),
    M.NotificationDelivery.findAll({ attributes: ['channel', 'status', [fn('COUNT', col('id')), 'n']], group: ['channel', 'status'], raw: true }),
  ]);
  res.json({ data, stats });
}));

// ---------- Notifications ----------
r.get('/notifications', asyncHandler(async (req, res) => {
  const [data, unread] = await Promise.all([
    M.Notification.findAll({ where: { userId: req.user.id }, order: [['id', 'DESC']], limit: 50 }),
    M.Notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  res.json({ data, unread });
}));
r.post('/notifications/read', asyncHandler(async (req, res) => {
  await M.Notification.update({ readAt: new Date() }, { where: { userId: req.user.id, readAt: null } });
  res.json({ ok: true });
}));

// =====================================================================
// TABLEAUX DE BORD
// =====================================================================
r.get('/dashboard', requirePerm('dashboard:read'), asyncHandler(async (req, res) => {
  const u = req.user, d = today();
  if (['admin', 'staff', 'accountant'].includes(u.role)) {
    const [students, teachers, classes, absences, lates, pendingInv, newApps, openTickets, buses, missingDocs, revenue, enrolledByYear, byCycle] = await Promise.all([
      M.Student.count({ where: { status: 'enrolled' } }),
      M.Teacher.count({ where: { status: { [Op.ne]: 'left' } } }),
      M.Class.count(),
      M.Attendance.findAll({ where: { onDate: d, status: 'absent' }, attributes: ['justified'] }),
      M.Attendance.count({ where: { onDate: d, status: 'late' } }),
      M.Invoice.findAll({ where: { status: { [Op.in]: ['due', 'overdue'] }, dueOn: { [Op.lte]: d } }, attributes: [[fn('COUNT', col('id')), 'n'], [fn('SUM', col('amount_cents')), 'amount']], raw: true }),
      M.EnrollmentApplication.count({ where: { status: { [Op.in]: ['new', 'review'] } } }),
      M.Ticket.count({ where: { status: { [Op.in]: ['new', 'in_progress'] } } }),
      M.Bus.findAll({ attributes: ['id', 'lineName', 'status', 'delayMinutes'] }),
      M.EnrollmentApplication.count({ where: { status: 'accepted', paid: false } }),
      M.Payment.findAll({ attributes: [[fn('DATE_FORMAT', col('paid_at'), '%Y-%m'), 'month'], [fn('SUM', col('amount_cents')), 'amount']], where: { paidAt: { [Op.gte]: new Date(Date.now() - 365 * 86400000) } }, group: [literal('month')], order: [[literal('month'), 'ASC']], raw: true }),
      M.Student.findAll({ attributes: [[fn('YEAR', col('enrolled_on')), 'year'], [fn('COUNT', col('id')), 'n']], group: [literal('year')], order: [[literal('year'), 'ASC']], raw: true }),
      M.Student.findAll({ attributes: [[col('class->level.cycle'), 'cycle'], [fn('COUNT', col('Student.id')), 'n']], include: [{ model: M.Class, as: 'class', attributes: [], include: [{ model: M.Level, as: 'level', attributes: [] }] }], where: { status: 'enrolled' }, group: [col('class->level.cycle')], raw: true }),
    ]);
    const presence = students ? Math.round((1 - absences.length / students) * 1000) / 10 : null;
    return res.json({
      role: 'admin',
      kpis: { students, teachers, classes, presence, absences: absences.length, unjustified: absences.filter(a => !a.justified).length, lates, pendingPayments: Number(pendingInv[0].n || 0), pendingAmountCents: Number(pendingInv[0].amount || 0), newApplications: newApps, openTickets, busesInService: buses.filter(b => b.status === 'in_service').length, buses: buses.length },
      todo: { payments: Number(pendingInv[0].n || 0), unjustifiedAbsences: absences.filter(a => !a.justified).length, missingDocuments: missingDocs, applications: newApps, tickets: openTickets, transportAlerts: buses.filter(b => b.delayMinutes > 0).length },
      charts: { revenueByMonth: revenue.map(x => ({ month: x.month, amountCents: Number(x.amount) })), enrolledByYear: enrolledByYear.map(x => ({ year: x.year, count: Number(x.n) })), byCycle: byCycle.map(x => ({ cycle: x.cycle, count: Number(x.n) })) },
      alerts: buses.filter(b => b.delayMinutes > 0).map(b => ({ kind: 'transport', title: `${b.lineName} : +${b.delayMinutes} min` })),
      recent: await M.AuditLog.findAll({ order: [['id', 'DESC']], limit: 8, include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] }),
    });
  }
  if (u.role === 'teacher') {
    const t = await M.Teacher.findOne({ where: { userId: u.id } });
    const classIds = await scope.teacherClassIds(u);
    const weekday = ((new Date().getDay() + 6) % 7) + 1;
    const [todaySlots, homework, classes] = await Promise.all([
      M.TimetableSlot.findAll({ where: { teacherId: t ? t.id : 0, weekday }, include: [{ model: M.Class, as: 'class', attributes: ['id', 'name'] }, { model: M.Subject, as: 'subject' }, { model: M.Room, as: 'room' }], order: [['startTime', 'ASC']] }),
      M.Homework.findAll({ where: { teacherId: t ? t.id : 0 }, include: [{ model: M.HomeworkSubmission, as: 'submissions', attributes: ['status'] }], order: [['dueAt', 'DESC']], limit: 10 }),
      M.Class.findAll({ where: { id: { [Op.in]: classIds.concat(0) } } }),
    ]);
    return res.json({ role: 'teacher', today: todaySlots, homework: homework.map(h => ({ id: h.id, title: h.title, dueAt: h.dueAt, toGrade: h.submissions.filter(s => ['submitted', 'late'].includes(s.status)).length, total: h.submissions.length })), classes });
  }
  // parent / élève
  const ids = await scope.allowedStudentIds(u);
  const children = await M.Student.findAll({ where: { id: { [Op.in]: ids.concat(0) } }, include: [{ model: M.Class, as: 'class', attributes: ['id', 'name'] }, { model: M.BusAssignment, as: 'busAssignment', include: [{ model: M.Bus, as: 'bus', attributes: ['id', 'lineName', 'delayMinutes'] }, { model: M.BusStop, as: 'stop' }] }] });
  const out = [];
  for (const c of children) {
    const [avg, absToday, homework, invoices] = await Promise.all([
      grading.studentAverages(c),
      M.Attendance.findOne({ where: { studentId: c.id, onDate: d, status: 'absent' } }),
      M.Homework.findAll({ where: { classId: c.classId || 0, dueAt: { [Op.gte]: new Date() } }, include: [{ model: M.Subject, as: 'subject' }], order: [['dueAt', 'ASC']], limit: 5 }),
      M.Invoice.findAll({ where: { studentId: c.id, status: { [Op.in]: ['due', 'overdue'] } } }),
    ]);
    out.push({ student: c, average: avg && avg.general, rank: avg && avg.rank, absentToday: !!absToday, homework, pendingInvoices: invoices });
  }
  const [announcements, menu, events] = await Promise.all([
    M.Announcement.findAll({ order: [['pinned', 'DESC'], ['publishedAt', 'DESC']], limit: 4 }),
    M.CanteenMenu.findOne({ where: { onDate: d } }),
    M.Event.findAll({ where: { startsAt: { [Op.gte]: d } }, order: [['startsAt', 'ASC']], limit: 5 }),
  ]);
  res.json({ role: u.role, children: out, announcements, menu, events });
}));

// =====================================================================
// ANALYTICS (plan Premium)
// =====================================================================
r.get('/analytics/overview', requireFeature('analytics'), requirePerm('analytics:read'), asyncHandler(async (req, res) => {
  const classWhere = {};
  if (req.query.levelId) classWhere.levelId = req.query.levelId;
  if (req.query.classId) classWhere.id = req.query.classId;
  const classes = await M.Class.findAll({ where: classWhere, include: [{ model: M.Level, as: 'level' }] });
  const classIds = classes.map(c => c.id).concat(0);
  const tid = Number(currentTenantId());
  const [perfBySubject, attendanceByWeek, payment] = await Promise.all([
    sequelize.query(`
      SELECT e.class_id AS classId, e.subject_id AS subjectId, ROUND(SUM(g.score / e.max_score * 20 * e.coefficient) / SUM(e.coefficient), 2) AS average
      FROM grades g JOIN evaluations e ON e.id = g.evaluation_id AND e.tenant_id = g.tenant_id
      WHERE g.tenant_id = :tid AND e.published = 1 AND g.score IS NOT NULL AND e.class_id IN (:classIds)
      GROUP BY e.class_id, e.subject_id`, { replacements: { tid, classIds }, type: sequelize.QueryTypes.SELECT }),
    sequelize.query(`
      SELECT YEARWEEK(a.on_date, 3) AS week, SUM(a.status = 'absent' AND a.justified = 1) AS justified,
             SUM(a.status = 'absent' AND a.justified = 0) AS unjustified, SUM(a.status = 'late') AS lates, COUNT(*) AS total
      FROM attendance a JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
      WHERE a.tenant_id = :tid AND s.class_id IN (:classIds) AND a.on_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
      GROUP BY week ORDER BY week`, { replacements: { tid, classIds }, type: sequelize.QueryTypes.SELECT }),
    M.Invoice.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'n']], where: { dueOn: { [Op.lte]: today() } }, group: ['status'], raw: true }),
  ]);
  const byClass = classes.map(c => { const rows = perfBySubject.filter(p => Number(p.classId) === Number(c.id)); return { classId: c.id, name: c.name, cycle: c.level.cycle, average: rows.length ? Math.round(rows.reduce((a, p) => a + Number(p.average), 0) / rows.length * 100) / 100 : null }; });
  const paid = Number((payment.find(p => p.status === 'paid') || {}).n || 0), all = payment.reduce((a, p) => a + Number(p.n), 0);
  res.json({ byClass, bySubject: perfBySubject, attendanceByWeek, paymentRate: all ? Math.round(paid / all * 1000) / 10 : null });
}));

// =====================================================================
// PARAMÈTRES DE L'ÉTABLISSEMENT & AUDIT
// =====================================================================
r.get('/settings', requireRole('admin'), asyncHandler(async (req, res) => {
  const [students, users] = await Promise.all([M.Student.count({ where: { status: 'enrolled' } }), M.User.count()]);
  res.json({ tenant: req.tenant, usage: { students, users, maxStudents: req.tenant.plan && req.tenant.plan.maxStudents } });
}));
r.patch('/settings', requireRole('admin'), validate({ body: z.object({
  name: z.string().max(160).optional(), city: z.string().max(80).optional(), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoFileId: z.number().int().positive().optional(), customDomain: z.string().max(160).nullable().optional(), schoolYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  settings: z.object({ grading: z.object({ decimals: z.number().int().min(0).max(3), dropLowest: z.boolean(), ranking: z.boolean(), passMark: z.number().min(0).max(20) }).partial().optional() }).passthrough().optional(),
}) }), asyncHandler(async (req, res) => {
  const t = await M.Tenant.findByPk(req.tenant.id);
  const { logoFileId, ...body } = req.body;
  if (logoFileId) body.logoUrl = fileUrl((await claimFile(req.user, logoFileId, 'logo')).id);
  if (body.settings) body.settings = { ...(t.settings || {}), ...body.settings, grading: { ...((t.settings || {}).grading || {}), ...(body.settings.grading || {}) } };
  await t.update(body);
  invalidateTenantCache();
  res.json(t);
}));
r.get('/audit', requireRole('admin'), asyncHandler(async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  res.json({ data: await M.AuditLog.findAll({ order: [['id', 'DESC']], limit, include: [{ model: M.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'role'] }] }) });
}));

// =====================================================================
// ASSISTANT IA (plan Premium)
// =====================================================================
r.post('/ai/chat', requireFeature('ai'), requirePerm('ai:use'), validate({ body: z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8000) })).min(1).max(30),
}) }), asyncHandler(async (req, res) => {
  // Contexte métier minimal, filtré par rôle — jamais de données de santé.
  const context = { date: today(), role: req.user.role };
  const ids = await scope.allowedStudentIds(req.user);
  if (ids && ids.length && ids.length <= 5) {
    context.students = [];
    for (const s of await M.Student.findAll({ where: { id: { [Op.in]: ids } }, include: [{ model: M.Class, as: 'class', attributes: ['name'] }] })) {
      const avg = await grading.studentAverages(s);
      context.students.push({ name: `${s.firstName} ${s.lastName}`, class: s.class && s.class.name, average: avg && avg.general, subjects: avg && Object.fromEntries(Object.entries(avg.subjects || {}).map(([k, v]) => [k, v.average])) });
    }
  }
  if (['admin', 'staff'].includes(req.user.role)) context.absencesToday = await M.Attendance.count({ where: { onDate: today(), status: 'absent' } });
  const subjects = await M.Subject.findAll({ attributes: ['id', 'name'] });
  context.subjects = Object.fromEntries(subjects.map(s => [s.id, s.name]));
  res.json(await ai.chat({ tenant: req.tenant, user: req.user, messages: req.body.messages, context }));
}));

module.exports = r;
