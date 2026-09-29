'use strict';
/**
 * Test de bout en bout (base seedée requise) : démarre l'API en mémoire et vérifie
 * rôles, permissions, isolation multi-tenant et principaux flux métier.
 *   npm run smoke
 */
const http = require('http');
const app = require('../src/app');
const M = require('../src/models');
const { runWithTenant, runAsSystem } = require('../src/core/context');

const PASSWORD = 'Athenee2026!';
let base, failures = 0, passed = 0;

const check = (label, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${label}`); } else { failures++; console.log(`  ✗ ${label} ${extra}`); } };

async function call(method, path, { tenant = 'alfarabi', token, body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, data: type.includes('json') ? await res.json() : null };
}
const login = async (who, tenant = 'alfarabi') => (await call('POST', '/api/auth/login', { tenant, body: { email: `${who}@${tenant}.athenee.app`, password: PASSWORD } })).data.accessToken;

(async () => {
  const server = http.createServer(app).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const T = {};
  for (const r of ['direction', 'scolarite', 'comptabilite', 'infirmerie', 'enseignant', 'parent', 'eleve', 'chauffeur']) T[r] = await login(r);
  T.lumiere = await login('direction', 'lumiere');

  console.log('\nAuthentification');
  check('connexion des 8 rôles', Object.values(T).every(Boolean));
  check('mauvais mot de passe refusé', (await call('POST', '/api/auth/login', { body: { email: 'direction@alfarabi.athenee.app', password: 'x' } })).status === 401);
  check('requête sans jeton refusée', (await call('GET', '/api/students')).status === 401);
  const me = await call('GET', '/api/auth/me', { token: T.parent });
  check('parent : 2 enfants rattachés au compte', me.data.children && me.data.children.length === 2, JSON.stringify(me.data.children && me.data.children.length));

  console.log('\nIsolation multi-tenant');
  check('jeton Al Farabi refusé sur Lumière', (await call('GET', '/api/students', { tenant: 'lumiere', token: T.direction })).status === 403);
  const a = await call('GET', '/api/students?limit=200', { token: T.direction });
  const b = await call('GET', '/api/students?limit=200', { tenant: 'lumiere', token: T.lumiere });
  const aIds = new Set(a.data.data.map(s => s.id));
  check('aucun élève commun entre les deux écoles', b.data.data.every(s => !aIds.has(s.id)) && a.data.total === 277 && b.data.total === 169, `${a.data.total}/${b.data.total}`);
  const lumStudent = b.data.data[0];
  check('élève de Lumière introuvable depuis Al Farabi', (await call('GET', `/api/students/${lumStudent.id}`, { token: T.direction })).status === 404);
  let blocked = false;
  try { await M.Student.findAll(); } catch (e) { blocked = /hors contexte tenant/.test(e.message); }
  check('ORM : requête hors contexte tenant bloquée (fail-closed)', blocked);
  const [afTenant, lumTenant] = await runAsSystem(() => Promise.all([M.Tenant.findOne({ where: { slug: 'alfarabi' } }), M.Tenant.findOne({ where: { slug: 'lumiere' } })]));
  const lumClass = await runWithTenant(lumTenant.get({ plain: true }), () => M.Class.findOne());
  let fkBlocked = false;
  try { await runWithTenant(afTenant.get({ plain: true }), () => M.Student.create({ firstName: 'Test', lastName: 'Fuite', birthDate: '2015-01-01', matricule: 'X-1', classId: lumClass.id })); }
  catch (e) { fkBlocked = e.name === 'SequelizeForeignKeyConstraintError'; }
  check('MySQL : clé étrangère composite refuse une classe d\'une autre école', fkBlocked);
  check('plan Essentiel : transport désactivé (402)', (await call('GET', '/api/transport/buses', { tenant: 'lumiere', token: T.lumiere })).status === 402);

  console.log('\nRBAC & périmètre');
  const kids = await call('GET', '/api/students', { token: T.parent });
  check('parent : ne voit que ses 2 enfants', kids.data.total === 2);
  const other = a.data.data.find(s => !kids.data.data.some(k => k.id === s.id));
  check('parent : fiche d\'un autre élève refusée', (await call('GET', `/api/students/${other.id}`, { token: T.parent })).status === 403);
  check('parent : accès finance global refusé', (await call('GET', '/api/finance/stats', { token: T.parent })).status === 403);
  check('enseignant : infirmerie refusée', (await call('GET', '/api/health/visits', { token: T.enseignant })).status === 403);
  check('infirmerie : registre accessible et déchiffré', (await (async () => { const r = await call('GET', '/api/health/visits', { token: T.infirmerie }); return r.status === 200 && r.data.data.every(v => typeof v.reason === 'string'); })()));
  check('comptabilité : paramètres refusés', (await call('GET', '/api/settings', { token: T.comptabilite })).status === 403);
  const fiche = await call('GET', `/api/students/${kids.data.data[0].id}`, { token: T.parent });
  check('parent : fiche 360° de son enfant, sans données médicales', fiche.status === 200 && fiche.data.health === null && fiche.data.averages);

  console.log('\nFlux métier');
  const dash = await call('GET', '/api/dashboard', { token: T.direction });
  check('tableau de bord direction', dash.status === 200 && dash.data.kpis.students === 277, JSON.stringify(dash.data.error || ''));
  check('tableau de bord parent', (await call('GET', '/api/dashboard', { token: T.parent })).data.children.length === 2);
  check('tableau de bord enseignant', (await call('GET', '/api/dashboard', { token: T.enseignant })).status === 200);
  const classes = await call('GET', '/api/classes', { token: T.enseignant });
  check('enseignant : ses classes uniquement', classes.status === 200 && classes.data.data.length > 0 && classes.data.data.length < 12);
  const cls = await call('GET', `/api/classes/${classes.data.data[0].id}`, { token: T.enseignant });
  const roll = await call('POST', '/api/attendance/roll', { token: T.enseignant, body: { classId: cls.data.id, entries: cls.data.students.map((s, i) => ({ studentId: s.id, status: i === 0 ? 'absent' : 'present' })) } });
  check('appel enregistré + familles notifiées', roll.status === 200 && roll.data.absents === 1, JSON.stringify(roll.data));
  check('parent : appel interdit', (await call('POST', '/api/attendance/roll', { token: T.parent, body: { classId: cls.data.id, entries: [{ studentId: cls.data.students[0].id, status: 'present' }] } })).status === 403);
  const evs = await call('GET', `/api/evaluations?classId=${cls.data.id}`, { token: T.enseignant });
  const myEval = evs.data.data.find(e => e.subject.shortName === 'Maths');
  const put = await call('PUT', `/api/evaluations/${myEval.id}/grades`, { token: T.enseignant, body: { grades: [{ studentId: cls.data.students[0].id, score: 16 }], publish: true } });
  check('saisie de note + publication', put.status === 200);
  check('note > barème refusée', (await call('PUT', `/api/evaluations/${myEval.id}/grades`, { token: T.enseignant, body: { grades: [{ studentId: cls.data.students[0].id, score: 25 }] } })).status === 400);
  const avg = await call('GET', `/api/classes/${cls.data.id}/averages`, { token: T.enseignant });
  check('moyennes calculées (règles de l\'école)', avg.status === 200 && avg.data.classAverage > 0);
  const tt = await call('GET', `/api/timetable?classId=${cls.data.id}`, { token: T.direction });
  const [s1, s2] = tt.data.data;
  const move = await call('PATCH', `/api/timetable/${s1.id}/move`, { token: T.direction, body: { weekday: s2.weekday, startTime: s2.startTime, endTime: s2.endTime } });
  check('emploi du temps : conflit détecté par MySQL (409)', move.status === 409, move.status);
  const inv = await call('GET', '/api/finance/invoices?status=overdue', { token: T.comptabilite });
  if (inv.data.data.length) {
    const pay = await call('POST', `/api/finance/invoices/${inv.data.data[0].id}/pay`, { token: T.comptabilite, body: { method: 'cash' } });
    check('encaissement d\'une facture', pay.status === 200 && pay.data.invoice.status === 'paid');
    const pdfRes = await call('GET', `/api/finance/invoices/${inv.data.data[0].id}/receipt.pdf`, { token: T.comptabilite });
    check('reçu PDF généré', pdfRes.status === 200 && pdfRes.type.includes('pdf'));
  }
  const cert = await call('GET', `/api/documents/certificate/${kids.data.data[0].id}`, { token: T.parent });
  check('certificat de scolarité PDF', cert.status === 200 && cert.type.includes('pdf'));
  const buses = await call('GET', '/api/transport/buses', { token: T.parent });
  check('transport : parent voit le bus de son enfant', buses.status === 200 && buses.data.data.length >= 1 && buses.data.data[0].eta);
  const drv = await call('GET', '/api/transport/buses', { token: T.chauffeur });
  const pos = await call('POST', `/api/transport/buses/${drv.data.data[0].id}/position`, { token: T.chauffeur, body: { lat: 33.58, lng: -7.59, speed: 25 } });
  check('chauffeur : position GPS publiée', pos.status === 201);
  const lost = await call('GET', '/api/lost?kind=lost&category=Sac', { token: T.parent });
  const matches = await call('GET', `/api/lost/${lost.data.data[0].id}/matches`, { token: T.parent });
  check('objets perdus : correspondance FULLTEXT trouvée', matches.status === 200 && matches.data.data.length >= 1);
  check('objets perdus : un parent ne clôt pas la déclaration d\'un autre', (await call('PATCH', `/api/lost/${lost.data.data[0].id}`, { token: T.parent, body: { status: 'returned' } })).status === 403);
  check('objets perdus : la vie scolaire peut la clôturer', (await call('PATCH', `/api/lost/${lost.data.data[0].id}`, { token: T.scolarite, body: { status: 'returned' } })).status === 200);
  const tk = await call('POST', '/api/tickets', { token: T.parent, body: { subject: 'Question sur la cantine', category: 'Cantine', body: 'Bonjour…' } });
  check('ticket de support créé', tk.status === 201);
  const notif = await call('GET', '/api/notifications', { token: T.parent });
  check('notifications du parent', notif.status === 200 && notif.data.unread > 0);
  const aiRes = await call('POST', '/api/ai/chat', { token: T.enseignant, body: { messages: [{ role: 'user', content: 'Génère un quiz sur les fractions' }] } });
  check('assistant IA', aiRes.status === 200 && aiRes.data.text, JSON.stringify(aiRes.data).slice(0, 120));
  check('analytics (Premium)', (await call('GET', '/api/analytics/overview', { token: T.direction })).status === 200);
  check('journal d\'audit alimenté', (await call('GET', '/api/audit', { token: T.direction })).data.data.length > 0);
  const pub = await call('POST', '/api/public/enrollments', { body: { studentFirstName: 'Nora', studentLastName: 'Test', guardianName: 'Parent Test' } });
  check('inscription publique (sans compte)', pub.status === 201);

  // -------------------------------------------------------------- Fichiers
  console.log('\nFichiers');
  const upload = async (token, kind, name, mime, content, tenant = 'alfarabi') => {
    const fd = new FormData();
    fd.append('file', new Blob([content], { type: mime }), name);
    const res = await fetch(`${base}/api/files?kind=${kind}`, { method: 'POST', headers: { 'X-Tenant': tenant, Authorization: `Bearer ${token}` }, body: fd });
    return { status: res.status, data: await res.json() };
  };
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const proof = await upload(T.parent, 'attendance_proof', 'certificat.pdf', 'application/pdf', PDF);
  check('téléversement d\'un justificatif PDF', proof.status === 201 && proof.data.url);
  check('faux PDF refusé (signature binaire)', (await upload(T.parent, 'attendance_proof', 'x.pdf', 'application/pdf', Buffer.from('MZ-not-a-pdf'))).status === 400);
  check('type exécutable refusé', (await upload(T.parent, 'other', 'virus.exe', 'application/x-msdownload', Buffer.from('MZ'))).status === 400);
  check('logo réservé à la direction', (await upload(T.parent, 'logo', 'l.png', 'image/png', Buffer.from('89504e470d0a1a0a00', 'hex'))).status === 403);
  const readAs = async (token, id, tenant = 'alfarabi') => (await fetch(`${base}/api/files/${id}`, { headers: { 'X-Tenant': tenant, Authorization: `Bearer ${token}` } })).status;
  check('le propriétaire relit son fichier', await readAs(T.parent, proof.data.id) === 200);
  check('un enseignant ne lit pas un justificatif médical', await readAs(T.enseignant, proof.data.id) === 403);
  check('la direction le lit', await readAs(T.direction, proof.data.id) === 200);
  check('autre école : fichier introuvable', await readAs(T.lumiere, proof.data.id, 'lumiere') === 404);
  const kidAbs = await runWithTenant(afTenant.get({ plain: true }), () => M.Attendance.create({ studentId: kids.data.data[0].id, onDate: '2026-01-05', status: 'absent' }));
  const just = await call('PATCH', `/api/attendance/${kidAbs.id}/justify`, { token: T.parent, body: { reason: 'Maladie', fileId: proof.data.id } });
  check('justification d\'absence avec pièce jointe', just.status === 200 && just.data.proofUrl === proof.data.url);
  const hwList = await call('GET', '/api/homework', { token: T.eleve });
  const todoHw = hwList.data.data.find(h => h.submissions[0] && h.submissions[0].status === 'todo');
  const copy = await upload(T.eleve, 'homework', 'copie.pdf', 'application/pdf', PDF);
  const sub = await call('POST', `/api/homework/${todoHw.id}/submit`, { token: T.eleve, body: { fileId: copy.data.id } });
  check('élève : devoir rendu avec fichier', sub.status === 200 && ['submitted', 'late'].includes(sub.data.status));
  check('élève : impossible de rendre le fichier d\'un autre', (await call('POST', `/api/homework/${todoHw.id}/submit`, { token: T.eleve, body: { fileId: proof.data.id } })).status >= 400);

  // -------------------------------------------------------------- Notifications
  console.log('\nNotifications externes');
  const prefs = await call('PATCH', '/api/auth/me/preferences', { token: T.parent, body: { locale: 'ar', notifyPrefs: { sms: false } } });
  check('préférences parent (langue + canaux)', prefs.status === 200 && prefs.data.user.locale === 'ar' && prefs.data.user.notifyPrefs.sms === false);
  const pk = await call('GET', '/api/push/public-key', { token: T.parent });
  check('clé publique Web Push exposée', pk.status === 200 && typeof pk.data.enabled === 'boolean');

  // -------------------------------------------------------------- Paiement en ligne
  console.log('\nPaiement en ligne');
  const dueInv = (await call('GET', '/api/finance/invoices?status=due', { token: T.parent })).data.data[0]
    || (await call('GET', '/api/finance/invoices?status=overdue', { token: T.parent })).data.data[0];
  check('parent : encaissement guichet interdit', (await call('POST', `/api/finance/invoices/${dueInv.id}/pay`, { token: T.parent, body: { method: 'cash' } })).status === 403);
  const co = await call('POST', `/api/finance/invoices/${dueInv.id}/checkout`, { token: T.parent });
  check('session de paiement créée', co.status === 201 && co.data.url && co.data.provider);
  check('facture d\'un autre élève refusée', (await call('POST', `/api/finance/invoices/${(await call('GET', '/api/finance/invoices?limit=200', { token: T.comptabilite })).data.data.find(i => !kids.data.data.some(k => k.id === i.studentId)).id}/checkout`, { token: T.parent })).status === 403);
  if (co.data.provider === 'simulated') {
    const done = await call('POST', `/api/finance/checkout/${co.data.sessionId}/simulate`, { token: T.parent, body: { outcome: 'paid' } });
    const again = await call('POST', `/api/finance/checkout/${co.data.sessionId}/simulate`, { token: T.parent, body: { outcome: 'paid' } });
    const st = await call('GET', `/api/finance/checkout/${co.data.sessionId}`, { token: T.parent });
    const pays = await runWithTenant(afTenant.get({ plain: true }), () => M.Payment.count({ where: { invoiceId: dueInv.id } }));
    check('paiement confirmé → facture payée', done.status === 200 && st.data.invoice.status === 'paid');
    check('confirmation rejouée sans double paiement', again.status === 200 && pays === 1, `paiements=${pays}`);
  }
  // Le paiement ci-dessus notifie le parent de démo par email (envoi en arrière-plan)
  await new Promise(r => setTimeout(r, 800)); // envois en arrière-plan
  const deliveries = await call('GET', '/api/notifications/deliveries', { token: T.direction });
  check('historique des envois alimenté', deliveries.status === 200 && deliveries.data.data.length > 0);
  check('emails générés (outbox de développement)', deliveries.data.data.some(d => d.channel === 'email' && d.status === 'sent'));
  check('historique réservé à la direction', (await call('GET', '/api/notifications/deliveries', { token: T.comptabilite })).status === 403);
  check('webhook Stripe sans signature refusé', (await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 400);

  // -------------------------------------------------------------- Import Excel
  console.log('\nImport Excel');
  const tpl = await fetch(`${base}/api/students/import/template.xlsx`, { headers: { 'X-Tenant': 'alfarabi', Authorization: `Bearer ${T.scolarite}` } });
  check('modèle Excel téléchargeable', tpl.status === 200 && (tpl.headers.get('content-type') || '').includes('spreadsheet'));
  const ExcelJS = require('exceljs');
  const tplWb = new ExcelJS.Workbook(); await tplWb.xlsx.load(Buffer.from(await tpl.arrayBuffer()));
  const className = tplWb.worksheets[0].getRow(2).getCell(5).value;
  const headers = tplWb.worksheets[0].getRow(1).values.slice(1);
  const build = async rowsData => { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Élèves'); ws.addRow(headers); rowsData.forEach(x => ws.addRow(x)); return Buffer.from(await wb.xlsx.writeBuffer()); };
  const good = [['Imane', 'Testimport', new Date('2016-03-02'), 'F', className, 'Hind', 'Testimport', 'Mère', '+212 611 22 33 44', 'hind.test@example.com'], ['Yanis', 'Testimport', '15/09/2014', 'M', className, 'Hind', 'Testimport', 'Mère', '+212 611 22 33 44', 'hind.test@example.com']];
  const bad = ['', 'SansPrenom', 'pas une date', 'M', 'Classe inexistante'];
  const xlsx = await build([...good, bad]);
  const up = await upload(T.scolarite, 'import', 'eleves.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsx);
  const preview = await call('POST', '/api/students/import', { token: T.scolarite, body: { fileId: up.data.id } });
  check('aperçu : 2 lignes valides, 1 en erreur', preview.status === 200 && preview.data.valid === 2 && preview.data.invalid === 1, JSON.stringify(preview.data).slice(0, 200));
  check('commit refusé tant qu\'il reste des erreurs', (await call('POST', '/api/students/import', { token: T.scolarite, body: { fileId: up.data.id, commit: true } })).data.error);
  const up2 = await upload(T.scolarite, 'import', 'eleves.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', await build(good));
  const commit = await call('POST', '/api/students/import', { token: T.scolarite, body: { fileId: up2.data.id, commit: true } });
  const siblings = await runWithTenant(afTenant.get({ plain: true }), () => M.Guardian.count({ where: { lastName: 'Testimport' } }));
  check('import : 2 élèves créés, parent commun dédoublonné', commit.data.created === 2 && siblings === 1, `created=${commit.data.created} parents=${siblings}`);
  check('réimport du même fichier : doublons détectés', (await call('POST', '/api/students/import', { token: T.scolarite, body: { fileId: up2.data.id } })).data.invalid === 2);
  check('parent : import interdit', (await call('POST', '/api/students/import', { token: T.parent, body: { fileId: up2.data.id } })).status === 403);

  console.log(`\n${passed} réussis, ${failures} échec(s)`);
  server.close(); await M.sequelize.close();
  process.exit(failures ? 1 : 0);
})().catch(async e => { console.error(e); process.exit(1); });
