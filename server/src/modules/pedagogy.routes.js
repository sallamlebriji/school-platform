'use strict';
/**
 * Pédagogie : emploi du temps, présences, évaluations & notes, bulletins,
 * devoirs, cours en ligne, bibliothèque.
 */
const express = require('express');
const { Op } = require('sequelize');
const { z } = require('zod');
const M = require('../models');
const { sequelize } = M;
const { crudRouter, idParam } = require('../core/crud');
const { requirePerm } = require('../middlewares/auth');
const { requireFeature } = require('../middlewares/tenant');
const { validate } = require('../middlewares/common');
const { asyncHandler, notFound, forbidden, conflict, badRequest } = require('../core/errors');
const scope = require('../services/scope');
const grading = require('../services/grading');
const { notify, parentsByStudent, parentUserIds } = require('../services/notifier');
const pdf = require('../services/pdf');
const { claimFile, fileUrl } = require('./files.routes');

const r = express.Router();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const today = () => new Date().toISOString().slice(0, 10);
const teacherOf = user => M.Teacher.findOne({ where: { userId: user.id } });

// =====================================================================
// EMPLOI DU TEMPS
// =====================================================================
const slotInclude = [
  { model: M.Subject, as: 'subject' }, { model: M.Room, as: 'room' }, { model: M.Class, as: 'class', attributes: ['id', 'name'] },
  { model: M.Teacher, as: 'teacher', include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] },
];
r.get('/timetable', requirePerm('timetable:read'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.classId) { await scope.assertClassAccess(req.user, req.query.classId); where.classId = req.query.classId; }
  else if (req.query.teacherId) where.teacherId = req.query.teacherId;
  else if (req.query.roomId) where.roomId = req.query.roomId;
  else if (req.user.role === 'teacher') { const t = await teacherOf(req.user); where.teacherId = t ? t.id : 0; }
  else { const ids = await scope.allowedClassIds(req.user); if (ids !== null) where.classId = { [Op.in]: ids.length ? ids : [0] }; else throw badRequest('Précisez classId, teacherId ou roomId'); }
  const slots = await M.TimetableSlot.findAll({ where, include: [...slotInclude, { model: M.TimetableException, as: 'exceptions', required: false, where: { onDate: { [Op.gte]: today() } } }], order: [['weekday', 'ASC'], ['startTime', 'ASC']] });
  res.json({ data: slots });
}));

const slotSchema = z.object({ classId: z.number().int().positive(), subjectId: z.number().int().positive(), teacherId: z.number().int().positive(), roomId: z.number().int().positive().nullable().optional(), weekday: z.number().int().min(1).max(6), startTime: time, endTime: time });
r.post('/timetable', requirePerm('timetable:write'), validate({ body: slotSchema }), asyncHandler(async (req, res) => {
  res.status(201).json(await M.TimetableSlot.create(req.body));
}));

/** Drag & drop : déplacer un cours. Les contraintes UNIQUE MySQL détectent les conflits. */
r.patch('/timetable/:id/move', requirePerm('timetable:write'), validate({ params: idParam, body: z.object({ weekday: z.number().int().min(1).max(6), startTime: time, endTime: time }) }), asyncHandler(async (req, res) => {
  const slot = await M.TimetableSlot.findByPk(req.params.id, { include: slotInclude });
  if (!slot) throw notFound();
  try { await slot.update(req.body); }
  catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') throw conflict('Conflit : la classe ou l\'enseignant a déjà un cours sur ce créneau');
    throw e;
  }
  const students = await M.Student.findAll({ where: { classId: slot.classId }, attributes: ['id', 'userId'] });
  await notify([slot.teacher.userId, ...students.map(s => s.userId), ...(await parentUserIds(students.map(s => s.id)))], {
    kind: 'timetable', title: `Changement d'emploi du temps — ${slot.class.name}`, body: `${slot.subject.name} déplacé`, link: '/timetable',
  }, { channels: ['push'] });
  res.json(slot);
}));
r.delete('/timetable/:id', requirePerm('timetable:write'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const slot = await M.TimetableSlot.findByPk(req.params.id); if (!slot) throw notFound();
  await slot.destroy(); res.status(204).end();
}));

