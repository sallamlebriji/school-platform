/* ==========================================================
   Athénée — UI kit : icônes, formatage, graphiques SVG,
   modales, tiroirs, notifications toast.
   ========================================================== */
(function () {
  'use strict';

  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    students: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
    parents: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><circle cx="17.5" cy="9.5" r="2.5"/><path d="M16.5 14.6c2.6-.3 4.6 1.3 5 4.4"/>',
    teachers: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 20l2-4M17 20l-2-4M8 9h5M8 12h8"/>',
    classes: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-5h6v5"/><circle cx="12" cy="11" r="1.6"/>',
    timetable: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3"/><path d="M12 13v3l2 1"/>',
    attendance: '<rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="m9 14 2 2 4-4.5"/>',
    grades: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
    homework: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    elearning: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8.5 4.5 2-4.5 2z"/>',
    library: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 1 6 18h13"/><path d="M9 7h6"/>',
    transport: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v2.5M16 18v2.5"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/><path d="M9 6.5h6"/>',
    canteen: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M7 8h0"/><path d="M17 21V3c-2 1.5-3 4-3 7h3"/>',
    activities: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    lost: '<path d="M3 8 12 3l9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    documents: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    communication: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
    finance: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M6 3.5h12"/><circle cx="16.5" cy="15" r="1.2"/>',
    analytics: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-6"/>',
    support: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.8"/><path d="m5.6 5.6 3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    health: '<path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.7Z"/><path d="M12 10v5M9.5 12.5h5"/>',
    enroll: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    filter: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
    sparkles: '<path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9-4.9-1.8 4.9-1.8Z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h0"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    up: '<path d="m7 14 5-5 5 5"/>', dn: '<path d="m7 10 5 5 5-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    star: '<path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h3v4h-3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2 2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    book: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2ZM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8Z"/>',
    shirt: '<path d="M20.4 6.5 16 4a4 4 0 0 1-8 0L3.6 6.5a1 1 0 0 0-.5 1.3l1.3 2.6a1 1 0 0 0 1.2.5L7 10.4V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9.6l1.4.5a1 1 0 0 0 1.2-.5l1.3-2.6a1 1 0 0 0-.5-1.3Z"/>',
    glasses: '<circle cx="6.5" cy="15" r="3.5"/><circle cx="17.5" cy="15" r="3.5"/><path d="M10 15h4M3 15 5 6h2M21 15l-2-9h-2"/>',
    watch: '<circle cx="12" cy="12" r="6"/><path d="M12 9.5V12l1.5 1.5M9 3h6l.5 3.5M9 21h6l.5-3.5M8.5 6.5 9 3M8.5 17.5 9 21"/>',
    bottle: '<path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3V2Z"/><path d="M8 12h8"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r=".8"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
    flag: '<path d="M4 22V4s1.5-1 5-1 5 2 8 2 3-1 3-1v11s-1 1-3 1-5-2-8-2-5 1-5 1"/>'
  };
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.dashboard}</svg>`;

  // ---------- Formatage ----------
  const nf = new Intl.NumberFormat('fr-FR');
  const money = (v, cur) => nf.format(Math.round(v)) + ' ' + (cur === 'MAD' ? 'DH' : cur === 'EUR' ? '€' : cur || 'DH');
  const kmoney = (v, cur) => v >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + ' M' + (cur === 'MAD' ? ' DH' : ' €') : v >= 1e4 ? nf.format(Math.round(v / 1000)) + ' k' + (cur === 'MAD' ? ' DH' : ' €') : money(v, cur);
  const num = v => nf.format(v);
  const pct = (v, d = 1) => v.toFixed(d).replace('.', ',') + ' %';
  const dec = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const date = s => { const d = typeof s === 'string' ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')) : s; return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); };
  const dateShort = s => { const d = typeof s === 'string' ? new Date(s + 'T12:00:00') : s; return d.getDate() + ' ' + MOIS[d.getMonth()]; };
  const longDate = d => JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.getMonth()] + ' ' + d.getFullYear();
  const relDays = s => { const diff = Math.round((new Date(s + 'T12:00:00') - new Date(DB.TODAY.toDateString() + ' 12:00')) / DB.DAY); return diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : diff === -1 ? 'Hier' : diff > 0 ? 'Dans ' + diff + ' j' : 'Il y a ' + (-diff) + ' j'; };
  const age = s => { const b = new Date(s); let a = DB.TODAY.getFullYear() - b.getFullYear(); if (DB.TODAY < new Date(DB.TODAY.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = p => (p.first[0] + (p.last[0] || '')).toUpperCase();
  const fullName = p => p ? p.first + ' ' + p.last : '—';
  const AV_COLORS = [['#E8DFCF', '#13254A'], ['#E6EBF5', '#1D3462'], ['#EFE3CB', '#7A5A2E'], ['#E3EEE8', '#2E5E4E'], ['#F1E4E6', '#5A2E3A'], ['#EAE6F2', '#4E3F73']];
  const avatar = (p, cls = '') => { const c = AV_COLORS[DB.hash(p.id || p.first) % AV_COLORS.length]; return `<div class="avatar ${cls}" style="background:${c[0]};color:${c[1]}">${initials(p)}</div>`; };
  const who = (p, sub, cls = 'sm') => `<div class="who">${avatar(p, cls)}<div><div class="n">${esc(fullName(p))}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div></div>`;

  const STATUS = { 'Payé': 'success', 'En attente': 'warning', 'En retard': 'danger', 'À venir': 'plain', 'Nouveau': 'info', 'En vérification': 'warning', 'Accepté': 'navy', 'Inscrit': 'success', 'En cours': 'warning', 'Résolu': 'success', 'Fermé': 'plain', 'Ouvert': 'warning', 'Récupéré': 'success', 'Perdu': 'danger', 'Trouvé': 'info', 'Actif': 'success', 'Absent': 'danger', 'Justifiée': 'success', 'Non justifiée': 'danger', 'À faire': 'plain', 'Rendu': 'info', 'Corrigé': 'success', 'Haute': 'danger', 'Normale': 'plain', 'Basse': 'plain', 'Publié': 'success', 'Brouillon': 'plain' };
  const badge = (s, kind) => `<span class="badge ${kind || STATUS[s] || ''}">${esc(s)}</span>`;
  const gradeColor = g => g >= 16 ? 'var(--success)' : g >= 12 ? 'var(--navy-700)' : g >= 10 ? 'var(--warning)' : 'var(--danger)';

  // ---------- Tooltip ----------
  let tipEl;
  function tip(e, html) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    if (!html) { tipEl.style.opacity = 0; return; }
    tipEl.innerHTML = html; tipEl.style.opacity = 1;
    const x = Math.min(e.clientX + 14, window.innerWidth - tipEl.offsetWidth - 10);
    tipEl.style.left = x + 'px'; tipEl.style.top = (e.clientY - tipEl.offsetHeight - 10) + 'px';
  }
  document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t) tip(e, t.getAttribute('data-tip')); });
  document.addEventListener('mousemove', e => { const t = e.target.closest('[data-tip]'); if (t) tip(e, t.getAttribute('data-tip')); else if (tipEl && tipEl.style.opacity === '1') tip(e, null); });

  // ---------- Graphiques SVG ----------
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

  /** Courbes / aires. series: [{name,color,values,area?,dash?}] */
  function line(labels, series, o = {}) {
    const W = o.w || 640, H = o.h || 220, L = o.left ?? 40, R = 12, T = 12, B = 26;
    const all = series.flatMap(s => s.values);
    const min = o.min ?? 0; const max = o.max ?? niceMax(Math.max(...all) * 1.08);
    const x = i => L + (labels.length === 1 ? 0 : i * (W - L - R) / (labels.length - 1));
    const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    const fmt = o.fmt || (v => num(Math.round(v)));
    let g = '<g class="axis">';
    for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4; g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${o.axisFmt ? o.axisFmt(v) : fmt(v)}</text>`; }
    labels.forEach((l, i) => { if (labels.length > 14 && i % 2) return; g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`; });
    g += '</g>';
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    let defs = '<defs>'; let paths = '';
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const d = smooth(pts);
      if (s.area) { defs += `<linearGradient id="${id}${si}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".22"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`; paths += `<path d="${d} L${pts[pts.length - 1][0]},${y(min)} L${pts[0][0]},${y(min)} Z" fill="url(#${id}${si})"/>`; }
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" ${s.dash ? 'stroke-dasharray="5 5"' : ''} stroke-linecap="round" style="stroke-dasharray:${s.dash ? '5 5' : '2000'};stroke-dashoffset:${s.dash ? 0 : 2000};animation:${s.dash ? 'none' : 'draw 1.4s var(--ease) forwards'}"/>`;
    });
    defs += '</defs>';
    let hits = '';
    labels.forEach((l, i) => {
      const t = `${l}<br>` + series.map(s => `<span style="color:${s.color}">●</span> ${s.name} : <b>${fmt(s.values[i])}</b>`).join('<br>');
      const cw = (W - L - R) / Math.max(1, labels.length - 1);
      hits += `<rect x="${x(i) - cw / 2}" y="${T}" width="${cw}" height="${H - T - B}" fill="transparent" data-tip="${esc(t)}"/>`;
      series.forEach(s => { if (!s.dash) hits += `<circle cx="${x(i)}" cy="${y(s.values[i])}" r="${o.dots ? 3 : 0}" fill="#fff" stroke="${s.color}" stroke-width="2" pointer-events="none"/>`; });
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${defs}${g}${paths}${hits}</svg></div>`;
  }
  function smooth(p) {
    if (p.length < 2) return `M${p[0][0]},${p[0][1]}`;
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, t = .18;
      d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  /** Barres (groupées ou empilées). series: [{name,color,values}] */
  function bars(labels, series, o = {}) {
    const W = o.w || 640, H = o.h || 220, L = o.left ?? 40, R = 8, T = 12, B = 26;
    const stacked = o.stacked;
    const tot = labels.map((_, i) => stacked ? series.reduce((a, s) => a + s.values[i], 0) : Math.max(...series.map(s => s.values[i])));
    const max = o.max ?? niceMax(Math.max(...tot) * 1.05);
    const min = o.min ?? 0;
    const fmt = o.fmt || (v => num(Math.round(v)));
    const y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
    const bw = (W - L - R) / labels.length;
    let g = '<g class="axis">';
    for (let k = 0; k <= 4; k++) { const v = min + (max - min) * k / 4; g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${o.axisFmt ? o.axisFmt(v) : fmt(v)}</text>`; }
    labels.forEach((l, i) => g += `<text x="${L + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${l}</text>`);
    g += '</g>';
    let b = '';
    labels.forEach((l, i) => {
      const t = esc(`${l}<br>` + series.map(s => `<span style="color:${s.color}">●</span> ${s.name} : <b>${fmt(s.values[i])}</b>`).join('<br>'));
      const inner = bw * (o.gap ?? .56);
      if (stacked) {
        let acc = min;
        series.forEach((s, si) => { const v = s.values[i]; const y1 = y(acc + v), y0 = y(acc); b += `<rect x="${L + bw * i + (bw - inner) / 2}" y="${y1}" width="${inner}" height="${Math.max(0, y0 - y1)}" fill="${s.color}" rx="${si === series.length - 1 ? 4 : 0}" data-tip="${t}" style="transform-origin:0 ${H - B}px;animation:growY .8s var(--ease) both ${i * 30}ms"/>`; acc += v; });
      } else {
        const each = inner / series.length;
        series.forEach((s, si) => { const v = s.values[i]; b += `<rect x="${L + bw * i + (bw - inner) / 2 + si * each}" y="${y(v)}" width="${each - 2}" height="${Math.max(0, y(min) - y(v))}" fill="${o.highlight != null && o.highlight !== i ? s.color + '66' : s.color}" rx="4" data-tip="${t}" style="transform-origin:0 ${H - B}px;animation:growY .8s var(--ease) both ${i * 30}ms"/>`; });
      }
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}${b}</svg></div>`;
  }

  /** Barres horizontales */
  function hbars(items, o = {}) {
    const max = o.max || Math.max(...items.map(i => i.value));
    return `<div class="stack" style="gap:12px">${items.map(it => `
      <div data-tip="${esc(it.label + ' : <b>' + (o.fmt ? o.fmt(it.value) : it.value) + '</b>')}">
        <div class="row between" style="font-size:12.5px;margin-bottom:5px"><span>${esc(it.label)}</span><span style="font-weight:600;font-variant-numeric:tabular-nums">${o.fmt ? o.fmt(it.value) : it.value}</span></div>
        <div class="bar ${o.cls || ''}"><i style="width:${Math.max(2, it.value / max * 100)}%;${it.color ? 'background:' + it.color : ''}"></i></div>
      </div>`).join('')}</div>`;
  }

  /** Donut */
  function donut(items, o = {}) {
    const S = o.size || 150, R = S / 2 - 10, C = 2 * Math.PI * R, tot = items.reduce((a, b) => a + b.value, 0);
    let off = 0, arcs = '';
    items.forEach(it => {
      const len = it.value / tot * C;
      arcs += `<circle cx="${S / 2}" cy="${S / 2}" r="${R}" fill="none" stroke="${it.color}" stroke-width="${o.thick || 16}" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${S / 2} ${S / 2})" data-tip="${esc(it.label + ' : <b>' + (o.fmt ? o.fmt(it.value) : num(it.value)) + '</b> (' + Math.round(it.value / tot * 100) + ' %)')}" style="cursor:pointer"/>`;
      off += len;
    });
    const center = `<text x="50%" y="${S / 2 - 2}" text-anchor="middle" font-size="${S / 6.5}" fill="var(--ink)" class="donut-center">${o.center ?? num(tot)}</text><text x="50%" y="${S / 2 + 16}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${o.sub || 'total'}</text>`;
    const legend = o.legend === false ? '' : `<div class="stack" style="gap:8px;flex:1;min-width:0">${items.map(it => `<div class="row between" style="font-size:12.5px"><span class="row" style="gap:8px;min-width:0"><i style="width:9px;height:9px;border-radius:3px;background:${it.color};flex:none"></i><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.label)}</span></span><b style="font-weight:600">${o.fmt ? o.fmt(it.value) : num(it.value)}</b></div>`).join('')}</div>`;
    return `<div class="donut-wrap"><svg viewBox="0 0 ${S} ${S}" style="width:${S}px;flex:none"><circle cx="${S / 2}" cy="${S / 2}" r="${R}" fill="none" stroke="var(--beige-100)" stroke-width="${o.thick || 16}"/>${arcs}${center}</svg>${legend}</div>`;
  }

  /** Anneau de progression */
  function ring(v, o = {}) {
    const S = o.size || 64, R = S / 2 - 5, C = 2 * Math.PI * R;
    return `<svg class="ring" viewBox="0 0 ${S} ${S}" style="width:${S}px;flex:none"><circle cx="${S / 2}" cy="${S / 2}" r="${R}" fill="none" stroke="${o.track || 'var(--beige-100)'}" stroke-width="${o.w || 5}"/><circle cx="${S / 2}" cy="${S / 2}" r="${R}" fill="none" stroke="${o.color || 'var(--navy-700)'}" stroke-width="${o.w || 5}" stroke-linecap="round" stroke-dasharray="${C * v / 100} ${C}" transform="rotate(-90 ${S / 2} ${S / 2})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${S / 4.2}" fill="${o.text || 'var(--ink)'}">${o.label ?? Math.round(v) + '%'}</text></svg>`;
  }

  function spark(values, color = 'var(--navy-700)', w = 110, h = 34) {
    const max = Math.max(...values), min = Math.min(...values);
    const pts = values.map((v, i) => [i * w / (values.length - 1), h - 3 - (v - min) / (max - min || 1) * (h - 6)]);
    return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px"><path d="${smooth(pts)}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  /** Heatmap (lignes × colonnes) */
  function heat(rows, cols, val, o = {}) {
    const color = v => { const t = Math.max(0, Math.min(1, (v - (o.min ?? 8)) / ((o.max ?? 17) - (o.min ?? 8)))); return `rgba(29,52,98,${.08 + t * .82})`; };
    return `<div class="table-wrap"><table class="tbl" style="font-size:12px"><thead><tr><th></th>${cols.map(c => `<th style="text-align:center">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td style="font-weight:500;white-space:nowrap">${esc(r.label)}</td>${cols.map(c => { const v = val(r, c); return v == null ? '<td style="text-align:center;color:var(--ink-3)">—</td>' : `<td style="padding:4px"><div data-tip="${esc(r.label + ' · ' + c.label + ' : <b>' + dec(v) + '</b>')}" style="background:${color(v)};color:${v > ((o.max ?? 17) + (o.min ?? 8)) / 2 ? '#fff' : 'var(--ink)'};border-radius:6px;text-align:center;padding:7px 4px;font-variant-numeric:tabular-nums">${dec(v, 1)}</div></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  const legend = items => `<div class="legend">${items.map(i => `<span><i style="background:${i.color}"></i>${esc(i.name || i.label)}</span>`).join('')}</div>`;

  // ---------- Modale / tiroir / toast ----------
  function modal(title, body, o = {}) {
    closeModal();
    const el = document.createElement('div'); el.className = 'overlay'; el.id = 'modal';
    el.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-close>${icon('x')}</button></div><div class="modal-b">${body}</div>${o.foot !== false ? `<div class="modal-f">${o.foot || `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>${o.ok || 'Enregistrer'}</button>`}</div>` : ''}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close]')) closeModal();
      if (e.target.closest('[data-ok]')) { const res = o.onOk ? o.onOk(el) : true; if (res !== false) closeModal(); }
    });
    if (o.mount) o.mount(el);
    return el;
  }
  function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });

  function drawer(title, body, o = {}) {
    closeDrawer(true);
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'drawer-ov'; ov.style.background = 'rgba(8,18,38,.18)';
    const el = document.createElement('aside'); el.className = 'drawer ' + (o.cls || ''); el.id = 'drawer';
    el.innerHTML = `<div class="drawer-h"><div>${title}</div><button class="icon-btn" data-close>${icon('x')}</button></div><div class="drawer-b">${body}</div>${o.foot || ''}`;
    document.body.append(ov, el);
    requestAnimationFrame(() => el.classList.add('open'));
    ov.addEventListener('click', () => closeDrawer());
    el.querySelector('[data-close]').addEventListener('click', () => closeDrawer());
    if (o.mount) o.mount(el);
    return el;
  }
  function closeDrawer(now) {
    const el = document.getElementById('drawer'), ov = document.getElementById('drawer-ov');
    if (ov) ov.remove();
    if (el) { if (now) el.remove(); else { el.classList.remove('open'); setTimeout(() => el.remove(), 350); } }
  }

  function toast(msg, ic = 'checkc') {
    let wrap = document.querySelector('.toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = icon(ic) + '<span>' + msg + '</span>';
    wrap.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = 0; t.style.transform = 'translateY(6px)'; setTimeout(() => t.remove(), 300); }, 3200);
  }

  const style = document.createElement('style');
  style.textContent = '@keyframes draw{to{stroke-dashoffset:0}}@keyframes growY{from{transform:scaleY(0)}to{transform:scaleY(1)}}';
  document.head.appendChild(style);

  window.UI = { icon, money, kmoney, num, pct, dec, date, dateShort, longDate, relDays, age, esc, initials, fullName, avatar, who, badge, gradeColor, line, bars, hbars, donut, ring, spark, heat, legend, modal, closeModal, drawer, closeDrawer, toast, MOIS, JOURS };
})();
