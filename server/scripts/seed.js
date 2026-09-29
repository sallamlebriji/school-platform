'use strict';
/**
 * Données de démonstration : 2 établissements totalement isolés.
 *   - alfarabi (plan Premium)   : Primaire, Collège, Lycée + transport, e-learning, IA
 *   - lumiere  (plan Essentiel) : Primaire, Collège — modules Premium désactivés
 * Tous les comptes de démo utilisent le mot de passe défini dans DEMO_PASSWORD.
 */
const bcrypt = require('bcryptjs');
const M = require('../src/models');
const { runAsSystem, runWithTenant } = require('../src/core/context');
const { encrypt } = require('../src/services/security');

const DEMO_PASSWORD = 'Athenee2026!';

// ---------- aléatoire déterministe ----------
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const iso = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const FIRST_F = ['Salma', 'Yasmine', 'Inès', 'Lina', 'Rim', 'Aya', 'Malak', 'Sara', 'Nour', 'Léa', 'Chloé', 'Emma', 'Hiba', 'Imane', 'Zineb', 'Meryem', 'Kenza', 'Ghita', 'Camille', 'Sofia'];
const FIRST_M = ['Adam', 'Youssef', 'Mehdi', 'Omar', 'Rayan', 'Ilyas', 'Hamza', 'Anas', 'Amine', 'Karim', 'Hugo', 'Lucas', 'Nathan', 'Yanis', 'Zakaria', 'Othmane', 'Ayoub', 'Idriss', 'Ali', 'Jules'];
const LAST = ['Alaoui', 'Bennani', 'El Idrissi', 'Tazi', 'Berrada', 'Chraibi', 'Fassi', 'Lahlou', 'Kettani', 'Sebti', 'Benjelloun', 'Amrani', 'Ouazzani', 'Naciri', 'Mansouri', 'Martin', 'Dubois', 'Laurent', 'Moreau', 'Haddad', 'Zniber', 'Guessous', 'Filali', 'Cherkaoui', 'Kabbaj', 'Lamrani'];
const LEVELS = { Primaire: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'], 'Collège': ['6e', '5e', '4e', '3e'], 'Lycée': ['2nde', '1re', 'Tle'] };
const SUBJECTS = [['Mathématiques', 'Maths', 4, '#1D3462', 5], ['Français', 'Français', 4, '#B08D57', 5], ['Arabe', 'Arabe', 3, '#6F8FC4', 4], ['Anglais', 'Anglais', 2, '#8FB0A0', 3], ['Histoire-Géographie', 'Histoire-Géo', 2, '#C9A97A', 2], ['SVT', 'SVT', 2, '#5F8C6E', 2], ['Physique-Chimie', 'Physique', 3, '#7C6AA6', 2], ['Éducation physique', 'EPS', 1, '#A9B4C8', 2]];
const HOURS = ['08:00', '09:00', '10:15', '11:15', '14:00', '15:00'];
const endOf = h => ({ '08:00': '09:00', '09:00': '10:00', '10:15': '11:15', '11:15': '12:15', '14:00': '15:00', '15:00': '16:00' })[h];

const TENANTS = [
  { slug: 'alfarabi', name: 'Groupe Scolaire Al Farabi', city: 'Casablanca', planId: 'premium', primaryColor: '#13254A', cycles: ['Primaire', 'Collège', 'Lycée'], perClass: [20, 26], director: ['Nadia', 'Benkirane'], center: [33.5731, -7.5898] },
  { slug: 'lumiere', name: 'École Internationale Lumière', city: 'Rabat', planId: 'essentiel', primaryColor: '#5A2E3A', cycles: ['Primaire', 'Collège'], perClass: [16, 22], director: ['Julien', 'Morel'], center: [34.0209, -6.8416] },
];

async function seedTenant(def, hash) {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const schoolYear = `${year}-${year + 1}`;
  const tenant = await runAsSystem(() => M.Tenant.create({ slug: def.slug, name: def.name, city: def.city, planId: def.planId, currency: 'MAD', primaryColor: def.primaryColor, schoolYear, settings: { grading: { decimals: 2, ranking: true, dropLowest: false, passMark: 10 } }, status: 'active' }));

  await runWithTenant(tenant.get({ plain: true }), async () => {
    const domain = `${def.slug}.athenee.app`;
    const mkUser = (role, first, last, email) => ({ role, firstName: first, lastName: last, email: email || `${slug(first)}.${slug(last)}@${domain}`, passwordHash: hash, status: 'active', phone: `+212 6${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}` });

    // ---- Comptes du personnel ----
    const staff = await M.User.bulkCreate([
      mkUser('admin', def.director[0], def.director[1], `direction@${domain}`),
      mkUser('staff', 'Samira', 'Ouali', `scolarite@${domain}`),
      mkUser('accountant', 'Hicham', 'Rami', `comptabilite@${domain}`),
      mkUser('nurse', 'Khadija', 'Amrani', `infirmerie@${domain}`),
    ]);
    const admin = staff[0];

    // ---- Référentiels ----
    const levels = [];
    let pos = 0;
    for (const cy of def.cycles) for (const name of LEVELS[cy]) levels.push({ name, cycle: cy, position: pos++ });
    const levelRows = await M.Level.bulkCreate(levels);
    const subjects = await M.Subject.bulkCreate(SUBJECTS.map(s => ({ name: s[0], shortName: s[1], coefficient: s[2], color: s[3] })));
    const rooms = await M.Room.bulkCreate(Array.from({ length: levelRows.length + 3 }, (_, i) => ({ name: i < levelRows.length ? `${'ABC'[Math.floor(i / 6)]}${101 + (i % 6)}` : ['Gymnase', 'Labo 1', 'Salle Info'][i - levelRows.length], capacity: 32 })));

    // ---- Enseignants (1 à 2 par matière) ----
    const teacherDefs = [];
    subjects.forEach((s, i) => { const n = i < 2 && def.slug === 'alfarabi' ? 2 : 1; for (let k = 0; k < n; k++) { const f = rnd() < .55; teacherDefs.push({ subjectId: s.id, first: pick(f ? FIRST_F : FIRST_M), last: pick(LAST) }); } });
    teacherDefs[0].email = `enseignant@${domain}`; // compte de démo : professeur de mathématiques
    const tUsers = await M.User.bulkCreate(teacherDefs.map(t => mkUser('teacher', t.first, t.last, t.email || `${slug(t.first)}.${slug(t.last)}${rint(1, 99)}@${domain}`)));
    const teachers = await M.Teacher.bulkCreate(tUsers.map((u, i) => ({ userId: u.id, subjectId: teacherDefs[i].subjectId, hiredOn: `${rint(2012, 2024)}-09-01` })));

    // ---- Classes & affectations ----
    const classes = await M.Class.bulkCreate(levelRows.map((l, i) => ({ levelId: l.id, name: l.name + ' A', schoolYear, capacity: 30, roomId: rooms[i].id })));
    const load = {}; // teacherId -> nb classes
    const cs = [];
    classes.forEach((c, ci) => {
      const cycle = levelRows[ci].cycle;
      subjects.forEach((s, si) => {
        if (cycle === 'Primaire' && si === 6) return; // pas de physique en primaire
        const cands = teachers.filter(t => Number(t.subjectId) === Number(s.id)).sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0));
        const t = cands[0]; load[t.id] = (load[t.id] || 0) + 1;
        cs.push({ classId: c.id, subjectId: s.id, teacherId: t.id, weeklyHours: SUBJECTS[si][4] });
      });
    });
    await M.ClassSubject.bulkCreate(cs);
    for (const c of classes) { const fr = cs.find(x => x.classId === c.id && x.subjectId === subjects[1].id); await c.update({ mainTeacherId: fr.teacherId }); }

    // ---- Emploi du temps sans conflit ----
    const busyT = new Set(), slots = [];
    for (const c of classes) {
      const busyC = new Set();
      const reqs = cs.filter(x => x.classId === c.id).flatMap(x => Array(Math.min(x.weeklyHours, 4)).fill(x));
      reqs.sort(() => rnd() - .5);
      for (const x of reqs) {
        const order = []; for (let d = 1; d <= 5; d++) for (const h of HOURS) if (!(d === 3 && h >= '14:00')) order.push([d, h]);
        order.sort(() => rnd() - .5);
        const spot = order.find(([d, h]) => !busyC.has(d + h) && !busyT.has(x.teacherId + '|' + d + h));
        if (!spot) continue;
        busyC.add(spot[0] + spot[1]); busyT.add(x.teacherId + '|' + spot[0] + spot[1]);
        const subjIdx = subjects.findIndex(s => s.id === x.subjectId);
        slots.push({ classId: c.id, subjectId: x.subjectId, teacherId: x.teacherId, roomId: subjIdx === 7 ? rooms[rooms.length - 3].id : c.roomId, weekday: spot[0], startTime: spot[1], endTime: endOf(spot[1]) });
      }
    }
    // la salle de gym peut accueillir plusieurs classes (pas de contrainte UNIQUE sur la salle)
    await M.TimetableSlot.bulkCreate(slots);

    // ---- Familles & élèves ----
    const students = [], links = [], guardians = [];
    let matricule = 1;
    const slotsByClass = classes.flatMap((c, ci) => Array(rint(def.perClass[0], def.perClass[1])).fill(0).map(() => ({ c, ci })));
    slotsByClass.sort(() => rnd() - .5);
    let i = 0;
    while (i < slotsByClass.length) {
      const last = pick(LAST);
      const kids = Math.min(slotsByClass.length - i, rnd() < .6 ? 1 : 2);
      const g = { firstName: pick(FIRST_F), lastName: last, relation: 'Mère', phone: `+212 6${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}`, job: pick(['Médecin', 'Ingénieure', 'Avocate', 'Enseignante', 'Architecte', 'Pharmacienne', 'Cadre']) };
      g.email = `${slug(g.firstName)}.${slug(last)}${rint(1, 999)}@gmail.com`;
      const family = { g, kids: [] };
      for (let k = 0; k < kids; k++) {
        const { c, ci } = slotsByClass[i++];
        const f = rnd() < .5;
        const age = 6 + ci;
        family.kids.push({ classId: c.id, firstName: pick(f ? FIRST_F : FIRST_M), lastName: last, gender: f ? 'F' : 'M', birthDate: `${now.getFullYear() - age - 1}-${String(rint(1, 12)).padStart(2, '0')}-${String(rint(1, 28)).padStart(2, '0')}`, matricule: `${def.slug.slice(0, 3).toUpperCase()}-${rint(2019, year)}-${String(matricule++).padStart(5, '0')}`, status: 'enrolled', enrolledOn: `${rint(2019, year)}-09-0${rint(1, 5)}`, usesCanteen: rnd() < .7, address: `${rint(2, 180)}, Bd Anfa, ${def.city}` });
      }
      guardians.push(family);
    }
    // Famille de démo : le premier parent avec 2 enfants possède un compte
    const demoFamily = guardians.find(f => f.kids.length === 2);
    const parentUser = await M.User.create(mkUser('parent', demoFamily.g.firstName, demoFamily.g.lastName, `parent@${domain}`));
    const gRows = await M.Guardian.bulkCreate(guardians.map(f => ({ ...f.g, userId: f === demoFamily ? parentUser.id : null })));
    const sRows = await M.Student.bulkCreate(guardians.flatMap(f => f.kids));
    let si2 = 0;
    guardians.forEach((f, gi) => f.kids.forEach(() => { links.push({ studentId: sRows[si2].id, guardianId: gRows[gi].id, isEmergency: true }); si2++; }));
    await M.StudentGuardian.bulkCreate(links);
    students.push(...sRows);
    // Compte élève de démo : l'aîné de la famille de démo
    const demoKids = sRows.filter(s => demoFamily.kids.some(k => k.matricule === s.matricule)).sort((a, b) => a.birthDate.localeCompare(b.birthDate));
    const studentUser = await M.User.create(mkUser('student', demoKids[0].firstName, demoKids[0].lastName, `eleve@${domain}`));
    await demoKids[0].update({ userId: studentUser.id });

    // ---- Évaluations & notes ----
    const ability = Object.fromEntries(students.map(s => [s.id, Math.max(6, Math.min(18.5, 12.8 + gauss() * 2.6))]));
    const kinds = ['Contrôle', 'Devoir surveillé', 'Interrogation', 'Examen'];
    const evals = [];
    for (const x of cs) for (let k = 0; k < 3; k++) evals.push({ classId: x.classId, subjectId: x.subjectId, teacherId: x.teacherId, kind: kinds[k === 2 ? 3 : k], title: `${kinds[k === 2 ? 3 : k]} ${k + 1}`, coefficient: [1, 2, 3][k], maxScore: 20, heldOn: iso(addDays(now, -rint(3, 25) - (2 - k) * 7)), term: 1, published: true });
    const evRows = await M.Evaluation.bulkCreate(evals);
    const grades = [];
    for (const ev of evRows) for (const s of students.filter(st => st.classId === ev.classId)) grades.push({ evaluationId: ev.id, studentId: s.id, score: Math.round(Math.max(2, Math.min(20, ability[s.id] + (rnd() - .5) * 5)) * 4) / 4 });
    await M.Grade.bulkCreate(grades);

    // ---- Présences (15 derniers jours ouvrés, dont aujourd'hui) ----
    const att = [];
    for (let d = 0, n = 0; n < 15; d++) {
      const day = addDays(now, -d); if ([0, 6].includes(day.getDay())) continue; n++;
      for (const s of students) {
        const x = rnd();
        if (x < .025) att.push({ studentId: s.id, onDate: iso(day), status: 'absent', justified: rnd() < .5, reason: pick(['Maladie', 'Rendez-vous médical', 'Raison familiale', null]), recordedBy: admin.id });
        else if (x < .05) att.push({ studentId: s.id, onDate: iso(day), status: 'late', minutesLate: pick([5, 10, 15, 20]), recordedBy: admin.id });
      }
    }
    await M.Attendance.bulkCreate(att);

    // ---- Devoirs ----
    const HW = ['Exercices 12 à 18 p. 84', 'Rédaction : récit d\'aventure', 'Fiche de lecture', 'Exposé oral à préparer', 'Série de problèmes', 'Compte rendu de TP'];
    const hwRows = await M.Homework.bulkCreate(classes.flatMap(c => [0, 1].map(k => { const x = pick(cs.filter(y => y.classId === c.id)); return { classId: c.id, subjectId: x.subjectId, teacherId: x.teacherId, title: pick(HW), instructions: 'Travail à rendre sur la plateforme.', dueAt: addDays(now, k ? rint(2, 9) : -rint(2, 6)) }; })));
    const subs = [];
    for (const h of hwRows) for (const s of students.filter(st => st.classId === h.classId)) { const past = new Date(h.dueAt) < now; const done = past ? rnd() < .9 : rnd() < .3; subs.push({ homeworkId: h.id, studentId: s.id, status: done ? (past && rnd() < .6 ? 'graded' : 'submitted') : 'todo', submittedAt: done ? addDays(new Date(h.dueAt), -1) : null, score: done && past ? rint(10, 19) : null }); }
    await M.HomeworkSubmission.bulkCreate(subs);

    // ---- E-learning & bibliothèque ----
    const courseRows = await M.Course.bulkCreate([['Fractions et proportionnalité', 0], ['Le roman au XIXe siècle', 1], ['Grammar essentials', 3], ['La cellule vivante', 5]].map(([t, si]) => ({ subjectId: subjects[si].id, levelId: levelRows[Math.min(5, levelRows.length - 1)].id, teacherId: teachers.find(x => Number(x.subjectId) === Number(subjects[si].id)).id, title: t, description: 'Cours complet avec vidéos, documents et quiz.', status: 'published' })));
    await M.CourseLesson.bulkCreate(courseRows.flatMap(c => ['Introduction', 'Notions fondamentales', 'Exercices guidés', 'Quiz de validation'].map((t, p) => ({ courseId: c.id, chapter: `Chapitre ${p + 1}`, position: p, title: t, kind: p === 3 ? 'quiz' : p === 2 ? 'exercise' : 'video', quiz: p === 3 ? [{ q: '3/4 + 1/4 = ?', options: ['1/2', '1', '4/8'], answer: 1 }] : null }))));
    await M.LibraryItem.bulkCreate([['Le Petit Prince', 'Antoine de Saint-Exupéry', 'Livre', 1], ['Les Misérables', 'Victor Hugo', 'Livre', 1], ['Maths — Manuel', 'Collectif', 'Manuel', 0], ['English Grammar in Use', 'Raymond Murphy', 'Manuel', 3], ['La cellule en schémas', 'Équipe SVT', 'PDF', 5], ['Les fractions en vidéo', 'Équipe Maths', 'Vidéo', 0], ['Atlas du monde', 'Éditions Autrement', 'Référence', 4], ['Méthodologie de la dissertation', 'Équipe Français', 'Support de cours', 1]].map(b => ({ title: b[0], author: b[1], kind: b[2], subjectId: subjects[b[3]].id, level: 'Tous niveaux', downloads: rint(10, 400) })));

    // ---- Transport (plan Premium uniquement) ----
    if (def.planId === 'premium') {
      const driverUsers = await M.User.bulkCreate([0, 1, 2].map(k => mkUser('driver', pick(FIRST_M), pick(LAST), k === 0 ? `chauffeur@${domain}` : undefined)));
      const colors = ['#1D3462', '#B08D57', '#3A7C8C'];
      const buses = await M.Bus.bulkCreate(['Ligne 1 — Anfa', 'Ligne 2 — Maârif', 'Ligne 3 — Californie'].map((l, k) => ({ lineName: l, plate: `${rint(10000, 99999)}-A-${rint(1, 80)}`, model: pick(['Mercedes Sprinter', 'Iveco Daily']), capacity: 33, color: colors[k], driverUserId: driverUsers[k].id, status: 'in_service', delayMinutes: k === 2 ? 7 : 0 })));
      const stops = [];
      buses.forEach((b, k) => { const ang = k * 2.1 + .4; for (let p = 0; p < 5; p++) { const rad = .045 - p * .01; stops.push({ busId: b.id, position: p, name: p === 4 ? 'Entrée principale' : `${pick(['Place', 'Résidence', 'Parc', 'Rond-point'])} ${pick(['des Roses', 'Atlas', 'Océan', 'Jasmin', 'Palmiers'])}`, lat: +(def.center[0] + Math.sin(ang) * rad).toFixed(6), lng: +(def.center[1] + Math.cos(ang) * rad * 1.2).toFixed(6), scheduledTime: `07:${String(10 + p * 8).padStart(2, '0')}` }); } });
      const stopRows = await M.BusStop.bulkCreate(stops);
      const riders = students.filter(() => rnd() < .35).slice(0, 90);
      if (!riders.find(s => s.id === demoKids[0].id)) riders.push(demoKids[0]);
      await M.BusAssignment.bulkCreate(riders.map((s, k) => { const b = buses[k % 3]; const st = stopRows.filter(x => x.busId === b.id && x.position < 4); return { studentId: s.id, busId: b.id, stopId: pick(st).id }; }));
      await M.BusPosition.bulkCreate(buses.map(b => { const st = stopRows.filter(x => x.busId === b.id); return { busId: b.id, lat: st[1].lat, lng: st[1].lng, speed: 28, recordedAt: now }; }));
    }

    // ---- Cantine, activités, santé, objets perdus ----
    const MENUS = [['Salade marocaine', 'Tajine de poulet aux olives', 'Semoule', 'Orange à la cannelle', 'Tajine de légumes'], ['Velouté de potiron', 'Poisson meunière', 'Riz pilaf', 'Yaourt', 'Galette de pois chiches'], ['Carottes râpées', 'Bœuf aux légumes', 'Pâtes fraîches', 'Compote', 'Lasagnes aux légumes'], ['Harira', 'Couscous sept légumes', null, 'Salade de fruits', 'Couscous végétarien'], ['Taboulé', 'Émincé de dinde', 'Purée maison', 'Crème vanille', 'Omelette aux herbes']];
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    await M.CanteenMenu.bulkCreate(MENUS.map((m, k) => ({ onDate: iso(addDays(monday, k)), starter: m[0], main: m[1], side: m[2], dessert: m[3], vegetarian: m[4] })));
    const acts = await M.Activity.bulkCreate([['Club Robotique', 'Club', 18, 40000], ['Football U13', 'Sport', 22, 0], ['Théâtre', 'Club', 16, 25000], ['Sortie — Musée', 'Sortie', 45, 5000], ['Olympiades de mathématiques', 'Compétition', 12, 0]].map((a, k) => ({ name: a[0], kind: a[1], capacity: a[2], priceCents: a[3], startsAt: addDays(now, rint(3, 30)), schedule: pick(['Mercredi 14h–16h', 'Samedi 10h–12h']), place: pick(['Gymnase', 'Amphi', 'Terrain']), teacherId: teachers[k % teachers.length].id })));
    await M.ActivityEnrollment.bulkCreate(acts.flatMap(a => students.filter(() => rnd() < .04).slice(0, a.capacity).map(s => ({ activityId: a.id, studentId: s.id }))));
    const allergic = students.filter(() => rnd() < .08);
    await M.HealthRecord.bulkCreate(allergic.map(s => ({ studentId: s.id, bloodType: pick(['A+', 'O+', 'B+']), allergiesEnc: encrypt(pick(['Arachides', 'Gluten', 'Lactose'])), diet: rnd() < .3 ? 'Sans gluten' : null })));
    await M.InfirmaryVisit.bulkCreate(students.filter(() => rnd() < .03).map(s => ({ studentId: s.id, visitedAt: addDays(now, -rint(0, 10)), kind: rnd() < .2 ? 'accident' : 'visit', reasonEnc: encrypt(pick(['Maux de tête', 'Chute en récréation', 'Fièvre légère'])), careEnc: encrypt(pick(['Repos 20 min', 'Pansement', 'Parents contactés'])), parentsNotified: true, nurseUserId: staff[3].id })));
    await M.LostItem.bulkCreate([['lost', 'Sac', 'Sac à dos noir Eastpak avec porte-clés étoile', 'Cour de récréation'], ['found', 'Sac', 'Sac à dos noir avec un porte-clés en forme d\'étoile', 'Cour de récréation'], ['found', 'Lunettes', 'Lunettes de vue monture noire, étui rouge', 'Bibliothèque'], ['lost', 'Téléphone', 'iPhone bleu, coque transparente', 'Gymnase'], ['found', 'Vêtement', 'Veste de sport bleu marine taille 12 ans', 'Vestiaires']].map(x => ({ kind: x[0], category: x[1], description: x[2], place: x[3], onDate: iso(addDays(now, -rint(0, 7))), status: 'open', reportedBy: admin.id })));

    // ---- Inscriptions en ligne ----
    await M.EnrollmentApplication.bulkCreate(Array.from({ length: 10 }, (_, k) => ({ studentFirstName: pick(FIRST_F.concat(FIRST_M)), studentLastName: pick(LAST), birthDate: `${now.getFullYear() - rint(6, 15)}-05-12`, levelId: pick(levelRows).id, guardianName: `${pick(FIRST_F)} ${pick(LAST)}`, guardianPhone: '+212 600 00 00 00', guardianEmail: `famille${k}@gmail.com`, status: ['new', 'new', 'new', 'review', 'review', 'accepted', 'enrolled', 'new', 'review', 'rejected'][k], docs: [], paid: k % 3 === 0, source: pick(['Site web', 'Recommandation', 'Portes ouvertes']) })));

    // ---- Finance ----
    const FEES = { Primaire: 260000, 'Collège': 310000, 'Lycée': 360000 };
    const invoices = [];
    let num = 1;
    const cycleOf = cid => levelRows[classes.findIndex(c => c.id === cid)].cycle;
    for (const s of students) {
      const risk = rnd();
      invoices.push({ number: `F-${year}-${String(num++).padStart(5, '0')}`, studentId: s.id, label: 'Frais d\'inscription', kind: 'registration', dueOn: `${year}-08-31`, amountCents: 300000, status: 'paid', paidAt: `${year}-08-20 10:00:00` });
      for (const [m, label] of [[8, 'Septembre'], [9, 'Octobre']]) {
        const due = new Date(year, m, 5);
        const status = due > now ? 'due' : risk < .07 ? 'overdue' : risk < .18 && m === 9 ? 'due' : 'paid';
        invoices.push({ number: `F-${year}-${String(num++).padStart(5, '0')}`, studentId: s.id, label: `Scolarité ${label} ${year}`, kind: 'tuition', dueOn: iso(due), amountCents: FEES[cycleOf(s.classId)], status, paidAt: status === 'paid' ? iso(addDays(due, -rint(0, 4))) + ' 09:00:00' : null });
      }
    }
    const invRows = await M.Invoice.bulkCreate(invoices);
    await M.Payment.bulkCreate(invRows.filter(i => i.status === 'paid').map(i => ({ invoiceId: i.id, amountCents: i.amountCents, method: pick(['transfer', 'card', 'cheque', 'cash']), paidAt: i.paidAt, recordedBy: staff[2].id })));

    // ---- Communication, calendrier, support ----
    const math = tUsers[0];
    const conv = await M.Conversation.create({ kind: 'direct' });
    await M.ConversationMember.bulkCreate([{ conversationId: conv.id, userId: parentUser.id }, { conversationId: conv.id, userId: math.id }]);
    await M.Message.bulkCreate([[math.id, `Bonjour, ${demoKids[0].firstName} a fait de très beaux progrès ce mois-ci.`], [parentUser.id, 'Merci beaucoup pour ce retour !'], [math.id, 'Je lui ai proposé des exercices d\'approfondissement en ligne.']].map(([senderId, body]) => ({ conversationId: conv.id, senderId, body })));
    await M.Announcement.bulkCreate([{ title: 'Réunion parents-enseignants', body: 'Les rencontres individuelles auront lieu dans 3 jours de 16h30 à 19h.', audience: 'parents', channels: ['app', 'push'], pinned: true, publishedAt: now, authorId: admin.id }, { title: 'Menu de la semaine', body: 'Le menu est disponible, avec une option végétarienne chaque jour.', audience: 'all', channels: ['app'], publishedAt: addDays(now, -1), authorId: admin.id }]);
    await M.Event.bulkCreate([['Réunion parents-enseignants', 'Réunion', 3], ['Contrôle commun de mathématiques', 'Examen', 6], ['Sortie — Musée', 'Sortie', 9], ['Conseil de classe', 'Conseil', 12], ['Journée portes ouvertes', 'Événement', 18], ['Vacances d\'automne', 'Vacances', 26]].map(e => ({ title: e[0], kind: e[1], startsAt: `${iso(addDays(now, e[2]))} 14:00:00`, endsAt: e[1] === 'Vacances' ? `${iso(addDays(now, e[2] + 8))} 18:00:00` : null })));
    const tk = await M.Ticket.bulkCreate([['Erreur sur la facture de septembre', 'Finance', parentUser.id, 'new'], ['Vidéoprojecteur en panne — B102', 'Logistique', math.id, 'in_progress'], ['Demande de relevé de notes', 'Scolarité', parentUser.id, 'resolved']].map((t, k) => ({ number: `TK-${1001 + k}`, subject: t[0], category: t[1], authorId: t[2], status: t[3], priority: 'normal' })));
    await M.TicketMessage.bulkCreate(tk.map(t => ({ ticketId: t.id, authorId: t.authorId, body: `Bonjour, ${t.subject.toLowerCase()}. Merci de votre aide.` })));
    await M.Notification.bulkCreate([{ userId: parentUser.id, kind: 'grade', title: `${demoKids[0].firstName} a obtenu 16/20 en mathématiques.`, body: 'Contrôle 2' }, { userId: parentUser.id, kind: 'payment_due', title: 'Le paiement du mois est en attente.' }, { userId: admin.id, kind: 'enrollment', title: '3 nouvelles demandes d\'inscription' }]);

    console.log(`  ✓ ${def.name} : ${classes.length} classes, ${students.length} élèves, ${teachers.length} enseignants, ${grades.length} notes, ${invRows.length} factures`);
  });
}

(async () => {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const existing = await runAsSystem(() => M.Tenant.count());
  if (existing) { console.log('Des établissements existent déjà. Utilisez `npm run db:reset` pour repartir de zéro.'); process.exit(0); }
  console.log('Génération des données de démonstration…');
  for (const def of TENANTS) await seedTenant(def, hash);
  console.log(`\nComptes de démo (mot de passe : ${DEMO_PASSWORD}) — en-tête X-Tenant: alfarabi | lumiere`);
  for (const r of ['direction', 'scolarite', 'comptabilite', 'infirmerie', 'enseignant', 'parent', 'eleve', 'chauffeur']) console.log(`  ${r}@<slug>.athenee.app`);
  await M.sequelize.close();
})().catch(async e => { console.error(e); await M.sequelize.close(); process.exit(1); });