/** Remplacement / annulation / changement de salle pour une date donnée. */
r.post('/timetable/:id/exceptions', requirePerm('timetable:write'), validate({ params: idParam, body: z.object({ onDate: date, kind: z.enum(['cancel', 'substitute', 'room_change', 'moved']), substituteTeacherId: z.number().int().positive().optional(), roomId: z.number().int().positive().optional(), note: z.string().max(255).optional() }) }), asyncHandler(async (req, res) => {
  const slot = await M.TimetableSlot.findByPk(req.params.id, { include: slotInclude }); if (!slot) throw notFound();
  if (req.body.substituteTeacherId) {
    const busy = await M.TimetableSlot.findOne({ where: { teacherId: req.body.substituteTeacherId, weekday: slot.weekday, startTime: slot.startTime } });
    if (busy) throw conflict('Le remplaçant a déjà cours sur ce créneau');
  }
  const ex = await M.TimetableException.create({ ...req.body, slotId: slot.id });
  const students = await M.Student.findAll({ where: { classId: slot.classId }, attributes: ['id', 'userId'] });
  const sub = req.body.substituteTeacherId ? await M.Teacher.findByPk(req.body.substituteTeacherId) : null;
  await notify([...students.map(s => s.userId), ...(await parentUserIds(students.map(s => s.id))), sub && sub.userId], {
    kind: 'timetable', title: `${slot.subject.name} (${slot.class.name}) — ${{ cancel: 'cours annulé', substitute: 'remplacement', room_change: 'changement de salle', moved: 'cours déplacé' }[req.body.kind]}`,
    body: `Le ${req.body.onDate}${req.body.note ? ' · ' + req.body.note : ''}`, link: '/timetable',
  }, { channels: ['push'] });
  res.status(201).json(ex);
}));

