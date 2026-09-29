'use strict';
/**
 * Visibilité ligne à ligne À L'INTÉRIEUR d'un tenant.
 *  - direction / scolarité / comptabilité / infirmerie : tous les élèves
 *  - enseignant : élèves de ses classes
 *  - parent     : ses enfants
 *  - élève      : lui-même
 */
const { Op } = require('sequelize');
const { Student, Guardian, StudentGuardian, Teacher, ClassSubject, Class } = require('../models');
const { ctx } = require('../core/context');
const { forbidden } = require('../core/errors');

async function teacherClassIds(user) {
  const t = await Teacher.findOne({ where: { userId: user.id } });
  if (!t) return [];
  const [cs, main] = await Promise.all([
    ClassSubject.findAll({ where: { teacherId: t.id }, attributes: ['classId'] }),
    Class.findAll({ where: { mainTeacherId: t.id }, attributes: ['id'] }),
  ]);
  return [...new Set([...cs.map(x => Number(x.classId)), ...main.map(x => Number(x.id))])];
}

/** null = pas de restriction ; sinon liste d'ids d'élèves visibles. Mis en cache pour la requête. */
async function allowedStudentIds(user) {
  const store = ctx();
  if (store && store.studentIds !== undefined) return store.studentIds;
  let ids = null;
  if (user.role === 'parent') {
    const g = await Guardian.findOne({ where: { userId: user.id }, include: [{ model: StudentGuardian, as: 'childLinks' }] });
    ids = g ? g.childLinks.map(l => Number(l.studentId)) : [];
  } else if (user.role === 'student') {
    const s = await Student.findOne({ where: { userId: user.id } });
    ids = s ? [Number(s.id)] : [];
  } else if (user.role === 'teacher') {
    const classIds = await teacherClassIds(user);
    ids = (await Student.findAll({ where: { classId: { [Op.in]: classIds.length ? classIds : [0] } }, attributes: ['id'] })).map(s => Number(s.id));
  } else if (user.role === 'driver') {
    ids = [];
  }
  if (store) store.studentIds = ids;
  return ids;
}

/** Filtre `where` à ajouter sur une colonne studentId. */
async function studentWhere(user, column = 'studentId') {
  const ids = await allowedStudentIds(user);
  return ids === null ? {} : { [column]: { [Op.in]: ids.length ? ids : [0] } };
}

async function assertStudentAccess(user, studentId) {
  const ids = await allowedStudentIds(user);
  if (ids !== null && !ids.includes(Number(studentId))) throw forbidden('Élève hors de votre périmètre');
}

async function allowedClassIds(user) {
  if (user.role === 'teacher') return teacherClassIds(user);
  if (user.role === 'parent' || user.role === 'student') {
    const ids = await allowedStudentIds(user);
    const st = await Student.findAll({ where: { id: { [Op.in]: ids.length ? ids : [0] } }, attributes: ['classId'] });
    return [...new Set(st.map(s => Number(s.classId)).filter(Boolean))];
  }
  return null;
}

async function assertClassAccess(user, classId) {
  const ids = await allowedClassIds(user);
  if (ids !== null && !ids.includes(Number(classId))) throw forbidden('Classe hors de votre périmètre');
}

module.exports = { allowedStudentIds, studentWhere, assertStudentAccess, allowedClassIds, assertClassAccess, teacherClassIds };
