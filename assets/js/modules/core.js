/* ==========================================================
   Modules : Dashboards (4 rôles), Élèves & fiche 360°,
   Parents, Enseignants, Classes, Inscriptions
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, badge, num, pct, dec, date, dateShort, relDays, age, fullName, avatar, who } = UI;
  const { D, S, Views, head, kpi, delta, card, tabs, bindTabs, currentUser, State } = App;
  const C = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  const HEX = ['#1D3462', '#B08D57', '#6F8FC4', '#8FB0A0', '#C9A97A', '#A9B4C8'];

  // ==========================================================
  // DASHBOARD
  // ==========================================================
  Views.dashboard = function () {
    return ({ admin: adminDash, teacher: teacherDash, parent: parentDash, student: studentDash })[State.role]();
  };

  function greeting() { const h = new Date().getHours(); return h < 18 ? 'Bonjour' : 'Bonsoir'; }

  function adminDash() {
    const d = D(), u = currentUser(), t = d.tenant;
    const n = d.students.length;
    const presence = 100 - d.todayAbsences.length / n * 100;
    const pending = d.invoices.filter(i => i.status === 'En attente' || i.status === 'En retard');
    const monthRev = d.revenue[1];
    const newStudents = d.students.filter(s => s.since === DB.TODAY.getFullYear()).length;
    const inBus = d.buses.reduce((a, b) => a + b.studentIds.length, 0);
    const unjust = d.todayAbsences.filter(a => !a.justified);
    const docsMissing = d.students.filter(s => s.docsMissing.length);
    const apps = d.applications.filter(a => a.status === 'Nouveau' || a.status === 'En vérification');
    const tk = d.tickets.filter(x => x.status === 'Nouveau' || x.status === 'En cours');
    const busAlerts = d.buses.filter(b => b.delay);
    const byCycle = t.cycles.map((cy, i) => ({ label: cy, value: d.students.filter(s => S.cls(s.classId).cycle === cy).length, color: HEX[i] }));
    const perfLevels = d.levels.filter(l => l.cycle !== 'Maternelle').map(l => { const cls = d.classes.filter(c => c.level === l.id); const v = cls.map(S.classAvg).filter(x => x); return { label: l.name, value: v.reduce((a, b) => a + b, 0) / v.length }; });

    const html = `
      ${head(`${greeting()}, ${esc(u.first)}`, `${UI.longDate(DB.TODAY)} · ${esc(t.name)}`,
        `<button class="btn btn-ghost" onclick="location.hash='#/analytics'">${icon('analytics', 'sm')} Rapports</button><button class="btn btn-primary" id="quickAdd">${icon('plus', 'sm')} Nouvelle action</button>`)}

      <div class="grid g-6">
        ${kpi('Élèves', num(n), 'students', `${delta(4.8)}<span>vs N-1</span>`, { href: '#/students' })}
        ${kpi('Enseignants', num(d.teachers.length), 'teachers', `<span>${d.teachers.filter(x => x.status === 'Absent').length} absent(s) aujourd'hui</span>`, { href: '#/teachers' })}
        ${kpi('Classes', d.classes.length, 'classes', `<span>${Math.round(n / d.classes.length)} élèves / classe</span>`, { href: '#/classes' })}
        ${kpi('Taux de présence', pct(presence), 'attendance', `${delta(0.6)}<span>cette semaine</span>`, { href: '#/attendance' })}
        ${kpi('Moyenne générale', dec(S.schoolAvg()) + '<small>/20</small>', 'grades', `${delta(0.3, '')}<span>vs T3</span>`, { href: '#/grades' })}
        ${kpi('Revenus du mois', S.kmoney(monthRev), 'finance', `${delta(7.2)}<span>vs N-1</span>`, { gold: 1, href: '#/finance' })}
      </div>

      <div class="grid g-6 mt">
        ${kpi('Absences du jour', d.todayAbsences.length, 'xc', `<span>${unjust.length} non justifiées</span>`, { cls: 'mini', href: '#/attendance' })}
        ${kpi('Retards', d.todayLates.length, 'clock', `<span>moy. ${Math.round(d.todayLates.reduce((a, l) => a + l.minutes, 0) / (d.todayLates.length || 1))} min</span>`, { cls: 'mini', href: '#/attendance' })}
        ${kpi('Paiements en attente', num(pending.length), 'card', `<span>${S.kmoney(pending.reduce((a, i) => a + i.amount, 0))}</span>`, { cls: 'mini', href: '#/finance' })}
        ${kpi('Nouveaux inscrits', newStudents, 'enroll', `<span>rentrée ${DB.TODAY.getFullYear()}</span>`, { cls: 'mini', href: '#/enrollments' })}
        ${kpi('Transport actif', `${d.buses.length}<small>bus</small>`, 'transport', `<span>${inBus} élèves transportés</span>`, { cls: 'mini', href: '#/transport' })}
        ${kpi('Alertes', busAlerts.length + unjust.length > 0 ? busAlerts.length + 3 : 0, 'alert', `<span>dont ${busAlerts.length} transport</span>`, { cls: 'mini' })}
      </div>

      <div class="card mt">
        <div class="card-h"><div><h3>À traiter aujourd'hui</h3><div class="sub">Priorités opérationnelles de la journée</div></div><span class="badge gold plain">${pending.length + unjust.length + docsMissing.length + apps.length + tk.length + busAlerts.length} éléments</span></div>
        <div class="card-b"><div class="todo-grid">
          ${[['finance', 'warning', pending.length, 'Paiements en attente', '#/finance'], ['attendance', 'danger', unjust.length, 'Absences non justifiées', '#/attendance'], ['documents', 'info', docsMissing.length, 'Documents manquants', '#/documents'], ['enroll', 'navy', apps.length, 'Inscriptions à valider', '#/enrollments'], ['support', 'warning', tk.length, 'Réclamations ouvertes', '#/support'], ['transport', 'danger', busAlerts.length, 'Alertes transport', '#/transport']]
            .map(x => `<div class="todo" onclick="location.hash='${x[4]}'"><div class="dot-ic ${x[1]}">${icon(x[0], 'sm')}</div><div class="n">${x[2]}</div><div class="l">${x[3]}</div></div>`).join('')}
        </div></div>
      </div>

      <div class="grid g-main mt">
        ${card('Revenus mensuels', UI.line(d.revenueMonths, [{ name: 'Année ' + t.year.slice(0, 4), color: HEX[0], values: d.revenue, area: true }, { name: 'Année précédente', color: HEX[1], values: d.revenuePrev, dash: true }], { h: 230, left: 52, fmt: S.kmoney, axisFmt: v => Math.round(v / 1000) + 'k' }),
          { sub: 'Encaissements réels, toutes catégories', action: UI.legend([{ name: 'Cette année', color: HEX[0] }, { name: 'N-1', color: HEX[1] }]) })}
        ${card('Répartition des élèves', UI.donut(byCycle, { sub: 'élèves' }), { sub: 'Par cycle' })}
      </div>

      <div class="grid g-3 mt">
        ${card('Évolution des inscriptions', UI.line(d.enrollHistory.map(e => e.year), [{ name: 'Élèves', color: HEX[0], values: d.enrollHistory.map(e => e.value), area: true }], { h: 190, dots: true }), { sub: '7 dernières années' })}
        ${card('Présence / absence', UI.bars(d.attendanceWeeks.map(w => w.label), [{ name: 'Abs. justifiées', color: HEX[2], values: d.attendanceWeeks.map(w => w.justified) }, { name: 'Abs. non justifiées', color: HEX[1], values: d.attendanceWeeks.map(w => w.unjustified) }], { h: 190, stacked: true, fmt: v => dec(v, 1) + ' %', axisFmt: v => dec(v, 1) + '%', left: 42 }), { sub: 'Taux hebdomadaire, 12 semaines' })}
        ${card('Performances scolaires', UI.bars(perfLevels.map(p => p.label), [{ name: 'Moyenne', color: HEX[0], values: perfLevels.map(p => p.value) }], { h: 190, min: 8, max: 16, fmt: v => dec(v) + '/20', axisFmt: v => Math.round(v) }), { sub: 'Moyenne par niveau' })}
      </div>

      <div class="grid g-3 mt">
        ${card('Paiements en retard', UI.bars(d.revenueMonths.slice(0, 10), [{ name: 'Impayés', color: '#B0443B', values: d.overdueMonths }], { h: 180, fmt: S.kmoney, axisFmt: v => Math.round(v / 1000) + 'k', left: 44, highlight: 1 }), { sub: 'Montant par mois d\'échéance' })}
        ${card('Utilisation des cours en ligne', UI.line(d.onlineUsage.map(w => w.label), [{ name: 'Heures de cours suivies', color: HEX[1], values: d.onlineUsage.map(w => w.hours), area: true }], { h: 180 }), { sub: 'Heures cumulées / semaine' })}
        <div class="card"><div class="card-h"><div><h3>Alertes importantes</h3><div class="sub">Temps réel</div></div></div>
          <div class="card-b flush"><div class="list">
            ${busAlerts.map(b => `<div class="li click" onclick="location.hash='#/transport'"><div class="dot-ic warning">${icon('transport', 'sm')}</div><div class="grow"><div class="t">${esc(b.line)} : +${b.delay} min</div><div class="s">Parents notifiés automatiquement</div></div></div>`).join('')}
            <div class="li click" onclick="location.hash='#/health'"><div class="dot-ic danger">${icon('health', 'sm')}</div><div class="grow"><div class="t">Accident scolaire déclaré</div><div class="s">${esc(fullName(S.stu(d.infirmary[1].studentId)))} · ${esc(d.infirmary[1].reason)}</div></div></div>
            <div class="li click" onclick="location.hash='#/finance'"><div class="dot-ic danger">${icon('finance', 'sm')}</div><div class="grow"><div class="t">${d.invoices.filter(i => i.status === 'En retard').length} factures en retard > 15 j</div><div class="s">Relance automatique programmée</div></div></div>
            <div class="li click" onclick="location.hash='#/settings'"><div class="dot-ic info">${icon('shield', 'sm')}</div><div class="grow"><div class="t">3 tentatives de connexion bloquées</div><div class="s">IP 196.12.44.7 — compte verrouillé</div></div></div>
          </div></div></div>
      </div>

      <div class="grid g-main mt">
        <div class="card"><div class="card-h"><div><h3>Classes à surveiller</h3><div class="sub">Moyenne & présence par classe</div></div><a class="btn btn-sm btn-ghost" href="#/classes">Toutes les classes</a></div>
          <div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>Classe</th><th>Effectif</th><th>Prof. principal</th><th class="num">Moyenne</th><th>Présence</th></tr></thead><tbody>
          ${d.classes.filter(c => c.cycle !== 'Maternelle').map(c => ({ c, a: S.classAvg(c), p: S.classAttendance(c) })).sort((x, y) => x.a - y.a).slice(0, 6).map(({ c, a, p }) => `
            <tr class="click" onclick="location.hash='#/classes/${c.id}'"><td><b>${c.name}</b> <span class="muted">· ${c.cycle}</span></td><td>${c.studentIds.length}/${c.capacity}</td><td>${esc(fullName(S.tch(c.mainTeacher)))}</td><td class="num" style="color:${UI.gradeColor(a)};font-weight:600">${dec(a)}</td><td style="width:160px"><div class="row"><div class="bar ${p > 95 ? 'success' : ''}" style="flex:1"><i style="width:${p}%"></i></div><span style="font-size:12px">${dec(p, 1)}%</span></div></td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="card"><div class="card-h"><div><h3>Activités récentes</h3><div class="sub">Journal de l'établissement</div></div></div>
          <div class="card-b"><div class="timeline">
            ${[['Bulletin T1 publié pour les classes de Collège', '09:12 · Direction'], [fullName(S.tch(d.classes[5].mainTeacher)) + ' a saisi 28 notes en ' + d.classes[5].name, '08:57 · Enseignant'], ['Paiement reçu — ' + S.money(3950), '08:41 · ' + fullName(d.parents[4])], ['Nouvelle demande d\'inscription (' + d.applications[0].level + ')', '08:30 · Portail en ligne'], ['Appel effectué dans ' + (d.classes.length - 3) + ' classes', '08:20 · Vie scolaire'], [d.buses[0].line + ' arrivé à l\'école', '07:52 · GPS'], ['Menu de la semaine publié', 'Hier · Cantine']]
              .map(a => `<div class="tl-i"><div class="t">${esc(a[0])}</div><div class="s">${esc(a[1])}</div></div>`).join('')}
          </div></div></div>
      </div>`;
    return { html, mount: el => el.querySelector('#quickAdd').onclick = quickActions };
  }

  function quickActions() {
    const acts = [['enroll', 'Inscrire un élève', '#/enrollments'], ['attendance', 'Faire l\'appel', '#/attendance'], ['grades', 'Saisir des notes', '#/grades'], ['communication', 'Publier une annonce', '#/communication'], ['finance', 'Enregistrer un paiement', '#/finance'], ['calendar', 'Créer un événement', '#/calendar'], ['documents', 'Générer un certificat', '#/documents'], ['transport', 'Suivre les bus', '#/transport']];
    UI.modal('Nouvelle action', `<div class="grid g-2" style="gap:10px">${acts.map(a => `<a class="card hover" href="${a[2]}" onclick="UI.closeModal()" style="display:flex;align-items:center;gap:12px;padding:14px"><div class="dot-ic navy">${icon(a[0], 'sm')}</div><span style="font-weight:500">${a[1]}</span></a>`).join('')}</div>`, { foot: false });
  }

  function teacherDash() {
    const d = D(), u = currentUser();
    const myClasses = u.classes.map(S.cls);
    const day = Math.min(4, Math.max(0, DB.TODAY.getDay() - 1));
    const today = S.teacherTimetable(u.id)[day] || [];
    const hw = d.homework.filter(h => h.teacherId === u.id);
    const toCorrect = hw.reduce((a, h) => a + (h.submitted - h.corrected), 0);
    const students = myClasses.reduce((a, c) => a + c.studentIds.length, 0);
    const html = `
      ${head(`${greeting()}, ${esc(u.first)}`, `${UI.longDate(DB.TODAY)} · ${S.subj(u.subject).name}`, `<a class="btn btn-ghost" href="#/grades">${icon('grades', 'sm')} Saisir des notes</a><a class="btn btn-primary" href="#/attendance">${icon('attendance', 'sm')} Faire l'appel</a>`)}
      <div class="grid g-4">
        ${kpi('Classes affectées', myClasses.length, 'classes', `<span>${students} élèves</span>`)}
        ${kpi('Cours aujourd\'hui', today.filter(Boolean).length, 'timetable', `<span>${today.filter(Boolean).length} h de cours</span>`)}
        ${kpi('Copies à corriger', toCorrect, 'homework', `<span>${hw.length} devoirs actifs</span>`, { gold: 1 })}
        ${kpi('Moyenne de mes classes', dec(myClasses.map(c => S.classSubjectAvg(c, u.subject)).filter(Boolean).reduce((a, b, _, arr) => a + b / arr.length, 0)) + '<small>/20</small>', 'grades', delta(0.4, ''))}
      </div>
      <div class="grid g-main mt">
        ${card('Mon emploi du temps du jour', `<div class="list">${S.SLOTS.map((sl, i) => { const l = today[i]; return sl.break ? `<div class="li" style="background:var(--beige-50)"><span class="muted" style="width:90px;font-size:12px">${sl.label}</span><span class="muted">${sl.break}</span></div>` : `<div class="li"><span style="width:90px;font-size:12px;color:var(--ink-3)">${sl.label}</span>${l ? `<div class="dot-ic" style="background:${S.subj(l.subject).color}18;color:${S.subj(l.subject).color}">${icon('classes', 'sm')}</div><div class="grow"><div class="t">${S.cls(l.classId).name} — ${S.subj(l.subject).name}</div><div class="s">Salle ${l.room}</div></div><a class="btn btn-sm btn-soft" href="#/attendance/${l.classId}">Appel</a>` : '<span class="muted">Libre</span>'}</div>`; }).join('')}</div>`, { flush: true, sub: UI.longDate(DB.TODAY) })}
        ${card('Devoirs à corriger', `<div class="list">${hw.slice(0, 6).map(h => `<div class="li click" onclick="location.hash='#/homework'"><div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${S.cls(h.classId).name} · rendu ${h.submitted}/${h.total}</div></div>${h.submitted - h.corrected > 0 ? badge((h.submitted - h.corrected) + ' à corriger', 'warning') : badge('À jour', 'success')}</div>`).join('') || '<div class="empty">Aucun devoir</div>'}</div>`, { flush: true })}
      </div>
      <div class="grid g-3 mt">
        ${myClasses.slice(0, 6).map(c => { const a = S.classSubjectAvg(c, u.subject); const dist = [0, 0, 0, 0]; c.studentIds.forEach(id => { const g = (S.averages(S.stu(id)).subjects[u.subject] || {}).avg; if (g == null) return; dist[g < 10 ? 0 : g < 12 ? 1 : g < 15 ? 2 : 3]++; }); return `<div class="card hover" style="cursor:pointer" onclick="location.hash='#/classes/${c.id}'"><div class="card-h"><div><h3>${c.name}</h3><div class="sub">${c.studentIds.length} élèves · Salle ${c.room}</div></div><span class="serif" style="font-size:24px;color:${UI.gradeColor(a || 12)}">${a ? dec(a) : '—'}</span></div><div class="card-b">${UI.bars(['< 10', '10–12', '12–15', '≥ 15'], [{ name: 'Élèves', color: HEX[0], values: dist }], { h: 120, left: 22 })}</div></div>`; }).join('')}
      </div>`;
    return html;
  }

  function parentDash(params) {
    const d = D(), u = currentUser();
    const kids = u.childIds.map(S.stu);
    const html = `
      ${head(`${greeting()}, ${esc(u.first)}`, `${UI.longDate(DB.TODAY)} · Suivi de ${kids.length} enfant${kids.length > 1 ? 's' : ''}`, `<a class="btn btn-ghost" href="#/communication">${icon('communication', 'sm')} Contacter l'école</a><a class="btn btn-primary" href="#/finance">${icon('card', 'sm')} Payer en ligne</a>`)}
      <div class="grid ${kids.length > 1 ? 'g-2' : ''}">
        ${kids.map(k => {
          const c = S.cls(k.classId), a = S.averages(k), bus = k.bus ? S.bus(k.bus) : null;
          const inv = S.invoicesOf(k.id).filter(i => i.status !== 'Payé' && i.status !== 'À venir');
          const hw = d.homework.filter(h => h.classId === k.classId && h.due >= DB.iso(DB.TODAY));
          const abs = d.todayAbsences.find(x => x.studentId === k.id);
          const last = Object.entries(a.subjects).map(([sid, v]) => ({ sid, ...v.list[v.list.length - 1] })).sort((x, y) => y.ev.date.localeCompare(x.ev.date)).slice(0, 3);
          return `<div class="card">
            <div class="hero-360" style="padding:20px 20px 12px">${avatar(k, 'lg')}<div style="flex:1"><div class="serif" style="font-size:22px">${esc(k.first)} ${esc(k.last)}</div><div class="muted">${c.name} · ${c.cycle} · ${age(k.birth)} ans</div></div>${abs ? badge('Absent(e) aujourd\'hui', 'danger') : badge('Présent(e)', 'success')}</div>
            <div class="grid g-3" style="padding:0 20px;gap:10px">
              <div class="card beige kpi mini"><span class="kpi-label">Moyenne</span><span class="kpi-val" style="color:${UI.gradeColor(a.general || 12)}">${a.general ? dec(a.general) : '—'}</span></div>
              <div class="card beige kpi mini"><span class="kpi-label">Présence</span><span class="kpi-val">${Math.round(k.attendance * 100)}%</span></div>
              <div class="card beige kpi mini"><span class="kpi-label">E-learning</span><span class="kpi-val">${k.online}%</span></div>
            </div>
            <div class="list mt-s">
              ${bus ? `<div class="li click" onclick="location.hash='#/transport'"><div class="dot-ic info">${icon('transport', 'sm')}</div><div class="grow"><div class="t">${esc(bus.line)} — arrivée estimée ${bus.delay ? 'dans ' + (8 + bus.delay) + ' min' : 'dans 8 min'}</div><div class="s">Arrêt : ${esc(bus.stops[k.stop].name)} ${bus.delay ? '· <span style="color:var(--warning)">retard ' + bus.delay + ' min</span>' : ''}</div></div>${icon('right', 'sm')}</div>` : ''}
              ${last.map(l => `<div class="li"><div class="dot-ic navy">${icon('grades', 'sm')}</div><div class="grow"><div class="t">${S.subj(l.sid).name} — ${esc(l.ev.title)}</div><div class="s">${dateShort(l.ev.date)}</div></div><b style="color:${UI.gradeColor(l.g)}">${dec(l.g, 2).replace(',00', '')}/20</b></div>`).join('')}
              ${hw.slice(0, 2).map(h => `<div class="li click" onclick="location.hash='#/homework'"><div class="dot-ic warning">${icon('homework', 'sm')}</div><div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${S.subj(h.subject).name} · à rendre ${relDays(h.due).toLowerCase()}</div></div></div>`).join('')}
              ${inv.length ? `<div class="li click" onclick="location.hash='#/finance'"><div class="dot-ic danger">${icon('finance', 'sm')}</div><div class="grow"><div class="t">${inv.length} paiement(s) en attente</div><div class="s">${S.money(inv.reduce((s, i) => s + i.amount, 0))}</div></div>${badge(inv[0].status)}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="grid g-3 mt">
        ${card('Annonces', `<div class="list">${d.announcements.slice(0, 3).map(a => `<div class="li"><div class="grow"><div class="t">${a.pinned ? '📌 ' : ''}${esc(a.title)}</div><div class="s" style="white-space:normal">${esc(a.body)}</div></div></div>`).join('')}</div>`, { flush: true })}
        ${card('Menu du jour', (() => { const m = d.menu[Math.min(4, Math.max(0, DB.TODAY.getDay() - 1))]; return `<div class="stack" style="gap:10px"><div><div class="muted" style="font-size:12px">Entrée</div><div>${m.starter}</div></div><div><div class="muted" style="font-size:12px">Plat</div><div style="font-weight:500">${m.main}</div></div><div><div class="muted" style="font-size:12px">Dessert</div><div>${m.dessert}</div></div><div class="badge success">Option végétarienne : ${m.veg}</div></div>`; })(), { sub: UI.longDate(DB.TODAY), action: '<a class="btn btn-sm btn-ghost" href="#/canteen">Semaine</a>' })}
        ${card('Prochains événements', `<div class="list">${d.events.filter(e => e.date >= DB.iso(DB.TODAY)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4).map(e => `<div class="li"><div class="dot-ic navy" style="flex-direction:column;line-height:1;font-size:10px"><b style="font-size:14px">${new Date(e.date).getDate()}</b>${UI.MOIS[new Date(e.date).getMonth()]}</div><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${e.kind} · ${e.time}</div></div></div>`).join('')}</div>`, { flush: true })}
      </div>`;
    return html;
  }

  function studentDash() {
    const d = D(), u = currentUser(), c = S.cls(u.classId), a = S.averages(u);
    const courses = d.courses.slice(0, 6).map((co, i) => ({ ...co, my: [100, 72, 45, 100, 18, 60][i] }));
    const hw = d.homework.filter(h => h.classId === u.classId);
    const day = Math.min(4, Math.max(0, DB.TODAY.getDay() - 1));
    const dayTT = S.timetable(c.id)[day] || []; const nextIdx = dayTT.findIndex(Boolean); const next = dayTT[nextIdx];
    const quizzes = [['Fractions — quiz 3', 17], ['La cellule', 14.5], ['Present perfect', 18], ['Révolution industrielle', 12.5]];
    const html = `
      ${head(`${greeting()}, ${esc(u.first)} 👋`, `Ton espace d'apprentissage · ${c.name}`, `<a class="btn btn-primary" href="#/elearning">${icon('play', 'sm')} Reprendre mon cours</a>`)}
      <div class="grid g-main">
        <div class="card navy" style="padding:26px;display:flex;gap:26px;align-items:center">
          ${UI.ring(u.online, { size: 120, w: 9, color: 'var(--gold)', track: 'rgba(255,255,255,.1)', text: '#fff' })}
          <div style="flex:1"><div class="eyebrow" style="color:var(--gold-soft)">Learning dashboard</div><div class="serif" style="font-size:26px;color:#fff;margin:6px 0">Progression globale : ${u.online} %</div><p style="color:#AEB9D2">Tu as terminé <b style="color:#fff">${courses.filter(x => x.my === 100).length} cours</b> et ${courses.filter(x => x.my < 100).length} sont en cours. Continue comme ça !</p>
          <div class="row mt-s" style="gap:24px;color:#C9D2E6;font-size:12.5px"><span>${icon('clock', 'sm')} 14 h cette semaine</span><span>${icon('star', 'sm')} 6 badges</span><span>${icon('zap', 'sm')} Série de 9 jours</span></div></div>
        </div>
        ${card('Prochain cours', next ? `<div class="serif" style="font-size:22px">${S.subj(next.subject).name}</div><div class="muted mt-s">${S.SLOTS[nextIdx].label} · Salle ${next.room}</div><div class="mt-s">${who(S.tch(next.teacherId), 'Enseignant')}</div>` : '<div class="muted">Pas de cours</div>', { action: '<a class="btn btn-sm btn-ghost" href="#/timetable">Planning</a>' })}
      </div>
      <div class="grid g-4 mt">
        ${kpi('Moyenne générale', a.general ? dec(a.general) + '<small>/20</small>' : '—', 'grades', delta(0.5, ''))}
        ${kpi('Cours terminés', courses.filter(x => x.my === 100).length, 'checkc')}
        ${kpi('Cours en cours', courses.filter(x => x.my < 100).length, 'elearning')}
        ${kpi('Devoirs à rendre', hw.filter(h => h.due >= DB.iso(DB.TODAY)).length, 'homework', '', { gold: 1 })}
      </div>
      <div class="grid g-main mt">
        ${card('Mes cours', `<div class="list">${courses.map(co => `<div class="li click" onclick="location.hash='#/elearning/${co.id}'"><div class="dot-ic" style="background:${S.subj(co.subject).color}1a;color:${S.subj(co.subject).color}">${icon('elearning', 'sm')}</div><div class="grow"><div class="t">${esc(co.title)}</div><div class="s">${S.subj(co.subject).name} · ${co.chapters} chapitres</div></div><div style="width:140px"><div class="bar ${co.my === 100 ? 'success' : 'gold'}"><i style="width:${co.my}%"></i></div></div><span style="width:40px;text-align:right;font-size:12px">${co.my}%</span></div>`).join('')}</div>`, { flush: true })}
        <div class="stack">
          ${card('Devoirs à rendre', `<div class="list">${hw.slice(0, 4).map(h => { const st = h.due < DB.iso(DB.TODAY) ? 'Rendu' : 'À faire'; return `<div class="li"><div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${S.subj(h.subject).short} · ${relDays(h.due)}</div></div>${badge(st)}</div>`; }).join('')}</div>`, { flush: true })}
          ${card('Résultats des quiz', UI.hbars(quizzes.map(q => ({ label: q[0], value: q[1] })), { max: 20, fmt: v => dec(v, 1).replace(',0', '') + '/20', cls: 'gold' }))}
        </div>
      </div>`;
    return html;
  }

  // ==========================================================
  // ÉLÈVES
  // ==========================================================
  const stuState = { q: '', cls: '', cycle: '', page: 0 };
  Views.students = function (p) {
    if (p[0]) return student360(p[0], p[1]);
    const d = D();
    const isTeacher = State.role === 'teacher';
    const myCls = isTeacher ? currentUser().classes : null;
    const html = `
      ${head('Élèves', `${num(isTeacher ? myCls.reduce((a, id) => a + S.cls(id).studentIds.length, 0) : d.students.length)} élèves ${isTeacher ? 'dans vos classes' : 'inscrits'} · ${d.tenant.year}`, isTeacher ? '' : `<button class="btn btn-ghost" id="exp">${icon('download', 'sm')} Exporter</button><button class="btn btn-primary" id="addS">${icon('plus', 'sm')} Nouvel élève</button>`)}
      <div class="card">
        <div class="toolbar">
          <div class="input-ic" style="flex:1;min-width:220px">${icon('search', 'sm')}<input class="input" style="width:100%" id="sq" placeholder="Nom, prénom ou matricule…" value="${esc(stuState.q)}"></div>
          <select class="select" id="scy"><option value="">Tous les cycles</option>${d.tenant.cycles.map(c => `<option ${stuState.cycle === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
          <select class="select" id="scl"><option value="">Toutes les classes</option>${d.classes.filter(c => !myCls || myCls.includes(c.id)).map(c => `<option value="${c.id}" ${stuState.cls === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
        </div>
        <div class="table-wrap" id="stbl"></div>
      </div>`;
    return {
      html, mount: el => {
        const draw = () => {
          const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          let list = d.students.filter(s => (!myCls || myCls.includes(s.classId)) && (!stuState.cls || s.classId === stuState.cls) && (!stuState.cycle || S.cls(s.classId).cycle === stuState.cycle) && (!stuState.q || norm(s.first + ' ' + s.last + ' ' + s.matricule).includes(norm(stuState.q))));
          const pages = Math.ceil(list.length / 20); stuState.page = Math.min(stuState.page, Math.max(0, pages - 1));
          const rows = list.slice(stuState.page * 20, stuState.page * 20 + 20);
          el.querySelector('#stbl').innerHTML = `<table class="tbl"><thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Âge</th><th class="num">Moyenne</th><th>Présence</th><th>Paiement</th><th>Transport</th></tr></thead><tbody>
            ${rows.map(s => { const a = S.averages(s).general; const inv = S.invoicesOf(s.id); const late = inv.some(i => i.status === 'En retard'), pend = inv.some(i => i.status === 'En attente'); return `<tr class="click" data-id="${s.id}"><td>${who(s, s.parentIds.length + ' responsable(s)')}</td><td class="muted">${s.matricule}</td><td>${S.cls(s.classId).name}</td><td>${age(s.birth)} ans</td><td class="num" style="font-weight:600;color:${a ? UI.gradeColor(a) : 'var(--ink-3)'}">${a ? dec(a) : '—'}</td><td>${Math.round(s.attendance * 100)}%</td><td>${badge(late ? 'En retard' : pend ? 'En attente' : 'Payé')}</td><td>${s.bus ? badge(S.bus(s.bus).line.split(' — ')[0], 'navy') : '<span class="muted">—</span>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucun élève trouvé</td></tr>'}
          </tbody></table>
          <div class="row between" style="padding:12px 16px;border-top:1px solid var(--line);font-size:12.5px"><span class="muted">${list.length} résultat(s) · page ${stuState.page + 1}/${Math.max(1, pages)}</span><div class="row"><button class="btn btn-sm btn-ghost" id="pp" ${stuState.page ? '' : 'disabled'}>${icon('left', 'sm')}</button><button class="btn btn-sm btn-ghost" id="pn" ${stuState.page < pages - 1 ? '' : 'disabled'}>${icon('right', 'sm')}</button></div></div>`;
          el.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => location.hash = '#/students/' + tr.dataset.id);
          el.querySelector('#pp').onclick = () => { stuState.page--; draw(); };
          el.querySelector('#pn').onclick = () => { stuState.page++; draw(); };
        };
        el.querySelector('#sq').oninput = e => { stuState.q = e.target.value; stuState.page = 0; draw(); };
        el.querySelector('#scy').onchange = e => { stuState.cycle = e.target.value; stuState.page = 0; draw(); };
        el.querySelector('#scl').onchange = e => { stuState.cls = e.target.value; stuState.page = 0; draw(); };
        const add = el.querySelector('#addS'); if (add) add.onclick = newStudent;
        const exp = el.querySelector('#exp'); if (exp) exp.onclick = () => exportCSV('eleves.csv', [['Matricule', 'Nom', 'Prénom', 'Classe', 'Naissance', 'Moyenne']].concat(d.students.map(s => [s.matricule, s.last, s.first, S.cls(s.classId).name, s.birth, dec(S.averages(s).general || 0)])));
        draw();
      }
    };
  };

  function exportCSV(name, rows) {
    const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
    UI.toast('Export <b>' + name + '</b> généré');
  }
  App.exportCSV = exportCSV;

  function newStudent() {
    const d = D();
    UI.modal('Nouvel élève', `
      <div class="form-grid">
        <div class="field"><label>Prénom</label><input class="input" id="nf"></div>
        <div class="field"><label>Nom</label><input class="input" id="nl"></div>
        <div class="field"><label>Date de naissance</label><input class="input" type="date" id="nb"></div>
        <div class="field"><label>Classe</label><select class="select" id="nc">${d.classes.map(c => `<option value="${c.id}">${c.name} (${c.studentIds.length}/${c.capacity})</option>`).join('')}</select></div>
        <div class="field"><label>Responsable légal</label><input class="input" placeholder="Nom du parent"></div>
        <div class="field"><label>Téléphone</label><input class="input" placeholder="+212 6…"></div>
        <div class="field" style="grid-column:1/-1"><label>Allergies / informations médicales</label><input class="input" placeholder="Visible uniquement par l'infirmerie"></div>
      </div>`, {
      ok: 'Créer le dossier', onOk: el => {
        const f = el.querySelector('#nf').value.trim(), l = el.querySelector('#nl').value.trim();
        if (!f || !l) { UI.toast('Prénom et nom requis', 'alert'); return false; }
        const c = S.cls(el.querySelector('#nc').value);
        const s = { id: 's' + d.students.length, first: f, last: l, gender: 'F', birth: el.querySelector('#nb').value || '2014-01-01', classId: c.id, parentIds: [], matricule: d.tenant.initials + '-' + DB.TODAY.getFullYear() + '-' + String(d.students.length).padStart(4, '0'), ability: 13, attendance: 1, bus: undefined, canteen: false, allergies: [], diet: null, since: DB.TODAY.getFullYear(), address: '—', blood: '—', docsMissing: ['Certificat médical'], online: 0, clubs: [] };
        d.students.push(s); c.studentIds.push(s.id);
        UI.toast(`Dossier de <b>${f} ${l}</b> créé — matricule ${s.matricule}`);
        location.hash = '#/students/' + s.id;
      }
    });
  }

  function student360(id, tab = 'overview') {
    const d = D(), s = S.stu(id);
    if (!s) return '<div class="empty">Élève introuvable</div>';
    const c = S.cls(s.classId), a = S.averages(s), rk = S.rank(s), parents = s.parentIds.map(S.par);
    const bus = s.bus ? S.bus(s.bus) : null;
    const inv = S.invoicesOf(s.id);
    const r = DB.mulberry(DB.hash(s.id));
    const rewards = [['Tableau d\'honneur', 'T3 2025-2026'], ['Félicitations du conseil', 'T2 2025-2026'], ['1er prix — concours de lecture', 'Mai 2026']].filter(() => r() < (a.general > 13 ? .8 : .3));
    const sanctions = [['Avertissement oral', 'Bavardages répétés'], ['Retenue (1 h)', 'Travail non rendu']].filter(() => r() < (a.general < 11 ? .6 : .12));
    const clubs = s.clubs.map(cid => d.activities.find(x => x.id === cid));
    const isAdmin = State.role === 'admin';
    const tabsList = [['overview', 'Vue d\'ensemble'], ['school', 'Scolarité'], ['attendance', 'Présences'], ['finance', 'Paiements'], ['transport', 'Transport'], ['health', 'Santé'], ['docs', 'Documents'], ['activities', 'Activités & e-learning']];
    const abs = Math.round((1 - s.attendance) * 180), lates = Math.round((1 - s.attendance) * 60) + (DB.hash(s.id) % 4);

    const body = {
      overview: `
        <div class="grid g-3">
          <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Moyenne générale</span>${UI.ring((a.general || 0) * 5, { size: 54, label: '', color: UI.gradeColor(a.general || 10) })}</div><div class="kpi-val" style="color:${UI.gradeColor(a.general || 10)}">${a.general ? dec(a.general) : '—'}<small>/20</small></div><div class="kpi-foot"><span>${App.setting('ranking', true) ? `Rang ${rk.rank}/${rk.of}` : 'Classement désactivé'}</span>${delta(0.4, '')}</div></div>
          <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Assiduité</span>${UI.ring(s.attendance * 100, { size: 54, label: '', color: 'var(--success)' })}</div><div class="kpi-val">${Math.round(s.attendance * 100)}<small>%</small></div><div class="kpi-foot"><span>${abs} demi-journées d'absence · ${lates} retards</span></div></div>
          <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Cours en ligne</span>${UI.ring(s.online, { size: 54, label: '', color: 'var(--gold)' })}</div><div class="kpi-val">${s.online}<small>%</small></div><div class="kpi-foot"><span>Progression moyenne</span></div></div>
        </div>
        <div class="grid g-main mt">
          ${card('Informations personnelles', `<div class="info-grid">
            ${[['Nom complet', fullName(s)], ['Date de naissance', date(s.birth) + ' (' + age(s.birth) + ' ans)'], ['Sexe', s.gender === 'F' ? 'Féminin' : 'Masculin'], ['Matricule', s.matricule], ['Classe', c.name + ' — ' + c.cycle], ['Professeur principal', fullName(S.tch(c.mainTeacher))], ['Adresse', s.address], ['Élève depuis', s.since], ['Cantine', s.canteen ? 'Inscrit(e)' : 'Non'], ['Transport', bus ? bus.line : 'Non']].map(x => `<div><div class="k">${x[0]}</div><div class="v">${esc(x[1])}</div></div>`).join('')}
          </div>`)}
          ${card('Parents & contacts d\'urgence', `<div class="stack" style="gap:14px">${parents.map(p => `<div class="row" style="align-items:flex-start">${avatar(p)}<div style="flex:1"><div style="font-weight:500">${esc(fullName(p))} <span class="muted" style="font-weight:400">· ${p.relation}</span></div><div class="muted" style="font-size:12px">${p.job}</div><div class="row mt-s" style="gap:6px"><a class="btn btn-sm btn-soft" href="tel:${p.phone}">${icon('phone', 'sm')} ${p.phone}</a><a class="btn btn-sm btn-ghost btn-icon" href="#/communication" title="Message">${icon('communication', 'sm')}</a></div></div></div>`).join('')}
            <div class="divider" style="margin:0"></div><div class="row"><div class="dot-ic danger">${icon('phone', 'sm')}</div><div><div style="font-weight:500">Contact d'urgence</div><div class="muted" style="font-size:12px">${esc(parents[0].first)} (${parents[0].relation}) · ${parents[0].phone}</div></div></div></div>`)}
        </div>
        <div class="grid g-3 mt">
          ${card('Récompenses', rewards.length ? `<div class="list">${rewards.map(x => `<div class="li" style="padding-left:0;padding-right:0"><div class="dot-ic" style="background:var(--gold-soft);color:var(--gold-600)">${icon('award', 'sm')}</div><div class="grow"><div class="t">${x[0]}</div><div class="s">${x[1]}</div></div></div>`).join('')}</div>` : '<div class="muted">Aucune récompense cette année</div>')}
          ${card('Sanctions', sanctions.length ? `<div class="list">${sanctions.map(x => `<div class="li" style="padding-left:0;padding-right:0"><div class="dot-ic warning">${icon('flag', 'sm')}</div><div class="grow"><div class="t">${x[0]}</div><div class="s">${x[1]}</div></div></div>`).join('')}</div>` : '<div class="muted">Aucune sanction ✓</div>')}
          ${card('Historique scolaire', `<div class="timeline">${Array.from({ length: Math.min(4, DB.TODAY.getFullYear() - s.since + 1) }, (_, i) => { const y = DB.TODAY.getFullYear() - i; const lvl = d.levels[Math.max(0, d.levels.findIndex(l => l.id === c.level) - i)]; return `<div class="tl-i"><div class="t">${y}–${y + 1} · ${lvl.name}</div><div class="s">${i === 0 ? 'En cours' : 'Moyenne ' + dec(Math.max(9, (a.general || 12) + (r() - .5) * 2)) + ' · Admis(e)'}</div></div>`; }).join('')}</div>`)}
        </div>`,
      school: (() => {
        const subs = Object.keys(a.subjects);
        return `<div class="grid g-main">
          <div class="card"><div class="card-h"><div><h3>Notes par matière</h3><div class="sub">Trimestre 1 · moyennes pondérées par coefficient</div></div><button class="btn btn-sm btn-primary" onclick="App.bulletin('${s.id}')">${icon('printer', 'sm')} Bulletin PDF</button></div>
            <div class="card-b flush table-wrap"><table class="tbl"><thead><tr><th>Matière</th><th class="num">Coef.</th><th>Évaluations</th><th class="num">Moy. élève</th><th class="num">Moy. classe</th></tr></thead><tbody>
            ${subs.map(sid => { const x = a.subjects[sid]; const ca = S.classSubjectAvg(c, sid); return `<tr><td><span class="row" style="gap:8px"><i style="width:8px;height:8px;border-radius:2px;background:${S.subj(sid).color}"></i>${S.subj(sid).name}</span></td><td class="num">${S.subj(sid).coef}</td><td>${x.list.map(l => `<span class="badge plain" style="margin-right:4px;background:var(--beige-50);color:${UI.gradeColor(l.g)}" data-tip="${esc(l.ev.title + ' · coef ' + l.ev.coef + ' · ' + dateShort(l.ev.date))}">${dec(l.g, 2).replace(',00', '').replace(/0$/, '')}</span>`).join('')}</td><td class="num" style="font-weight:600;color:${UI.gradeColor(x.avg)}">${dec(x.avg)}</td><td class="num muted">${dec(ca)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Pas de notes (maternelle : évaluation par compétences)</td></tr>'}
            </tbody></table></div></div>
          ${card('Profil de compétences', subs.length ? UI.bars(subs.map(x => S.subj(x).short.slice(0, 7)), [{ name: 'Élève', color: HEX[0], values: subs.map(x => a.subjects[x].avg) }, { name: 'Classe', color: HEX[1], values: subs.map(x => S.classSubjectAvg(c, x)) }], { h: 230, min: 0, max: 20, fmt: v => dec(v) }) + '<div class="mt-s">' + UI.legend([{ name: 'Élève', color: HEX[0] }, { name: 'Moyenne classe', color: HEX[1] }]) + '</div><button class="btn btn-soft btn-sm mt" onclick="AI.open(\'Analyse les performances de ' + esc(s.first) + ' ' + esc(s.last) + '\')">' + icon('sparkles', 'sm') + ' Analyse IA de l\'élève</button>' : '<div class="muted">—</div>')}
        </div>`;
      })(),
      attendance: `<div class="grid g-main">${card('Historique des absences & retards', `<table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Motif</th><th>Statut</th><th>Parents notifiés</th></tr></thead><tbody>${Array.from({ length: Math.max(2, Math.round(abs / 3)) }, (_, i) => { const late = i % 3 === 1; const j = r() < .6; return `<tr><td>${date(DB.addDays(DB.TODAY, -(i * 6 + 2)))}</td><td>${late ? badge('Retard ' + (5 + i * 3) + ' min', 'warning') : badge('Absence', 'danger')}</td><td>${late ? 'Transport' : j ? ['Maladie', 'Rendez-vous médical', 'Raison familiale'][i % 3] : '—'}</td><td>${late ? '—' : badge(j ? 'Justifiée' : 'Non justifiée')}</td><td>${icon('check', 'sm')}</td></tr>`; }).join('')}</tbody></table>`, { flush: true })}
        ${card('Assiduité mensuelle', UI.bars(['Sept.', 'Oct.', 'Nov.', 'Déc.', 'Janv.', 'Févr.'], [{ name: 'Présence', color: HEX[0], values: [0, 1, 2, 3, 4, 5].map(i => Math.min(100, s.attendance * 100 + (r() - .5) * 5)) }], { h: 200, min: 80, max: 100, fmt: v => dec(v, 1) + ' %' }))}</div>`,
      finance: `${card('Historique des paiements', `<table class="tbl"><thead><tr><th>Référence</th><th>Libellé</th><th>Échéance</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead><tbody>${inv.map(i => `<tr><td class="muted">${i.id}</td><td>${i.label}</td><td>${date(i.due)}</td><td class="num">${S.money(i.amount)}</td><td>${badge(i.status)}</td><td>${i.status === 'Payé' ? `<button class="btn btn-sm btn-ghost" onclick="App.receipt('${i.id}')">${icon('download', 'sm')} Reçu</button>` : i.status !== 'À venir' ? `<button class="btn btn-sm btn-soft" onclick="UI.toast('Relance envoyée par email et SMS','send')">Relancer</button>` : ''}</td></tr>`).join('')}</tbody></table>`, { flush: true })}`,
      transport: bus ? `<div class="grid g-2">${card(bus.line, `<div class="info-grid">${[['Bus', bus.model + ' · ' + bus.plate], ['Arrêt', bus.stops[s.stop].name], ['Horaire de passage', bus.stops[s.stop].time], ['Chauffeur', fullName(bus.driver)], ['Accompagnatrice', fullName(bus.attendant)], ['Badge', bus.rfid]].map(x => `<div><div class="k">${x[0]}</div><div class="v">${esc(x[1])}</div></div>`).join('')}</div><a class="btn btn-primary mt" href="#/transport">${icon('pin', 'sm')} Suivre en temps réel</a>`)}${card('Journal de montée / descente', `<div class="timeline">${[['Montée — ' + bus.stops[s.stop].name, '07:' + (12 + s.stop * 3) + ' · scan ' + bus.rfid], ['Arrivée à l\'école', '07:52'], ['Départ de l\'école', 'Hier 16:35'], ['Descente — ' + bus.stops[s.stop].name, 'Hier 17:08']].map(x => `<div class="tl-i"><div class="t">${x[0]}</div><div class="s">${x[1]}</div></div>`).join('')}</div>`)}</div>` : `<div class="card empty">L'élève n'utilise pas le transport scolaire.</div>`,
      health: isAdmin ? `<div class="lock mb">${icon('lock')}<span><b>Données confidentielles.</b> Accès journalisé (audit log) — réservé à l'infirmerie et à la direction.</span></div><div class="grid g-2">${card('Dossier médical', `<div class="info-grid">${[['Groupe sanguin', s.blood], ['Allergies', s.allergies.join(', ') || 'Aucune déclarée'], ['Régime alimentaire', s.diet || 'Standard'], ['Médecin traitant', 'Dr. ' + parents[0].last], ['Assurance scolaire', 'Valide jusqu\'au 31/08'], ['PAI', s.allergies.length ? 'Oui — trousse d\'urgence' : 'Non']].map(x => `<div><div class="k">${x[0]}</div><div class="v">${esc(x[1])}</div></div>`).join('')}</div>`)}${card('Passages à l\'infirmerie', `<div class="timeline">${d.infirmary.filter(v => v.studentId === s.id).concat([{ date: DB.iso(DB.addDays(DB.TODAY, -34)), reason: 'Maux de tête', care: 'Repos 20 min' }]).map(v => `<div class="tl-i"><div class="t">${v.reason}</div><div class="s">${date(v.date)} · ${v.care}</div></div>`).join('')}</div>`)}</div>` : `<div class="lock">${icon('lock')}<span>Accès restreint aux utilisateurs autorisés (infirmerie, direction).</span></div>`,
      docs: `${card('Documents administratifs', `<div class="list">${[['Certificat de scolarité', true], ['Fiche d\'inscription', true], ['Photo d\'identité', !s.docsMissing.includes('Photo d\'identité')], ['Certificat médical', !s.docsMissing.includes('Certificat médical')], ['Carnet de vaccination', !s.docsMissing.includes('Carnet de vaccination')], ['Copie CIN parent', !s.docsMissing.includes('Copie CIN parent')], ['Assurance scolaire', !s.docsMissing.includes('Assurance scolaire')], ['Autorisation droit à l\'image', true]].map(x => `<div class="li"><div class="dot-ic ${x[1] ? 'success' : 'danger'}">${icon(x[1] ? 'documents' : 'alert', 'sm')}</div><div class="grow"><div class="t">${x[0]}</div><div class="s">${x[1] ? 'Déposé · vérifié' : 'Manquant — relance envoyée'}</div></div>${x[1] ? `<button class="btn btn-sm btn-ghost" onclick="App.certificate('${s.id}')">${icon('download', 'sm')}</button>` : `<button class="btn btn-sm btn-soft" onclick="UI.toast('Demande envoyée aux parents','send')">Demander</button>`}</div>`).join('')}</div>`, { flush: true })}`,
      activities: `<div class="grid g-2">${card('Activités & clubs', clubs.length ? `<div class="list">${clubs.map(x => `<div class="li" style="padding-left:0"><div class="dot-ic navy">${icon('activities', 'sm')}</div><div class="grow"><div class="t">${x.name}</div><div class="s">${x.schedule} · ${x.place}</div></div></div>`).join('')}</div>` : '<div class="muted">Aucune activité</div>')}${card('Cours suivis en ligne', `<div class="list">${d.courses.filter((_, i) => (DB.hash(s.id) + i) % 3 === 0).slice(0, 5).map(co => { const p = (DB.hash(s.id + co.id) % 100); return `<div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">${esc(co.title)}</div><div class="s">${S.subj(co.subject).name}</div></div><div style="width:120px"><div class="bar gold"><i style="width:${p}%"></i></div></div><span style="font-size:12px;width:36px;text-align:right">${p}%</span></div>`; }).join('')}</div>`)}</div>`
    }[tab];

    const html = `
      <div class="crumbs"><a href="#/students">Élèves</a>${icon('right', 'sm')}<span>${esc(fullName(s))}</span></div>
      <div class="card mb" style="overflow:hidden">
        <div style="height:74px;background:linear-gradient(120deg,var(--navy-800),var(--navy-950));position:relative"><div style="position:absolute;inset:0;background:radial-gradient(circle at 85% 20%,rgba(176,141,87,.35),transparent 50%)"></div></div>
        <div class="hero-360" style="margin-top:-44px;padding-top:0;align-items:flex-end">
          <div style="border:4px solid var(--paper);border-radius:50%">${avatar(s, 'xl')}</div>
          <div style="flex:1;padding:52px 0 4px"><h1 class="serif" style="font-size:28px;font-weight:500">${esc(fullName(s))}</h1>
            <div class="meta"><span>${icon('classes', 'sm')} ${c.name} · ${c.cycle}</span><span>${icon('user', 'sm')} ${age(s.birth)} ans</span><span>${icon('key', 'sm')} ${s.matricule}</span>${s.allergies.length ? `<span style="color:var(--danger)">${icon('alert', 'sm')} Allergie</span>` : ''}${bus ? `<span>${icon('transport', 'sm')} ${bus.line.split(' — ')[0]}</span>` : ''}</div></div>
          <div class="row" style="padding-bottom:4px"><button class="btn btn-ghost" onclick="App.certificate('${s.id}')">${icon('documents', 'sm')} Certificat</button><a class="btn btn-primary" href="#/communication">${icon('communication', 'sm')} Contacter</a></div>
        </div>
      </div>
      ${tabs(tabsList, tab)}
      ${body}`;
    return { html, mount: el => bindTabs(el, 'tab', t => location.hash = '#/students/' + id + '/' + t) };
  }

  // ==========================================================
  // PARENTS
  // ==========================================================
  Views.parents = function () {
    const d = D();
    const multi = d.parents.filter(p => p.childIds.length > 1).length;
    const html = `
      ${head('Parents', `${num(d.parents.length)} responsables légaux · ${multi} comptes multi-enfants`, `<button class="btn btn-ghost" onclick="UI.toast('Invitations envoyées par email et SMS','send')">${icon('mail', 'sm')} Inviter à l'espace parent</button>`)}
      <div class="grid g-4 mb">
        ${kpi('Comptes activés', pct(91.4), 'user', delta(3.1))}
        ${kpi('Connexions / semaine', num(Math.round(d.parents.length * 2.6)), 'trend', delta(12))}
        ${kpi('Multi-enfants', multi, 'parents')}
        ${kpi('Satisfaction', '4,5<small>/5</small>', 'star', '', { gold: 1 })}
      </div>
      <div class="card"><div class="toolbar"><div class="input-ic" style="flex:1">${icon('search', 'sm')}<input class="input" style="width:100%" id="pq" placeholder="Rechercher un parent…"></div></div><div class="table-wrap" id="ptbl"></div></div>`;
    return {
      html, mount: el => {
        const draw = q => {
          const list = d.parents.filter(p => !q || (p.first + ' ' + p.last).toLowerCase().includes(q.toLowerCase())).slice(0, 30);
          el.querySelector('#ptbl').innerHTML = `<table class="tbl"><thead><tr><th>Parent</th><th>Lien</th><th>Enfants</th><th>Contact</th><th>Espace parent</th></tr></thead><tbody>${list.map(p => `<tr class="click" data-p="${p.id}"><td>${who(p, p.job)}</td><td>${p.relation}</td><td>${p.childIds.map(id => { const k = S.stu(id); return `<span class="badge navy plain" style="margin:2px">${k.first} · ${S.cls(k.classId).name}</span>`; }).join('')}</td><td><div style="font-size:12.5px">${p.phone}</div><div class="muted" style="font-size:11.5px">${p.email}</div></td><td>${badge(DB.hash(p.id) % 10 ? 'Actif' : 'Invitation envoyée', DB.hash(p.id) % 10 ? 'success' : 'warning')}</td></tr>`).join('')}</tbody></table>`;
          el.querySelectorAll('[data-p]').forEach(tr => tr.onclick = () => parentDrawer(tr.dataset.p));
        };
        el.querySelector('#pq').oninput = e => draw(e.target.value); draw('');
      }
    };
  };
  function parentDrawer(id) {
    const p = S.par(id);
    UI.drawer(`<div class="row">${avatar(p)}<div><div style="font-weight:600">${esc(fullName(p))}</div><div class="muted" style="font-size:12px">${p.relation} · ${p.job}</div></div></div>`, `
      <div style="padding:20px" class="stack">
        <div class="info-grid"><div><div class="k">Téléphone</div><div class="v">${p.phone}</div></div><div><div class="k">Email</div><div class="v" style="font-size:12.5px">${p.email}</div></div></div>
        <div><div class="eyebrow mb" style="margin-bottom:10px">Enfants</div>${p.childIds.map(cid => { const k = S.stu(cid); const a = S.averages(k).general; return `<a class="card hover" href="#/students/${k.id}" onclick="UI.closeDrawer()" style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px">${avatar(k)}<div style="flex:1"><div style="font-weight:500">${esc(fullName(k))}</div><div class="muted" style="font-size:12px">${S.cls(k.classId).name}</div></div><b style="color:${UI.gradeColor(a || 12)}">${a ? dec(a) : '—'}</b></a>`; }).join('')}</div>
        <div class="row"><a class="btn btn-primary" href="#/communication" onclick="UI.closeDrawer()">${icon('communication', 'sm')} Message</a><button class="btn btn-ghost" onclick="UI.toast('Lien de réinitialisation envoyé','key')">${icon('key', 'sm')} Réinitialiser l'accès</button></div>
      </div>`);
  }

  // ==========================================================
  // ENSEIGNANTS
  // ==========================================================
  Views.teachers = function (p) {
    const d = D();
    if (p[0]) return teacherDetail(p[0]);
    const html = `
      ${head('Enseignants', `${d.teachers.length} enseignants · ${d.subjects.filter(s => d.teachers.some(t => t.subject === s.id)).length} disciplines`, `<button class="btn btn-primary" onclick="UI.toast('Formulaire de recrutement ouvert','plus')">${icon('plus', 'sm')} Ajouter</button>`)}
      <div class="pill-filter mb" id="tf"><button class="on" data-s="">Toutes les matières</button>${d.subjects.filter(s => d.teachers.some(t => t.subject === s.id)).map(s => `<button data-s="${s.id}">${s.short}</button>`).join('')}</div>
      <div class="grid g-4" id="tgrid"></div>`;
    return {
      html, mount: el => {
        const draw = sid => {
          el.querySelector('#tgrid').innerHTML = d.teachers.filter(t => !sid || t.subject === sid).map(t => { const sub = S.subj(t.subject); const n = t.classes.reduce((a, c) => a + S.cls(c).studentIds.length, 0); return `
            <div class="card hover" style="cursor:pointer;padding:20px" onclick="location.hash='#/teachers/${t.id}'">
              <div class="row between">${avatar(t, 'lg')}${badge(t.status)}</div>
              <div style="font-weight:600;font-size:15px;margin-top:14px">${esc(fullName(t))}</div>
              <div class="row" style="gap:6px;margin-top:4px;font-size:12.5px;color:${sub.color}"><i style="width:7px;height:7px;border-radius:2px;background:${sub.color}"></i>${sub.name}</div>
              <div class="divider"></div>
              <div class="row between" style="font-size:12.5px"><span class="muted">${t.classes.length} classes · ${n} élèves</span><span>${icon('star', 'sm')}</span></div>
              <div class="row between" style="font-size:12.5px;margin-top:4px"><span class="muted">Depuis ${t.since}</span><b>${t.rating.replace('.', ',')}</b></div>
            </div>`; }).join('');
        };
        App.bindTabs(el, 's', draw); draw('');
      }
    };
  };
  function teacherDetail(id) {
    const t = S.tch(id), sub = S.subj(t.subject);
    const cls = t.classes.map(S.cls);
    const html = `
      <div class="crumbs"><a href="#/teachers">Enseignants</a>${icon('right', 'sm')}<span>${esc(fullName(t))}</span></div>
      <div class="card mb"><div class="hero-360">${avatar(t, 'xl')}<div style="flex:1"><h1 class="serif" style="font-size:28px;font-weight:500">${esc(fullName(t))}</h1><div class="meta"><span style="color:${sub.color}">${icon('book', 'sm')} ${sub.name}</span><span>${icon('mail', 'sm')} ${t.email}</span><span>${icon('phone', 'sm')} ${t.phone}</span><span>${icon('calendar', 'sm')} Depuis ${t.since}</span></div></div><div class="row"><a class="btn btn-ghost" href="#/timetable">${icon('timetable', 'sm')} Emploi du temps</a><a class="btn btn-primary" href="#/communication">${icon('communication', 'sm')} Message</a></div></div></div>
      <div class="grid g-4 mb">${kpi('Classes', cls.length, 'classes')}${kpi('Élèves', cls.reduce((a, c) => a + c.studentIds.length, 0), 'students')}${kpi('Heures / semaine', S.teacherTimetable(t.id).flat().filter(Boolean).length + ' h', 'clock')}${kpi('Évaluation', t.rating.replace('.', ',') + '<small>/5</small>', 'star', '', { gold: 1 })}</div>
      ${card('Classes affectées & performances', `<table class="tbl"><thead><tr><th>Classe</th><th>Effectif</th><th>Salle</th><th class="num">Moyenne ${sub.short}</th><th>Devoirs actifs</th></tr></thead><tbody>${cls.map(c => { const a = S.classSubjectAvg(c, t.subject); return `<tr class="click" onclick="location.hash='#/classes/${c.id}'"><td><b>${c.name}</b></td><td>${c.studentIds.length}</td><td>${c.room}</td><td class="num" style="color:${UI.gradeColor(a || 12)};font-weight:600">${a ? dec(a) : '—'}</td><td>${D().homework.filter(h => h.teacherId === t.id && h.classId === c.id).length}</td></tr>`; }).join('')}</tbody></table>`, { flush: true })}`;
    return html;
  }

  // ==========================================================
  // CLASSES
  // ==========================================================
  Views.classes = function (p) {
    const d = D();
    if (p[0]) return classDetail(p[0]);
    const mine = State.role === 'teacher' ? currentUser().classes : null;
    const list = d.classes.filter(c => !mine || mine.includes(c.id));
    const html = `
      ${head('Classes', `${list.length} classes · ${d.levels.length} niveaux · capacité ${num(list.reduce((a, c) => a + c.capacity, 0))} places`, State.role === 'admin' ? `<button class="btn btn-primary" id="addC">${icon('plus', 'sm')} Nouvelle classe</button>` : '')}
      ${d.tenant.cycles.map(cy => { const cl = list.filter(c => c.cycle === cy); if (!cl.length) return ''; return `
        <div class="row between" style="margin:8px 0 12px"><h3 class="serif" style="font-size:19px;font-weight:500">${cy}</h3><span class="muted" style="font-size:12.5px">${cl.reduce((a, c) => a + c.studentIds.length, 0)} élèves</span></div>
        <div class="grid g-4 mb">${cl.map(c => {
          const girls = c.studentIds.filter(id => S.stu(id).gender === 'F').length, n = c.studentIds.length;
          const a = S.classAvg(c), att = S.classAttendance(c);
          return `<div class="card hover" style="cursor:pointer" onclick="location.hash='#/classes/${c.id}'">
            <div class="card-h"><div><h3 style="font-size:17px" class="serif">${c.name}</h3><div class="sub">Salle ${c.room} · ${esc(fullName(S.tch(c.mainTeacher)))}</div></div>${a ? `<span class="serif" style="font-size:20px;color:${UI.gradeColor(a)}">${dec(a)}</span>` : ''}</div>
            <div class="card-b">
              <div class="row between" style="font-size:12px;margin-bottom:6px"><span class="muted">Effectif</span><b>${n}/${c.capacity}</b></div>
              <div class="bar ${n / c.capacity > .95 ? 'gold' : ''}"><i style="width:${n / c.capacity * 100}%"></i></div>
              <div class="row" style="gap:2px;margin-top:12px;height:8px;border-radius:4px;overflow:hidden"><div style="flex:${girls};background:var(--c2);height:100%" data-tip="Filles : <b>${girls}</b>"></div><div style="flex:${n - girls};background:var(--c1);height:100%" data-tip="Garçons : <b>${n - girls}</b>"></div></div>
              <div class="row between" style="font-size:11.5px;margin-top:6px" ><span class="muted">${girls} filles · ${n - girls} garçons</span><span class="muted">${dec(att, 1)}% présence</span></div>
              <div class="row" style="margin-top:12px;gap:-6px">${c.studentIds.slice(0, 7).map(id => `<div style="margin-right:-8px;border:2px solid #fff;border-radius:50%">${avatar(S.stu(id), 'sm')}</div>`).join('')}${n > 7 ? `<span class="muted" style="margin-left:14px;font-size:12px">+${n - 7}</span>` : ''}</div>
            </div></div>`;
        }).join('')}</div>`; }).join('')}`;
    return { html, mount: el => { const b = el.querySelector('#addC'); if (b) b.onclick = () => UI.modal('Nouvelle classe', `<div class="form-grid"><div class="field"><label>Nom</label><input class="input" placeholder="ex : 5e C"></div><div class="field"><label>Niveau</label><select class="select">${d.levels.map(l => `<option>${l.name}</option>`).join('')}</select></div><div class="field"><label>Capacité maximale</label><input class="input" type="number" value="30"></div><div class="field"><label>Salle</label><input class="input" placeholder="A204"></div><div class="field" style="grid-column:1/-1"><label>Professeur principal</label><select class="select">${d.teachers.map(t => `<option>${fullName(t)} — ${S.subj(t.subject).short}</option>`).join('')}</select></div></div>`, { ok: 'Créer la classe', onOk: () => UI.toast('Classe créée') }); } };
  };

  function classDetail(id) {
    const c = S.cls(id), d = D();
    const students = c.studentIds.map(S.stu).sort((a, b) => a.last.localeCompare(b.last));
    const a = S.classAvg(c);
    const html = `
      <div class="crumbs"><a href="#/classes">Classes</a>${icon('right', 'sm')}<span>${c.name}</span></div>
      ${head('Classe ' + c.name, `${c.cycle} · Salle ${c.room} · Professeur principal : ${esc(fullName(S.tch(c.mainTeacher)))}`, `<a class="btn btn-ghost" href="#/timetable/class/${c.id}">${icon('timetable', 'sm')} Emploi du temps</a><a class="btn btn-primary" href="#/attendance/${c.id}">${icon('attendance', 'sm')} Faire l'appel</a>`)}
      <div class="grid g-4 mb">${kpi('Effectif', `${c.studentIds.length}<small>/ ${c.capacity}</small>`, 'students')}${kpi('Moyenne de la classe', a ? dec(a) + '<small>/20</small>' : '—', 'grades')}${kpi('Taux de présence', dec(S.classAttendance(c), 1) + '<small>%</small>', 'attendance')}${kpi('Matières', c.subjects.length, 'book', '', { gold: 1 })}</div>
      <div class="grid g-main">
        ${card('Élèves', `<table class="tbl"><thead><tr><th>Élève</th><th class="num">Moyenne</th><th>Présence</th><th></th></tr></thead><tbody>${students.map(s => { const g = S.averages(s).general; return `<tr class="click" onclick="location.hash='#/students/${s.id}'"><td>${who(s, s.matricule)}</td><td class="num" style="font-weight:600;color:${g ? UI.gradeColor(g) : 'inherit'}">${g ? dec(g) : '—'}</td><td>${Math.round(s.attendance * 100)}%</td><td>${s.allergies.length ? `<span data-tip="Allergie déclarée">${icon('alert', 'sm')}</span>` : ''}</td></tr>`; }).join('')}</tbody></table>`, { flush: true })}
        ${card('Matières & enseignants', `<div class="list">${c.subjects.map(sid => { const t = S.tch(c.teachers[sid]); const sa = S.classSubjectAvg(c, sid); return `<div class="li" style="padding-left:0;padding-right:0"><i style="width:4px;height:32px;border-radius:2px;background:${S.subj(sid).color}"></i><div class="grow"><div class="t">${S.subj(sid).name}</div><div class="s">${esc(fullName(t))} · coef ${S.subj(sid).coef}</div></div>${sa ? `<b style="color:${UI.gradeColor(sa)}">${dec(sa)}</b>` : ''}</div>`; }).join('')}</div>`)}
      </div>`;
    return html;
  }

  // ==========================================================
  // INSCRIPTIONS EN LIGNE (Kanban drag & drop)
  // ==========================================================
  Views.enrollments = function () {
    const d = D();
    const COLS = ['Nouveau', 'En vérification', 'Accepté', 'Inscrit'];
    const html = `
      ${head('Inscriptions en ligne', 'Pipeline des candidatures · glissez une carte pour faire avancer un dossier', `<button class="btn btn-ghost" id="portal">${icon('globe', 'sm')} Voir le portail public</button><button class="btn btn-primary" id="newApp">${icon('plus', 'sm')} Nouvelle candidature</button>`)}
      <div class="grid g-4 mb">${kpi('Candidatures', d.applications.length, 'inbox', delta(18))}${kpi('Taux de conversion', pct(d.applications.filter(a => a.status === 'Inscrit').length / d.applications.length * 100 + 30, 0), 'trend')}${kpi('Délai moyen', '4,2 j', 'clock')}${kpi('Places restantes', d.classes.reduce((a, c) => a + c.capacity - c.studentIds.length, 0), 'classes', '', { gold: 1 })}</div>
      <div class="kanban" id="kb">${COLS.map(col => `<div class="col" data-col="${col}"><div class="col-h"><span>${col}</span><span class="badge plain">${d.applications.filter(a => a.status === col).length}</span></div>${d.applications.filter(a => a.status === col).map(appCard).join('')}</div>`).join('')}</div>`;
    return {
      html, mount: el => {
        let drag;
        el.querySelectorAll('.kcard').forEach(k => { k.addEventListener('dragstart', () => { drag = k; k.classList.add('dragging'); }); k.addEventListener('dragend', () => k.classList.remove('dragging')); k.addEventListener('click', () => appDrawer(k.dataset.id)); });
        el.querySelectorAll('.col').forEach(col => {
          col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
          col.addEventListener('dragleave', () => col.classList.remove('over'));
          col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); if (!drag) return; const a = d.applications.find(x => x.id === drag.dataset.id); a.status = col.dataset.col; col.appendChild(drag); el.querySelectorAll('.col').forEach(c => c.querySelector('.badge').textContent = d.applications.filter(x => x.status === c.dataset.col).length); UI.toast(`${a.first} ${a.last} → <b>${a.status}</b>. Notification envoyée à la famille.`, 'send'); });
        });
        el.querySelector('#portal').onclick = publicPortal;
        el.querySelector('#newApp').onclick = publicPortal;
      }
    };
  };
  const appCard = a => `<div class="kcard" draggable="true" data-id="${a.id}"><div class="row between"><b style="font-size:13.5px">${esc(a.first)} ${esc(a.last)}</b><span class="badge navy plain">${a.level}</span></div><div class="muted" style="font-size:12px;margin-top:4px">${esc(a.parent)} · ${a.source}</div><div class="row between" style="margin-top:10px;font-size:11.5px"><span class="row" style="gap:4px;color:var(--ink-3)">${icon('documents', 'sm')} ${a.docs}/${a.docsTotal}</span><span class="row" style="gap:4px;color:${a.paid ? 'var(--success)' : 'var(--ink-3)'}">${icon('card', 'sm')} ${a.paid ? 'Payé' : 'Non payé'}</span><span class="muted">${dateShort(a.date)}</span></div></div>`;
  function appDrawer(id) {
    const a = D().applications.find(x => x.id === id);
    UI.drawer(`<div><div style="font-weight:600">${esc(a.first)} ${esc(a.last)}</div><div class="muted" style="font-size:12px">Candidature ${a.level} · ${date(a.date)}</div></div>`, `<div style="padding:20px" class="stack">
      <div>${badge(a.status)}</div>
      <div class="info-grid"><div><div class="k">Responsable</div><div class="v">${esc(a.parent)}</div></div><div><div class="k">Téléphone</div><div class="v">${a.phone}</div></div><div><div class="k">Niveau demandé</div><div class="v">${a.level}</div></div><div><div class="k">Source</div><div class="v">${a.source}</div></div></div>
      <div><div class="eyebrow" style="margin-bottom:10px">Pièces du dossier</div>${['Acte de naissance', 'Photo d\'identité', 'Bulletins année précédente', 'Certificat de radiation', 'Carnet de vaccination'].map((x, i) => `<div class="row" style="padding:6px 0;font-size:13px"><span style="color:${i < a.docs ? 'var(--success)' : 'var(--ink-3)'}">${icon(i < a.docs ? 'checkc' : 'clock', 'sm')}</span>${x}</div>`).join('')}</div>
      <div class="row"><button class="btn btn-primary" onclick="UI.closeDrawer();UI.toast('Dossier accepté — email de confirmation envoyé')">Accepter</button><button class="btn btn-ghost" onclick="UI.toast('Demande de pièces envoyée','send')">Demander des pièces</button></div></div>`);
  }
  function publicPortal() {
    const d = D();
    UI.modal(`Portail d'inscription — ${esc(d.tenant.short)}`, `
      <div class="row mb" style="gap:8px">${['Élève', 'Responsables', 'Documents', 'Paiement', 'Confirmation'].map((s, i) => `<div style="flex:1"><div class="bar ${i < 1 ? 'gold' : ''}"><i style="width:${i < 1 ? 100 : 0}%"></i></div><div style="font-size:11.5px;margin-top:6px;color:${i < 1 ? 'var(--ink)' : 'var(--ink-3)'}">${i + 1}. ${s}</div></div>`).join('')}</div>
      <div class="form-grid">
        <div class="field"><label>Prénom de l'élève</label><input class="input" id="pf"></div><div class="field"><label>Nom</label><input class="input" id="pl"></div>
        <div class="field"><label>Date de naissance</label><input class="input" type="date"></div><div class="field"><label>Niveau souhaité</label><select class="select" id="plv">${d.levels.map(l => `<option>${l.name}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Établissement actuel</label><input class="input"></div>
        <div class="field" style="grid-column:1/-1"><label>Documents</label><div style="border:1.5px dashed var(--beige-300);border-radius:12px;padding:22px;text-align:center;color:var(--ink-3);background:var(--beige-50)">${icon('upload')}<div style="margin-top:6px">Glissez vos fichiers ici (PDF, JPG — 10 Mo max)</div></div></div>
      </div>`, { ok: 'Soumettre la candidature', wide: true, onOk: el => { const f = el.querySelector('#pf').value || 'Nouvel', l = el.querySelector('#pl').value || 'Élève'; d.applications.unshift({ id: 'a' + Date.now(), first: f, last: l, level: el.querySelector('#plv').value, status: 'Nouveau', date: DB.iso(DB.TODAY), parent: '—', phone: '—', docs: 1, docsTotal: 5, paid: false, source: 'Site web' }); App.route(); UI.toast('Candidature reçue — accusé de réception envoyé'); } });
  }
})();