// =====================================================================
// PRÉSENCES
// =====================================================================
r.get('/attendance', requirePerm('attendance:read'), asyncHandler(async (req, res) => {
  const where = { ...(await scope.studentWhere(req.user)) };
  if (req.query.date) where.onDate = req.query.date;
  if (req.query.from) where.onDate = { ...(where.onDate && typeof where.onDate === 'object' ? where.onDate : {}), [Op.gte]: req.query.from };
  if (req.query.status) where.status = req.query.status;
  if (req.query.studentId) where.studentId = req.query.studentId;
  const include = [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName', 'classId'], where: req.query.classId ? { classId: req.query.classId } : undefined, include: [{ model: M.Class, as: 'class', attributes: ['name'] }] }];
  res.json({ data: await M.Attendance.findAll({ where, include, order: [['onDate', 'DESC']], limit: Math.min(500, Number(req.query.limit) || 200) }) });
}));

/** Appel d'une classe : upsert des statuts + notification automatique aux parents des absents. */
r.post('/attendance/roll', requirePerm('attendance:write'), validate({ body: z.object({
  classId: z.number().int().positive(), date: date.default(today()), period: z.enum(['day', 'morning', 'afternoon']).default('day'),
  entries: z.array(z.object({ studentId: z.number().int().positive(), status: z.enum(['present', 'absent', 'late']), minutesLate: z.number().int().min(0).max(240).optional(), reason: z.string().max(255).optional() })).min(1),
}) }), asyncHandler(async (req, res) => {
  const { classId, date: onDate, period, entries } = req.body;
  await scope.assertClassAccess(req.user, classId);
  const inClass = new Set((await M.Student.findAll({ where: { classId }, attributes: ['id'] })).map(s => Number(s.id)));
  const bad = entries.find(e => !inClass.has(e.studentId));
  if (bad) throw badRequest(`L'élève ${bad.studentId} n'appartient pas à cette classe`);

  await sequelize.transaction(async transaction => {
    for (const e of entries) {
      const [row, created] = await M.Attendance.findOrCreate({ where: { studentId: e.studentId, onDate, period }, defaults: { ...e, onDate, period, recordedBy: req.user.id }, transaction });
      if (!created) await row.update({ status: e.status, minutesLate: e.minutesLate || null, reason: e.reason || row.reason, recordedBy: req.user.id }, { transaction });
    }
  });

  const absentIds = entries.filter(e => e.status === 'absent').map(e => e.studentId);
  const lateIds = entries.filter(e => e.status === 'late').map(e => e.studentId);
  const parents = await parentsByStudent([...absentIds, ...lateIds]);
  const students = await M.Student.findAll({ where: { id: { [Op.in]: [...absentIds, ...lateIds, 0] } }, attributes: ['id', 'firstName'] });
  for (const s of students) {
    const absent = absentIds.includes(Number(s.id));
    await notify(parents[s.id] || [], {
      kind: absent ? 'absence' : 'late', title: absent ? `${s.firstName} est absent(e) aujourd'hui.` : `${s.firstName} est arrivé(e) en retard.`,
      body: absent ? 'Merci de justifier l\'absence depuis votre espace parent.' : undefined, link: '/attendance',
    }, { channels: absent ? ['push', 'sms'] : ['push'] });
  }
  res.json({ saved: entries.length, absents: absentIds.length, lates: lateIds.length, notifiedFamilies: Object.keys(parents).length });
}));

/** Justification par un parent (ou la vie scolaire). */
r.patch('/attendance/:id/justify', requirePerm('attendance:justify', 'attendance:write'), validate({ params: idParam, body: z.object({ reason: z.string().min(2).max(255), fileId: z.number().int().positive().optional() }) }), asyncHandler(async (req, res) => {
  const a = await M.Attendance.findByPk(req.params.id); if (!a) throw notFound();
  await scope.assertStudentAccess(req.user, a.studentId);
  const proof = req.body.fileId ? await claimFile(req.user, req.body.fileId, 'attendance_proof') : null;
  res.json(await a.update({ justified: true, reason: req.body.reason, proofUrl: proof ? fileUrl(proof.id) : a.proofUrl }));
}));

// =====================================================================
// ÉVALUATIONS & NOTES
// =====================================================================
async function assertTeaches(user, classId, subjectId) {
  if (user.role !== 'teacher') return;
  const t = await teacherOf(user);
  const ok = t && await M.ClassSubject.findOne({ where: { classId, subjectId, teacherId: t.id } });
  if (!ok) throw forbidden('Vous n\'enseignez pas cette matière dans cette classe');
}

r.get('/evaluations', requirePerm('grades:read'), asyncHandler(async (req, res) => {
  const where = {};
  const allowed = await scope.allowedClassIds(req.user);
  if (allowed !== null) where.classId = { [Op.in]: allowed.length ? allowed : [0] };
  if (req.query.classId) { await scope.assertClassAccess(req.user, req.query.classId); where.classId = req.query.classId; }
  if (req.query.subjectId) where.subjectId = req.query.subjectId;
  if (['parent', 'student'].includes(req.user.role)) where.published = true;
  res.json({ data: await M.Evaluation.findAll({ where, include: [{ model: M.Subject, as: 'subject' }], order: [['heldOn', 'DESC']] }) });
}));

const evalSchema = z.object({ classId: z.number().int().positive(), subjectId: z.number().int().positive(), kind: z.enum(['Contrôle', 'Examen', 'Devoir surveillé', 'Interrogation', 'Exposé']), title: z.string().min(1).max(120), coefficient: z.number().min(0.25).max(10).default(1), maxScore: z.number().positive().max(100).default(20), heldOn: date, term: z.number().int().min(1).max(3).default(1), published: z.boolean().default(false) });
r.post('/evaluations', requirePerm('grades:write'), validate({ body: evalSchema }), asyncHandler(async (req, res) => {
  await assertTeaches(req.user, req.body.classId, req.body.subjectId);
  const t = req.user.role === 'teacher' ? await teacherOf(req.user) : null;
  res.status(201).json(await M.Evaluation.create({ ...req.body, teacherId: t ? t.id : null }));
}));

r.get('/evaluations/:id/grades', requirePerm('grades:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const ev = await M.Evaluation.findByPk(req.params.id); if (!ev) throw notFound();
  await scope.assertClassAccess(req.user, ev.classId);
  const where = { evaluationId: ev.id, ...(await scope.studentWhere(req.user)) };
  res.json({ evaluation: ev, data: await M.Grade.findAll({ where, include: [{ model: M.Student, as: 'student', attributes: ['id', 'firstName', 'lastName'] }] }) });
}));

