/* ==========================================================
   Athénée — Shell applicatif : état, rôles (RBAC), routeur,
   navigation, recherche globale, notifications.
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc } = UI;

  // ---------- État persistant ----------
  const saved = (() => { try { return JSON.parse(localStorage.getItem('athenee') || '{}'); } catch (e) { return {}; } })();
  const State = {
    tenant: saved.tenant || 'alfarabi',
    role: saved.role || 'admin',
    settings: saved.settings || {},
    save() { try { localStorage.setItem('athenee', JSON.stringify({ tenant: this.tenant, role: this.role, settings: this.settings })); } catch (e) { } }
  };
  const D = () => DB.get(State.tenant);
  const setting = (k, def) => { const s = State.settings[State.tenant] || {}; return s[k] === undefined ? def : s[k]; };
  const setSetting = (k, v) => { (State.settings[State.tenant] = State.settings[State.tenant] || {})[k] = v; State.save(); };

  // ---------- Services métier ----------
  const S = {
    cls: id => D().classes.find(c => c.id === id),
    stu: id => D().students.find(s => s.id === id),
    tch: id => D().teachers.find(t => t.id === id),
    par: id => D().parents.find(p => p.id === id),
    subj: id => D().subjects.find(s => s.id === id),
    bus: id => D().buses.find(b => b.id === id),
    _avg: {},
    /** Moyennes d'un élève : par matière (pondérée par coef d'évaluation) + générale (coef matière) */
    averages(st) {
      const key = State.tenant + st.id;
      if (S._avg[key]) return S._avg[key];
      const evs = D().evaluations.filter(e => e.classId === st.classId && e.published);
      const bySub = {};
      evs.forEach(e => { const g = D().gradeOf(st, e); (bySub[e.subject] = bySub[e.subject] || { sum: 0, w: 0, list: [] }); bySub[e.subject].sum += g * e.coef; bySub[e.subject].w += e.coef; bySub[e.subject].list.push({ ev: e, g }); });
      let sum = 0, w = 0; const subjects = {};
      Object.keys(bySub).forEach(sid => { const a = bySub[sid].sum / bySub[sid].w; subjects[sid] = { avg: a, list: bySub[sid].list }; const c = S.subj(sid).coef; sum += a * c; w += c; });
      return (S._avg[key] = { general: w ? sum / w : null, subjects });
    },
    classAvg(c) { const v = c.studentIds.map(id => S.averages(S.stu(id)).general).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; },
    classSubjectAvg(c, sid) { const v = c.studentIds.map(id => (S.averages(S.stu(id)).subjects[sid] || {}).avg).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; },
    classAttendance(c) { return c.studentIds.reduce((a, id) => a + S.stu(id).attendance, 0) / (c.studentIds.length || 1) * 100; },
    schoolAvg() { const v = D().classes.map(S.classAvg).filter(x => x != null); return v.reduce((a, b) => a + b, 0) / v.length; },
    rank(st) { const c = S.cls(st.classId); const arr = c.studentIds.map(id => ({ id, g: S.averages(S.stu(id)).general })).sort((a, b) => b.g - a.g); return { rank: arr.findIndex(x => x.id === st.id) + 1, of: arr.length }; },
    invoicesOf: sid => D().invoices.filter(i => i.studentId === sid),
    childrenOf: pid => S.par(pid).childIds.map(S.stu),
    money: v => UI.money(v, D().tenant.currency),
    kmoney: v => UI.kmoney(v, D().tenant.currency)
  };

  // ---------- Utilisateur courant par rôle ----------
  function currentUser() {
    const d = D();
    if (State.role === 'admin') return { first: d.tenant.director.first, last: d.tenant.director.last, id: 'dir', title: 'Directrice générale'.replace('Directrice', d.tenant.id === 'lumiere' ? 'Directeur' : 'Directrice') };
    if (State.role === 'teacher') { const t = d.teachers.find(x => x.subject === 'math'); return Object.assign({ title: 'Enseignant · ' + S.subj(t.subject).name }, t); }
    if (State.role === 'parent') { const p = d.parents.find(x => x.childIds.length >= 2) || d.parents[0]; return Object.assign({ title: 'Parent · ' + p.childIds.length + ' enfants' }, p); }
    const p = d.parents.find(x => x.childIds.length >= 2) || d.parents[0];
    const kids = p.childIds.map(S.stu).sort((a, b) => a.birth.localeCompare(b.birth));
    const s = kids[0]; return Object.assign({ title: 'Élève · ' + S.cls(s.classId).name }, s);
  }

  // ---------- Navigation (RBAC) ----------
  const NAV = [
    { sec: 'Pilotage' },
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', roles: 'admin teacher parent student' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics', roles: 'admin' },
    { sec: 'Communauté' },
    { id: 'students', label: 'Élèves', icon: 'students', roles: 'admin teacher' },
    { id: 'parents', label: 'Parents', icon: 'parents', roles: 'admin' },
    { id: 'teachers', label: 'Enseignants', icon: 'teachers', roles: 'admin' },
    { id: 'enrollments', label: 'Inscriptions', icon: 'enroll', roles: 'admin', count: () => D().applications.filter(a => a.status === 'Nouveau').length },
    { sec: 'Pédagogie' },
    { id: 'classes', label: 'Classes', icon: 'classes', roles: 'admin teacher' },
    { id: 'timetable', label: 'Emploi du temps', icon: 'timetable', roles: 'admin teacher parent student' },
    { id: 'attendance', label: 'Présences', icon: 'attendance', roles: 'admin teacher parent' },
    { id: 'grades', label: 'Notes & Évaluations', icon: 'grades', roles: 'admin teacher parent student' },
    { id: 'homework', label: 'Devoirs', icon: 'homework', roles: 'admin teacher parent student' },
    { id: 'elearning', label: 'Cours en ligne', icon: 'elearning', roles: 'admin teacher parent student' },
    { id: 'library', label: 'Bibliothèque', icon: 'library', roles: 'admin teacher parent student' },
    { sec: 'Vie scolaire' },
    { id: 'transport', label: 'Transport', icon: 'transport', roles: 'admin parent' },
    { id: 'canteen', label: 'Cantine', icon: 'canteen', roles: 'admin parent student' },
    { id: 'activities', label: 'Activités', icon: 'activities', roles: 'admin teacher parent student' },
    { id: 'health', label: 'Infirmerie', icon: 'health', roles: 'admin' },
    { id: 'lost', label: 'Objets perdus', icon: 'lost', roles: 'admin teacher parent student' },
    { id: 'documents', label: 'Documents', icon: 'documents', roles: 'admin parent' },
    { sec: 'Échanges' },
    { id: 'communication', label: 'Communication', icon: 'communication', roles: 'admin teacher parent student', count: () => D().threads.reduce((a, t) => a + t.unread, 0) },
    { id: 'calendar', label: 'Calendrier', icon: 'calendar', roles: 'admin teacher parent student' },
    { sec: 'Administration' },
    { id: 'finance', label: 'Finance', icon: 'finance', roles: 'admin parent' },
    { id: 'support', label: 'Support', icon: 'support', roles: 'admin teacher parent student', count: () => State.role === 'admin' ? D().tickets.filter(t => t.status === 'Nouveau').length : 0 },
    { id: 'settings', label: 'Paramètres', icon: 'settings', roles: 'admin' }
  ];
  const ROLES = { admin: 'Direction', teacher: 'Enseignant', parent: 'Parent', student: 'Élève' };
  const can = id => { const n = NAV.find(x => x.id === id); return !n || n.roles.split(' ').includes(State.role); };

  // ---------- Rendu du shell ----------
  function renderShell() {
    const d = D(), t = d.tenant, u = currentUser();
    document.documentElement.style.setProperty('--accent', t.color);
    const used = Math.round(d.students.length / t.seats * 100);
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="index.html"><div class="brand-mark">A</div><div><div class="brand-name">Athénée</div><div class="brand-sub">School OS</div></div></a>
          <div class="tenant-card" id="tenantSwitch" title="Changer d'établissement">
            <div class="tenant-logo" style="background:${t.color}">${t.initials}</div>
            <div style="min-width:0;flex:1"><div class="tenant-name">${esc(t.short)}</div><div class="tenant-meta">${esc(t.city)} · ${t.year}</div></div>
            ${icon('down', 'sm')}
          </div>
          <nav class="nav" id="nav">${NAV.filter(n => n.sec || n.roles.split(' ').includes(State.role)).map((n, i, arr) => {
            if (n.sec) { const nxt = arr[i + 1]; return nxt && !nxt.sec ? `<div class="nav-section">${n.sec}</div>` : ''; }
            const c = n.count ? n.count() : 0;
            return `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span>${c ? `<span class="count">${c}</span>` : ''}</a>`;
          }).join('')}</nav>
          <div class="sidebar-foot">
            <div class="plan-pill"><span>Plan <b style="color:var(--gold-soft);font-weight:500">${t.plan}</b></span><span>${d.students.length}/${t.seats} élèves</span></div>
            <div class="plan-bar"><i style="width:${used}%"></i></div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" id="menuBtn">${icon('menu')}</button>
            <label class="search">${icon('search')}<input id="gsearch" placeholder="Rechercher un élève, un enseignant, une classe…" autocomplete="off"><span class="kbd">Ctrl K</span></label>
            <div class="spacer"></div>
            <div class="role-switch" title="Simuler un rôle (démo RBAC)">${Object.keys(ROLES).map(r => `<button data-role="${r}" class="${State.role === r ? 'on' : ''}">${ROLES[r]}</button>`).join('')}</div>
            <button class="icon-btn" id="notifBtn" title="Notifications">${icon('bell')}<span class="dot"></span></button>
            <div class="user-chip">${UI.avatar(u)}<div class="txt"><div class="n">${esc(u.first + ' ' + u.last)}</div><div class="r">${esc(u.title)}</div></div></div>
          </header>
          <main class="content" id="content"></main>
        </div>
      </div>
      <button class="ai-fab" id="aiFab">${icon('sparkles')}<span>Assistant IA</span></button>`;

    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { State.role = b.dataset.role; State.save(); renderShell(); location.hash = '#/dashboard'; route(); UI.toast('Vous naviguez maintenant en tant que <b>' + ROLES[State.role] + '</b>', 'user'); });
    document.getElementById('tenantSwitch').onclick = tenantPicker;
    document.getElementById('notifBtn').onclick = notifications;
    document.getElementById('aiFab').onclick = () => window.AI && AI.open();
    document.getElementById('menuBtn').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    initSearch();
    highlightNav();
  }

  function tenantPicker() {
    UI.modal('Changer d\'établissement', `
      <p class="muted" style="margin-bottom:16px">Chaque établissement dispose d'un espace isolé : élèves, enseignants, parents, finances et paramètres ne sont jamais partagés.</p>
      <div class="stack" style="gap:10px">${DB.TENANTS.map(t => `
        <button class="card hover" data-t="${t.id}" style="display:flex;align-items:center;gap:14px;padding:16px;text-align:left;cursor:pointer;${t.id === State.tenant ? 'border-color:var(--gold)' : ''}">
          <div class="tenant-logo" style="background:${t.color};width:44px;height:44px;border-radius:12px;font-size:15px">${t.initials}</div>
          <div style="flex:1"><div style="font-weight:600">${t.name}</div><div class="muted" style="font-size:12.5px">${t.city} · ${t.cycles.join(', ')} · ${t.domain}</div></div>
          ${UI.badge('Plan ' + t.plan, t.plan === 'Premium' ? 'gold' : 'navy')}
        </button>`).join('')}</div>
      <div class="lock mt">${icon('shield')}<span>Isolation par <b>tenant_id</b> + Row-Level Security PostgreSQL côté serveur (voir docs/ARCHITECTURE.md).</span></div>`, {
      foot: false, mount: el => el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { State.tenant = b.dataset.t; State.save(); UI.closeModal(); renderShell(); route(); UI.toast('Espace <b>' + D().tenant.name + '</b> chargé', 'home'); })
    });
  }

  function notifList() {
    const d = D(), u = currentUser();
    const kid = State.role === 'parent' ? S.stu(u.childIds[0]) : d.students[0];
    const k2 = State.role === 'parent' && u.childIds[1] ? S.stu(u.childIds[1]) : kid;
    const bus = d.buses.find(b => b.id === (kid.bus || k2.bus)) || d.buses[0];
    if (State.role === 'parent') return [
      ['transport', 'info', `Le bus scolaire arrivera dans 10 minutes.`, bus.line + ' · arrêt ' + bus.stops[0].name, 'Il y a 2 min'],
      ['checkc', 'success', `${k2.first} est monté(e) dans le bus.`, 'Scan ' + bus.rfid + ' · 07:14', 'Il y a 18 min'],
      ['grades', 'navy', `${kid.first} a obtenu 16/20 en mathématiques.`, 'Contrôle 2 — Fonctions', 'Il y a 1 h'],
      ['homework', 'navy', 'Un nouveau devoir a été publié.', 'Français — Fiche de lecture, pour vendredi', 'Il y a 3 h'],
      ['finance', 'warning', 'Le paiement du mois est en attente.', 'Scolarité octobre · ' + S.money(3950), 'Hier'],
      ['documents', 'navy', 'Un nouveau bulletin est disponible.', 'Bulletin T3 2025-2026', 'Il y a 2 j'],
      ['alert', 'danger', `${k2.first} est absent(e) aujourd'hui.`, 'Absence non justifiée — merci de la justifier', 'Il y a 3 j']
    ];
    return [
      ['alert', 'danger', d.todayAbsences.filter(a => !a.justified).length + ' absences non justifiées', 'Notifications envoyées aux parents automatiquement', 'Il y a 12 min'],
      ['transport', 'warning', `Retard ${d.buses.find(b => b.delay).line}`, '+' + d.buses.find(b => b.delay).delay + ' min — parents notifiés', 'Il y a 20 min'],
      ['enroll', 'info', d.applications.filter(a => a.status === 'Nouveau').length + ' nouvelles demandes d\'inscription', 'À valider par la scolarité', 'Il y a 1 h'],
      ['finance', 'warning', d.invoices.filter(i => i.status === 'En retard').length + ' factures en retard', 'Relance automatique programmée à 18h', 'Il y a 2 h'],
      ['support', 'navy', 'Nouveau ticket : ' + d.tickets[0].subject, d.tickets[0].author, 'Il y a 3 h'],
      ['shield', 'navy', 'Sauvegarde chiffrée terminée', 'Rétention 30 jours · AES-256', 'Il y a 5 h']
    ];
  }
  function notifications() {
    const items = notifList();
    UI.drawer(`<h3 class="serif" style="font-size:20px">Notifications</h3><div class="muted" style="font-size:12px">Application · Email · Push · SMS</div>`,
      `<div class="list">${items.map(n => `<div class="li"><div class="dot-ic ${n[1]}">${icon(n[0])}</div><div class="grow"><div class="t" style="white-space:normal">${esc(n[2])}</div><div class="s" style="white-space:normal">${esc(n[3])}</div><div class="s" style="margin-top:2px">${n[4]}</div></div></div>`).join('')}</div>`,
      { foot: `<div style="padding:14px 20px;border-top:1px solid var(--line)"><button class="btn btn-ghost" style="width:100%" onclick="UI.closeDrawer();UI.toast('Toutes les notifications sont marquées comme lues')">Tout marquer comme lu</button></div>` });
  }

  // ---------- Recherche globale ----------
  function initSearch() {
    const input = document.getElementById('gsearch');
    let box;
    const close = () => { if (box) { box.remove(); box = null; } };
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase(); close();
      if (q.length < 2) return;
      const d = D();
      const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const nq = norm(q);
      const res = [];
      if (State.role === 'admin' || State.role === 'teacher') d.students.filter(s => norm(s.first + ' ' + s.last).includes(nq) || s.matricule.toLowerCase().includes(nq)).slice(0, 6).forEach(s => res.push(['students', s.first + ' ' + s.last, 'Élève · ' + S.cls(s.classId).name, '#/students/' + s.id]));
      if (State.role === 'admin') d.teachers.filter(t => norm(t.first + ' ' + t.last).includes(nq)).slice(0, 3).forEach(t => res.push(['teachers', t.first + ' ' + t.last, 'Enseignant · ' + S.subj(t.subject).name, '#/teachers/' + t.id]));
      d.classes.filter(c => norm(c.name).includes(nq)).slice(0, 3).forEach(c => can('classes') && res.push(['classes', 'Classe ' + c.name, c.studentIds.length + ' élèves', '#/classes/' + c.id]));
      NAV.filter(n => n.id && can(n.id) && norm(n.label).includes(nq)).forEach(n => res.push([n.icon, n.label, 'Module', '#/' + n.id]));
      box = document.createElement('div');
      box.className = 'card'; box.style.cssText = 'position:fixed;z-index:80;width:' + input.parentElement.offsetWidth + 'px;box-shadow:var(--sh-3);animation:fadeUp .2s';
      const r = input.parentElement.getBoundingClientRect(); box.style.left = r.left + 'px'; box.style.top = (r.bottom + 6) + 'px';
      box.innerHTML = res.length ? `<div class="list" style="padding:6px 0">${res.slice(0, 10).map(x => `<a class="li click" href="${x[3]}"><div class="dot-ic navy">${icon(x[0], 'sm')}</div><div class="grow"><div class="t">${esc(x[1])}</div><div class="s">${esc(x[2])}</div></div></a>`).join('')}</div>` : '<div class="empty">Aucun résultat</div>';
      document.body.appendChild(box);
      box.addEventListener('click', () => { close(); input.value = ''; });
    });
    input.addEventListener('blur', () => setTimeout(close, 180));
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); const i = document.getElementById('gsearch'); if (i) i.focus(); } });

  // ---------- Routeur ----------
  const Views = {};
  function highlightNav() {
    const id = (location.hash.replace('#/', '').split('/')[0]) || 'dashboard';
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
  }
  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const id = parts[0];
    const el = document.getElementById('content');
    if (!el) return;
    highlightNav();
    document.getElementById('sidebar').classList.remove('open');
    if (!can(id)) { el.innerHTML = `<div class="view"><div class="card" style="max-width:560px;margin:60px auto;padding:40px;text-align:center"><div class="dot-ic navy" style="margin:0 auto 16px;width:52px;height:52px">${icon('lock', 'lg')}</div><h2 class="serif" style="font-size:24px;font-weight:500">Accès restreint</h2><p class="muted mt-s">Votre rôle <b>${ROLES[State.role]}</b> ne dispose pas des permissions nécessaires pour ce module.</p><a class="btn btn-primary mt" href="#/dashboard">Retour au tableau de bord</a></div></div>`; return; }
    const v = Views[id];
    if (!v) { el.innerHTML = '<div class="view empty">Module introuvable.</div>'; return; }
    const out = v(parts.slice(1));
    el.innerHTML = `<div class="view">${typeof out === 'string' ? out : out.html}</div>`;
    el.scrollTop = 0;
    if (out && out.mount) out.mount(el);
  }
  window.addEventListener('hashchange', route);

  // ---------- Helpers de page ----------
  const head = (title, sub, actions = '', crumbs) => `
    <div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
  const kpi = (label, val, ic, foot = '', o = {}) => `
    <div class="card kpi ${o.cls || ''}" ${o.href ? `onclick="location.hash='${o.href}'" style="cursor:pointer"` : ''}>
      <div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ic ${o.gold ? 'gold' : ''}">${icon(ic, 'sm')}</span></div>
      <div class="kpi-val">${val}</div>
      ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
    </div>`;
  const delta = (v, suffix = '%', invert) => { const up = v >= 0; const good = invert ? !up : up; return `<span class="delta ${good ? 'up' : 'down'}">${icon(up ? 'up' : 'dn', 'sm')}${Math.abs(v).toString().replace('.', ',')}${suffix}</span>`; };
  const card = (title, body, o = {}) => `<div class="card ${o.cls || ''}" ${o.style ? `style="${o.style}"` : ''}>${title ? `<div class="card-h"><div><h3>${title}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</div>${o.action || ''}</div>` : ''}<div class="card-b ${o.flush ? 'flush' : ''}">${body}</div></div>`;
  const tabs = (items, on, attr = 'tab') => `<div class="tabs">${items.map(([k, l]) => `<button data-${attr}="${k}" class="${on === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const bindTabs = (root, attr, fn) => root.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => { root.querySelectorAll(`[data-${attr}]`).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset[attr]); }));

  window.App = { State, D, S, Views, route, renderShell, currentUser, can, setting, setSetting, head, kpi, delta, card, tabs, bindTabs, ROLES, notifList };

  document.addEventListener('DOMContentLoaded', () => { renderShell(); route(); });
})();
