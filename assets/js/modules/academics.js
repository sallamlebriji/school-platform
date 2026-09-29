/* ==========================================================
   Modules pédagogiques : Emploi du temps (drag & drop),
   Présences, Notes & bulletins, Devoirs, E-learning, Bibliothèque
   + génération de documents PDF (certificat, bulletin, reçu)
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, badge, num, pct, dec, date, dateShort, relDays, fullName, avatar, who } = UI;
  const { D, S, Views, head, kpi, delta, card, tabs, bindTabs, currentUser, State } = App;

  // ==========================================================
  // Génération globale des emplois du temps (sans conflit enseignant)
  // ==========================================================
  S.SLOTS = [
    { label: '08:00 – 09:00' }, { label: '09:00 – 10:00' }, { label: '10:00 – 10:15', break: 'Récréation' },
    { label: '10:15 – 11:15' }, { label: '11:15 – 12:15' }, { label: '12:15 – 14:00', break: 'Déjeuner' },
    { label: '14:00 – 15:00' }, { label: '15:00 – 16:00' }, { label: '16:00 – 17:00' }
  ];
  S.DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const HOURS = { math: 5, fr: 5, ar: 4, en: 3, hg: 2, svt: 2, pc: 3, info: 1, eps: 2, art: 2 };
  function buildTT() {
    const d = D(); if (d._tt) return d._tt;
    const tt = {}, busy = {}, roomBusy = {};
    const r = DB.mulberry(DB.hash(d.tenant.id + 'tt'));
    const lessonSlots = S.SLOTS.map((s, i) => s.break ? null : i).filter(i => i != null);
    d.classes.forEach(c => {
      tt[c.id] = S.DAYS.map(() => S.SLOTS.map(() => null));
      const reqs = [];
      c.subjects.forEach(sid => { for (let k = 0; k < (HOURS[sid] || 2); k++) reqs.push(sid); });
      reqs.sort(() => r() - .5);
      reqs.forEach(sid => {
        const tid = c.teachers[sid];
        const room = sid === 'eps' ? 'Gymnase' : sid === 'info' ? 'Salle Info' : sid === 'art' ? 'Atelier Arts' : (sid === 'pc' || sid === 'svt') && r() < .5 ? 'Labo ' + (1 + (DB.hash(c.id) % 2)) : c.room;
        const order = []; S.DAYS.forEach((_, di) => lessonSlots.forEach(si => order.push([di, si])));
        order.sort(() => r() - .5);
        for (const [di, si] of order) {
          if (c.cycle !== 'Lycée' && si === 8) continue;
          if (di === 2 && si > 5) continue; // mercredi après-midi libre
          const k = di + '-' + si;
          if (tt[c.id][di][si] || (busy[tid] && busy[tid][k]) || (room !== c.room && roomBusy[room + k])) continue;
          tt[c.id][di][si] = { subject: sid, teacherId: tid, room, classId: c.id };
          (busy[tid] = busy[tid] || {})[k] = true; roomBusy[room + k] = true;
          break;
        }
      });
    });
    // quelques remplacements / changements exceptionnels
    const c0 = d.classes[Math.min(4, d.classes.length - 1)];
    const l = tt[c0.id][1].find(Boolean); if (l) { l.sub = true; l.note = 'Remplacement : ' + fullName(d.teachers[(d.teachers.indexOf(S.tch(l.teacherId)) + 1) % d.teachers.length]); }
    const l2 = tt[c0.id][3].filter(Boolean)[2]; if (l2) { l2.changed = true; l2.note = 'Déplacé en salle Amphi'; l2.room = 'Amphi'; }
    return (d._tt = tt);
  }
  S.timetable = cid => buildTT()[cid];
  S.teacherTimetable = tid => { const tt = buildTT(); const out = S.DAYS.map(() => S.SLOTS.map(() => null)); Object.values(tt).forEach(g => g.forEach((day, di) => day.forEach((l, si) => { if (l && l.teacherId === tid) out[di][si] = l; }))); return out; };
  S.roomTimetable = room => { const tt = buildTT(); const out = S.DAYS.map(() => S.SLOTS.map(() => null)); Object.values(tt).forEach(g => g.forEach((day, di) => day.forEach((l, si) => { if (l && l.room === room) out[di][si] = l; }))); return out; };

  // ==========================================================
  // EMPLOI DU TEMPS
  // ==========================================================
  Views.timetable = function (p) {
    const d = D(), u = currentUser();
    let mode = p[0] || (State.role === 'teacher' ? 'teacher' : 'class');
    let target = p[1];
    if (State.role === 'parent' || State.role === 'student') { mode = 'class'; const kids = State.role === 'parent' ? u.childIds.map(S.stu) : [u]; target = target && kids.some(k => k.classId === target) ? target : kids[0].classId; }
    if (mode === 'class') target = target || d.classes[Math.min(6, d.classes.length - 1)].id;
    if (mode === 'teacher') target = target || (State.role === 'teacher' ? u.id : d.teachers[0].id);
    const rooms = [...new Set(Object.values(buildTT()).flatMap(g => g.flatMap(x => x.filter(Boolean).map(l => l.room))))].sort();
    if (mode === 'room') target = target || rooms[0];
    const grid = mode === 'class' ? S.timetable(target) : mode === 'teacher' ? S.teacherTimetable(target) : S.roomTimetable(target);
    const editable = State.role === 'admin' && mode === 'class';
    const opts = mode === 'class' ? (State.role === 'parent' ? u.childIds.map(id => S.cls(S.stu(id).classId)) : State.role === 'student' ? [S.cls(u.classId)] : d.classes).map(c => [c.id, c.name]) : mode === 'teacher' ? d.teachers.map(t => [t.id, fullName(t) + ' — ' + S.subj(t.subject).short]) : rooms.map(r => [r, r]);
    const changes = [];
    grid.forEach((day, di) => day.forEach(l => { if (l && l.note) changes.push([S.DAYS[di], l]); }));

    const html = `
      ${head('Emploi du temps', editable ? 'Glissez-déposez un cours pour le déplacer — les enseignants et parents sont notifiés automatiquement' : 'Planning hebdomadaire', State.role === 'admin' ? `<button class="btn btn-ghost" id="subBtn">${icon('refresh', 'sm')} Remplacement</button><button class="btn btn-primary" onclick="window.print()">${icon('printer', 'sm')} Imprimer</button>` : `<button class="btn btn-ghost" onclick="window.print()">${icon('printer', 'sm')} Imprimer</button>`)}
      <div class="row wrap mb" style="gap:12px">
        ${State.role === 'admin' || State.role === 'teacher' ? `<div class="seg" id="ttmode">${[['class', 'Par classe'], ['teacher', 'Par enseignant'], ['room', 'Par salle']].map(m => `<button data-m="${m[0]}" class="${mode === m[0] ? 'on' : ''}">${m[1]}</button>`).join('')}</div>` : ''}
        <select class="select" id="tttarget" style="min-width:220px">${opts.map(o => `<option value="${o[0]}" ${o[0] === target ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
        <div class="legend" style="margin-left:auto">${[...new Set(grid.flat().filter(Boolean).map(l => l.subject))].map(sid => `<span><i style="background:${S.subj(sid).color}"></i>${S.subj(sid).short}</span>`).join('')}</div>
      </div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 280px">
        <div class="tt" id="tt">
          <div class="tt-h"></div>${S.DAYS.map((d0, i) => `<div class="tt-h">${d0}${i === Math.min(4, Math.max(0, DB.TODAY.getDay() - 1)) ? ' <span class="badge gold plain" style="height:18px;font-size:10px">Auj.</span>' : ''}</div>`).join('')}
          ${S.SLOTS.map((sl, si) => `<div class="tt-time">${sl.label.split(' – ')[0]}</div>${S.DAYS.map((_, di) => {
            if (sl.break) return `<div class="tt-cell break" style="height:28px">${di === 2 ? `<div class="muted" style="font-size:10.5px;text-align:center;padding-top:3px">${sl.break}</div>` : ''}</div>`;
            const l = grid[di][si];
            return `<div class="tt-cell" data-d="${di}" data-s="${si}">${l ? lessonHTML(l, mode, editable) : ''}</div>`;
          }).join('')}`).join('')}
        </div>
        <div class="stack">
          ${card('Changements exceptionnels', changes.length ? `<div class="list">${changes.map(([day, l]) => `<div class="li" style="padding-left:0;padding-right:0"><div class="dot-ic ${l.sub ? 'warning' : 'info'}">${icon(l.sub ? 'refresh' : 'pin', 'sm')}</div><div class="grow"><div class="t" style="white-space:normal">${S.subj(l.subject).short} · ${day}</div><div class="s" style="white-space:normal">${esc(l.note)}</div></div></div>`).join('')}</div>` : '<div class="muted">Aucun changement cette semaine</div>')}
          ${card('Volume horaire', UI.hbars(Object.entries(grid.flat().filter(Boolean).reduce((a, l) => (a[l.subject] = (a[l.subject] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).map(([sid, v]) => ({ label: S.subj(sid).short, value: v, color: S.subj(sid).color })), { fmt: v => v + ' h' }))}
          <div class="card beige" style="padding:16px;font-size:12.5px"><div class="row" style="margin-bottom:6px">${icon('bell', 'sm')}<b>Notifications automatiques</b></div><span class="muted">Chaque modification est notifiée aux enseignants concernés, aux élèves et aux parents (app, push, email).</span></div>
        </div>
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#tttarget').onchange = e => location.hash = `#/timetable/${mode}/${e.target.value}`;
        const seg = el.querySelector('#ttmode'); if (seg) seg.querySelectorAll('button').forEach(b => b.onclick = () => location.hash = '#/timetable/' + b.dataset.m);
        const sb = el.querySelector('#subBtn'); if (sb) sb.onclick = () => substitution();
        if (!editable) return;
        let src;
        el.querySelectorAll('.lesson').forEach(x => x.addEventListener('dragstart', e => { src = x.parentElement; e.dataTransfer.effectAllowed = 'move'; x.style.opacity = .4; }));
        el.querySelectorAll('.lesson').forEach(x => x.addEventListener('dragend', () => x.style.opacity = 1));
        el.querySelectorAll('.tt-cell[data-d]').forEach(cell => {
          cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('over'); });
          cell.addEventListener('dragleave', () => cell.classList.remove('over'));
          cell.addEventListener('drop', e => {
            e.preventDefault(); cell.classList.remove('over'); if (!src || src === cell) return;
            const g = S.timetable(target), a = g[src.dataset.d][src.dataset.s], b = g[cell.dataset.d][cell.dataset.s];
            // vérifie la disponibilité de l'enseignant
            const tBusy = S.teacherTimetable(a.teacherId)[cell.dataset.d][cell.dataset.s];
            if (tBusy && tBusy.classId !== target) { UI.toast(`Conflit : ${fullName(S.tch(a.teacherId))} enseigne déjà en ${S.cls(tBusy.classId).name} sur ce créneau`, 'alert'); return; }
            g[cell.dataset.d][cell.dataset.s] = Object.assign(a, { changed: true, note: 'Déplacé au ' + S.DAYS[cell.dataset.d].toLowerCase() + ' ' + S.SLOTS[cell.dataset.s].label.split(' – ')[0] });
            g[src.dataset.d][src.dataset.s] = b || null;
            App.route();
            UI.toast(`${S.subj(a.subject).name} déplacé — ${S.cls(target).studentIds.length} familles et ${fullName(S.tch(a.teacherId))} notifiés`, 'bell');
          });
        });
      }
    };
  };
  function lessonHTML(l, mode, editable) {
    const s = S.subj(l.subject), t = S.tch(l.teacherId);
    const line2 = mode === 'teacher' ? S.cls(l.classId).name + ' · ' + l.room : mode === 'room' ? S.cls(l.classId).name + ' · ' + t.last : t.first[0] + '. ' + t.last + ' · ' + l.room;
    return `<div class="lesson ${l.sub ? 'sub' : ''}" draggable="${editable}" style="background:${s.color}14;border-color:${s.color};position:relative" data-tip="${esc(s.name + '<br>' + fullName(t) + ' · ' + l.room + (l.note ? '<br><b>' + l.note + '</b>' : ''))}"><b style="color:${s.color}">${s.short}</b><span class="muted">${esc(line2)}</span>${l.sub ? '<span class="tag">Rempl.</span>' : l.changed ? '<span class="tag" style="background:var(--info)">Modifié</span>' : ''}</div>`;
  }
  function substitution() {
    const d = D();
    const absent = d.teachers.find(t => t.status === 'Absent') || d.teachers[2];
    UI.modal('Remplacement d\'enseignant', `
      <div class="lock mb">${icon('alert')}<span><b>${esc(fullName(absent))}</b> (${S.subj(absent.subject).name}) est déclaré(e) absent(e) aujourd'hui.</span></div>
      <div class="field mb"><label>Cours concernés</label>${S.teacherTimetable(absent.id)[Math.min(4, Math.max(0, DB.TODAY.getDay() - 1))].map((l, si) => l ? `<label class="check" style="padding:6px 0"><input type="checkbox" checked> ${S.SLOTS[si].label} · ${S.cls(l.classId).name} · ${l.room}</label>` : '').join('') || '<span class="muted">Aucun cours aujourd\'hui</span>'}</div>
      <div class="field"><label>Remplaçant suggéré (disponible, même discipline en priorité)</label><select class="select">${d.teachers.filter(t => t.id !== absent.id).sort((a, b) => (b.subject === absent.subject) - (a.subject === absent.subject)).slice(0, 8).map(t => `<option>${fullName(t)} — ${S.subj(t.subject).short}${t.subject === absent.subject ? ' ✓' : ''}</option>`).join('')}</select></div>`,
      { ok: 'Valider & notifier', onOk: () => UI.toast('Remplacement enregistré — élèves, parents et enseignant notifiés', 'bell') });
  }

  // ==========================================================
  // PRÉSENCES
  // ==========================================================
  const attState = {};
  Views.attendance = function (p) {
    const d = D(), u = currentUser();
    if (State.role === 'parent') return parentAttendance();
    const classes = State.role === 'teacher' ? u.classes.map(S.cls) : d.classes;
    const cid = p[0] && classes.some(c => c.id === p[0]) ? p[0] : classes[0].id;
    const c = S.cls(cid);
    const key = cid + DB.iso(DB.TODAY);
    if (!attState[key]) { attState[key] = {}; c.studentIds.forEach(id => { const ab = d.todayAbsences.find(a => a.studentId === id), la = d.todayLates.find(a => a.studentId === id); attState[key][id] = ab ? 'A' : la ? 'R' : 'P'; }); }
    const st = attState[key];
    const count = k => Object.values(st).filter(v => v === k).length;
    const unjust = d.todayAbsences.filter(a => !a.justified);
    const html = `
      ${head('Présences', `${UI.longDate(DB.TODAY)} · appel du matin`, `<button class="btn btn-ghost" onclick="App.exportCSV('absences.csv',[['Élève','Classe','Motif','Justifiée']].concat(App.D().todayAbsences.map(a=>{const s=App.S.stu(a.studentId);return [s.first+' '+s.last,App.S.cls(s.classId).name,a.reason,a.justified?'Oui':'Non']})))">${icon('download', 'sm')} Export</button>`)}
      ${State.role === 'admin' ? `<div class="grid g-4 mb">
        ${kpi('Taux de présence', pct(100 - d.todayAbsences.length / d.students.length * 100), 'attendance', delta(.4))}
        ${kpi('Absences', d.todayAbsences.length, 'xc', `<span>${unjust.length} non justifiées</span>`)}
        ${kpi('Retards', d.todayLates.length, 'clock')}
        ${kpi('Parents notifiés', d.todayAbsences.length, 'bell', '<span>SMS + push automatiques</span>', { gold: 1 })}
      </div>` : ''}
      <div class="grid g-main">
        <div class="card">
          <div class="toolbar"><select class="select" id="acls">${classes.map(x => `<option value="${x.id}" ${x.id === cid ? 'selected' : ''}>${x.name} (${x.studentIds.length})</option>`).join('')}</select>
            <div class="row" style="gap:6px;margin-left:auto">${badge(count('P') + ' présents', 'success')}${badge(count('A') + ' absents', 'danger')}${badge(count('R') + ' retards', 'warning')}</div>
            <button class="btn btn-sm btn-soft" id="allP">Tous présents</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Élève</th><th>Statut</th><th>Motif / minutes</th></tr></thead><tbody>
            ${c.studentIds.map(S.stu).sort((a, b) => a.last.localeCompare(b.last)).map(s => `<tr><td>${who(s, s.matricule)}</td><td><div class="att-btns" data-s="${s.id}">${['P', 'A', 'R'].map(k => `<button class="${k} ${st[s.id] === k ? 'on' : ''}" data-k="${k}" title="${{ P: 'Présent', A: 'Absent', R: 'Retard' }[k]}">${k}</button>`).join('')}</div></td><td>${st[s.id] === 'A' ? `<select class="select" style="height:30px"><option>Non communiqué</option><option>Maladie</option><option>Rendez-vous médical</option><option>Raison familiale</option></select>` : st[s.id] === 'R' ? `<input class="input" style="height:30px;width:90px" value="${(d.todayLates.find(l => l.studentId === s.id) || { minutes: 10 }).minutes} min">` : '<span class="muted">—</span>'}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="row between" style="padding:14px 16px;border-top:1px solid var(--line)"><span class="muted" style="font-size:12.5px">${icon('bell', 'sm')} Les parents des absents seront notifiés immédiatement.</span><button class="btn btn-primary" id="saveAtt">${icon('check', 'sm')} Valider l'appel</button></div>
        </div>
        <div class="stack">
          ${card('Absences non justifiées', `<div class="list">${unjust.slice(0, 8).map(a => { const s = S.stu(a.studentId); return `<div class="li"><div class="grow">${who(s, S.cls(s.classId).name + ' · ' + a.period)}</div><button class="btn btn-sm btn-ghost" onclick="UI.toast('Relance envoyée aux parents de ${esc(s.first)}','send')">Relancer</button></div>`; }).join('') || '<div class="empty">Aucune</div>'}</div>`, { flush: true, sub: unjust.length + ' aujourd\'hui' })}
          ${card('Tendance 12 semaines', UI.line(d.attendanceWeeks.map(w => w.label), [{ name: 'Présence', color: '#2E7A58', values: d.attendanceWeeks.map(w => w.present), area: true }], { h: 160, min: 88, max: 100, fmt: v => dec(v, 1) + ' %', axisFmt: v => Math.round(v) }))}
        </div>
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#acls').onchange = e => location.hash = '#/attendance/' + e.target.value;
        el.querySelectorAll('.att-btns button').forEach(b => b.onclick = () => { st[b.parentElement.dataset.s] = b.dataset.k; App.route(); });
        el.querySelector('#allP').onclick = () => { Object.keys(st).forEach(k => st[k] = 'P'); App.route(); };
        el.querySelector('#saveAtt').onclick = () => UI.toast(`Appel de ${c.name} enregistré — ${count('A')} famille(s) notifiée(s) par SMS & push`, 'bell');
      }
    };
  };
  function parentAttendance() {
    const u = currentUser(), kids = u.childIds.map(S.stu);
    const rows = kids.flatMap((k, ki) => Array.from({ length: 3 + ki }, (_, i) => ({ k, date: DB.iso(DB.addDays(DB.TODAY, -(i * 9 + ki * 2))), type: i % 2 ? 'Retard' : 'Absence', just: i > 0, reason: i ? ['Rendez-vous médical', 'Transport', 'Maladie'][i % 3] : null })));
    const html = `
      ${head('Absences & retards', 'Suivi de l\'assiduité de vos enfants')}
      <div class="grid g-${kids.length > 1 ? 2 : 1} mb">${kids.map(k => `<div class="card" style="padding:20px;display:flex;gap:18px;align-items:center">${UI.ring(k.attendance * 100, { size: 76, color: 'var(--success)' })}<div><div style="font-weight:600">${esc(fullName(k))}</div><div class="muted" style="font-size:12.5px">${S.cls(k.classId).name} · taux de présence</div></div></div>`).join('')}</div>
      ${card('Historique', `<table class="tbl"><thead><tr><th>Enfant</th><th>Date</th><th>Type</th><th>Motif</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.k.first)}</td><td>${date(r.date)}</td><td>${badge(r.type, r.type === 'Retard' ? 'warning' : 'danger')}</td><td>${r.reason || '—'}</td><td>${r.type === 'Retard' ? '—' : badge(r.just ? 'Justifiée' : 'Non justifiée')}</td><td>${!r.just && r.type === 'Absence' ? `<button class="btn btn-sm btn-primary" data-just>Justifier</button>` : ''}</td></tr>`).join('')}</tbody></table>`, { flush: true })}`;
    return {
      html, mount: el => el.querySelectorAll('[data-just]').forEach(b => b.onclick = () => UI.modal('Justifier une absence', `<div class="stack"><div class="field"><label>Motif</label><select class="select"><option>Maladie</option><option>Rendez-vous médical</option><option>Raison familiale</option><option>Autre</option></select></div><div class="field"><label>Commentaire</label><textarea class="input" placeholder="Précisions pour la vie scolaire…"></textarea></div><div class="field"><label>Justificatif</label><div style="border:1.5px dashed var(--beige-300);border-radius:12px;padding:18px;text-align:center;color:var(--ink-3)">${icon('upload')} Ajouter un certificat (PDF, photo)</div></div></div>`, { ok: 'Envoyer', onOk: () => { b.outerHTML = UI.badge('Envoyé', 'info'); UI.toast('Justificatif transmis à la vie scolaire'); } }))
    };
  }

  // ==========================================================
  // NOTES & ÉVALUATIONS
  // ==========================================================
  Views.grades = function (p) {
    if (State.role === 'parent' || State.role === 'student') return myGrades(p[0]);
    const d = D(), u = currentUser();
    const classes = (State.role === 'teacher' ? u.classes.map(S.cls) : d.classes).filter(c => c.cycle !== 'Maternelle');
    const cid = p[0] && classes.some(c => c.id === p[0]) ? p[0] : classes[0].id;
    const c = S.cls(cid);
    const subjects = State.role === 'teacher' ? [u.subject] : c.subjects;
    const sid = p[1] && subjects.includes(p[1]) ? p[1] : subjects[0];
    const evs = d.evaluations.filter(e => e.classId === cid && e.subject === sid);
    const students = c.studentIds.map(S.stu).sort((a, b) => a.last.localeCompare(b.last));
    const ranking = App.setting('ranking', true);
    const avgs = students.map(s => (S.averages(s).subjects[sid] || {}).avg);
    const html = `
      ${head('Notes & évaluations', 'Moyennes calculées automatiquement selon les règles de l\'établissement', `<button class="btn btn-ghost" id="rules">${icon('settings', 'sm')} Règles de calcul</button><button class="btn btn-ghost" id="bulk">${icon('printer', 'sm')} Bulletins PDF</button><button class="btn btn-primary" id="newEv">${icon('plus', 'sm')} Nouvelle évaluation</button>`)}
      <div class="row wrap mb" style="gap:10px">
        <select class="select" id="gcls">${classes.map(x => `<option value="${x.id}" ${x.id === cid ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
        <div class="pill-filter" id="gsub">${subjects.map(x => `<button data-g="${x}" class="${x === sid ? 'on' : ''}">${S.subj(x).short}</button>`).join('')}</div>
      </div>
      <div class="grid g-4 mb">
        ${kpi('Moyenne de la classe', dec(S.classSubjectAvg(c, sid)) + '<small>/20</small>', 'grades')}
        ${kpi('Note la plus haute', dec(Math.max(...avgs.filter(x => x != null))), 'trend')}
        ${kpi('Élèves < 10', avgs.filter(x => x < 10).length, 'alert')}
        ${kpi('Évaluations', evs.length, 'layers', '', { gold: 1 })}
      </div>
      <div class="card">
        <div class="card-h"><div><h3>${S.subj(sid).name} — ${c.name}</h3><div class="sub">Cliquez sur une note pour la modifier · coefficient matière ${S.subj(sid).coef}</div></div><button class="btn btn-sm btn-soft" onclick="AI.open('Génère un rapport de classe pour ${c.name} en ${S.subj(sid).name}')">${icon('sparkles', 'sm')} Rapport IA</button></div>
        <div class="card-b flush table-wrap"><table class="tbl" id="gtbl"><thead><tr><th>Élève</th>${evs.map(e => `<th style="text-align:center" data-tip="${esc(e.type + ' · ' + date(e.date) + ' · coef ' + e.coef)}">${e.title}<div style="font-weight:400;text-transform:none;letter-spacing:0">coef ${String(e.coef).replace('.', ',')}</div></th>`).join('')}<th class="num">Moyenne</th>${ranking ? '<th class="num">Rang</th>' : ''}<th>Appréciation</th></tr></thead><tbody>
          ${students.map((s, i) => { const a = avgs[i]; const rank = avgs.filter(x => x > a).length + 1; return `<tr><td>${who(s)}</td>${evs.map(e => { const g = D().gradeOf(s, e); return `<td style="text-align:center"><input class="grade-in" value="${dec(g, 2).replace(',00', '').replace(/(,\d)0$/, '$1')}" style="color:${UI.gradeColor(g)}" data-s="${s.id}" data-e="${e.id}"></td>`; }).join('')}<td class="num" style="font-weight:600;color:${UI.gradeColor(a)}">${dec(a)}</td>${ranking ? `<td class="num muted">${rank}<sup>${rank === 1 ? 'er' : 'e'}</sup></td>` : ''}<td class="muted" style="font-size:12px;max-width:220px">${a >= 16 ? 'Excellent travail, félicitations.' : a >= 13 ? 'Bon trimestre, continuez ainsi.' : a >= 10 ? 'Résultats corrects, peut mieux faire.' : 'Des efforts sont nécessaires.'}</td></tr>`; }).join('')}
        </tbody></table></div>
      </div>
      <div class="grid g-2 mt">
        ${card('Distribution des moyennes', UI.bars(['0–8', '8–10', '10–12', '12–14', '14–16', '16–20'], [{ name: 'Élèves', color: '#1D3462', values: [[0, 8], [8, 10], [10, 12], [12, 14], [14, 16], [16, 21]].map(([a, b]) => avgs.filter(x => x >= a && x < b).length) }], { h: 180 }))}
        ${card('Historique des évaluations', UI.line(evs.map(e => e.title.replace('Interrogation', 'Interro.').replace('Devoir surveillé', 'DS')), [{ name: 'Moyenne', color: '#B08D57', values: evs.map(e => students.reduce((a, s) => a + D().gradeOf(s, e), 0) / students.length), area: true }], { h: 180, min: 6, max: 18, dots: true, fmt: v => dec(v) }))}
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#gcls').onchange = e => location.hash = '#/grades/' + e.target.value;
        el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => location.hash = '#/grades/' + cid + '/' + b.dataset.g);
        el.querySelectorAll('.grade-in').forEach(i => i.onchange = () => { const v = parseFloat(i.value.replace(',', '.')); if (isNaN(v) || v < 0 || v > 20) { UI.toast('Note invalide (0 à 20)', 'alert'); return; } i.style.color = UI.gradeColor(v); UI.toast('Note enregistrée · moyenne recalculée · parent notifié', 'check'); });
        el.querySelector('#newEv').onclick = () => UI.modal('Nouvelle évaluation', `<div class="form-grid"><div class="field"><label>Titre</label><input class="input" id="evt" placeholder="Contrôle 4 — Équations"></div><div class="field"><label>Type</label><select class="select" id="evy"><option>Contrôle</option><option>Examen</option><option>Devoir surveillé</option><option>Interrogation</option><option>Exposé</option></select></div><div class="field"><label>Date</label><input class="input" type="date" value="${DB.iso(DB.TODAY)}"></div><div class="field"><label>Coefficient</label><input class="input" id="evc" type="number" step="0.5" value="1"></div><div class="field"><label>Barème</label><input class="input" value="20"></div><div class="field"><label>Publication aux familles</label><select class="select"><option>Immédiate</option><option>Après validation</option></select></div></div>`, { ok: 'Créer', onOk: m => { d.evaluations.push({ id: 'e' + d.evaluations.length, classId: cid, subject: sid, type: m.querySelector('#evy').value, coef: +m.querySelector('#evc').value || 1, title: m.querySelector('#evt').value || 'Évaluation', date: DB.iso(DB.TODAY), max: 20, off: 0, published: true }); App.S._avg = {}; App.route(); UI.toast('Évaluation créée'); } });
        el.querySelector('#rules').onclick = rulesModal;
        el.querySelector('#bulk').onclick = () => App.bulletin(students[0].id);
      }
    };
  };
  function rulesModal() {
    UI.modal('Règles de calcul des moyennes', `<div class="stack">
      ${[['ranking', 'Afficher le classement interne', 'Rang de l\'élève dans la classe (bulletins et espace parent)', true], ['weighted', 'Pondération par coefficient', 'Chaque évaluation et chaque matière est pondérée', true], ['bestof', 'Ignorer la plus mauvaise note', 'Si au moins 4 évaluations dans la matière', false], ['round', 'Arrondi au 1/4 de point', 'Sinon arrondi au centième', false]].map(r => `<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line-2)"><div><div style="font-weight:500">${r[1]}</div><div class="muted" style="font-size:12px">${r[2]}</div></div><button class="switch ${App.setting(r[0], r[3]) ? 'on' : ''}" data-k="${r[0]}"></button></div>`).join('')}
      <div class="form-grid"><div class="field"><label>Seuil de réussite</label><input class="input" value="10"></div><div class="field"><label>Périodes</label><select class="select"><option>Trimestres</option><option>Semestres</option></select></div></div></div>`,
      { mount: m => m.querySelectorAll('.switch').forEach(s => s.onclick = () => s.classList.toggle('on')), onOk: m => { m.querySelectorAll('.switch').forEach(s => App.setSetting(s.dataset.k, s.classList.contains('on'))); App.route(); UI.toast('Règles mises à jour — moyennes recalculées'); } });
  }
  function myGrades(kidId) {
    const u = currentUser();
    const kids = State.role === 'parent' ? u.childIds.map(S.stu) : [u];
    const k = kids.find(x => x.id === kidId) || kids[0];
    const a = S.averages(k), c = S.cls(k.classId), rk = S.rank(k);
    const subs = Object.keys(a.subjects);
    const html = `
      ${head('Notes & bulletins', `${esc(fullName(k))} · ${c.name}`, `<button class="btn btn-primary" onclick="App.bulletin('${k.id}')">${icon('download', 'sm')} Télécharger le bulletin</button>`)}
      ${kids.length > 1 ? `<div class="pill-filter mb">${kids.map(x => `<button class="${x.id === k.id ? 'on' : ''}" onclick="location.hash='#/grades/${x.id}'">${x.first} · ${S.cls(x.classId).name}</button>`).join('')}</div>` : ''}
      <div class="grid g-4 mb">${kpi('Moyenne générale', a.general ? dec(a.general) + '<small>/20</small>' : '—', 'grades', delta(.3, ''))}${kpi('Moyenne de la classe', dec(S.classAvg(c) || 0), 'classes')}${App.setting('ranking', true) ? kpi('Classement', `${rk.rank}<small>/ ${rk.of}</small>`, 'award', '', { gold: 1 }) : kpi('Évaluations', subs.reduce((n, sid) => n + a.subjects[sid].list.length, 0), 'layers')}${kpi('Bulletins disponibles', 4, 'documents')}</div>
      <div class="grid g-main">
        ${card('Résultats par matière', subs.length ? `<table class="tbl"><thead><tr><th>Matière</th><th>Notes</th><th class="num">Moyenne</th><th class="num">Classe</th></tr></thead><tbody>${subs.map(sid => `<tr><td><b style="font-weight:500">${S.subj(sid).name}</b><div class="muted" style="font-size:11.5px">${esc(fullName(S.tch(c.teachers[sid])))}</div></td><td>${a.subjects[sid].list.map(l => `<span class="badge plain" style="margin-right:4px;background:var(--beige-50);color:${UI.gradeColor(l.g)}" data-tip="${esc(l.ev.title + ' · coef ' + l.ev.coef)}">${String(l.g).replace('.', ',')}</span>`).join('')}</td><td class="num" style="font-weight:600;color:${UI.gradeColor(a.subjects[sid].avg)}">${dec(a.subjects[sid].avg)}</td><td class="num muted">${dec(S.classSubjectAvg(c, sid))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Évaluation par compétences (maternelle)</div>', { flush: true })}
        <div class="stack">
          ${card('Bulletins', `<div class="list">${['Trimestre 1 — ' + DB.TODAY.getFullYear(), 'Trimestre 3 — ' + (DB.TODAY.getFullYear() - 1), 'Trimestre 2 — ' + (DB.TODAY.getFullYear() - 1), 'Trimestre 1 — ' + (DB.TODAY.getFullYear() - 1)].map((b, i) => `<div class="li"><div class="dot-ic navy">${icon('documents', 'sm')}</div><div class="grow"><div class="t">${b}</div><div class="s">${i ? 'Archivé' : 'Provisoire'}</div></div><button class="btn btn-sm btn-ghost" onclick="App.bulletin('${k.id}')">${icon('download', 'sm')}</button></div>`).join('')}</div>`, { flush: true })}
          ${card('Commentaires des enseignants', `<div class="stack" style="gap:12px">${subs.slice(0, 3).map(sid => `<div><div style="font-size:12px;font-weight:600">${S.subj(sid).short}</div><div class="muted" style="font-size:12.5px;font-style:italic">« ${a.subjects[sid].avg >= 14 ? 'Très bon travail, participation active.' : a.subjects[sid].avg >= 11 ? 'Travail sérieux, à consolider.' : 'Doit s\'investir davantage à l\'oral et à l\'écrit.'} »</div></div>`).join('')}</div>`)}
        </div>
      </div>`;
    return html;
  }

  // ==========================================================
  // DOCUMENTS PDF (impression navigateur → PDF)
  // ==========================================================
  function printDoc(title, body) {
    const t = D().tenant;
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Autorisez les fenêtres pop-up pour générer le PDF', 'alert'); return; }
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>
      @page{size:A4;margin:16mm}body{font-family:Inter,system-ui,sans-serif;color:#111C33;font-size:12px;margin:0}
      .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${t.color};padding-bottom:14px;margin-bottom:26px}
      .logo{display:flex;align-items:center;gap:12px}.lg{width:48px;height:48px;border-radius:12px;background:${t.color};color:#fff;display:grid;place-items:center;font-family:Fraunces,serif;font-size:18px;border:2px solid #B08D57}
      h1{font-family:Fraunces,serif;font-weight:500;font-size:26px;margin:0 0 6px}h2{font-family:Fraunces,serif;font-weight:500;font-size:16px}
      table{width:100%;border-collapse:collapse;margin:14px 0}th,td{padding:8px 10px;border-bottom:1px solid #E9E4DA;text-align:left}th{background:#F8F4EC;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#4A556E}
      .r{text-align:right}.muted{color:#8B93A7}.gold{color:#9A7843}.box{background:#F8F4EC;border:1px solid #E8DFCF;border-radius:10px;padding:14px 16px;margin:14px 0}
      .sig{margin-top:60px;display:flex;justify-content:space-between}.stamp{width:120px;height:120px;border:2px solid ${t.color};border-radius:50%;display:grid;place-items:center;text-align:center;font-size:10px;color:${t.color};transform:rotate(-8deg);opacity:.75}
      .ft{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9.5px;color:#8B93A7;border-top:1px solid #E9E4DA;padding-top:6px}
    </style></head><body>
      <div class="hd"><div class="logo"><div class="lg">${t.initials}</div><div><div style="font-family:Fraunces,serif;font-size:17px">${t.name}</div><div class="muted">${t.city} · ${t.domain}</div></div></div><div class="muted r">Année scolaire ${t.year}<br>Édité le ${UI.date(DB.TODAY)}</div></div>
      ${body}
      <div class="ft">${t.name} — Document généré par Athénée School OS · Réf. ${Math.random().toString(36).slice(2, 10).toUpperCase()} · Vérifiable sur ${t.domain}/verify</div>
      <script>document.fonts.ready.then(()=>setTimeout(()=>print(),200))<\/script></body></html>`);
    w.document.close();
  }
  App.printDoc = printDoc;
  App.certificate = function (sid) {
    const s = S.stu(sid), c = S.cls(s.classId), t = D().tenant;
    printDoc('Certificat de scolarité', `<h1>Certificat de scolarité</h1><p class="muted">N° ${s.matricule}/${DB.TODAY.getFullYear()}</p>
      <p style="font-size:13.5px;line-height:1.9;margin-top:30px">${t.id === 'lumiere' ? 'Le directeur' : 'La directrice'} de l'établissement <b>${t.name}</b>, soussigné(e), certifie que l'élève :</p>
      <div class="box" style="font-size:13.5px;line-height:1.9"><b>${fullName(s)}</b><br>Né(e) le ${UI.date(s.birth)}<br>Matricule : ${s.matricule}</div>
      <p style="font-size:13.5px;line-height:1.9">est régulièrement inscrit(e) en classe de <b>${c.name}</b> (${c.cycle}) pour l'année scolaire ${t.year}.</p>
      <p style="font-size:13.5px;line-height:1.9">Le présent certificat est délivré pour servir et valoir ce que de droit.</p>
      <div class="sig"><div class="stamp">${t.name.toUpperCase()}<br>— ${t.city.toUpperCase()} —</div><div class="r">Fait à ${t.city}, le ${UI.date(DB.TODAY)}<br><br><b>${t.director.first} ${t.director.last}</b><br><span class="muted">Direction</span></div></div>`);
  };
  App.bulletin = function (sid) {
    const s = S.stu(sid), c = S.cls(s.classId), a = S.averages(s), rk = S.rank(s);
    printDoc('Bulletin — ' + fullName(s), `<h1>Bulletin scolaire · Trimestre 1</h1>
      <div class="box" style="display:flex;justify-content:space-between"><div><b style="font-size:14px">${fullName(s)}</b><br><span class="muted">Né(e) le ${UI.date(s.birth)} · ${s.matricule}</span></div><div class="r">Classe <b>${c.name}</b><br><span class="muted">Prof. principal : ${fullName(S.tch(c.mainTeacher))}</span></div></div>
      <table><thead><tr><th>Matière</th><th>Enseignant</th><th class="r">Coef.</th><th class="r">Moy. élève</th><th class="r">Moy. classe</th><th>Appréciation</th></tr></thead><tbody>
      ${Object.keys(a.subjects).map(sid2 => { const x = a.subjects[sid2].avg; return `<tr><td><b>${S.subj(sid2).name}</b></td><td class="muted">${fullName(S.tch(c.teachers[sid2]))}</td><td class="r">${S.subj(sid2).coef}</td><td class="r"><b>${dec(x)}</b></td><td class="r muted">${dec(S.classSubjectAvg(c, sid2))}</td><td>${x >= 16 ? 'Excellent' : x >= 13 ? 'Bon travail' : x >= 10 ? 'Assez bien' : 'Insuffisant'}</td></tr>`; }).join('')}
      </tbody></table>
      <div class="box" style="display:flex;justify-content:space-between;align-items:center"><div>Moyenne générale<br><span style="font-family:Fraunces,serif;font-size:28px">${a.general ? dec(a.general) : '—'}</span> <span class="muted">/ 20</span></div>${App.setting('ranking', true) ? `<div>Rang<br><span style="font-family:Fraunces,serif;font-size:28px">${rk.rank}</span> <span class="muted">/ ${rk.of}</span></div>` : ''}<div>Moyenne de classe<br><span style="font-family:Fraunces,serif;font-size:28px">${dec(S.classAvg(c) || 0)}</span></div><div>Assiduité<br><span style="font-family:Fraunces,serif;font-size:28px">${Math.round(s.attendance * 100)}%</span></div></div>
      <h2>Appréciation du conseil de classe</h2><p style="line-height:1.7">${a.general >= 15 ? 'Félicitations. Un trimestre remarquable, fruit d\'un travail régulier et approfondi.' : a.general >= 12 ? 'Encouragements. Un bon trimestre ; poursuivre les efforts engagés.' : 'Trimestre fragile. Un travail plus régulier est attendu pour progresser.'}</p>
      <div class="sig"><div class="stamp">CONSEIL DE CLASSE<br>${c.name}</div><div class="r">${D().tenant.director.first} ${D().tenant.director.last}<br><span class="muted">Direction</span></div></div>`);
  };
  App.receipt = function (invId) {
    const i = D().invoices.find(x => x.id === invId), s = S.stu(i.studentId);
    printDoc('Reçu ' + i.id, `<h1>Reçu de paiement</h1><p class="muted">N° ${i.id}</p>
      <div class="box"><b>${fullName(s.parentIds.length ? S.par(s.parentIds[0]) : s)}</b><br><span class="muted">Pour l'élève ${fullName(s)} · ${S.cls(s.classId).name}</span></div>
      <table><thead><tr><th>Désignation</th><th class="r">Montant</th></tr></thead><tbody>${i.detail ? Object.entries(i.detail).filter(x => x[1]).map(([k, v]) => `<tr><td>${{ scolarite: 'Frais de scolarité', transport: 'Transport scolaire', cantine: 'Cantine' }[k]} — ${i.label.replace('Scolarité ', '')}</td><td class="r">${S.money(v)}</td></tr>`).join('') : `<tr><td>${i.label}</td><td class="r">${S.money(i.amount)}</td></tr>`}<tr><td><b>Total réglé</b></td><td class="r"><b>${S.money(i.amount)}</b></td></tr></tbody></table>
      <p>Mode de règlement : <b>${i.method || '—'}</b> · Échéance : ${UI.date(i.due)}</p>
      <div class="sig"><div class="stamp">PAYÉ<br>${UI.date(i.due)}</div><div class="r">Service financier<br><span class="muted">${D().tenant.name}</span></div></div>`);
  };

  // ==========================================================
  // DEVOIRS
  // ==========================================================
  Views.homework = function () {
    const d = D(), u = currentUser();
    const today = DB.iso(DB.TODAY);
    let list = d.homework;
    if (State.role === 'teacher') list = list.filter(h => h.teacherId === u.id);
    if (State.role === 'parent') list = list.filter(h => u.childIds.some(id => S.stu(id).classId === h.classId));
    if (State.role === 'student') list = list.filter(h => h.classId === u.classId);
    const isFamily = State.role === 'parent' || State.role === 'student';
    const statusOf = h => { if (isFamily) { const x = DB.hash(h.id + (u.id || '')) % 10; return h.due < today ? (x < 7 ? 'Corrigé' : x < 9 ? 'Rendu' : 'En retard') : x < 3 ? 'Rendu' : 'À faire'; } return h.due < today ? (h.corrected >= h.submitted ? 'Corrigé' : 'Rendu') : 'À faire'; };
    list = list.slice().sort((a, b) => b.due.localeCompare(a.due));
    const html = `
      ${head('Devoirs', isFamily ? 'Travail à faire, rendus et corrections' : `${list.length} devoirs · rappels automatiques 48 h et 24 h avant la date limite`, State.role === 'teacher' || State.role === 'admin' ? `<button class="btn btn-primary" id="newHw">${icon('plus', 'sm')} Créer un devoir</button>` : '')}
      <div class="grid g-4 mb">
        ${kpi('À faire', list.filter(h => statusOf(h) === 'À faire').length, 'homework')}
        ${kpi('Rendus', list.filter(h => statusOf(h) === 'Rendu').length, 'upload')}
        ${kpi('Corrigés', list.filter(h => statusOf(h) === 'Corrigé').length, 'checkc')}
        ${kpi(isFamily ? 'En retard' : 'Copies à corriger', isFamily ? list.filter(h => statusOf(h) === 'En retard').length : list.reduce((a, h) => a + h.submitted - h.corrected, 0), 'alert', '', { gold: 1 })}
      </div>
      <div class="card"><div class="toolbar"><div class="pill-filter" id="hwf">${['Tous', 'À faire', 'Rendu', 'Corrigé', 'En retard'].map((x, i) => `<button class="${i ? '' : 'on'}" data-f="${x}">${x}</button>`).join('')}</div></div>
        <div class="list" id="hwl"></div></div>`;
    return {
      html, mount: el => {
        const draw = f => {
          el.querySelector('#hwl').innerHTML = list.filter(h => f === 'Tous' || statusOf(h) === f).map(h => { const st = statusOf(h); const s = S.subj(h.subject); return `
            <div class="li" style="padding:14px 20px"><div class="dot-ic" style="background:${s.color}18;color:${s.color}">${icon('homework', 'sm')}</div>
              <div class="grow"><div class="t">${esc(h.title)}</div><div class="s">${s.name} · ${S.cls(h.classId).name} · ${esc(fullName(S.tch(h.teacherId)))}${h.attachments ? ' · ' + h.attachments + ' pièce(s) jointe(s)' : ''}</div></div>
              <div style="text-align:right;min-width:120px"><div style="font-size:12.5px;font-weight:500;color:${h.due < today ? 'var(--ink-3)' : h.due === today ? 'var(--danger)' : 'var(--ink)'}">${relDays(h.due)}</div><div class="muted" style="font-size:11.5px">${date(h.due)}</div></div>
              ${!isFamily ? `<div style="width:130px"><div class="row between" style="font-size:11.5px"><span class="muted">Rendus</span><b>${h.submitted}/${h.total}</b></div><div class="bar"><i style="width:${h.submitted / h.total * 100}%"></i></div></div>` : ''}
              <div style="width:96px;text-align:right">${badge(st)}</div>
              ${isFamily && st === 'À faire' && State.role === 'student' ? `<button class="btn btn-sm btn-primary" data-sub="${h.id}">Rendre</button>` : !isFamily ? `<button class="btn btn-sm btn-ghost" data-cor="${h.id}">Corriger</button>` : st === 'Corrigé' ? `<span class="badge navy plain">${12 + DB.hash(h.id) % 8}/20</span>` : ''}
            </div>`; }).join('') || '<div class="empty">Aucun devoir</div>';
          el.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => UI.modal('Rendre mon devoir', `<div class="stack"><div style="border:1.5px dashed var(--beige-300);border-radius:12px;padding:30px;text-align:center;color:var(--ink-3);background:var(--beige-50)">${icon('upload', 'lg')}<div class="mt-s">Déposez votre fichier (PDF, Word, image)</div></div><textarea class="input" placeholder="Message pour l'enseignant (facultatif)"></textarea></div>`, { ok: 'Envoyer', onOk: () => { UI.toast('Devoir rendu — accusé de réception envoyé'); b.outerHTML = UI.badge('Rendu'); } }));
          el.querySelectorAll('[data-cor]').forEach(b => b.onclick = () => correction(d.homework.find(h => h.id === b.dataset.cor)));
        };
        App.bindTabs(el, 'f', draw); draw('Tous');
        const nb = el.querySelector('#newHw'); if (nb) nb.onclick = () => UI.modal('Nouveau devoir', `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Titre</label><input class="input" id="ht" placeholder="Exercices 1 à 5 p. 42"></div><div class="field"><label>Classe</label><select class="select" id="hc">${(State.role === 'teacher' ? u.classes.map(S.cls) : d.classes).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="field"><label>Date limite</label><input class="input" type="date" id="hd" value="${DB.iso(DB.addDays(DB.TODAY, 7))}"></div><div class="field" style="grid-column:1/-1"><label>Consignes</label><textarea class="input"></textarea></div><div class="field"><label>Pièces jointes</label><button class="btn btn-ghost">${icon('upload', 'sm')} Ajouter</button></div><div class="field"><label>Élèves concernés</label><select class="select"><option>Toute la classe</option><option>Groupe A</option><option>Sélection…</option></select></div></div>`, { ok: 'Publier', onOk: m => { const c = S.cls(m.querySelector('#hc').value); d.homework.unshift({ id: 'h' + Date.now(), classId: c.id, subject: State.role === 'teacher' ? u.subject : c.subjects[0], teacherId: State.role === 'teacher' ? u.id : c.mainTeacher, title: m.querySelector('#ht').value || 'Nouveau devoir', due: m.querySelector('#hd').value, created: DB.iso(DB.TODAY), submitted: 0, corrected: 0, total: c.studentIds.length, attachments: 0 }); App.route(); UI.toast(`Devoir publié — ${c.studentIds.length} élèves et leurs parents notifiés`, 'bell'); } });
      }
    };
  };
  function correction(h) {
    const c = S.cls(h.classId);
    UI.modal('Correction — ' + esc(h.title), `<table class="tbl"><thead><tr><th>Élève</th><th>Rendu</th><th>Note</th><th>Commentaire</th></tr></thead><tbody>${c.studentIds.slice(0, 10).map((id, i) => { const s = S.stu(id); const done = i < h.submitted; return `<tr><td>${who(s)}</td><td>${done ? badge(i % 7 === 3 ? 'En retard' : 'Rendu') : badge('À faire')}</td><td>${done ? `<input class="grade-in" value="${i < h.corrected ? 10 + DB.hash(id + h.id) % 10 : ''}" placeholder="/20">` : ''}</td><td>${done ? '<input class="input" style="height:30px;width:100%" placeholder="Commentaire…">' : ''}</td></tr>`; }).join('')}</tbody></table>`, { wide: true, ok: 'Publier les corrections', onOk: () => UI.toast('Corrections publiées — élèves et parents notifiés', 'bell') });
  }

  // ==========================================================
  // E-LEARNING
  // ==========================================================
  Views.elearning = function (p) {
    const d = D();
    if (p[0]) return courseView(p[0], p[1]);
    const creator = State.role === 'teacher' || State.role === 'admin';
    const html = `
      ${head('Cours en ligne', 'Plateforme d\'apprentissage intégrée — vidéos, documents, quiz et devoirs', creator ? `<button class="btn btn-ghost" onclick="AI.open('Génère un quiz de 5 questions sur les fractions niveau 6e')">${icon('sparkles', 'sm')} Générer avec l'IA</button><button class="btn btn-primary" id="newCo">${icon('plus', 'sm')} Créer un cours</button>` : '')}
      <div class="grid g-4 mb">
        ${kpi('Cours publiés', d.courses.length, 'elearning', delta(22))}
        ${kpi('Élèves actifs / sem.', num(d.onlineUsage[11].active), 'students', delta(9))}
        ${kpi('Heures suivies', num(d.onlineUsage.reduce((a, w) => a + w.hours, 0)), 'clock')}
        ${kpi('Taux de complétion', pct(d.courses.reduce((a, c) => a + c.completion, 0) / d.courses.length, 0), 'checkc', '', { gold: 1 })}
      </div>
      <div class="pill-filter mb" id="cof"><button class="on" data-c="">Toutes les matières</button>${[...new Set(d.courses.map(c => c.subject))].map(s => `<button data-c="${s}">${S.subj(s).short}</button>`).join('')}</div>
      <div class="grid g-3" id="cogrid"></div>`;
    return {
      html, mount: el => {
        const draw = sid => el.querySelector('#cogrid').innerHTML = d.courses.filter(c => !sid || c.subject === sid).map(co => { const s = S.subj(co.subject); return `
          <div class="card hover" style="cursor:pointer;overflow:hidden" onclick="location.hash='#/elearning/${co.id}'">
            <div style="height:120px;background:linear-gradient(135deg,${s.color},${s.color}bb);position:relative;padding:16px;color:#fff;display:flex;flex-direction:column;justify-content:space-between">
              <div class="row between"><span class="badge plain" style="background:rgba(255,255,255,.18);color:#fff">${s.short} · ${co.level}</span><span style="font-size:12px;opacity:.9">${icon('star', 'sm')}</span></div>
              <div class="serif" style="font-size:19px;line-height:1.2">${esc(co.title)}</div>
              <svg viewBox="0 0 100 100" style="position:absolute;right:-20px;bottom:-30px;width:130px;opacity:.12"><circle cx="50" cy="50" r="48" fill="#fff"/></svg>
            </div>
            <div class="card-b">
              <div class="row between" style="font-size:12px" ><span class="muted">${co.chapters} chapitres · ${co.videos} vidéos · ${co.quizzes} quiz</span><span class="muted">${co.duration}</span></div>
              <div class="row" style="margin-top:12px">${avatar(S.tch(co.teacherId), 'sm')}<span style="font-size:12.5px;flex:1">${esc(fullName(S.tch(co.teacherId)))}</span><span style="font-size:12px"><b>${co.rating.replace('.', ',')}</b> ★</span></div>
              <div class="row" style="margin-top:12px"><div class="bar gold" style="flex:1"><i style="width:${co.completion}%"></i></div><span style="font-size:12px">${co.completion}%</span></div>
            </div></div>`; }).join('');
        App.bindTabs(el, 'c', draw); draw('');
        const nb = el.querySelector('#newCo'); if (nb) nb.onclick = () => UI.modal('Créer un cours', `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Titre du cours</label><input class="input" placeholder="Les équations du premier degré"></div><div class="field"><label>Matière</label><select class="select">${d.subjects.map(s => `<option>${s.name}</option>`).join('')}</select></div><div class="field"><label>Niveau</label><select class="select">${d.levels.map(l => `<option>${l.name}</option>`).join('')}</select></div><div class="field" style="grid-column:1/-1"><label>Contenus</label><div class="row wrap">${[['video', 'Vidéo'], ['documents', 'PDF'], ['layers', 'Présentation'], ['homework', 'Exercices'], ['target', 'Quiz'], ['upload', 'Devoir']].map(x => `<button class="btn btn-ghost btn-sm" onclick="UI.toast('${x[1]} ajouté au chapitre 1')">${icon(x[0], 'sm')} ${x[1]}</button>`).join('')}</div></div></div>`, { ok: 'Créer le brouillon', onOk: () => UI.toast('Cours créé en brouillon') });
      }
    };
  };
  function courseView(id, chap = '0') {
    const d = D(), co = d.courses.find(c => c.id === id); if (!co) return '<div class="empty">Cours introuvable</div>';
    const s = S.subj(co.subject), ci = +chap;
    const chapters = Array.from({ length: co.chapters }, (_, i) => ({ title: ['Introduction', 'Notions fondamentales', 'Méthodes et exemples', 'Exercices guidés', 'Approfondissement', 'Cas pratiques', 'Synthèse', 'Révision', 'Évaluation finale'][i] || 'Chapitre ' + (i + 1), items: [['video', 'Vidéo — ' + (6 + i * 2) + ' min'], ['documents', 'Support PDF'], ['target', 'Quiz de validation']], done: i < Math.floor(co.chapters * co.completion / 100) }));
    const html = `
      <div class="crumbs"><a href="#/elearning">Cours en ligne</a>${icon('right', 'sm')}<span>${esc(co.title)}</span></div>
      ${head(esc(co.title), `${s.name} · ${co.level} · ${esc(fullName(S.tch(co.teacherId)))}`, `<button class="btn btn-ghost" onclick="AI.open('Résume le cours : ${esc(co.title)}')">${icon('sparkles', 'sm')} Résumé IA</button><button class="btn btn-ghost" onclick="AI.open('Génère une fiche de révision sur : ${esc(co.title)}')">${icon('documents', 'sm')} Fiche de révision</button>`)}
      <div class="grid g-main">
        <div class="stack">
          <div class="card" style="overflow:hidden"><div style="aspect-ratio:16/9;background:linear-gradient(135deg,var(--navy-900),${s.color});display:grid;place-items:center;position:relative;color:#fff" id="player">
            <button style="width:74px;height:74px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.12);backdrop-filter:blur(6px);display:grid;place-items:center;cursor:pointer;color:#fff" id="playBtn">${icon('play', 'lg')}</button>
            <div style="position:absolute;left:24px;bottom:22px;right:24px"><div class="eyebrow" style="color:var(--gold-soft)">Chapitre ${ci + 1}</div><div class="serif" style="font-size:24px">${chapters[ci].title}</div><div class="bar" style="margin-top:12px;background:rgba(255,255,255,.15)"><i id="vprog" style="width:0%;background:var(--gold)"></i></div></div>
          </div></div>
          ${card('Quiz de validation', quizHTML(), { sub: '3 questions · correction immédiate' })}
        </div>
        ${card('Programme du cours', `<div class="row mb" style="gap:12px">${UI.ring(co.completion, { size: 58, color: 'var(--gold)' })}<div><div style="font-weight:600">${co.completion}% complété</div><div class="muted" style="font-size:12px">${chapters.filter(c => c.done).length}/${co.chapters} chapitres</div></div></div><div class="list">${chapters.map((c, i) => `<a class="li click" href="#/elearning/${id}/${i}" style="padding-left:0;padding-right:0;${i === ci ? 'background:var(--beige-50)' : ''}"><div class="dot-ic ${c.done ? 'success' : i === ci ? 'navy' : ''}">${c.done ? icon('check', 'sm') : '<b style="font-size:12px">' + (i + 1) + '</b>'}</div><div class="grow"><div class="t">${c.title}</div><div class="s">${c.items.map(x => x[1]).join(' · ')}</div></div></a>`).join('')}</div>`)}
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#playBtn').onclick = e => { const b = e.currentTarget; b.innerHTML = icon('clock', 'lg'); let p = 0; const iv = setInterval(() => { p += 2; const v = el.querySelector('#vprog'); if (!v) return clearInterval(iv); v.style.width = p + '%'; if (p >= 100) { clearInterval(iv); b.innerHTML = icon('check', 'lg'); UI.toast('Chapitre terminé — progression enregistrée'); } }, 60); };
        el.querySelectorAll('.qopt').forEach(o => o.onclick = () => { const q = o.closest('.q'); if (q.dataset.done) return; q.dataset.done = 1; const ok = o.dataset.ok === '1'; o.style.borderColor = ok ? 'var(--success)' : 'var(--danger)'; o.style.background = ok ? 'var(--success-bg)' : 'var(--danger-bg)'; if (!ok) { const good = q.querySelector('[data-ok="1"]'); good.style.borderColor = 'var(--success)'; } const done = el.querySelectorAll('.q[data-done]').length; if (done === 3) { const score = [...el.querySelectorAll('.q')].filter(x => x.querySelector('[data-ok="1"]').style.background).length; UI.toast(`Quiz terminé : ${score}/3 — résultat envoyé au Learning Dashboard`, 'award'); } });
      }
    };
  }
  function quizHTML() {
    const Q = [['Quelle est la valeur de 3/4 + 1/4 ?', ['1/2', '1', '4/8', '3/16'], 1], ['Laquelle de ces fractions est irréductible ?', ['6/9', '4/10', '7/12', '8/12'], 2], ['2/5 de 30 est égal à :', ['10', '12', '15', '6'], 1]];
    return Q.map((q, i) => `<div class="q" style="margin-bottom:16px"><div style="font-weight:500;margin-bottom:8px">${i + 1}. ${q[0]}</div><div class="grid g-4" style="gap:8px">${q[1].map((o, j) => `<button class="qopt card" data-ok="${j === q[2] ? 1 : 0}" style="padding:10px;cursor:pointer;text-align:center;border-width:1.5px">${o}</button>`).join('')}</div></div>`).join('');
  }

  // ==========================================================
  // BIBLIOTHÈQUE NUMÉRIQUE
  // ==========================================================
  const favs = new Set();
  Views.library = function () {
    const d = D();
    const kinds = ['Tous', 'Livre', 'Manuel', 'PDF', 'Vidéo', 'Support de cours', 'Référence', 'Favoris'];
    const html = `
      ${head('Bibliothèque numérique', `${d.books.length} ressources · livres, manuels, PDF, vidéos et supports de cours`, State.role !== 'parent' && State.role !== 'student' ? `<button class="btn btn-primary" onclick="UI.toast('Ressource ajoutée au catalogue','upload')">${icon('upload', 'sm')} Ajouter une ressource</button>` : '')}
      <div class="card mb"><div class="toolbar" style="border:0">
        <div class="input-ic" style="flex:1;min-width:220px">${icon('search', 'sm')}<input class="input" style="width:100%" id="lq" placeholder="Titre, auteur, sujet…"></div>
        <select class="select" id="lsub"><option value="">Toutes les matières</option>${d.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
        <select class="select" id="llvl"><option value="">Tous les niveaux</option><option>Primaire</option><option>Collège</option><option>Lycée</option></select>
      </div><div style="padding:0 16px 14px" class="pill-filter" id="lk">${kinds.map((k, i) => `<button class="${i ? '' : 'on'}" data-k="${k}">${k === 'Favoris' ? '★ ' : ''}${k}</button>`).join('')}</div></div>
      <div class="grid g-6" id="lgrid"></div>`;
    return {
      html, mount: el => {
        let kind = 'Tous';
        const draw = () => {
          const q = el.querySelector('#lq').value.toLowerCase(), sub = el.querySelector('#lsub').value, lvl = el.querySelector('#llvl').value;
          const list = d.books.filter(b => (kind === 'Tous' || (kind === 'Favoris' ? favs.has(b.id) : b.kind === kind)) && (!sub || b.subject === sub) && (!lvl || b.level === lvl || b.level === 'Tous niveaux') && (!q || (b.title + ' ' + b.author).toLowerCase().includes(q)));
          el.querySelector('#lgrid').innerHTML = list.map(b => `<div class="card hover" style="padding:12px">
            <div class="cover" style="background:linear-gradient(160deg,${b.cover},${b.cover}cc)"><div class="row between" style="position:relative;z-index:1"><span style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">${b.kind}</span>${b.kind === 'Vidéo' ? icon('play', 'sm') : ''}</div><div style="position:relative;z-index:1"><div class="ct">${esc(b.title)}</div><div class="ca">${esc(b.author)}</div></div></div>
            <div style="margin-top:10px;font-size:12px" class="row between"><span class="muted">${S.subj(b.subject).short} · ${b.level}</span></div>
            <div class="row" style="margin-top:8px;gap:6px"><button class="btn btn-sm btn-soft" style="flex:1" onclick="UI.toast('Téléchargement de « ${esc(b.title).replace(/'/g, '')} »','download')">${icon('download', 'sm')}</button><button class="btn btn-sm btn-ghost btn-icon" data-fav="${b.id}" style="color:${favs.has(b.id) ? 'var(--gold)' : 'inherit'}">${icon('star', 'sm')}</button></div>
          </div>`).join('') || '<div class="empty span-all">Aucune ressource ne correspond à votre recherche.</div>';
          el.querySelectorAll('[data-fav]').forEach(f => f.onclick = () => { favs.has(f.dataset.fav) ? favs.delete(f.dataset.fav) : favs.add(f.dataset.fav); draw(); });
        };
        el.querySelector('#lq').oninput = draw; el.querySelector('#lsub').onchange = draw; el.querySelector('#llvl').onchange = draw;
        App.bindTabs(el, 'k', k => { kind = k; draw(); }); draw();
      }
    };
  };
})();