/** Saisie des notes en masse + publication éventuelle (notifie élèves & parents). */
r.put('/evaluations/:id/grades', requirePerm('grades:write'), validate({ params: idParam, body: z.object({
  grades: z.array(z.object({ studentId: z.number().int().positive(), score: z.number().min(0).nullable(), comment: z.string().max(255).optional() })),
  publish: z.boolean().optional(),
}) }), asyncHandler(async (req, res) => {
  const ev = await M.Evaluation.findByPk(req.params.id, { include: [{ model: M.Subject, as: 'subject' }] }); if (!ev) throw notFound();
  await assertTeaches(req.user, ev.classId, ev.subjectId);
  const bad = req.body.grades.find(g => g.score != null && g.score > Number(ev.maxScore));
  if (bad) throw badRequest(`Note supérieure au barème (${ev.maxScore})`);
  await sequelize.transaction(async transaction => {
    for (const g of req.body.grades) {
      const [row, created] = await M.Grade.findOrCreate({ where: { evaluationId: ev.id, studentId: g.studentId }, defaults: g, transaction });
      if (!created) await row.update({ score: g.score, comment: g.comment }, { transaction });
    }
    if (req.body.publish) await ev.update({ published: true }, { transaction });
  });
  if (req.body.publish) {
    const ids = req.body.grades.map(g => g.studentId);
    const parents = await parentsByStudent(ids);
    const students = await M.Student.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'firstName', 'userId'] });
    for (const s of students) {
      const g = req.body.grades.find(x => x.studentId === Number(s.id));
      if (g.score == null) continue;
      await notify([s.userId, ...(parents[s.id] || [])], { kind: 'grade', title: `${s.firstName} a obtenu ${g.score}/${Number(ev.maxScore)} en ${ev.subject.name}.`, body: ev.title, link: '/grades' });
    }
  }
  res.json({ saved: req.body.grades.length, published: !!req.body.publish });
}));

r.get('/classes/:id/averages', requirePerm('grades:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  if (['parent', 'student'].includes(req.user.role)) throw forbidden();
  await scope.assertClassAccess(req.user, req.params.id);
  res.json(await grading.classAverages(req.params.id, Number(req.query.term) || 1));
}));
r.get('/students/:id/averages', requirePerm('grades:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await scope.assertStudentAccess(req.user, req.params.id);
  const s = await M.Student.findByPk(req.params.id); if (!s) throw notFound();
  const avg = await grading.studentAverages(s, Number(req.query.term) || 1);
  if (avg && !avg.rules.ranking) { delete avg.rank; delete avg.of; }
  res.json(avg);
}));
r.get('/students/:id/report-card.pdf', requirePerm('grades:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  await scope.assertStudentAccess(req.user, req.params.id);
  const s = await M.Student.findByPk(req.params.id, { include: [{ model: M.Class, as: 'class' }] }); if (!s) throw notFound();
  const [avg, subjects] = await Promise.all([grading.studentAverages(s), M.Subject.findAll()]);
  pdf.reportCard(res, req.tenant, s, s.class, avg, Object.fromEntries(subjects.map(x => [x.id, x])));
}));

