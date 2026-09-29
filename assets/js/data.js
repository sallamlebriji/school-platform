/* ==========================================================
   Athénée — Données de démonstration multi-tenant
   Chaque école (tenant) possède son propre jeu de données,
   généré de façon déterministe et strictement isolé.
   ========================================================== */
(function () {
  'use strict';

  // ---------- RNG déterministe ----------
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- Date de démo (jour ouvré) ----------
  const TODAY = new Date(); TODAY.setHours(8, 30, 0, 0);
  if (TODAY.getDay() === 6) TODAY.setDate(TODAY.getDate() + 2);
  if (TODAY.getDay() === 0) TODAY.setDate(TODAY.getDate() + 1);
  const DAY = 86400000;
  const addDays = (d, n) => new Date(d.getTime() + n * DAY);
  const iso = d => d.toISOString().slice(0, 10);

  const TENANTS = [
    {
      id: 'alfarabi', name: 'Groupe Scolaire Al Farabi', short: 'Al Farabi', initials: 'AF', city: 'Casablanca',
      color: '#13254A', plan: 'Premium', seats: 900, currency: 'MAD', domain: 'alfarabi.athenee.app',
      cycles: ['Maternelle', 'Primaire', 'Collège', 'Lycée'], groups: 2, year: '2026 – 2027', seed: 11,
      director: { first: 'Nadia', last: 'Benkirane' }
    },
    {
      id: 'lumiere', name: 'École Internationale Lumière', short: 'Lumière', initials: 'EL', city: 'Rabat',
      color: '#5A2E3A', plan: 'Essentiel', seats: 400, currency: 'MAD', domain: 'ecole-lumiere.ma',
      cycles: ['Primaire', 'Collège'], groups: 1, year: '2026 – 2027', seed: 97,
      director: { first: 'Julien', last: 'Morel' }
    }
  ];

  const FIRST_F = ['Salma', 'Yasmine', 'Inès', 'Lina', 'Rim', 'Aya', 'Malak', 'Sara', 'Nour', 'Léa', 'Chloé', 'Emma', 'Jade', 'Hiba', 'Imane', 'Zineb', 'Meryem', 'Kenza', 'Ghita', 'Camille', 'Manon', 'Alice', 'Douae', 'Hajar', 'Rania', 'Aïcha', 'Louise', 'Sofia', 'Amira', 'Nadia'];
  const FIRST_M = ['Adam', 'Youssef', 'Mehdi', 'Omar', 'Rayan', 'Ilyas', 'Hamza', 'Anas', 'Amine', 'Karim', 'Hugo', 'Lucas', 'Louis', 'Nathan', 'Yanis', 'Zakaria', 'Othmane', 'Ayoub', 'Idriss', 'Ali', 'Tom', 'Gabriel', 'Jules', 'Saad', 'Taha', 'Walid', 'Nassim', 'Marc', 'Réda', 'Ismail'];
  const LAST = ['Alaoui', 'Bennani', 'El Idrissi', 'Tazi', 'Berrada', 'Chraibi', 'Fassi', 'Lahlou', 'Kettani', 'Sebti', 'Benjelloun', 'Amrani', 'Ouazzani', 'Naciri', 'Belkadi', 'Mansouri', 'Martin', 'Bernard', 'Dubois', 'Laurent', 'Moreau', 'Lefèvre', 'Garcia', 'Rousseau', 'Haddad', 'Zniber', 'Squalli', 'Guessous', 'Filali', 'Cherkaoui', 'Bouzidi', 'Daoudi', 'Kabbaj', 'Lamrani', 'Sqalli', 'Mernissi'];
  const JOBS = ['Médecin', 'Ingénieur(e)', 'Architecte', 'Avocat(e)', 'Enseignant(e)', 'Entrepreneur(e)', 'Pharmacien(ne)', 'Cadre bancaire', 'Consultant(e)', 'Fonctionnaire', 'Commerçant(e)', 'Journaliste'];

  const SUBJECTS = [
    { id: 'math', name: 'Mathématiques', short: 'Maths', color: '#1D3462', coef: 4 },
    { id: 'fr', name: 'Français', short: 'Français', color: '#B08D57', coef: 4 },
    { id: 'ar', name: 'Arabe', short: 'Arabe', color: '#6F8FC4', coef: 3 },
    { id: 'en', name: 'Anglais', short: 'Anglais', color: '#8FB0A0', coef: 2 },
    { id: 'hg', name: 'Histoire-Géographie', short: 'Histoire-Géo', color: '#C9A97A', coef: 2 },
    { id: 'svt', name: 'Sciences de la Vie et de la Terre', short: 'SVT', color: '#5F8C6E', coef: 2 },
    { id: 'pc', name: 'Physique-Chimie', short: 'Physique', color: '#7C6AA6', coef: 3 },
    { id: 'info', name: 'Informatique', short: 'Info', color: '#3A7C8C', coef: 1 },
    { id: 'eps', name: 'Éducation physique', short: 'EPS', color: '#A9B4C8', coef: 1 },
    { id: 'art', name: 'Arts plastiques', short: 'Arts', color: '#B97A6B', coef: 1 }
  ];

  const LEVELS = {
    'Maternelle': ['PS', 'MS', 'GS'],
    'Primaire': ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
    'Collège': ['6e', '5e', '4e', '3e'],
    'Lycée': ['2nde', '1re', 'Tle']
  };
  const SUBJ_BY_CYCLE = {
    'Maternelle': ['fr', 'ar', 'en', 'art', 'eps'],
    'Primaire': ['math', 'fr', 'ar', 'en', 'hg', 'svt', 'art', 'eps'],
    'Collège': ['math', 'fr', 'ar', 'en', 'hg', 'svt', 'pc', 'info', 'eps'],
    'Lycée': ['math', 'fr', 'ar', 'en', 'hg', 'svt', 'pc', 'info', 'eps']
  };
  const ROOMS = ['A101', 'A102', 'A103', 'A201', 'A202', 'A203', 'B101', 'B102', 'B201', 'B202', 'C101', 'C102', 'Labo 1', 'Labo 2', 'Salle Info', 'Gymnase', 'Atelier Arts', 'Amphi'];

  const cache = {};

  function build(t) {
    const r = mulberry(t.seed * 7919);
    const pick = a => a[Math.floor(r() * a.length)];
    const rint = (a, b) => a + Math.floor(r() * (b - a + 1));
    const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const phone = () => '+212 6' + rint(10, 99) + ' ' + rint(10, 99) + ' ' + rint(10, 99) + ' ' + rint(10, 99);
    const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

    const D = { tenant: t, subjects: SUBJECTS, today: TODAY };

    // ----- Niveaux & classes -----
    D.levels = []; D.classes = [];
    let roomI = 0;
    t.cycles.forEach(cy => LEVELS[cy].forEach(lv => {
      D.levels.push({ id: lv, name: lv, cycle: cy });
      const groups = cy === 'Maternelle' ? 1 : t.groups;
      for (let g = 0; g < groups; g++) {
        const name = lv + (t.groups > 1 && groups > 1 ? ' ' + 'AB'[g] : '');
        D.classes.push({ id: 'c' + D.classes.length, name, level: lv, cycle: cy, room: ROOMS[roomI++ % 12], capacity: cy === 'Maternelle' ? 24 : 30, studentIds: [], subjects: SUBJ_BY_CYCLE[cy], teachers: {} });
      }
    }));

    // ----- Enseignants -----
    D.teachers = [];
    const needed = {};
    D.classes.forEach(c => c.subjects.forEach(s => needed[s] = (needed[s] || 0) + 1));
    Object.keys(needed).forEach(sid => {
      const n = Math.max(1, Math.ceil(needed[sid] / 5));
      for (let i = 0; i < n; i++) {
        const f = r() < .55; const first = pick(f ? FIRST_F : FIRST_M); const last = pick(LAST);
        D.teachers.push({ id: 't' + D.teachers.length, first, last, gender: f ? 'F' : 'M', subject: sid, classes: [], email: slug(first) + '.' + slug(last) + '@' + t.domain, phone: phone(), hours: 0, since: 2012 + rint(0, 13), rating: (4 + r()).toFixed(1), status: r() < .04 ? 'Absent' : 'Actif' });
      }
    });
    D.classes.forEach(c => c.subjects.forEach(sid => {
      const cands = D.teachers.filter(x => x.subject === sid).sort((a, b) => a.classes.length - b.classes.length);
      const tt = cands[0]; tt.classes.push(c.id); c.teachers[sid] = tt.id;
    }));
    D.classes.forEach(c => { c.mainTeacher = c.teachers.fr || c.teachers.math || Object.values(c.teachers)[0]; });

    // ----- Familles, parents & élèves -----
    D.students = []; D.parents = [];
    const target = Math.round(t.seats * (t.plan === 'Premium' ? .72 : .78));
    const perClass = Math.floor(target / D.classes.length);
    const slots = [];
    D.classes.forEach(c => { const n = Math.min(c.capacity, perClass + rint(-3, 3)); for (let i = 0; i < n; i++) slots.push(c.id); });
    // mélange
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    let si = 0;
    while (si < slots.length) {
      const last = pick(LAST);
      const kids = Math.min(slots.length - si, r() < .55 ? 1 : r() < .8 ? 2 : 3);
      const mother = { id: 'p' + D.parents.length, first: pick(FIRST_F), last, relation: 'Mère', phone: phone(), job: pick(JOBS), childIds: [] };
      mother.email = slug(mother.first) + '.' + slug(last) + '@gmail.com';
      D.parents.push(mother);
      let father = null;
      if (r() < .7) { father = { id: 'p' + D.parents.length, first: pick(FIRST_M), last, relation: 'Père', phone: phone(), job: pick(JOBS), childIds: [] }; father.email = slug(father.first) + '.' + slug(last) + '@gmail.com'; D.parents.push(father); }
      for (let k = 0; k < kids; k++) {
        const cid = slots[si++]; const cl = D.classes.find(c => c.id === cid);
        const f = r() < .5; const first = pick(f ? FIRST_F : FIRST_M);
        const lvIdx = D.levels.findIndex(l => l.id === cl.level);
        const baseAge = (t.cycles[0] === 'Maternelle' ? 3 : 6) + lvIdx;
        const birth = new Date(TODAY.getFullYear() - baseAge - 1, rint(0, 11), rint(1, 28));
        const s = {
          id: 's' + D.students.length, first, last, gender: f ? 'F' : 'M', birth: iso(birth), classId: cid,
          parentIds: [mother.id].concat(father ? [father.id] : []),
          matricule: t.initials + '-' + (2019 + rint(0, 7)) + '-' + String(1000 + D.students.length).slice(-4),
          ability: Math.max(6, Math.min(18.5, 12.8 + gauss() * 2.6)),
          attendance: Math.max(.82, Math.min(1, .965 + gauss() * .025)),
          bus: r() < .42 ? null : undefined, canteen: r() < .68,
          allergies: r() < .1 ? [pick(['Arachides', 'Gluten', 'Lactose', 'Fruits à coque', 'Œufs', 'Fruits de mer'])] : [],
          diet: r() < .06 ? pick(['Végétarien', 'Sans porc', 'Sans gluten']) : null,
          since: 2019 + rint(0, 7), address: rint(2, 180) + ', ' + pick(['Bd Anfa', 'Rue Ibn Sina', 'Av. Hassan II', 'Rue Moulay Youssef', 'Bd Zerktouni', 'Rue des Orangers', 'Av. Mohammed VI']) + ', ' + t.city,
          blood: pick(['A+', 'O+', 'B+', 'AB+', 'O-', 'A-']), docsMissing: r() < .08 ? [pick(['Certificat médical', 'Photo d\'identité', 'Copie CIN parent', 'Carnet de vaccination', 'Assurance scolaire'])] : [],
          online: Math.round(20 + r() * 80), clubs: []
        };
        cl.studentIds.push(s.id); mother.childIds.push(s.id); if (father) father.childIds.push(s.id);
        D.students.push(s);
      }
    }

    // ----- Évaluations & notes -----
    const TYPES = [['Contrôle', 1], ['Devoir surveillé', 2], ['Interrogation', .5], ['Examen', 3], ['Exposé', 1]];
    D.evaluations = [];
    D.classes.forEach(c => c.subjects.forEach(sid => {
      if (c.cycle === 'Maternelle') return;
      const n = rint(3, 4);
      for (let i = 0; i < n; i++) {
        const ty = i === n - 1 && r() < .5 ? TYPES[3] : pick([TYPES[0], TYPES[1], TYPES[2], TYPES[0], TYPES[4]]);
        const subjOff = (hash(c.id + sid) % 300) / 100 - 1.5;
        D.evaluations.push({ id: 'e' + D.evaluations.length, classId: c.id, subject: sid, type: ty[0], coef: ty[1], title: ty[0] + ' ' + (i + 1), date: iso(addDays(TODAY, -rint(3, 75))), max: 20, off: subjOff, published: r() < .92 });
      }
    }));
    D.gradeOf = function (st, ev) {
      const rr = mulberry(hash(st.id + ev.id));
      let g = st.ability + ev.off * .6 + (rr() - .5) * 5.2 + ((hash(st.id + ev.subject) % 100) / 100 - .5) * 3;
      return Math.round(Math.max(2, Math.min(20, g)) * 4) / 4;
    };

    // ----- Transport -----
    const LINES = [
      { name: 'Ligne 1 — Anfa', color: '#1D3462' }, { name: 'Ligne 2 — Maârif', color: '#B08D57' }, { name: 'Ligne 3 — Californie', color: '#3A7C8C' },
      { name: 'Ligne 4 — Bourgogne', color: '#7C6AA6' }, { name: 'Ligne 5 — Oasis', color: '#B97A6B' }, { name: 'Ligne 6 — Ain Diab', color: '#5F8C6E' }
    ];
    const SCHOOL = { x: 480, y: 300 };
    const nLines = t.id === 'alfarabi' ? 6 : 3;
    D.school = SCHOOL;
    D.buses = LINES.slice(0, nLines).map((L, i) => {
      const ang = (i / nLines) * Math.PI * 2 + .4; const stops = [];
      const nS = 5 + (i % 3);
      for (let k = nS; k >= 1; k--) {
        const rad = 40 + k * 38; const a2 = ang + Math.sin(k * 1.3 + i) * .35;
        stops.push({ name: pick(['Place', 'Rond-point', 'Résidence', 'Parc', 'Mosquée', 'Marché', 'Clinique', 'Lycée', 'Station']) + ' ' + pick(['des Roses', 'Mimosas', 'Palmiers', 'Oliviers', 'Anfa', 'Racine', 'Gauthier', 'Jasmin', 'Atlas', 'Océan']), x: Math.round(SCHOOL.x + Math.cos(a2) * rad * 1.45), y: Math.round(SCHOOL.y + Math.sin(a2) * rad * .95), time: '07:' + String(10 + (nS - k) * 6).padStart(2, '0') });
      }
      stops.push({ name: t.short + ' — Entrée principale', x: SCHOOL.x, y: SCHOOL.y, time: '07:' + String(10 + nS * 6).padStart(2, '0'), school: true });
      const driver = { first: pick(FIRST_M), last: pick(LAST), phone: phone() };
      const attendant = { first: pick(FIRST_F), last: pick(LAST), phone: phone() };
      return { id: 'b' + i, line: L.name, color: L.color, plate: rint(10000, 99999) + '-' + pick(['A', 'B', 'D', 'H']) + '-' + rint(1, 80), model: pick(['Mercedes Sprinter', 'Iveco Daily', 'Isuzu NQR', 'Otokar Navigo']), capacity: pick([30, 33, 45]), driver, attendant, stops, studentIds: [], progress: .15 + r() * .7, delay: i === 2 ? 7 : i === 4 ? 3 : 0, status: 'En circulation', rfid: pick(['QR Code', 'RFID', 'NFC']) };
    });
    D.students.forEach(s => {
      if (s.bus === null) {
        const b = D.buses[Math.floor(r() * D.buses.length)];
        if (b.studentIds.length < b.capacity) { s.bus = b.id; s.stop = Math.floor(r() * (b.stops.length - 1)); b.studentIds.push(s.id); } else s.bus = undefined;
      }
    });

    // ----- Finance -----
    const FEES = { 'Maternelle': 2200, 'Primaire': 2600, 'Collège': 3100, 'Lycée': 3600 };
    if (t.id === 'lumiere') { FEES['Primaire'] = 3400; FEES['Collège'] = 3900; }
    D.fees = FEES;
    D.invoices = [];
    const months = ['Sept.', 'Oct.', 'Nov.', 'Déc.', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin'];
    D.students.forEach(s => {
      const cl = D.classes.find(c => c.id === s.classId);
      const risk = r();
      D.invoices.push({ id: 'INV-' + (24000 + D.invoices.length), studentId: s.id, label: 'Frais d\'inscription', type: 'Inscription', amount: 3000, due: iso(addDays(TODAY, -40)), status: risk < .03 ? 'En retard' : 'Payé', method: pick(['Virement', 'Carte', 'Chèque', 'Espèces']) });
      const amount = FEES[cl.cycle] + (s.bus ? 650 : 0) + (s.canteen ? 700 : 0);
      [0, 1].forEach(m => {
        const due = new Date(TODAY.getFullYear(), 8 + m, 5);
        let status = 'Payé';
        if (due > TODAY) status = 'À venir';
        else if (m === 0) status = risk < .06 ? 'En retard' : 'Payé';
        else status = risk < .1 ? 'En retard' : risk < .22 ? 'En attente' : 'Payé';
        D.invoices.push({ id: 'INV-' + (24000 + D.invoices.length), studentId: s.id, label: 'Scolarité ' + months[m] + ' ' + due.getFullYear(), type: 'Scolarité', amount, due: iso(due), status, method: status === 'Payé' ? pick(['Virement', 'Carte', 'Prélèvement', 'Chèque']) : null, detail: { scolarite: FEES[cl.cycle], transport: s.bus ? 650 : 0, cantine: s.canteen ? 700 : 0 } });
      });
    });
    const base = D.students.reduce((a, s) => a + FEES[D.classes.find(c => c.id === s.classId).cycle], 0);
    D.revenueMonths = ['Sept.', 'Oct.', 'Nov.', 'Déc.', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août'];
    D.revenue = D.revenueMonths.map((m, i) => { const k = i < 10 ? 1 : .08; return Math.round(base * 1.18 * k * (0.93 + r() * .07) * (i === 0 ? 1.45 : 1)); });
    D.revenuePrev = D.revenue.map(v => Math.round(v * (.86 + r() * .06)));
    D.overdueMonths = D.revenueMonths.slice(0, 10).map(() => Math.round(base * (.03 + r() * .05)));

    // ----- Inscriptions (historique + candidatures) -----
    const cnt = D.students.length;
    D.enrollHistory = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y, i) => ({ year: y + '', value: Math.round(cnt * (.62 + i * .063) + (r() - .5) * 20) }));
    D.enrollHistory[6].value = cnt;
    D.applications = [];
    const APP_ST = ['Nouveau', 'En vérification', 'Accepté', 'Inscrit'];
    for (let i = 0; i < 22; i++) {
      const f = r() < .5; const lv = pick(D.levels);
      D.applications.push({ id: 'a' + i, first: pick(f ? FIRST_F : FIRST_M), last: pick(LAST), level: lv.id, status: APP_ST[i % 7 < 3 ? 0 : i % 7 < 5 ? 1 : i % 7 < 6 ? 2 : 3], date: iso(addDays(TODAY, -rint(0, 30))), parent: pick(FIRST_F) + ' ' + pick(LAST), phone: phone(), docs: rint(2, 5), docsTotal: 5, paid: r() < .5, source: pick(['Site web', 'Recommandation', 'Portes ouvertes', 'Réseaux sociaux']) });
    }

    // ----- Présences du jour -----
    D.todayAbsences = []; D.todayLates = [];
    D.students.forEach(s => {
      const rr = r();
      if (rr > s.attendance + .015) D.todayAbsences.push({ studentId: s.id, justified: r() < .45, reason: pick(['Maladie', 'Rendez-vous médical', 'Raison familiale', 'Non communiqué', 'Non communiqué']), period: pick(['Journée', 'Matin', 'Après-midi']), notified: true });
      else if (rr > s.attendance - .02) D.todayLates.push({ studentId: s.id, minutes: pick([5, 8, 10, 12, 15, 20, 25]) });
    });
    D.attendanceWeeks = Array.from({ length: 12 }, (_, i) => ({ label: 'S' + (i + 1), present: 93 + r() * 5, justified: 1 + r() * 2, unjustified: .5 + r() * 1.8 }));

    // ----- Cours en ligne -----
    const COURSE_T = { math: ['Fonctions et dérivées', 'Géométrie dans l\'espace', 'Fractions et proportionnalité'], fr: ['Le roman au XIXe siècle', 'Argumentation et débat', 'Poésie : Baudelaire'], ar: ['النحو والصرف', 'القراءة والتعبير'], en: ['Speaking with confidence', 'Grammar essentials'], hg: ['La Révolution industrielle', 'Les grandes découvertes'], svt: ['La cellule vivante', 'Écosystèmes et biodiversité'], pc: ['Électricité : lois fondamentales', 'Réactions chimiques'], info: ['Algorithmique avec Python', 'Initiation au Web'] };
    D.courses = [];
    Object.keys(COURSE_T).forEach(sid => COURSE_T[sid].forEach(title => {
      const tch = D.teachers.find(x => x.subject === sid); if (!tch) return;
      const lvl = pick(D.levels.filter(l => l.cycle !== 'Maternelle'));
      const chapters = rint(4, 9);
      D.courses.push({ id: 'co' + D.courses.length, title, subject: sid, teacherId: tch.id, level: lvl.id, chapters, videos: rint(3, 14), docs: rint(2, 10), quizzes: rint(1, 5), students: rint(20, 90), completion: Math.round(25 + r() * 70), rating: (4 + r()).toFixed(1), updated: iso(addDays(TODAY, -rint(0, 20))), duration: rint(3, 14) + ' h' });
    }));
    D.onlineUsage = Array.from({ length: 12 }, (_, i) => ({ label: 'S' + (i + 1), hours: Math.round(400 + i * 60 + r() * 180), active: Math.round(cnt * (.35 + i * .025 + r() * .05)) }));

    // ----- Devoirs -----
    D.homework = [];
    const HW = { math: ['Exercices 12 à 18 p.84', 'Problème : optimisation', 'Série d\'exercices sur les fractions'], fr: ['Commentaire de texte', 'Rédaction : récit d\'aventure', 'Fiche de lecture'], en: ['Essay: My ideal school', 'Vocabulary worksheet'], hg: ['Carte : les reliefs', 'Frise chronologique'], svt: ['Compte rendu de TP', 'Schéma de la cellule'], pc: ['Exercices circuits électriques', 'Rapport de laboratoire'], ar: ['تمارين في النحو', 'تعبير كتابي'], info: ['Mini-projet Python'] };
    D.classes.filter(c => c.cycle !== 'Maternelle').forEach(c => {
      for (let i = 0; i < 3; i++) {
        const sid = pick(c.subjects.filter(x => HW[x]));
        const offs = rint(-10, 9);
        const n = c.studentIds.length; const submitted = offs < 0 ? rint(Math.floor(n * .75), n) : rint(0, Math.floor(n * .6));
        D.homework.push({ id: 'h' + D.homework.length, classId: c.id, subject: sid, teacherId: c.teachers[sid], title: pick(HW[sid]), due: iso(addDays(TODAY, offs)), created: iso(addDays(TODAY, offs - rint(5, 10))), submitted, corrected: offs < -3 ? submitted : Math.floor(submitted * r() * .5), total: n, attachments: rint(0, 3) });
      }
    });

    // ----- Bibliothèque -----
    const BOOKS = [['Le Petit Prince', 'Antoine de Saint-Exupéry', 'fr', 'Livre'], ['Les Misérables', 'Victor Hugo', 'fr', 'Livre'], ['L\'Étranger', 'Albert Camus', 'fr', 'Livre'], ['Maths Terminale — Manuel', 'Collectif Hachette', 'math', 'Manuel'], ['Physique-Chimie 3e', 'Collectif Nathan', 'pc', 'Manuel'], ['Atlas du monde', 'Éditions Autrement', 'hg', 'Référence'], ['Harry Potter à l\'école des sorciers', 'J.K. Rowling', 'en', 'Livre'], ['Kalila wa Dimna', 'Ibn al-Muqaffa\'', 'ar', 'Livre'], ['La cellule en schémas', 'Pr. Amrani', 'svt', 'PDF'], ['Algorithmique pour débutants', 'Équipe Info', 'info', 'PDF'], ['Méthodologie de la dissertation', 'Équipe Français', 'fr', 'Support de cours'], ['Les fractions en vidéo', 'Équipe Maths', 'math', 'Vidéo'], ['English Grammar in Use', 'Raymond Murphy', 'en', 'Manuel'], ['Histoire du Maroc', 'Collectif', 'hg', 'Référence'], ['Le Horla', 'Guy de Maupassant', 'fr', 'Livre'], ['Chimie organique — cours', 'Équipe Physique', 'pc', 'PDF'], ['Initiation au dessin', 'Atelier Arts', 'art', 'Vidéo'], ['Le Cid', 'Pierre Corneille', 'fr', 'Livre'], ['Probabilités — fiches', 'Équipe Maths', 'math', 'Support de cours'], ['Ecosystems explained', 'BBC Learning', 'svt', 'Vidéo'], ['Le Comte de Monte-Cristo', 'Alexandre Dumas', 'fr', 'Livre'], ['الأيام', 'طه حسين', 'ar', 'Livre'], ['Python pas à pas', 'Équipe Info', 'info', 'Support de cours'], ['Géographie mondiale', 'Collectif Belin', 'hg', 'Manuel']];
    const COVERS = ['#1D3462', '#5A2E3A', '#2E5E4E', '#7A5A2E', '#3F5C99', '#6B4C7A', '#8C6B3A', '#2F4858'];
    D.books = BOOKS.map((b, i) => ({ id: 'bk' + i, title: b[0], author: b[1], subject: b[2], kind: b[3], level: pick(['Primaire', 'Collège', 'Lycée', 'Tous niveaux']), downloads: rint(12, 480), cover: COVERS[i % COVERS.length], available: r() < .8, year: rint(1990, 2025), pages: rint(40, 520) }));

    // ----- Cantine -----
    D.menu = [
      { day: 'Lundi', starter: 'Salade marocaine', main: 'Tajine de poulet aux olives', side: 'Semoule fine', dessert: 'Orange à la cannelle', veg: 'Tajine de légumes' },
      { day: 'Mardi', starter: 'Velouté de potiron', main: 'Poisson meunière', side: 'Riz pilaf', dessert: 'Yaourt nature', veg: 'Galette de pois chiches' },
      { day: 'Mercredi', starter: 'Carottes râpées', main: 'Bœuf bourguignon', side: 'Pâtes fraîches', dessert: 'Compote de pommes', veg: 'Lasagnes aux légumes' },
      { day: 'Jeudi', starter: 'Harira', main: 'Couscous sept légumes', side: '—', dessert: 'Salade de fruits', veg: 'Couscous végétarien' },
      { day: 'Vendredi', starter: 'Taboulé', main: 'Émincé de dinde', side: 'Purée maison', dessert: 'Crème dessert vanille', veg: 'Omelette aux herbes' }
    ];
    D.canteenWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map(d => ({ label: d, value: Math.round(D.students.filter(s => s.canteen).length * (.88 + r() * .1)) }));

    // ----- Activités -----
    const ACTS = [['Club Robotique', 'Club', 'Science', 18], ['Football U13', 'Sport', 'Sport', 22], ['Théâtre en français', 'Club', 'Culture', 16], ['Échecs', 'Club', 'Culture', 20], ['Natation', 'Sport', 'Sport', 15], ['Chorale', 'Club', 'Culture', 30], ['Olympiades de mathématiques', 'Compétition', 'Science', 12], ['Sortie — Musée Mohammed VI', 'Sortie', 'Culture', 45], ['Voyage à Ifrane — classe verte', 'Voyage', 'Nature', 40], ['Journée portes ouvertes', 'Événement', 'École', 0], ['Basketball', 'Sport', 'Sport', 20], ['Model United Nations', 'Compétition', 'Culture', 16]];
    D.activities = ACTS.map((a, i) => ({ id: 'ac' + i, name: a[0], kind: a[1], cat: a[2], capacity: a[3], enrolled: a[3] ? rint(Math.floor(a[3] * .5), a[3]) : 0, date: iso(addDays(TODAY, rint(-5, 45))), schedule: pick(['Mercredi 14h–16h', 'Samedi 10h–12h', 'Mardi 16h30–18h', 'Jeudi 16h30–18h']), teacherId: pick(D.teachers).id, price: pick([0, 0, 250, 400, 1200]), place: pick(['Gymnase', 'Salle polyvalente', 'Amphi', 'Terrain', 'Extérieur', 'Piscine municipale']) }));
    D.students.forEach(s => { if (r() < .35) { const a = pick(D.activities.filter(x => x.capacity)); s.clubs.push(a.id); } });

    // ----- Objets perdus / trouvés -----
    const LF = [['Téléphone', 'iPhone 13 bleu, coque transparente', 'phone'], ['Sac', 'Sac à dos Eastpak noir avec porte-clés étoile', 'bag'], ['Cahier', 'Cahier de mathématiques vert, 96 pages', 'book'], ['Vêtement', 'Veste de sport bleu marine, taille 12 ans', 'shirt'], ['Lunettes', 'Lunettes de vue monture noire, étui rouge', 'glasses'], ['Clés', 'Trousseau de 3 clés avec badge', 'key'], ['Carte scolaire', 'Carte scolaire au nom de ' + D.students[3].first + ' ' + D.students[3].last, 'card'], ['Accessoires', 'Montre Casio argentée', 'watch'], ['Vêtement', 'Pull gris col rond, marqué "Y.B."', 'shirt'], ['Sac', 'Trousse bleue avec feutres', 'bag'], ['Accessoires', 'Gourde isotherme blanche', 'bottle'], ['Téléphone', 'Samsung Galaxy noir, écran fissuré', 'phone']];
    D.lostFound = LF.map((x, i) => ({ id: 'lf' + i, category: x[0], desc: x[1], icon: x[2], type: i % 3 === 0 ? 'Perdu' : 'Trouvé', place: pick(['Cour de récréation', 'Cantine', 'Gymnase', 'Bus Ligne 2', 'Bibliothèque', 'Salle A201', 'Vestiaires']), date: iso(addDays(TODAY, -rint(0, 20))), by: pick(D.students).id, status: r() < .25 ? 'Récupéré' : 'Ouvert' }));

    // ----- Infirmerie -----
    D.infirmary = Array.from({ length: 14 }, (_, i) => {
      const s = pick(D.students);
      return { id: 'inf' + i, studentId: s.id, date: iso(addDays(TODAY, -Math.floor(i / 2))), time: rint(8, 16) + 'h' + String(rint(0, 5) * 10).padStart(2, '0'), reason: pick(['Maux de tête', 'Chute en récréation', 'Douleurs abdominales', 'Fièvre légère', 'Égratignure au genou', 'Saignement de nez', 'Allergie cutanée', 'Entorse légère (EPS)']), care: pick(['Repos 20 min', 'Désinfection et pansement', 'Glace appliquée', 'Parents contactés — retour à domicile', 'Surveillance', 'Paracétamol (autorisation parentale)']), kind: i % 5 === 1 ? 'Accident' : 'Passage', parentsNotified: r() < .7, nurse: 'Inf. ' + pick(['Khadija Amrani', 'Sophie Laurent']) };
    });

    // ----- Événements & calendrier -----
    const EV = [['Réunion parents-enseignants', 'Réunion', 3], ['Conseil de classe — Collège', 'Conseil', 12], ['Contrôle commun de mathématiques', 'Examen', 6], ['Sortie — Musée Mohammed VI', 'Sortie', 9], ['Journée portes ouvertes', 'Événement', 18], ['Vacances d\'automne', 'Vacances', 26], ['Examens blancs — Lycée', 'Examen', 21], ['Tournoi inter-écoles de football', 'Activité', 15], ['Remise des bulletins T1', 'Événement', 35], ['Formation enseignants — IA pédagogique', 'Réunion', 7], ['Spectacle de fin de trimestre', 'Événement', 40], ['Contrôle d\'anglais — 3e', 'Examen', 4], ['Club robotique — démonstration', 'Activité', 11], ['Visite médicale annuelle', 'Événement', 2], ['Conseil de classe — Lycée', 'Conseil', 13]];
    D.events = EV.map((e, i) => ({ id: 'ev' + i, title: e[0], kind: e[1], date: iso(addDays(TODAY, e[2] - 1)), days: e[1] === 'Vacances' ? 9 : 1, time: pick(['08:30', '10:00', '14:00', '16:30', '18:00']) }));

    // ----- Communication -----
    const tMath = D.teachers.find(x => x.subject === 'math'), tFr = D.teachers.find(x => x.subject === 'fr');
    D.threads = [
      { id: 'th0', with: tMath.first + ' ' + tMath.last, role: 'Enseignant — Mathématiques', unread: 2, msgs: [['in', 'Bonjour, je souhaitais vous informer que Adam a fait de très beaux progrès en géométrie ce mois-ci.', '09:12'], ['out', 'Merci beaucoup pour ce retour, cela nous fait très plaisir !', '09:30'], ['in', 'Je lui ai proposé quelques exercices d\'approfondissement sur la plateforme.', '09:34'], ['in', 'N\'hésitez pas à m\'écrire si vous avez des questions.', '09:35']] },
      { id: 'th1', with: 'Administration', role: 'Service scolarité', unread: 0, msgs: [['out', 'Bonjour, pourriez-vous m\'envoyer un certificat de scolarité ?', 'Hier'], ['in', 'Bonjour, il est disponible dans l\'onglet Documents. Bonne journée !', 'Hier']] },
      { id: 'th2', with: tFr.first + ' ' + tFr.last, role: 'Enseignant — Français', unread: 1, msgs: [['in', 'La fiche de lecture est à rendre pour vendredi. Pensez à vérifier le cahier de textes.', 'Lun.']] },
      { id: 'th3', with: 'Parents — ' + D.classes[4].name, role: 'Groupe · ' + D.classes[4].studentIds.length + ' membres', unread: 5, msgs: [['in', 'Rappel : la sortie au musée aura lieu jeudi, départ 8h30.', 'Lun.'], ['in', 'Pensez à l\'autorisation signée.', 'Lun.']] },
      { id: 'th4', with: 'Transport scolaire', role: 'Coordination bus', unread: 0, msgs: [['in', 'Le bus de la Ligne 3 aura environ 7 minutes de retard ce matin en raison de la circulation.', '07:21']] }
    ];
    D.announcements = [
      { title: 'Réunion parents-enseignants', body: 'Les rencontres individuelles auront lieu dans 3 jours de 16h30 à 19h. Réservez votre créneau depuis l\'espace parent.', date: iso(TODAY), audience: 'Tous les parents', pinned: true },
      { title: 'Nouveau menu de la cantine', body: 'Le menu de la semaine est disponible, avec une option végétarienne chaque jour.', date: iso(addDays(TODAY, -1)), audience: 'Parents & élèves' },
      { title: 'Vacances d\'automne', body: 'L\'établissement sera fermé pendant les vacances d\'automne. Reprise des cours selon le calendrier officiel.', date: iso(addDays(TODAY, -3)), audience: 'Toute l\'école' },
      { title: 'Plateforme e-learning : nouveaux cours', body: '12 nouveaux chapitres ont été publiés en mathématiques et physique-chimie.', date: iso(addDays(TODAY, -4)), audience: 'Élèves Collège & Lycée' }
    ];

    // ----- Tickets -----
    const TK = [['Erreur sur la facture de septembre', 'Finance', 'Parent'], ['Bus arrivé en retard 3 jours de suite', 'Transport', 'Parent'], ['Demande de changement de groupe', 'Scolarité', 'Parent'], ['Vidéoprojecteur en panne — salle B201', 'Logistique', 'Enseignant'], ['Accès à la plateforme e-learning', 'Technique', 'Élève'], ['Allergie non prise en compte à la cantine', 'Cantine', 'Parent'], ['Demande de relevé de notes', 'Scolarité', 'Élève'], ['Climatisation salle A203', 'Logistique', 'Enseignant'], ['Justificatif d\'absence refusé', 'Vie scolaire', 'Parent']];
    const TK_ST = ['Nouveau', 'En cours', 'Résolu', 'Fermé'];
    D.tickets = TK.map((x, i) => ({ id: 'TK-' + (1040 + i), subject: x[0], cat: x[1], from: x[2], author: x[2] === 'Enseignant' ? (pick(D.teachers).first + ' ' + pick(LAST)) : pick(D.parents).first + ' ' + pick(LAST), status: TK_ST[i % 4 === 3 ? 3 : i % 3], priority: pick(['Basse', 'Normale', 'Normale', 'Haute']), date: iso(addDays(TODAY, -rint(0, 12))), msgs: rint(1, 6) }));

    // ----- Documents -----
    D.documents = [
      ['Certificat de scolarité', 'Généré automatiquement', 'Administratif'], ['Attestation d\'inscription', 'Généré automatiquement', 'Administratif'], ['Bulletin T3 2025-2026', 'Bulletin', 'Scolarité'], ['Relevé de notes annuel', 'Relevé', 'Scolarité'], ['Contrat de scolarité 2026-2027', 'Contrat', 'Juridique'], ['Autorisation de sortie — Musée', 'Autorisation', 'Vie scolaire'], ['Autorisation droit à l\'image', 'Autorisation', 'Juridique'], ['Justificatif d\'absence', 'Justificatif', 'Vie scolaire'], ['Règlement intérieur', 'Référence', 'Juridique'], ['Fiche sanitaire', 'Santé', 'Confidentiel']
    ].map((d, i) => ({ id: 'd' + i, name: d[0], kind: d[1], cat: d[2], date: iso(addDays(TODAY, -rint(0, 60))), size: rint(80, 900) + ' Ko', signed: r() < .7 }));

    // ----- Audit log -----
    D.audit = [
      ['Connexion réussie (2FA)', 'N. Benkirane', '41.249.12.8'], ['Export des impayés (CSV)', 'Service financier', '41.249.12.8'], ['Modification de note — Maths 3e A', 'Enseignant', '105.66.3.20'], ['Consultation dossier médical', 'Infirmerie', '41.249.12.9'], ['Création utilisateur (Parent)', 'Scolarité', '41.249.12.8'], ['Échec de connexion ×3 — compte verrouillé', 'Inconnu', '196.12.44.7'], ['Changement de rôle : Enseignant → Coordinateur', 'Admin', '41.249.12.8'], ['Sauvegarde chiffrée terminée', 'Système', '—'], ['Publication bulletin T1 — Collège', 'Direction', '41.249.12.8']
    ].map((a, i) => ({ action: a[0], by: a[1], ip: a[2], at: new Date(TODAY.getTime() - i * 2.3 * 3600000).toISOString() }));

    // ----- Satisfaction -----
    D.satisfaction = [{ label: 'Pédagogie', value: 4.6 }, { label: 'Communication', value: 4.4 }, { label: 'Transport', value: 4.1 }, { label: 'Cantine', value: 3.9 }, { label: 'Activités', value: 4.5 }, { label: 'Plateforme', value: 4.7 }];

    return D;
  }

  window.DB = {
    TENANTS, TODAY, DAY, iso, addDays, hash, mulberry,
    get(id) { if (!cache[id]) cache[id] = build(TENANTS.find(t => t.id === id)); return cache[id]; }
  };
})();
