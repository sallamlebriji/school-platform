/* ==========================================================
   Vie scolaire : Transport (suivi GPS simulé), Cantine,
   Activités, Infirmerie (confidentiel), Objets perdus, Documents
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, badge, num, pct, dec, date, dateShort, relDays, fullName, avatar, who } = UI;
  const { D, S, Views, head, kpi, delta, card, currentUser, State } = App;

  // ==========================================================
  // TRANSPORT SCOLAIRE
  // ==========================================================
  function routePoints(b) { return b.stops.map(s => [s.x, s.y]); }
  function pointAt(pts, t) {
    const seg = []; let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); tot += l; }
    let d = t * tot;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i]; return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k, idx: i }; } d -= seg[i]; }
    const L = pts[pts.length - 1]; return { x: L[0], y: L[1], idx: pts.length - 2 };
  }
  function mapSVG(buses, focus) {
    const d = D(), sc = d.school;
    const roads = []; const r = DB.mulberry(7);
    for (let i = 0; i < 9; i++) roads.push(`<path d="M0 ${60 + i * 62 + r() * 20} C 300 ${40 + i * 62 + r() * 60}, 600 ${80 + i * 62 - r() * 60}, 960 ${50 + i * 62 + r() * 30}" stroke="#fff" stroke-width="${i % 3 ? 3 : 7}" fill="none" opacity=".9"/>`);
    for (let i = 0; i < 11; i++) roads.push(`<path d="M${40 + i * 92 + r() * 20} 0 C ${60 + i * 92 - r() * 40} 200, ${20 + i * 92 + r() * 40} 400, ${50 + i * 92} 600" stroke="#fff" stroke-width="${i % 4 ? 3 : 6}" fill="none" opacity=".9"/>`);
    const parks = [[120, 90, 90, 60], [700, 420, 120, 80], [760, 80, 80, 70], [180, 440, 70, 90]].map(p => `<rect x="${p[0]}" y="${p[1]}" width="${p[2]}" height="${p[3]}" rx="18" fill="#DDE5D3"/>`).join('');
    const sea = `<path d="M0 520 C 200 500, 400 560, 600 530 S 900 560, 960 540 L960 600 L0 600Z" fill="#D5E0EA"/>`;
    const lines = buses.map(b => `<polyline points="${routePoints(b).map(p => p.join(',')).join(' ')}" fill="none" stroke="${b.color}" stroke-width="${focus && focus !== b.id ? 2 : 4}" stroke-linecap="round" stroke-linejoin="round" opacity="${focus && focus !== b.id ? .25 : .85}" stroke-dasharray="${b.delay ? '0' : '0'}"/>`).join('');
    const stops = buses.filter(b => !focus || b.id === focus).map(b => b.stops.slice(0, -1).map(s => `<circle cx="${s.x}" cy="${s.y}" r="5" fill="#fff" stroke="${b.color}" stroke-width="2.5" data-tip="${esc('<b>' + s.name + '</b><br>' + b.line + ' · ' + s.time)}"/>`).join('')).join('');
    const markers = buses.map(b => { const p = pointAt(routePoints(b), b.progress); return `<g class="bus-dot" id="bm-${b.id}" transform="translate(${p.x},${p.y})" style="cursor:pointer" data-bus="${b.id}" data-tip="${esc('<b>' + b.line + '</b><br>' + b.plate + (b.delay ? '<br>Retard : ' + b.delay + ' min' : ''))}" opacity="${focus && focus !== b.id ? .35 : 1}"><circle r="16" fill="${b.color}" opacity=".25" class="pulse"/><circle r="11" fill="${b.color}" stroke="#fff" stroke-width="2.5"/><path d="M-5 -4h10v7h-10z M-5 0h10" stroke="#fff" stroke-width="1.4" fill="none"/></g>`; }).join('');
    return `<svg viewBox="0 0 960 600" id="busmap">${sea}${parks}${roads.join('')}${lines}${stops}
      <g transform="translate(${sc.x},${sc.y})"><circle r="24" fill="var(--navy-800)" opacity=".12"/><rect x="-15" y="-15" width="30" height="30" rx="8" fill="var(--navy-800)" stroke="var(--gold)" stroke-width="2"/><text y="5" text-anchor="middle" fill="#fff" font-size="13" font-family="Fraunces,serif">${d.tenant.initials}</text></g>
      ${markers}</svg>`;
  }
  function eta(b) { const remaining = (1 - b.progress) * 38; return Math.max(1, Math.round(remaining + b.delay)); }

  Views.transport = function (p) {
    clearInterval(window._busTimer);
    const d = D(), u = currentUser();
    const isParent = State.role === 'parent';
    const kids = isParent ? u.childIds.map(S.stu).filter(k => k.bus) : [];
    const buses = isParent ? d.buses.filter(b => kids.some(k => k.bus === b.id)) : d.buses;
    const focus = p[0] || (isParent && buses[0] ? buses[0].id : null);
    const fb = focus ? S.bus(focus) : null;
    if (isParent && !buses.length) return head('Transport scolaire', '') + '<div class="card empty">Aucun de vos enfants n\'est inscrit au transport scolaire.</div>';
    const transported = d.buses.reduce((a, b) => a + b.studentIds.length, 0);
    const html = `
      ${head('Transport scolaire', isParent ? 'Suivi en temps réel du bus de vos enfants' : `${d.buses.length} lignes · ${transported} élèves transportés · suivi GPS en temps réel`, isParent ? '' : `<button class="btn btn-ghost" id="scanBtn">${icon('qr', 'sm')} Scan QR / RFID</button><button class="btn btn-primary" onclick="UI.toast('Assistant de création de ligne ouvert','plus')">${icon('plus', 'sm')} Nouvelle ligne</button>`)}
      ${!isParent ? `<div class="grid g-4 mb">
        ${kpi('Bus en circulation', `${d.buses.length}<small>/ ${d.buses.length}</small>`, 'transport', '<span class="row" style="gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:var(--success)"></span>Tous connectés</span>')}
        ${kpi('Élèves à bord', Math.round(transported * .64), 'students', `<span>${transported} inscrits</span>`)}
        ${kpi('Retards', d.buses.filter(b => b.delay).length, 'clock', `<span>moy. ${dec(d.buses.filter(b => b.delay).reduce((a, b) => a + b.delay, 0) / Math.max(1, d.buses.filter(b => b.delay).length), 0)} min</span>`)}
        ${kpi('Taux de remplissage', pct(transported / d.buses.reduce((a, b) => a + b.capacity, 0) * 100, 0), 'layers', '', { gold: 1 })}
      </div>` : ''}
      <div class="grid g-main">
        <div class="card" style="overflow:hidden">
          <div class="card-h"><div><h3>${fb ? esc(fb.line) : 'Carte en temps réel'}</h3><div class="sub"><span class="row" style="gap:6px;display:inline-flex"><span style="width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 3px var(--success-bg)"></span>GPS actif · mise à jour chaque seconde</span></div></div>${focus && !isParent ? '<a class="btn btn-sm btn-ghost" href="#/transport">Toutes les lignes</a>' : ''}</div>
          <div class="card-b"><div class="map">${mapSVG(buses, focus)}</div></div>
        </div>
        <div class="stack">
          ${fb ? busPanel(fb, kids) : card('Lignes', `<div class="list">${d.buses.map(b => `<a class="li click" href="#/transport/${b.id}"><i style="width:4px;height:36px;border-radius:2px;background:${b.color}"></i><div class="grow"><div class="t">${esc(b.line)}</div><div class="s">${b.studentIds.length}/${b.capacity} élèves · ${esc(fullName(b.driver))}</div></div><div style="text-align:right"><div style="font-size:12.5px;font-weight:600" data-eta="${b.id}">${eta(b)} min</div>${b.delay ? badge('+' + b.delay + ' min', 'warning') : badge('À l\'heure', 'success')}</div></a>`).join('')}</div>`, { flush: true, sub: 'Heure estimée d\'arrivée à l\'école' })}
        </div>
      </div>
      ${fb && !isParent ? `<div class="grid g-2 mt">
        ${card('Élèves affectés', `<table class="tbl"><thead><tr><th>Élève</th><th>Arrêt</th><th>Statut</th></tr></thead><tbody>${fb.studentIds.slice(0, 12).map((id, i) => { const s = S.stu(id); const on = fb.stops[s.stop] && pointAt(routePoints(fb), fb.progress).idx >= s.stop; return `<tr><td>${who(s, S.cls(s.classId).name)}</td><td style="font-size:12.5px">${esc(fb.stops[s.stop].name)}</td><td>${on ? badge('À bord', 'success') : badge('En attente', 'plain')}</td></tr>`; }).join('')}</tbody></table>`, { flush: true, sub: fb.studentIds.length + ' élèves · badge ' + fb.rfid })}
        ${card('Équipage & véhicule', `<div class="stack"><div class="row between">${who(fb.driver, 'Chauffeur · ' + fb.driver.phone, '')}<a class="btn btn-sm btn-soft" href="tel:${fb.driver.phone}">${icon('phone', 'sm')}</a></div><div class="row between">${who(fb.attendant, 'Accompagnatrice · ' + fb.attendant.phone, '')}<a class="btn btn-sm btn-soft" href="tel:${fb.attendant.phone}">${icon('phone', 'sm')}</a></div><div class="divider" style="margin:0"></div><div class="info-grid"><div><div class="k">Véhicule</div><div class="v">${fb.model}</div></div><div><div class="k">Immatriculation</div><div class="v">${fb.plate}</div></div><div><div class="k">Capacité</div><div class="v">${fb.capacity} places</div></div><div><div class="k">Pointage</div><div class="v">${fb.rfid}</div></div></div></div>`)}
      </div>` : ''}
      ${isParent ? `<div class="grid g-2 mt">${card('Notifications de sécurité', `<div class="timeline">${kids.map(k => { const b = S.bus(k.bus); return [[`${k.first} est monté(e) dans le bus`, `07:${String(12 + k.stop * 3).padStart(2, '0')} · ${b.stops[k.stop].name} · scan ${b.rfid}`], [`Arrivée à l'école`, 'Hier 07:52'], [`Départ de l'école`, 'Hier 16:35'], [`${k.first} est descendu(e) du bus`, 'Hier 17:08 · ' + b.stops[k.stop].name]].map(x => `<div class="tl-i"><div class="t">${x[0]}</div><div class="s">${x[1]}</div></div>`).join(''); }).join('')}</div>`)}${card('Préférences d\'alerte', ['Bus proche (10 min)', 'Élève monté dans le bus', 'Élève descendu du bus', 'Arrivée à l\'école', 'Départ de l\'école', 'Retard du bus'].map(x => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line-2)"><span>${x}</span><button class="switch on" onclick="this.classList.toggle('on')"></button></div>`).join(''))}</div>` : ''}`;
    return {
      html, mount: el => {
        el.querySelectorAll('[data-bus]').forEach(g => g.onclick = () => location.hash = '#/transport/' + g.dataset.bus);
        const sb = el.querySelector('#scanBtn'); if (sb) sb.onclick = scanModal;
        window._busTimer = setInterval(() => {
          if (!document.getElementById('busmap')) return clearInterval(window._busTimer);
          buses.forEach(b => {
            b.progress += 0.0025 + (b.delay ? 0 : 0.0012); if (b.progress > 1) b.progress = 0;
            const pt = pointAt(routePoints(b), b.progress);
            const m = document.getElementById('bm-' + b.id); if (m) m.setAttribute('transform', `translate(${pt.x},${pt.y})`);
            document.querySelectorAll(`[data-eta="${b.id}"]`).forEach(e => e.textContent = eta(b) + ' min');
          });
        }, 1000);
      }
    };
  };
  function busPanel(b, kids) {
    const pt = pointAt(routePoints(b), b.progress);
    return `<div class="card"><div class="card-h"><div><h3>${esc(b.line)}</h3><div class="sub">${b.plate} · ${b.studentIds.length}/${b.capacity} élèves</div></div>${b.delay ? badge('Retard ' + b.delay + ' min', 'warning') : badge('À l\'heure', 'success')}</div>
      <div class="card-b">
        <div class="card navy" style="padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:16px"><div class="dot-ic" style="background:rgba(255,255,255,.1);color:var(--gold-soft)">${icon('clock')}</div><div><div style="font-size:12px;color:#AEB9D2">Arrivée estimée à l'école</div><div class="serif" style="font-size:24px;color:#fff" data-eta="${b.id}">${eta(b)} min</div></div></div>
        ${kids && kids.length ? kids.filter(k => k.bus === b.id).map(k => `<div class="lock mb">${icon('user')}<span><b>${esc(k.first)}</b> — arrêt ${esc(b.stops[k.stop].name)} (${b.stops[k.stop].time})</span></div>`).join('') : ''}
        <div class="timeline">${b.stops.map((s, i) => `<div class="tl-i" style="${i <= pt.idx ? '' : 'opacity:.55'}"><div class="t">${esc(s.name)} ${i <= pt.idx ? '<span class="badge success plain" style="height:18px;font-size:10px">passé</span>' : ''}</div><div class="s">${s.time}${b.delay && i > pt.idx ? ' → ' + s.time.slice(0, 3) + String(+s.time.slice(3) + b.delay).padStart(2, '0') : ''}</div></div>`).join('')}</div>
      </div></div>`;
  }
  function scanModal() {
    const d = D(); const cells = Array.from({ length: 441 }, (_, i) => { const x = i % 21, y = Math.floor(i / 21); const finder = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7 && (x === a || x === a + 6 || y === b || y === b + 6 || (x >= a + 2 && x <= a + 4 && y >= b + 2 && y <= b + 4)); const inF = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12); if (inF) return finder(0, 0) || finder(14, 0) || finder(0, 14); return DB.hash('q' + i) % 2 === 0; });
    const s = S.stu(d.buses[0].studentIds[0]);
    UI.modal('Pointage montée / descente', `<div class="row" style="gap:24px;align-items:flex-start"><div class="qr">${cells.map(c => `<i class="${c ? '' : 'o'}"></i>`).join('')}</div><div style="flex:1" class="stack"><div class="muted" style="font-size:13px">Chaque élève dispose d'une carte <b>QR Code</b>, d'un badge <b>RFID</b> ou d'un tag <b>NFC</b>. Le lecteur embarqué enregistre automatiquement la montée et la descente, et notifie les parents.</div>${who(s, S.cls(s.classId).name + ' · ' + d.buses[0].line, '')}<div class="row"><button class="btn btn-primary" data-ok>${icon('check', 'sm')} Simuler « montée »</button></div></div></div>`, { foot: false, onOk: () => UI.toast(`${esc(s.first)} est monté(e) dans le bus — parents notifiés`, 'bell') });
  }

  // ==========================================================
  // CANTINE
  // ==========================================================
  Views.canteen = function () {
    const d = D();
    const subs = d.students.filter(s => s.canteen);
    const allergic = subs.filter(s => s.allergies.length || s.diet);
    const isStaff = State.role === 'admin';
    const today = Math.min(4, Math.max(0, DB.TODAY.getDay() - 1));
    const html = `
      ${head('Cantine & restauration', 'Menus de la semaine, abonnements, allergies et régimes particuliers', isStaff ? `<button class="btn btn-ghost" onclick="UI.toast('Menu envoyé aux familles','send')">${icon('send', 'sm')} Publier le menu</button><button class="btn btn-primary" onclick="UI.toast('Éditeur de menu ouvert','edit')">${icon('edit', 'sm')} Modifier le menu</button>` : '')}
      ${isStaff ? `<div class="grid g-4 mb">${kpi('Abonnés', subs.length, 'canteen', `<span>${pct(subs.length / d.students.length * 100, 0)} des élèves</span>`)}${kpi('Repas servis aujourd\'hui', d.canteenWeek[today].value, 'checkc')}${kpi('Allergies & régimes', allergic.length, 'alert', '<span>PAI suivis</span>')}${kpi('Recettes du mois', S.kmoney(subs.length * 700), 'finance', '', { gold: 1 })}</div>` : ''}
      <div class="grid g-6 mb" style="grid-template-columns:repeat(5,minmax(0,1fr))">${d.menu.map((m, i) => `
        <div class="card ${i === today ? '' : 'hover'}" style="padding:18px;${i === today ? 'border-color:var(--gold);box-shadow:var(--sh-2)' : ''}">
          <div class="row between"><span class="eyebrow">${m.day}</span>${i === today ? badge('Aujourd\'hui', 'gold') : ''}</div>
          <div class="stack" style="gap:10px;margin-top:14px;font-size:13px">
            <div><div class="muted" style="font-size:11px">Entrée</div>${m.starter}</div>
            <div><div class="muted" style="font-size:11px">Plat</div><b style="font-weight:600">${m.main}</b></div>
            <div><div class="muted" style="font-size:11px">Accompagnement</div>${m.side}</div>
            <div><div class="muted" style="font-size:11px">Dessert</div>${m.dessert}</div>
            <div class="badge success" style="height:auto;padding:4px 9px;white-space:normal">${m.veg}</div>
          </div></div>`).join('')}</div>
      ${isStaff ? `<div class="grid g-main">
        ${card('Allergies alimentaires & régimes particuliers', `<table class="tbl"><thead><tr><th>Élève</th><th>Classe</th><th>Allergie</th><th>Régime</th><th>Alerte service</th></tr></thead><tbody>${allergic.slice(0, 10).map(s => `<tr><td>${who(s)}</td><td>${S.cls(s.classId).name}</td><td>${s.allergies.length ? badge(s.allergies[0], 'danger') : '—'}</td><td>${s.diet ? badge(s.diet, 'info') : '—'}</td><td>${icon('check', 'sm')}</td></tr>`).join('')}</tbody></table>`, { flush: true })}
        ${card('Présence à la cantine', UI.bars(d.canteenWeek.map(x => x.label), [{ name: 'Repas', color: '#B08D57', values: d.canteenWeek.map(x => x.value) }], { h: 200, highlight: today }), { sub: 'Semaine en cours' })}
      </div>` : `<div class="grid g-2">${card('Mon abonnement', `<div class="info-grid"><div><div class="k">Formule</div><div class="v">Forfait 5 jours</div></div><div><div class="k">Tarif</div><div class="v">${S.money(700)} / mois</div></div><div><div class="k">Régime</div><div class="v">Standard</div></div><div><div class="k">Allergies signalées</div><div class="v">Aucune</div></div></div><button class="btn btn-ghost mt" onclick="UI.toast('Demande transmise au service restauration','send')">Signaler une allergie</button>`)}${card('Informations', '<p class="muted">Les menus sont élaborés par une diététicienne. Une alternative végétarienne est proposée chaque jour. Les allergies déclarées déclenchent une alerte automatique au moment du service.</p>')}</div>`}`;
    return html;
  };

  // ==========================================================
  // ACTIVITÉS & ÉVÉNEMENTS
  // ==========================================================
  Views.activities = function () {
    const d = D(), u = currentUser();
    const kinds = ['Toutes', 'Club', 'Sport', 'Sortie', 'Voyage', 'Compétition', 'Événement'];
    const html = `
      ${head('Événements & activités', 'Clubs, sports, sorties, voyages, compétitions et événements', State.role === 'admin' ? `<button class="btn btn-primary" onclick="UI.toast('Nouvelle activité créée','plus')">${icon('plus', 'sm')} Nouvelle activité</button>` : '')}
      <div class="pill-filter mb" id="akf">${kinds.map((k, i) => `<button class="${i ? '' : 'on'}" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="grid g-3" id="agrid"></div>`;
    const KI = { Club: 'layers', Sport: 'activities', Sortie: 'pin', Voyage: 'globe', Compétition: 'award', Événement: 'star' };
    return {
      html, mount: el => {
        const draw = k => {
          el.querySelector('#agrid').innerHTML = d.activities.filter(a => k === 'Toutes' || a.kind === k).map(a => `
            <div class="card hover" style="padding:20px">
              <div class="row between"><div class="dot-ic navy">${icon(KI[a.kind] || 'star', 'sm')}</div>${badge(a.kind, 'navy')}</div>
              <div style="font-weight:600;font-size:15px;margin-top:14px">${esc(a.name)}</div>
              <div class="muted" style="font-size:12.5px;margin-top:4px">${a.kind === 'Sortie' || a.kind === 'Voyage' || a.kind === 'Événement' || a.kind === 'Compétition' ? date(a.date) : a.schedule} · ${a.place}</div>
              <div class="muted" style="font-size:12.5px">Encadrant : ${esc(fullName(S.tch(a.teacherId)))}</div>
              ${a.capacity ? `<div class="row between" style="font-size:12px;margin:14px 0 6px"><span class="muted">Inscrits</span><b>${a.enrolled}/${a.capacity}</b></div><div class="bar ${a.enrolled >= a.capacity ? 'gold' : ''}"><i style="width:${a.enrolled / a.capacity * 100}%"></i></div>` : '<div style="margin-top:14px" class="muted">Ouvert à tous</div>'}
              <div class="row between" style="margin-top:14px"><span style="font-weight:600">${a.price ? S.money(a.price) : 'Gratuit'}</span>${a.capacity ? `<button class="btn btn-sm ${a.enrolled >= a.capacity ? 'btn-ghost' : 'btn-primary'}" data-act="${a.id}" ${a.enrolled >= a.capacity ? 'disabled' : ''}>${a.enrolled >= a.capacity ? 'Complet' : State.role === 'admin' || State.role === 'teacher' ? 'Inscrire des élèves' : 'Inscrire'}</button>` : ''}</div>
            </div>`).join('');
          el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const a = d.activities.find(x => x.id === b.dataset.act); const cands = State.role === 'parent' ? u.childIds.map(S.stu) : State.role === 'student' ? [u] : d.classes[3] ? d.classes[3].studentIds.slice(0, 8).map(S.stu) : []; UI.modal('Inscription — ' + esc(a.name), `<div class="stack">${cands.map(s => `<label class="check"><input type="checkbox" ${State.role !== 'admin' ? 'checked' : ''}> ${esc(fullName(s))} · ${S.cls(s.classId).name}</label>`).join('')}${a.price ? `<div class="lock">${icon('card')}<span>Frais : <b>${S.money(a.price)}</b> — ajoutés à la prochaine facture.</span></div>` : ''}${a.kind === 'Sortie' || a.kind === 'Voyage' ? `<div class="lock">${icon('documents')}<span>Une autorisation parentale électronique sera demandée.</span></div>` : ''}</div>`, { ok: 'Confirmer l\'inscription', onOk: () => { a.enrolled++; draw(k); UI.toast('Inscription confirmée'); } }); });
        };
        App.bindTabs(el, 'k', draw); draw('Toutes');
      }
    };
  };

  // ==========================================================
  // INFIRMERIE — accès restreint
  // ==========================================================
  Views.health = function () {
    const d = D();
    const allergies = d.students.filter(s => s.allergies.length);
    const html = `
      ${head('Infirmerie & santé scolaire', 'Espace confidentiel — chaque consultation est journalisée', `<button class="btn btn-primary" id="newVisit">${icon('plus', 'sm')} Enregistrer un passage</button>`)}
      <div class="lock mb">${icon('lock')}<span><b>Données de santé chiffrées (AES-256)</b> · accès limité aux rôles <i>Infirmerie</i> et <i>Direction</i> · consultation tracée dans le journal d'audit.</span></div>
      <div class="grid g-4 mb">${kpi('Passages cette semaine', d.infirmary.length, 'health')}${kpi('Accidents déclarés', d.infirmary.filter(v => v.kind === 'Accident').length, 'alert')}${kpi('Allergies déclarées', allergies.length, 'alert')}${kpi('PAI actifs', allergies.length, 'shield', '', { gold: 1 })}</div>
      <div class="grid g-main">
        ${card('Registre des passages', `<table class="tbl"><thead><tr><th>Élève</th><th>Date</th><th>Motif</th><th>Soins</th><th>Type</th><th>Parents</th></tr></thead><tbody>${d.infirmary.map(v => { const s = S.stu(v.studentId); return `<tr><td>${who(s, S.cls(s.classId).name)}</td><td style="white-space:nowrap">${dateShort(v.date)} · ${v.time}</td><td>${v.reason}</td><td class="muted" style="font-size:12.5px">${v.care}</td><td>${badge(v.kind, v.kind === 'Accident' ? 'danger' : 'plain')}</td><td>${v.parentsNotified ? icon('check', 'sm') : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table>`, { flush: true })}
        <div class="stack">
          ${card('Allergies à connaître', `<div class="list">${allergies.slice(0, 8).map(s => `<div class="li"><div class="grow">${who(s, S.cls(s.classId).name)}</div>${badge(s.allergies[0], 'danger')}</div>`).join('')}</div>`, { flush: true })}
          ${card('Motifs fréquents', UI.hbars(Object.entries(d.infirmary.reduce((a, v) => (a[v.reason] = (a[v.reason] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, v]) => ({ label: l, value: v }))))}
        </div>
      </div>`;
    return { html, mount: el => el.querySelector('#newVisit').onclick = () => UI.modal('Passage à l\'infirmerie', `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Élève</label><select class="select">${d.students.slice(0, 60).map(s => `<option>${fullName(s)} — ${S.cls(s.classId).name}</option>`).join('')}</select></div><div class="field"><label>Type</label><select class="select"><option>Passage</option><option>Accident scolaire</option></select></div><div class="field"><label>Heure</label><input class="input" type="time" value="10:30"></div><div class="field" style="grid-column:1/-1"><label>Motif</label><input class="input"></div><div class="field" style="grid-column:1/-1"><label>Premiers soins</label><textarea class="input"></textarea></div><label class="check"><input type="checkbox" checked> Notifier les parents</label></div>`, { onOk: () => UI.toast('Passage enregistré — parents notifiés', 'bell') }) };
  };

  // ==========================================================
  // OBJETS PERDUS / TROUVÉS — correspondance intelligente
  // ==========================================================
  const CATS = ['Téléphone', 'Sac', 'Cahier', 'Vêtement', 'Lunettes', 'Clés', 'Carte scolaire', 'Accessoires'];
  const CAT_IC = { 'Téléphone': 'phone', 'Sac': 'bag', 'Cahier': 'book', 'Vêtement': 'shirt', 'Lunettes': 'glasses', 'Clés': 'key', 'Carte scolaire': 'card', 'Accessoires': 'watch' };
  function similarity(a, b) {
    if (a.category !== b.category) return 0;
    const words = s => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/).filter(w => w.length > 2));
    const A = words(a.desc + ' ' + a.place), B = words(b.desc + ' ' + b.place);
    const inter = [...A].filter(w => B.has(w)).length;
    const days = Math.abs(new Date(a.date) - new Date(b.date)) / DB.DAY;
    return Math.min(99, Math.round(45 + inter * 14 + Math.max(0, 15 - days)));
  }
  Views.lost = function () {
    const d = D();
    const html = `
      ${head('Objets perdus & trouvés', 'Déclarez, recherchez et récupérez — correspondances suggérées automatiquement', `<button class="btn btn-ghost" data-new="Trouvé">${icon('plus', 'sm')} J'ai trouvé un objet</button><button class="btn btn-primary" data-new="Perdu">${icon('search', 'sm')} J'ai perdu un objet</button>`)}
      <div class="card mb"><div class="toolbar" style="border:0"><div class="input-ic" style="flex:1">${icon('search', 'sm')}<input class="input" style="width:100%" id="lfq" placeholder="Rechercher : « sac noir », « lunettes »…"></div><select class="select" id="lfs"><option value="">Tous statuts</option><option>Ouvert</option><option>Récupéré</option></select></div>
        <div style="padding:0 16px 14px" class="pill-filter" id="lfc"><button class="on" data-c="">Toutes</button>${CATS.map(c => `<button data-c="${c}">${c}</button>`).join('')}</div></div>
      <div id="matches"></div>
      <div class="grid g-4" id="lfgrid"></div>`;
    return {
      html, mount: el => {
        let cat = '';
        const draw = () => {
          const q = el.querySelector('#lfq').value.toLowerCase(), st = el.querySelector('#lfs').value;
          const lost = d.lostFound.filter(x => x.type === 'Perdu' && x.status === 'Ouvert');
          const matches = []; lost.forEach(l => d.lostFound.filter(f => f.type === 'Trouvé' && f.status === 'Ouvert').forEach(f => { const s = similarity(l, f); if (s > 50) matches.push([l, f, s]); }));
          el.querySelector('#matches').innerHTML = matches.length ? `<div class="card beige mb" style="padding:16px 20px"><div class="row" style="margin-bottom:10px">${icon('sparkles', 'sm')}<b>Correspondances suggérées</b><span class="muted" style="font-size:12px">— analyse de la catégorie, de la description, du lieu et de la date</span></div>${matches.sort((a, b) => b[2] - a[2]).slice(0, 3).map(([l, f, s]) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--beige-200);font-size:13px"><span class="badge danger plain">Perdu</span><span style="flex:1">${esc(l.desc)}</span>${icon('link', 'sm')}<span class="badge info plain">Trouvé</span><span style="flex:1">${esc(f.desc)} · ${esc(f.place)}</span><b style="color:var(--gold-600)">${s}%</b><button class="btn btn-sm btn-primary" data-match="${l.id},${f.id}">Notifier</button></div>`).join('')}</div>` : '';
          el.querySelectorAll('[data-match]').forEach(b => b.onclick = () => UI.toast('Le propriétaire a été notifié de la correspondance', 'bell'));
          const list = d.lostFound.filter(x => (!cat || x.category === cat) && (!st || x.status === st) && (!q || (x.desc + ' ' + x.category + ' ' + x.place).toLowerCase().includes(q)));
          el.querySelector('#lfgrid').innerHTML = list.map(x => `<div class="card hover" style="padding:14px">
            <div class="thumb">${icon(CAT_IC[x.category] || 'lost', 'lg')}</div>
            <div class="row between" style="margin-top:12px">${badge(x.type)}${badge(x.status)}</div>
            <div style="font-weight:500;margin-top:10px;font-size:13.5px">${esc(x.desc)}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">${icon('pin', 'sm').replace('class="icon sm"', 'class="icon sm" style="display:inline;vertical-align:-3px"')} ${esc(x.place)} · ${dateShort(x.date)}</div>
            ${x.status === 'Ouvert' ? `<button class="btn btn-sm btn-soft mt-s" style="width:100%" data-got="${x.id}">Marquer comme récupéré</button>` : ''}
          </div>`).join('') || '<div class="empty span-all">Aucun objet</div>';
          el.querySelectorAll('[data-got]').forEach(b => b.onclick = () => { d.lostFound.find(x => x.id === b.dataset.got).status = 'Récupéré'; draw(); UI.toast('Objet marqué comme récupéré'); });
        };
        el.querySelector('#lfq').oninput = draw; el.querySelector('#lfs').onchange = draw;
        App.bindTabs(el, 'c', c => { cat = c; draw(); }); draw();
        el.querySelectorAll('[data-new]').forEach(b => b.onclick = () => UI.modal(b.dataset.new === 'Perdu' ? 'Déclarer un objet perdu' : 'Déclarer un objet trouvé', `<div class="form-grid"><div class="field"><label>Catégorie</label><select class="select" id="nc">${CATS.map(c => `<option>${c}</option>`).join('')}</select></div><div class="field"><label>Date</label><input class="input" type="date" id="nd" value="${DB.iso(DB.TODAY)}"></div><div class="field" style="grid-column:1/-1"><label>Description</label><input class="input" id="ndesc" placeholder="Couleur, marque, signes distinctifs…"></div><div class="field" style="grid-column:1/-1"><label>Lieu</label><input class="input" id="npl" placeholder="Cour, gymnase, bus…"></div><div class="field" style="grid-column:1/-1"><label>Photo</label><div style="border:1.5px dashed var(--beige-300);border-radius:12px;padding:18px;text-align:center;color:var(--ink-3)">${icon('image')} Ajouter une photo</div></div></div>`, { ok: 'Publier', onOk: m => { d.lostFound.unshift({ id: 'lf' + Date.now(), category: m.querySelector('#nc').value, desc: m.querySelector('#ndesc').value || 'Objet', place: m.querySelector('#npl').value || '—', date: m.querySelector('#nd').value, type: b.dataset.new, status: 'Ouvert', icon: '' }); draw(); UI.toast('Déclaration publiée — recherche de correspondances lancée', 'sparkles'); } }));
      }
    };
  };

  // ==========================================================
  // DOCUMENTS & ADMINISTRATION
  // ==========================================================
  Views.documents = function () {
    const d = D(), u = currentUser();
    const isParent = State.role === 'parent';
    const kids = isParent ? u.childIds.map(S.stu) : [];
    const gens = [['Certificat de scolarité', 'documents', s => App.certificate(s)], ['Attestation d\'inscription', 'checkc', s => App.certificate(s)], ['Bulletin', 'grades', s => App.bulletin(s)], ['Relevé de notes', 'layers', s => App.bulletin(s)]];
    const missing = d.students.filter(s => s.docsMissing.length);
    const html = `
      ${head('Documents & administration', 'Génération automatique de documents PDF à l\'en-tête de l\'établissement', '')}
      <div class="card mb"><div class="card-h"><div><h3>Générer un document</h3><div class="sub">PDF signé électroniquement avec logo et QR de vérification</div></div></div>
        <div class="card-b"><div class="row wrap" style="gap:12px;margin-bottom:14px"><select class="select" id="dstu" style="min-width:260px">${(isParent ? kids : d.students.slice(0, 80)).map(s => `<option value="${s.id}">${esc(fullName(s))} — ${S.cls(s.classId).name}</option>`).join('')}</select></div>
        <div class="grid g-4" style="gap:12px">${gens.map((g, i) => `<button class="card hover" data-gen="${i}" style="padding:16px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left"><div class="dot-ic navy">${icon(g[1], 'sm')}</div><div><div style="font-weight:500">${g[0]}</div><div class="muted" style="font-size:11.5px">PDF · instantané</div></div></button>`).join('')}</div></div></div>
      <div class="grid g-main">
        ${card('Espace documentaire', `<table class="tbl"><thead><tr><th>Document</th><th>Type</th><th>Catégorie</th><th>Date</th><th>Signature</th><th></th></tr></thead><tbody>${d.documents.filter(x => !isParent || x.cat !== 'Confidentiel').map(x => `<tr><td><div class="row"><div class="dot-ic">${icon('documents', 'sm')}</div><div><div style="font-weight:500">${x.name}</div><div class="muted" style="font-size:11.5px">${x.size}</div></div></div></td><td>${x.kind}</td><td>${x.cat === 'Confidentiel' ? badge('Confidentiel', 'danger') : x.cat}</td><td>${dateShort(x.date)}</td><td>${x.signed ? badge('Signé', 'success') : badge('À signer', 'warning')}</td><td><button class="btn btn-sm btn-ghost" onclick="UI.toast('Téléchargement de ${esc(x.name).replace(/'/g, '')}','download')">${icon('download', 'sm')}</button></td></tr>`).join('')}</tbody></table>`, { flush: true })}
        ${isParent ? card('Autorisations à signer', `<div class="list">${['Sortie — Musée Mohammed VI', 'Droit à l\'image 2026-2027'].map(x => `<div class="li"><div class="dot-ic warning">${icon('edit', 'sm')}</div><div class="grow"><div class="t">${x}</div><div class="s">Signature électronique</div></div><button class="btn btn-sm btn-primary" onclick="this.outerHTML=UI.badge('Signé','success');UI.toast('Document signé')">Signer</button></div>`).join('')}</div>`, { flush: true }) : card('Documents manquants', `<div class="list">${missing.slice(0, 8).map(s => `<div class="li"><div class="grow">${who(s, s.docsMissing.join(', '))}</div><button class="btn btn-sm btn-ghost" onclick="UI.toast('Relance envoyée','send')">Relancer</button></div>`).join('')}</div>`, { flush: true, sub: missing.length + ' dossiers incomplets', action: `<button class="btn btn-sm btn-soft" onclick="UI.toast('${missing.length} relances envoyées','send')">Tout relancer</button>` })}
      </div>`;
    return { html, mount: el => el.querySelectorAll('[data-gen]').forEach(b => b.onclick = () => gens[b.dataset.gen][2](el.querySelector('#dstu').value)) };
  };
})();