// =====================================================================
// DEVOIRS
// =====================================================================
r.get('/homework', requirePerm('homework:read'), asyncHandler(async (req, res) => {
  const where = {};
  const allowed = await scope.allowedClassIds(req.user);
  if (allowed !== null) where.classId = { [Op.in]: allowed.length ? allowed : [0] };
  if (req.query.classId) where.classId = req.query.classId;
  if (req.query.upcoming) where.dueAt = { [Op.gte]: new Date() };
  if (req.user.role === 'teacher' && req.query.mine) { const t = await teacherOf(req.user); where.teacherId = t ? t.id : 0; }
  const subWhere = await scope.studentWhere(req.user);
  const rows = await M.Homework.findAll({
    where, order: [['dueAt', 'DESC']], limit: 200,
    include: [{ model: M.Subject, as: 'subject' }, { model: M.Class, as: 'class', attributes: ['id', 'name'] }, { model: M.HomeworkSubmission, as: 'submissions', required: false, where: Object.keys(subWhere).length ? subWhere : undefined }],
  });
  res.json({ data: rows.map(h => { const j = h.toJSON(); return { ...j, stats: { submitted: j.submissions.filter(s => s.status !== 'todo').length, graded: j.submissions.filter(s => s.status === 'graded').length } }; }) });
}));
r.post('/homework', requirePerm('homework:write'), validate({ body: z.object({ classId: z.number().int().positive(), subjectId: z.number().int().positive(), title: z.string().min(1).max(160), instructions: z.string().max(5000).optional(), dueAt: z.string(), attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional() }) }), asyncHandler(async (req, res) => {
  await assertTeaches(req.user, req.body.classId, req.body.subjectId);
  const t = req.user.role === 'teacher' ? await teacherOf(req.user) : null;
  const hw = await M.Homework.create({ ...req.body, teacherId: t ? t.id : null });
  const students = await M.Student.findAll({ where: { classId: hw.classId, status: 'enrolled' }, attributes: ['id', 'userId'] });
  await M.HomeworkSubmission.bulkCreate(students.map(s => ({ homeworkId: hw.id, studentId: s.id })));
  await notify([...students.map(s => s.userId), ...(await parentUserIds(students.map(s => s.id)))], { kind: 'homework', title: 'Un nouveau devoir a été publié.', body: hw.title, link: '/homework' });
  res.status(201).json(hw);
}));
r.post('/homework/:id/submit', requirePerm('homework:submit'), validate({ params: idParam, body: z.object({ fileId: z.number().int().positive() }) }), asyncHandler(async (req, res) => {
  const me = await M.Student.findOne({ where: { userId: req.user.id } }); if (!me) throw forbidden();
  const hw = await M.Homework.findByPk(req.params.id); if (!hw) throw notFound();
  const sub = await M.HomeworkSubmission.findOne({ where: { homeworkId: hw.id, studentId: me.id } }); if (!sub) throw notFound();
  const f = await claimFile(req.user, req.body.fileId, 'homework');
  res.json(await sub.update({ fileUrl: fileUrl(f.id), submittedAt: new Date(), status: new Date() > new Date(hw.dueAt) ? 'late' : 'submitted' }));
}));
r.patch('/homework/submissions/:id', requirePerm('homework:write'), validate({ params: idParam, body: z.object({ score: z.number().min(0).max(20).nullable(), feedback: z.string().max(500).optional() }) }), asyncHandler(async (req, res) => {
  const sub = await M.HomeworkSubmission.findByPk(req.params.id, { include: [{ model: M.Student, as: 'student' }] }); if (!sub) throw notFound();
  await scope.assertStudentAccess(req.user, sub.studentId);
  await sub.update({ ...req.body, status: 'graded' });
  await notify([sub.student.userId, ...(await parentUserIds([sub.studentId]))], { kind: 'homework', title: 'Devoir corrigé', body: `Note : ${req.body.score ?? '—'}/20`, link: '/homework' });
  res.json(sub);
}));

