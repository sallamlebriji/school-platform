'use strict';
/**
 * Moteur de moyennes, paramétrable par établissement (tenants.settings.grading) :
 *   { decimals: 2, dropLowest: false, ranking: true, passMark: 10 }
 * Moyenne matière  = Σ(note/barème×20 × coef évaluation) / Σ coef
 * Moyenne générale = Σ(moyenne matière × coef matière) / Σ coef matière
 */
const { Op } = require('sequelize');
const { Evaluation, Grade, Subject, Student } = require('../models');
const { ctx } = require('../core/context');

const rules = () => ({ decimals: 2, dropLowest: false, ranking: true, passMark: 10, ...((ctx().tenant.settings || {}).grading || {}) });
const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Calcule les moyennes de tous les élèves d'une classe pour un trimestre. */
async function classAverages(classId, term = 1) {
  const r = rules();
  const [evaluations, students, subjects] = await Promise.all([
    Evaluation.findAll({ where: { classId, term, published: true }, include: [{ model: Grade, as: 'grades' }] }),
    Student.findAll({ where: { classId }, attributes: ['id', 'firstName', 'lastName'] }),
    Subject.findAll(),
  ]);
  const subjCoef = Object.fromEntries(subjects.map(s => [s.id, Number(s.coefficient)]));
  const result = {};
  for (const st of students) {
    const bySubject = {};
    for (const ev of evaluations) {
      const g = ev.grades.find(x => Number(x.studentId) === Number(st.id));
      if (!g || g.score == null) continue;
      (bySubject[ev.subjectId] = bySubject[ev.subjectId] || []).push({ value: Number(g.score) / Number(ev.maxScore) * 20, coef: Number(ev.coefficient), evaluationId: ev.id, title: ev.title });
    }
    const subjectsAvg = {};
    let sum = 0, w = 0;
    for (const [sid, list] of Object.entries(bySubject)) {
      let items = list;
      if (r.dropLowest && items.length >= 4) { const min = Math.min(...items.map(i => i.value)); items = items.filter((i, idx) => idx !== items.findIndex(x => x.value === min)); }
      const cs = items.reduce((a, i) => a + i.coef, 0);
      const avg = items.reduce((a, i) => a + i.value * i.coef, 0) / cs;
      subjectsAvg[sid] = { average: round(avg, r.decimals), grades: list };
      sum += avg * (subjCoef[sid] || 1); w += subjCoef[sid] || 1;
    }
    result[st.id] = { studentId: st.id, name: `${st.firstName} ${st.lastName}`, general: w ? round(sum / w, r.decimals) : null, subjects: subjectsAvg };
  }
  if (r.ranking) {
    const sorted = Object.values(result).filter(x => x.general != null).sort((a, b) => b.general - a.general);
    sorted.forEach((x, i) => { x.rank = i + 1; x.of = sorted.length; });
  }
  const gens = Object.values(result).map(x => x.general).filter(v => v != null);
  return { rules: r, classAverage: gens.length ? round(gens.reduce((a, b) => a + b, 0) / gens.length, r.decimals) : null, students: result };
}

async function studentAverages(student, term = 1) {
  if (!student.classId) return null;
  const all = await classAverages(student.classId, term);
  return { ...all.students[student.id], classAverage: all.classAverage, rules: all.rules };
}

module.exports = { classAverages, studentAverages, rules };
