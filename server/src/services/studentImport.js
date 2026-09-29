'use strict';
/**
 * Import d'élèves depuis Excel (.xlsx) ou CSV.
 * Étape 1 (aperçu) : chaque ligne est validée, les erreurs sont listées.
 * Étape 2 (commit)  : tout est créé en UNE transaction, ou rien.
 * Les parents sont dédoublonnés par téléphone/email (dans le fichier et en base).
 */
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const M = require('../models');
const storage = require('./storage');

const COLUMNS = [
  ['firstName', 'Prénom élève', true], ['lastName', 'Nom élève', true], ['birthDate', 'Date de naissance', true],
  ['gender', 'Sexe (F/M)', false], ['className', 'Classe', true],
  ['guardianFirstName', 'Prénom parent', false], ['guardianLastName', 'Nom parent', false], ['relation', 'Lien (Mère/Père/Tuteur)', false],
  ['guardianPhone', 'Téléphone parent', false], ['guardianEmail', 'Email parent', false],
];
const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

async function template(classes) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Athénée';
  const ws = wb.addWorksheet('Élèves', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS.map(([, header, req]) => ({ header: header + (req ? ' *' : ''), width: 22 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13254A' } };
  ws.addRow(['Adam', 'Alaoui', new Date('2015-04-12'), 'M', classes[0] ? classes[0].name : '6e A', 'Salma', 'Alaoui', 'Mère', '+212 600 00 00 00', 'salma.alaoui@example.com']);
  ws.getColumn(3).numFmt = 'dd/mm/yyyy';
  const ref = wb.addWorksheet('Classes');
  ref.addRow(['Classes disponibles']);
  classes.forEach(c => ref.addRow([c.name]));
  for (let row = 2; row <= 1000; row++) {
    ws.getCell(`E${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [`Classes!$A$2:$A$${classes.length + 1}`] };
    ws.getCell(`D${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"F,M"'] };
  }
  return wb.xlsx.writeBuffer();
}

function toIsoDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
const cellValue = v => (v && typeof v === 'object' && !(v instanceof Date) ? (v.text || v.result || (v.richText ? v.richText.map(t => t.text).join('') : '')) : v);

async function readRows(file) {
  const wb = new ExcelJS.Workbook();
  const path = storage.absPath(file.storageKey);
  if (file.mime === 'text/csv') await wb.csv.readFile(path, { parserOptions: { delimiter: undefined } }); else await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const header = ws.getRow(1).values.slice(1).map(h => norm(String(cellValue(h) || '').replace('*', '')));
  const index = COLUMNS.map(([key, label]) => header.findIndex(h => h === norm(label) || h.startsWith(norm(label).slice(0, 8))));
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const vals = row.values.slice(1).map(cellValue);
    if (!vals.some(v => v !== undefined && v !== null && String(v).trim() !== '')) return;
    const data = {};
    COLUMNS.forEach(([key], i) => { data[key] = index[i] >= 0 ? vals[index[i]] : undefined; });
    rows.push({ line: n, data });
  });
  return rows;
}

/** Valide les lignes ; si commit, crée tout en transaction. */
async function importStudents(file, { commit, tenantSlug }) {
  const rows = await readRows(file);
  if (rows.length > 2000) return { error: 'Maximum 2000 lignes par import' };
  const classes = await M.Class.findAll();
  const byName = Object.fromEntries(classes.map(c => [norm(c.name), c]));
  const counts = Object.fromEntries((await M.Student.findAll({ attributes: ['classId', [M.sequelize.fn('COUNT', M.sequelize.col('id')), 'n']], where: { status: 'enrolled' }, group: ['classId'], raw: true })).map(x => [x.classId, Number(x.n)]));
  const existing = new Set((await M.Student.findAll({ attributes: ['firstName', 'lastName', 'birthDate'] })).map(s => norm(s.firstName + s.lastName) + s.birthDate));

  const seen = new Set();
  for (const r of rows) {
    const d = r.data, errors = [];
    d.firstName = String(d.firstName || '').trim(); d.lastName = String(d.lastName || '').trim();
    if (!d.firstName) errors.push('Prénom manquant');
    if (!d.lastName) errors.push('Nom manquant');
    d.birthDate = toIsoDate(d.birthDate);
    if (!d.birthDate) errors.push('Date de naissance invalide (JJ/MM/AAAA)');
    const g = String(d.gender || '').trim().toUpperCase();
    d.gender = g.startsWith('F') ? 'F' : g.startsWith('M') || g.startsWith('G') ? 'M' : null;
    const cls = byName[norm(d.className)];
    if (!cls) errors.push(`Classe « ${d.className || ''} » inconnue`);
    else { counts[cls.id] = (counts[cls.id] || 0) + 1; if (counts[cls.id] > cls.capacity) errors.push(`Capacité de ${cls.name} dépassée (${cls.capacity})`); r.classId = cls.id; r.className = cls.name; }
    const key = norm(d.firstName + d.lastName) + d.birthDate;
    if (existing.has(key)) errors.push('Élève déjà inscrit');
    if (seen.has(key)) errors.push('Doublon dans le fichier');
    seen.add(key);
    d.guardianEmail = d.guardianEmail ? String(d.guardianEmail).trim().toLowerCase() : null;
    if (d.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.guardianEmail)) errors.push('Email parent invalide');
    d.guardianPhone = d.guardianPhone ? String(d.guardianPhone).trim() : null;
    r.errors = errors;
  }
  const invalid = rows.filter(r => r.errors.length).length;
  const summary = { total: rows.length, valid: rows.length - invalid, invalid, rows: rows.map(r => ({ line: r.line, firstName: r.data.firstName, lastName: r.data.lastName, birthDate: r.data.birthDate, className: r.className || r.data.className, guardian: [r.data.guardianFirstName, r.data.guardianLastName].filter(Boolean).join(' '), errors: r.errors })) };
  if (!commit) return summary;
  if (invalid) return { ...summary, error: 'Corrigez les lignes en erreur avant d\'importer' };

  const created = await M.sequelize.transaction(async transaction => {
    let count = await M.Student.count({ transaction });
    const year = new Date().getFullYear();
    const guardianCache = new Map();
    const findGuardian = async d => {
      const key = d.guardianPhone || d.guardianEmail;
      if (!key) return null;
      if (guardianCache.has(key)) return guardianCache.get(key);
      const or = []; if (d.guardianPhone) or.push({ phone: d.guardianPhone }); if (d.guardianEmail) or.push({ email: d.guardianEmail });
      let g = await M.Guardian.findOne({ where: { [Op.or]: or }, transaction });
      if (!g) g = await M.Guardian.create({ firstName: String(d.guardianFirstName || '—').trim(), lastName: String(d.guardianLastName || d.lastName).trim(), relation: d.relation ? String(d.relation).trim() : 'Responsable', phone: d.guardianPhone, email: d.guardianEmail }, { transaction });
      guardianCache.set(key, g);
      return g;
    };
    let n = 0;
    for (const r of rows) {
      const d = r.data;
      count++;
      const s = await M.Student.create({ firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, gender: d.gender, classId: r.classId, matricule: `${tenantSlug.slice(0, 3).toUpperCase()}-${year}-${String(count).padStart(5, '0')}`, enrolledOn: new Date(), status: 'enrolled' }, { transaction });
      const g = await findGuardian(d);
      if (g) await M.StudentGuardian.create({ studentId: s.id, guardianId: g.id, isEmergency: true }, { transaction });
      n++;
    }
    return n;
  });
  return { ...summary, created };
}

module.exports = { template, importStudents };
