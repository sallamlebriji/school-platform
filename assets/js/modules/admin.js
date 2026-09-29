/* ==========================================================
   Administration : Finance, Analytics & BI, Paramètres
   (établissement, marque, utilisateurs & RBAC, sécurité,
   audit log, abonnement SaaS & facturation)
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, badge, num, pct, dec, date, dateShort, fullName, avatar, who } = UI;
  const { D, S, Views, head, kpi, delta, card, tabs, bindTabs, currentUser, State } = App;
  const HEX = ['#1D3462', '#B08D57', '#6F8FC4', '#8FB0A0', '#C9A97A', '#A9B4C8'];

  // ==========================================================
  // FINANCE
  // ==========================================================
  const finState = { f: 'Tous', q: '' };
  Views.finance = function () {
    if (State.role === 'parent') return parentFinance();
    const d = D();
    const inv = d.invoices;
    const paid = inv.filter(i => i.status === 'Payé'), late = inv.filter(i => i.status === 'En retard'), pend = inv.filter(i => i.status === 'En attente'), up = inv.filter(i => i.status === 'À venir');
    const sum = a => a.reduce((s, i) => s + i.amount, 0);
    const ca = d.revenue.reduce((a, b) => a + b, 0);
    const byType = [['Scolarité', .74], ['Transport', .09], ['Cantine', .1], ['Inscriptions', .05], ['Activités', .02]].map(([l, k], i) => ({ label: l, value: Math.round(ca * k), color: HEX[i] }));
    const html = `
      ${head('Finance', `Exercice ${d.tenant.year} · frais d'inscription, scolarité, transport, cantine et activités`, `<button class="btn btn-ghost" id="expF">${icon('download', 'sm')} Export comptable</button><button class="btn btn-ghost" id="remind">${icon('send', 'sm')} Relancer les impayés</button><button class="btn btn-primary" id="pay">${icon('plus', 'sm')} Enregistrer un paiement</button>`)}
      <div class="grid g-4 mb">
        ${kpi('Chiffre d\'affaires annuel', S.kmoney(ca), 'finance', `${delta(8.4)}<span>vs N-1</span>`, { gold: 1 })}
        ${kpi('Paiements reçus', S.kmoney(sum(paid)), 'checkc', `<span>${num(paid.length)} règlements</span>`)}
        ${kpi('Impayés', S.kmoney(sum(late)), 'alert', `<span>${late.length} factures en retard</span>`)}
        ${kpi('Échéances à venir', S.kmoney(sum(up) + sum(pend)), 'calendar', `<span>${up.length + pend.length} factures</span>`)}
      </div>
      <div class="grid g-main mb">
        ${card('Revenus par mois', UI.bars(d.revenueMonths, [{ name: 'Encaissé', color: HEX[0], values: d.revenue }, { name: 'N-1', color: HEX[1] + '88', values: d.revenuePrev }], { h: 230, left: 50, fmt: S.kmoney, axisFmt: v => Math.round(v / 1000) + 'k' }), { action: UI.legend([{ name: 'Encaissé', color: HEX[0] }, { name: 'N-1', color: HEX[1] }]) })}
        ${card('Répartition du CA', UI.donut(byType, { fmt: S.kmoney, center: S.kmoney(ca).replace(' DH', ''), sub: 'DH', size: 140 }))}
      </div>
      <div class="grid g-3 mb">
        ${card('Taux de recouvrement', `<div class="row" style="gap:20px">${UI.ring(paid.length / (paid.length + late.length + pend.length) * 100, { size: 100, w: 8, color: 'var(--success)' })}<div class="stack" style="gap:6px;font-size:12.5px"><span>${badge('Payé')} ${num(paid.length)}</span><span>${badge('En attente')} ${num(pend.length)}</span><span>${badge('En retard')} ${num(late.length)}</span></div></div>`)}
        ${card('Modes de paiement', UI.hbars([['Virement', .38], ['Carte en ligne', .31], ['Prélèvement', .16], ['Chèque', .11], ['Espèces', .04]].map(([l, v]) => ({ label: l, value: Math.round(v * 100) })), { fmt: v => v + ' %', max: 100 }))}
        ${card('Grille tarifaire mensuelle', `<div class="list">${Object.entries(d.fees).filter(([k]) => d.tenant.cycles.includes(k)).map(([k, v]) => `<div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">${k}</div></div><b>${S.money(v)}</b></div>`).join('')}<div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">Transport</div></div><b>${S.money(650)}</b></div><div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">Cantine</div></div><b>${S.money(700)}</b></div></div>`)}
      </div>
      <div class="card"><div class="toolbar"><div class="pill-filter" id="ff">${['Tous', 'Payé', 'En attente', 'En retard', 'À venir'].map(x => `<button data-f="${x}" class="${finState.f === x ? 'on' : ''}">${x}</button>`).join('')}</div><div class="input-ic" style="margin-left:auto;min-width:240px">${icon('search', 'sm')}<input class="input" style="width:100%" id="fq" placeholder="Élève ou référence…" value="${esc(finState.q)}"></div></div>
        <div class="table-wrap" id="ftbl"></div></div>`;
    return {
      html, mount: el => {
        const draw = () => {
          const q = finState.q.toLowerCase();
          const rows = inv.filter(i => (finState.f === 'Tous' || i.status === finState.f) && (!q || i.id.toLowerCase().includes(q) || fullName(S.stu(i.studentId)).toLowerCase().includes(q))).slice(0, 25);
          el.querySelector('#ftbl').innerHTML = `<table class="tbl"><thead><tr><th>Référence</th><th>Élève</th><th>Libellé</th><th>Échéance</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead><tbody>${rows.map(i => { const s = S.stu(i.studentId); return `<tr><td class="muted">${i.id}</td><td>${who(s, S.cls(s.classId).name)}</td><td>${i.label}</td><td>${dateShort(i.due)}</td><td class="num" style="font-weight:500">${S.money(i.amount)}</td><td>${badge(i.status)}</td><td>${i.status === 'Payé' ? `<button class="btn btn-sm btn-ghost" onclick="App.receipt('${i.id}')">${icon('download', 'sm')} Reçu</button>` : i.status === 'À venir' ? '' : `<button class="btn btn-sm btn-soft" data-mark="${i.id}">Encaisser</button>`}</td></tr>`; }).join('')}</tbody></table>`;
          el.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { const i = inv.find(x => x.id === b.dataset.mark); i.status = 'Payé'; i.method = 'Espèces'; draw(); UI.toast(`Paiement ${i.id} encaissé — reçu envoyé à la famille`); });
        };
        App.bindTabs(el, 'f', f => { finState.f = f; draw(); });
        el.querySelector('#fq').oninput = e => { finState.q = e.target.value; draw(); };
        el.querySelector('#remind').onclick = () => UI.toast(`${late.length + pend.length} relances envoyées (email + SMS)`, 'send');
        el.querySelector('#expF').onclick = () => App.exportCSV('factures.csv', [['Référence', 'Élève', 'Libellé', 'Échéance', 'Montant', 'Statut']].concat(inv.map(i => [i.id, fullName(S.stu(i.studentId)), i.label, i.due, i.amount, i.status])));
        el.querySelector('#pay').onclick = () => UI.modal('Enregistrer un paiement', `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Facture</label><select class="select" id="pi">${inv.filter(i => i.status === 'En retard' || i.status === 'En attente').slice(0, 40).map(i => `<option value="${i.id}">${i.id} — ${fullName(S.stu(i.studentId))} — ${S.money(i.amount)}</option>`).join('')}</select></div><div class="field"><label>Mode</label><select class="select" id="pm"><option>Virement</option><option>Carte</option><option>Chèque</option><option>Espèces</option></select></div><div class="field"><label>Date</label><input class="input" type="date" value="${DB.iso(DB.TODAY)}"></div></div>`, { ok: 'Encaisser', onOk: m => { const i = inv.find(x => x.id === m.querySelector('#pi').value); if (i) { i.status = 'Payé'; i.method = m.querySelector('#pm').value; } draw(); UI.toast('Paiement enregistré — reçu PDF envoyé'); } });
        draw();
      }
    };
  };
  function parentFinance() {
    const u = currentUser(), kids = u.childIds.map(S.stu);
    const inv = kids.flatMap(k => S.invoicesOf(k.id).map(i => ({ ...i, k })));
    const due = inv.filter(i => i.status === 'En retard' || i.status === 'En attente');
    const html = `
      ${head('Paiements', 'Factures, échéances et reçus de vos enfants')}
      <div class="grid g-3 mb">
        <div class="card navy" style="padding:22px"><div style="font-size:12.5px;color:#AEB9D2">Montant à régler</div><div class="serif" style="font-size:32px;color:#fff;margin:6px 0 14px">${S.money(due.reduce((a, i) => a + i.amount, 0))}</div>${due.length ? `<button class="btn btn-gold" id="payAll">${icon('card', 'sm')} Payer en ligne</button>` : '<span class="badge success">À jour</span>'}</div>
        ${kpi('Payé cette année', S.money(inv.filter(i => i.status === 'Payé').reduce((a, i) => a + i.amount, 0)), 'checkc')}
        ${kpi('Prochaine échéance', (inv.find(i => i.status === 'À venir') || {}).due ? dateShort(inv.find(i => i.status === 'À venir').due) : '—', 'calendar', '', { gold: 1 })}
      </div>
      ${card('Factures', `<table class="tbl"><thead><tr><th>Référence</th><th>Enfant</th><th>Libellé</th><th>Échéance</th><th class="num">Montant</th><th>Statut</th><th></th></tr></thead><tbody>${inv.map(i => `<tr><td class="muted">${i.id}</td><td>${esc(i.k.first)}</td><td>${i.label}</td><td>${dateShort(i.due)}</td><td class="num">${S.money(i.amount)}</td><td>${badge(i.status)}</td><td>${i.status === 'Payé' ? `<button class="btn btn-sm btn-ghost" onclick="App.receipt('${i.id}')">${icon('download', 'sm')} Reçu</button>` : ''}</td></tr>`).join('')}</tbody></table>`, { flush: true })}`;
    return {
      html, mount: el => {
        const b = el.querySelector('#payAll');
        if (b) b.onclick = () => UI.modal('Paiement en ligne sécurisé', `<div class="lock mb">${icon('lock')}<span>Vous allez être redirigé vers la page sécurisée de notre prestataire de paiement (3-D Secure). Athénée ne stocke aucune donnée bancaire.</span></div><div class="list">${due.map(i => `<div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">${i.label}</div><div class="s">${esc(i.k.first)}</div></div><b>${S.money(i.amount)}</b></div>`).join('')}</div>`, { ok: 'Continuer vers le paiement', onOk: () => { due.forEach(i => { const o = D().invoices.find(x => x.id === i.id); o.status = 'Payé'; o.method = 'Carte'; }); App.route(); UI.toast('Paiement confirmé (démo) — reçus disponibles'); } });
      }
    };
  }

  // ==========================================================
  // ANALYTICS & BI
  // ==========================================================
  const anState = { year: '2026', cycle: '', cls: '' };
  Views.analytics = function () {
    const d = D();
    const classes = d.classes.filter(c => c.cycle !== 'Maternelle' && (!anState.cycle || c.cycle === anState.cycle) && (!anState.cls || c.id === anState.cls));
    const subjects = d.subjects.filter(s => classes.some(c => c.subjects.includes(s.id)) && s.id !== 'eps');
    const avg = classes.map(S.classAvg).filter(Boolean);
    const schoolAvg = avg.reduce((a, b) => a + b, 0) / avg.length;
    const inv = d.invoices.filter(i => i.status !== 'À venir');
    const payRate = inv.filter(i => i.status === 'Payé').length / inv.length * 100;
    const busUse = d.buses.reduce((a, b) => a + b.studentIds.length, 0) / d.students.length * 100;
    const html = `
      ${head('Analytics & Business Intelligence', 'Pilotage stratégique de l\'établissement', `<button class="btn btn-ghost" onclick="AI.open('Génère un rapport de direction mensuel')">${icon('sparkles', 'sm')} Rapport IA</button><button class="btn btn-primary" onclick="window.print()">${icon('printer', 'sm')} Exporter</button>`)}
      <div class="card mb"><div class="toolbar" style="border:0">${icon('filter', 'sm')}
        <select class="select" id="ay">${['2026', '2025', '2024'].map(y => `<option ${anState.year === y ? 'selected' : ''} value="${y}">Année ${y}–${+y + 1}</option>`).join('')}</select>
        <select class="select" id="acy"><option value="">Tous les niveaux</option>${d.tenant.cycles.filter(c => c !== 'Maternelle').map(c => `<option ${anState.cycle === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <select class="select" id="acl"><option value="">Toutes les classes</option>${d.classes.filter(c => c.cycle !== 'Maternelle' && (!anState.cycle || c.cycle === anState.cycle)).map(c => `<option value="${c.id}" ${anState.cls === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
        <span class="muted" style="margin-left:auto;font-size:12px">Données actualisées il y a 4 min</span></div></div>
      <div class="grid g-6 mb">
        ${kpi('Élèves', num(classes.reduce((a, c) => a + c.studentIds.length, 0)), 'students', delta(4.8), { cls: 'mini' })}
        ${kpi('Réinscription', pct(92.6), 'refresh', delta(1.9), { cls: 'mini' })}
        ${kpi('Absentéisme', pct(100 - classes.reduce((a, c) => a + S.classAttendance(c), 0) / classes.length), 'xc', delta(-.4, '%', true), { cls: 'mini' })}
        ${kpi('Moyenne', dec(schoolAvg), 'grades', delta(.3, ''), { cls: 'mini' })}
        ${kpi('Taux de paiement', pct(payRate), 'finance', delta(2.1), { cls: 'mini' })}
        ${kpi('Satisfaction', '4,4<small>/5</small>', 'star', delta(.2, ''), { cls: 'mini', gold: 1 })}
      </div>
      <div class="grid g-2 mb">
        ${card('Évolution des inscriptions & réinscriptions', UI.line(d.enrollHistory.map(e => e.year), [{ name: 'Effectif', color: HEX[0], values: d.enrollHistory.map(e => e.value), area: true }, { name: 'Réinscrits', color: HEX[1], values: d.enrollHistory.map(e => Math.round(e.value * .78)) }], { h: 220, dots: true }), { action: UI.legend([{ name: 'Effectif', color: HEX[0] }, { name: 'Réinscrits', color: HEX[1] }]) })}
        ${card('Performance par classe', UI.bars(classes.map(c => c.name), [{ name: 'Moyenne', color: HEX[0], values: classes.map(c => S.classAvg(c)) }], { h: 220, min: 8, max: 16, fmt: v => dec(v) + '/20', axisFmt: v => Math.round(v) }))}
      </div>
      ${card('Performance par matière et par classe', UI.heat(classes.slice(0, 12).map(c => ({ label: c.name, c })), subjects.map(s => ({ label: s.short, id: s.id })), (r, col) => r.c.subjects.includes(col.id) ? S.classSubjectAvg(r.c, col.id) : null), { sub: 'Moyennes — plus la cellule est foncée, meilleure est la performance' })}
      <div class="grid g-3 mt">
        ${card('Absentéisme hebdomadaire', UI.line(d.attendanceWeeks.map(w => w.label), [{ name: 'Non justifiées', color: '#B0443B', values: d.attendanceWeeks.map(w => w.unjustified) }, { name: 'Justifiées', color: HEX[2], values: d.attendanceWeeks.map(w => w.justified) }], { h: 180, fmt: v => dec(v, 1) + ' %', axisFmt: v => dec(v, 1) }))}
        ${card('Impayés par mois', UI.bars(d.revenueMonths.slice(0, 10), [{ name: 'Impayés', color: HEX[1], values: d.overdueMonths }], { h: 180, fmt: S.kmoney, axisFmt: v => Math.round(v / 1000) + 'k', left: 42 }))}
        ${card('Utilisation des cours en ligne', UI.line(d.onlineUsage.map(w => w.label), [{ name: 'Élèves actifs', color: HEX[0], values: d.onlineUsage.map(w => w.active), area: true }], { h: 180 }))}
      </div>
      <div class="grid g-3 mt">
        ${card('Utilisation du transport', `<div class="row" style="gap:18px">${UI.ring(busUse, { size: 96, w: 8, color: 'var(--gold)' })}<div class="stack" style="gap:6px;font-size:12.5px;flex:1">${d.buses.map(b => `<div class="row between"><span class="row" style="gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:${b.color}"></i>${b.line.split(' — ')[0]}</span><b>${Math.round(b.studentIds.length / b.capacity * 100)}%</b></div>`).join('')}</div></div>`, { sub: 'Part des élèves & remplissage par ligne' })}
        ${card('Satisfaction des parents', UI.hbars(d.satisfaction, { max: 5, fmt: v => dec(v, 1) + '/5', cls: 'gold' }), { sub: 'Enquête de rentrée · 612 réponses' })}
        ${card('Élèves à accompagner', `<div class="list">${d.students.filter(s => classes.some(c => c.id === s.classId)).map(s => ({ s, a: S.averages(s).general })).filter(x => x.a && x.a < 9.5).slice(0, 5).map(x => `<a class="li click" href="#/students/${x.s.id}" style="padding-left:0;padding-right:0"><div class="grow">${who(x.s, S.cls(x.s.classId).name)}</div><b style="color:var(--danger)">${dec(x.a)}</b></a>`).join('')}</div><button class="btn btn-sm btn-soft mt-s" onclick="AI.open('Identifie les élèves en difficulté et propose un plan d\\'accompagnement')">${icon('sparkles', 'sm')} Plan d'accompagnement IA</button>`, { sub: 'Détection automatique (moyenne < 9,5)' })}
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#ay').onchange = e => { anState.year = e.target.value; App.route(); UI.toast('Période : ' + e.target.value + '–' + (+e.target.value + 1)); };
        el.querySelector('#acy').onchange = e => { anState.cycle = e.target.value; anState.cls = ''; App.route(); };
        el.querySelector('#acl').onchange = e => { anState.cls = e.target.value; App.route(); };
      }
    };
  };

  // ==========================================================
  // PARAMÈTRES (SaaS multi-tenant)
  // ==========================================================
  const PLANS = [
    { id: 'Essentiel', price: 19, seats: 400, features: ['Scolarité, notes, présences', 'Espace parents & enseignants', 'Communication & calendrier', 'Finance & reçus', 'Support email'] },
    { id: 'Premium', price: 29, seats: 1200, features: ['Tout Essentiel', 'E-learning & bibliothèque', 'Transport GPS & QR/RFID', 'Analytics avancés', 'Assistant IA', 'Support prioritaire'] },
    { id: 'Groupe', price: null, seats: 'Illimité', features: ['Multi-établissements', 'Domaine personnalisé', 'SSO (SAML / Azure AD)', 'API & intégrations', 'SLA 99,9 % & DPO dédié'] }
  ];
  Views.settings = function (p) {
    const tab = p[0] || 'school';
    const d = D(), t = d.tenant;
    const body = {
      school: `<div class="grid g-main">
        ${card('Informations de l\'établissement', `<div class="form-grid"><div class="field"><label>Nom</label><input class="input" value="${esc(t.name)}"></div><div class="field"><label>Ville</label><input class="input" value="${esc(t.city)}"></div><div class="field"><label>Année scolaire</label><input class="input" value="${t.year}"></div><div class="field"><label>Devise</label><select class="select"><option>MAD — Dirham</option><option>EUR — Euro</option><option>XOF — Franc CFA</option></select></div><div class="field"><label>Cycles</label><input class="input" value="${t.cycles.join(', ')}"></div><div class="field"><label>Périodes</label><select class="select"><option>Trimestres</option><option>Semestres</option></select></div><div class="field"><label>Fuseau horaire</label><select class="select"><option>Africa/Casablanca</option><option>Europe/Paris</option></select></div><div class="field"><label>Langues</label><input class="input" value="Français, العربية, English"></div></div><div class="row mt" style="justify-content:flex-end"><button class="btn btn-primary" onclick="UI.toast('Paramètres enregistrés')">Enregistrer</button></div>`)}
        ${card('Isolation des données', `<div class="stack" style="gap:12px;font-size:13px"><div class="row">${icon('shield')}<span>Tenant ID : <code>${t.id}</code></span></div><div class="row">${icon('lock')}<span>Row-Level Security PostgreSQL</span></div><div class="row">${icon('key')}<span>Clé de chiffrement dédiée (KMS)</span></div><div class="row">${icon('globe')}<span>Hébergement : région UE / MA</span></div><p class="muted" style="font-size:12px">Aucune donnée de cet établissement n'est accessible depuis un autre tenant. Toute requête est filtrée par <code>tenant_id</code> au niveau de la base.</p></div>`)}
      </div>`,
      brand: `<div class="grid g-2">
        ${card('Identité visuelle', `<div class="stack"><div class="field"><label>Logo</label><div class="row"><div class="tenant-logo" style="background:${t.color};width:64px;height:64px;border-radius:16px;font-size:22px;border:2px solid var(--gold)">${t.initials}</div><button class="btn btn-ghost">${icon('upload', 'sm')} Remplacer</button></div></div><div class="field"><label>Couleur principale</label><div class="row">${['#13254A', '#5A2E3A', '#2E5E4E', '#3F2E5A', '#7A5A2E', '#1F4A5A'].map(c => `<button data-color="${c}" style="width:36px;height:36px;border-radius:10px;background:${c};border:3px solid ${c === t.color ? 'var(--gold)' : 'transparent'};cursor:pointer"></button>`).join('')}</div></div><div class="field"><label>Domaine personnalisé</label><div class="row"><input class="input" style="flex:1" value="${t.domain}">${badge('SSL actif', 'success')}</div><span class="muted" style="font-size:12px">CNAME → tenants.athenee.app</span></div></div>`)}
        ${card('Aperçu', `<div style="border:1px solid var(--line);border-radius:14px;overflow:hidden"><div style="background:${t.color};padding:16px;color:#fff;display:flex;align-items:center;gap:10px"><div class="tenant-logo" style="background:rgba(255,255,255,.12);border:1px solid var(--gold)">${t.initials}</div><b>${esc(t.name)}</b></div><div style="padding:18px;background:var(--ivory)"><div class="serif" style="font-size:20px">Bienvenue sur votre espace</div><p class="muted mt-s">Les documents PDF, emails et l'application mobile utilisent automatiquement votre logo et vos couleurs.</p><button class="btn mt" style="background:${t.color};color:#fff">Se connecter</button></div></div>`)}
      </div>`,
      users: (() => {
        const perms = ['Élèves', 'Notes', 'Présences', 'Finance', 'Santé', 'Transport', 'Paramètres'];
        const roles = [['Direction', [3, 3, 3, 3, 2, 3, 3]], ['Scolarité', [3, 1, 3, 1, 0, 2, 0]], ['Comptabilité', [1, 0, 0, 3, 0, 1, 0]], ['Enseignant', [1, 3, 3, 0, 0, 0, 0]], ['Infirmerie', [1, 0, 1, 0, 3, 0, 0]], ['Parent', [1, 1, 1, 1, 0, 1, 0]], ['Élève', [1, 1, 0, 0, 0, 0, 0]]];
        const L = ['—', 'Lecture', 'Édition', 'Complet'], LC = ['plain', 'navy', 'info', 'success'];
        return `<div class="grid g-4 mb">${kpi('Utilisateurs', num(d.teachers.length + d.parents.length + d.students.length + 14), 'user')}${kpi('Personnel administratif', 14, 'teachers')}${kpi('2FA activée', '87 %', 'shield')}${kpi('Rôles personnalisés', roles.length, 'key', '', { gold: 1 })}</div>
          ${card('Matrice des permissions (RBAC)', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Rôle</th>${perms.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${roles.map(r => `<tr><td><b style="font-weight:600">${r[0]}</b></td>${r[1].map(v => `<td>${v ? badge(L[v], LC[v]) : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`, { flush: true, sub: 'Principe du moindre privilège · les parents ne voient que leurs enfants', action: `<button class="btn btn-sm btn-primary" onclick="UI.toast('Éditeur de rôle ouvert','key')">${icon('plus', 'sm')} Rôle</button>` })}`;
      })(),
      security: `<div class="grid g-2">
        ${card('Authentification', ['Double authentification (2FA) obligatoire pour le personnel', 'Connexion SSO Google Workspace / Microsoft', 'Verrouillage après 5 échecs', 'Expiration des sessions après 30 min d\'inactivité', 'Mots de passe : 12 caractères minimum', 'Alerte de connexion depuis un nouvel appareil'].map((x, i) => `<div class="row between" style="padding:11px 0;border-bottom:1px solid var(--line-2)"><span>${x}</span><button class="switch ${i !== 1 ? 'on' : ''}" onclick="this.classList.toggle('on')"></button></div>`).join(''))}
        ${card('Sessions actives', `<div class="list">${[['Chrome · Windows', 'Casablanca · 41.249.12.8', 'Session actuelle'], ['Safari · iPhone', 'Casablanca · 105.66.3.20', 'Il y a 2 h'], ['Application Android', 'Rabat · 196.200.1.4', 'Hier']].map((s, i) => `<div class="li" style="padding-left:0;padding-right:0"><div class="dot-ic navy">${icon(i === 0 ? 'globe' : 'phone', 'sm')}</div><div class="grow"><div class="t">${s[0]}</div><div class="s">${s[1]} · ${s[2]}</div></div>${i ? `<button class="btn btn-sm btn-ghost" onclick="this.closest('.li').remove();UI.toast('Session révoquée')">Révoquer</button>` : badge('Actuelle', 'success')}</div>`).join('')}</div>`)}
        ${card('Chiffrement & sauvegardes', `<div class="stack" style="gap:10px;font-size:13px">${[['TLS 1.3 en transit', 'checkc'], ['AES-256 au repos (données de santé : chiffrement applicatif)', 'checkc'], ['Sauvegardes chiffrées toutes les 6 h — rétention 30 jours', 'checkc'], ['Réplication multi-zones & PITR', 'checkc'], ['Dernier test de restauration : il y a 6 jours', 'checkc']].map(x => `<div class="row"><span style="color:var(--success)">${icon(x[1], 'sm')}</span>${x[0]}</div>`).join('')}</div>`)}
        ${card('Conformité', `<div class="row wrap" style="gap:8px">${['RGPD', 'Loi 09-08 (CNDP)', 'ISO 27001 (en cours)', 'Hébergement certifié', 'DPA signé'].map(x => badge(x, 'navy')).join('')}</div><p class="muted mt" style="font-size:12.5px">Export et suppression des données sur demande, registre des traitements, consentements parentaux horodatés.</p>`)}
      </div>`,
      audit: card('Journal d\'audit', `<table class="tbl"><thead><tr><th>Horodatage</th><th>Action</th><th>Utilisateur</th><th>Adresse IP</th><th>Tenant</th></tr></thead><tbody>${d.audit.map(a => `<tr><td style="white-space:nowrap">${dateShort(a.at.slice(0, 10))} · ${a.at.slice(11, 16)}</td><td>${a.action.includes('Échec') ? `<span style="color:var(--danger)">${esc(a.action)}</span>` : esc(a.action)}</td><td>${esc(a.by)}</td><td class="muted">${a.ip}</td><td><code>${t.id}</code></td></tr>`).join('')}</tbody></table>`, { flush: true, sub: 'Immuable · conservé 12 mois · export SIEM disponible', action: `<button class="btn btn-sm btn-ghost" onclick="UI.toast('Journal exporté','download')">${icon('download', 'sm')} Export</button>` }),
      billing: `<div class="grid g-3 mb">${PLANS.map(pl => `<div class="card" style="padding:24px;${pl.id === t.plan ? 'border-color:var(--gold);box-shadow:var(--sh-2)' : ''}"><div class="row between"><h3 class="serif" style="font-size:20px;font-weight:500">${pl.id}</h3>${pl.id === t.plan ? badge('Plan actuel', 'gold') : ''}</div><div style="margin:12px 0"><span class="serif" style="font-size:32px">${pl.price ? pl.price + ' DH' : 'Sur devis'}</span>${pl.price ? '<span class="muted"> / élève / mois</span>' : ''}</div><div class="muted" style="font-size:12.5px;margin-bottom:12px">Jusqu'à ${pl.seats} élèves</div><div class="stack" style="gap:8px;font-size:13px">${pl.features.map(f => `<div class="row"><span style="color:var(--gold)">${icon('check', 'sm')}</span>${f}</div>`).join('')}</div>${pl.id !== t.plan ? `<button class="btn ${pl.id === 'Groupe' ? 'btn-ghost' : 'btn-primary'} mt" style="width:100%" onclick="UI.toast('Demande de changement de plan envoyée')">${pl.id === 'Groupe' ? 'Contacter les ventes' : 'Passer à ' + pl.id}</button>` : ''}</div>`).join('')}</div>
        <div class="grid g-main">${card('Consommation', `<div class="stack">${[['Élèves', d.students.length, t.seats], ['Stockage', 38, t.plan === 'Premium' ? 200 : 50], ['SMS ce mois', 1240, 3000], ['Requêtes IA', 3180, t.plan === 'Premium' ? 10000 : 0]].map(x => `<div><div class="row between" style="font-size:12.5px;margin-bottom:6px"><span>${x[0]}</span><b>${num(x[1])}${x[2] ? ' / ' + num(x[2]) : ' · non inclus'}${x[0] === 'Stockage' ? ' Go' : ''}</b></div><div class="bar ${x[2] && x[1] / x[2] > .8 ? 'gold' : ''}"><i style="width:${x[2] ? Math.min(100, x[1] / x[2] * 100) : 0}%"></i></div></div>`).join('')}</div>`)}
        ${card('Factures SaaS', `<div class="list">${['Septembre', 'Août', 'Juillet', 'Juin'].map((m, i) => `<div class="li" style="padding-left:0;padding-right:0"><div class="grow"><div class="t">${m} ${DB.TODAY.getFullYear()}</div><div class="s">ATH-${t.initials}-${2609 - i}</div></div><b>${S.money(d.students.length * (t.plan === 'Premium' ? 29 : 19))}</b>${badge('Payé')}</div>`).join('')}</div>`)}</div>`
    }[tab];
    return {
      html: `${head('Paramètres', `Configuration de ${esc(t.name)} · espace SaaS isolé`)}
        ${tabs([['school', 'Établissement'], ['brand', 'Marque & domaine'], ['users', 'Utilisateurs & rôles'], ['security', 'Sécurité'], ['audit', 'Journal d\'audit'], ['billing', 'Abonnement & facturation']], tab)}
        ${body}`,
      mount: el => {
        bindTabs(el, 'tab', x => location.hash = '#/settings/' + x);
        el.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { t.color = b.dataset.color; App.renderShell(); App.route(); UI.toast('Couleur de l\'établissement mise à jour'); });
      }
    };
  };
})();