// =====================================================================
// COURS EN LIGNE (plan Premium) & BIBLIOTHÈQUE
// =====================================================================
const courses = express.Router();
courses.use(requireFeature('elearning'));
courses.get('/:id', requirePerm('courses:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const c = await M.Course.findByPk(req.params.id, { include: [{ model: M.Subject, as: 'subject' }, { model: M.CourseLesson, as: 'lessons', separate: true, order: [['position', 'ASC']] }] });
  if (!c) throw notFound();
  let progress = [];
  if (req.user.role === 'student') {
    const me = await M.Student.findOne({ where: { userId: req.user.id } });
    progress = await M.LessonProgress.findAll({ where: { studentId: me.id, lessonId: { [Op.in]: c.lessons.map(l => l.id).concat(0) } } });
  }
  res.json({ ...c.toJSON(), progress });
}));
const quizSchema = z.array(z.object({ q: z.string().min(1).max(500), options: z.array(z.string().max(200)).min(2).max(6), answer: z.number().int().min(0) })).max(30);
courses.post('/:id/lessons', requirePerm('courses:write'), validate({ params: idParam, body: z.object({ chapter: z.string().max(120), title: z.string().max(160), kind: z.enum(['video', 'pdf', 'slides', 'exercise', 'quiz', 'assignment']), contentUrl: z.string().url().optional(), fileId: z.number().int().positive().optional(), quiz: quizSchema.optional(), position: z.number().int().default(0) }) }), asyncHandler(async (req, res) => {
  const c = await M.Course.findByPk(req.params.id); if (!c) throw notFound();
  if (req.body.fileId) await claimFile(req.user, req.body.fileId, 'course');
  res.status(201).json(await M.CourseLesson.create({ ...req.body, courseId: c.id }));
}));
courses.post('/lessons/:id/complete', requirePerm('courses:progress'), validate({ params: idParam, body: z.object({ score: z.number().min(0).max(20).optional() }) }), asyncHandler(async (req, res) => {
  const me = await M.Student.findOne({ where: { userId: req.user.id } }); if (!me) throw forbidden();
  const lesson = await M.CourseLesson.findByPk(req.params.id); if (!lesson) throw notFound();
  const [p] = await M.LessonProgress.findOrCreate({ where: { lessonId: lesson.id, studentId: me.id } });
  res.json(await p.update({ completedAt: new Date(), score: req.body.score ?? p.score }));
}));
crudRouter({
  router: courses, model: M.Course, resource: 'courses', only: ['list', 'create', 'update', 'delete'], search: ['title'], filters: ['subjectId', 'levelId', 'status'],
  include: [{ model: M.Subject, as: 'subject' }, { model: M.Teacher, as: 'teacher', include: [{ model: M.User, as: 'user', attributes: ['firstName', 'lastName'] }] }],
  createSchema: z.object({ subjectId: z.number().int().positive(), levelId: z.number().int().positive().optional(), title: z.string().min(1).max(160), description: z.string().max(5000).optional(), status: z.enum(['draft', 'published']).default('draft') }),
  beforeCreate: async (req, data) => { const t = req.user.role === 'teacher' ? await teacherOf(req.user) : null; return { ...data, teacherId: t ? t.id : null }; },
  scope: async req => (['parent', 'student'].includes(req.user.role) ? { status: 'published' } : {}),
});
r.use('/courses', courses);

const library = crudRouter({
  model: M.LibraryItem, resource: 'library', search: ['title', 'author'], filters: ['kind', 'subjectId', 'level'], defaultSort: 'title',
  include: [{ model: M.Subject, as: 'subject', attributes: ['id', 'name', 'shortName'] }],
  createSchema: z.object({ title: z.string().min(1).max(200), author: z.string().max(120).optional(), kind: z.enum(['Livre', 'Manuel', 'PDF', 'Vidéo', 'Support de cours', 'Référence']), subjectId: z.number().int().positive().optional(), level: z.string().max(40).optional(), fileUrl: z.string().url().optional() }),
});
library.post('/:id/download', requirePerm('library:read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const item = await M.LibraryItem.findByPk(req.params.id); if (!item) throw notFound();
  await item.update({ downloads: item.downloads + 1 });
  res.json({ url: item.fileUrl });
}));
r.use('/library', library);

module.exports = r;
