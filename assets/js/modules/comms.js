/* ==========================================================
   Échanges : Communication (messagerie, annonces, groupes),
   Calendrier scolaire, Support / réclamations (tickets)
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, badge, num, dec, date, dateShort, fullName, avatar, who } = UI;
  const { D, S, Views, head, kpi, card, tabs, bindTabs, currentUser, State } = App;

  // ==========================================================
  // COMMUNICATION
  // ==========================================================
  Views.communication = function (p) {
    const d = D();
    const tab = p[0] || 'messages';
    const canAnnounce = State.role === 'admin' || State.role === 'teacher';
    const body = tab === 'messages' ? messages() : tab === 'announcements' ? announcements(canAnnounce) : groups();
    return {
      html: `${head('Communication', 'Messagerie interne, annonces et groupes · notifications app, email, push et SMS', canAnnounce ? `<button class="btn btn-primary" id="newAnn">${icon('plus', 'sm')} Nouvelle annonce</button>` : '')}
        ${tabs([['messages', 'Messages'], ['announcements', 'Annonces'], ['groups', 'Groupes']], tab)}
        ${body.html}`,
      mount: el => {
        bindTabs(el, 'tab', t => location.hash = '#/communication/' + t);
        const nb = el.querySelector('#newAnn'); if (nb) nb.onclick = newAnnouncement;
        body.mount && body.mount(el);
      }
    };
  };
  function messages() {
    const d = D(); let cur = d.threads[0];
    const html = `<div class="card" style="overflow:hidden"><div class="chat">
      <div class="chat-list"><div style="padding:12px"><div class="input-ic">${icon('search', 'sm')}<input class="input" style="width:100%" placeholder="Rechercher une conversation"></div></div><div class="list" id="thl"></div></div>
      <div class="chat-main"><div class="row between" style="padding:14px 20px;border-bottom:1px solid var(--line)" id="chh"></div><div class="chat-msgs" id="msgs"></div>
        <div class="chat-input"><button class="icon-btn" title="Pièce jointe">${icon('upload', 'sm')}</button><input class="input" id="min" placeholder="Écrire un message…"><button class="btn btn-primary" id="msend">${icon('send', 'sm')}</button></div></div>
    </div></div>`;
    return {
      html, mount: el => {
        const drawList = () => el.querySelector('#thl').innerHTML = d.threads.map(t => `<div class="li click" data-th="${t.id}" style="${t === cur ? 'background:var(--beige-50)' : ''}">${avatar({ id: t.id, first: t.with.split(' ')[0], last: t.with.split(' ')[1] || '' })}<div class="grow"><div class="t">${esc(t.with)}</div><div class="s">${esc(t.msgs[t.msgs.length - 1][1])}</div></div><div style="text-align:right"><div class="muted" style="font-size:11px">${t.msgs[t.msgs.length - 1][2]}</div>${t.unread ? `<span class="badge gold plain" style="height:18px;margin-top:4px">${t.unread}</span>` : ''}</div></div>`).join('');
        const drawThread = () => {
          el.querySelector('#chh').innerHTML = `<div class="row">${avatar({ id: cur.id, first: cur.with.split(' ')[0], last: cur.with.split(' ')[1] || '' })}<div><div style="font-weight:600">${esc(cur.with)}</div><div class="muted" style="font-size:12px">${esc(cur.role)}</div></div></div><div class="row"><button class="icon-btn">${icon('phone', 'sm')}</button><button class="icon-btn">${icon('more', 'sm')}</button></div>`;
          const m = el.querySelector('#msgs');
          m.innerHTML = cur.msgs.map(x => `<div class="msg ${x[0]}">${esc(x[1])}<div class="time">${x[2]}${x[0] === 'out' ? ' · Lu' : ''}</div></div>`).join('');
          m.scrollTop = m.scrollHeight;
        };
        const send = () => {
          const i = el.querySelector('#min'); const v = i.value.trim(); if (!v) return;
          cur.msgs.push(['out', v, 'À l\'instant']); i.value = ''; drawThread(); drawList(); bind();
          setTimeout(() => { if (!document.getElementById('msgs')) return; cur.msgs.push(['in', 'Merci pour votre message, je reviens vers vous rapidement.', 'À l\'instant']); drawThread(); drawList(); bind(); }, 1400);
        };
        const bind = () => el.querySelectorAll('[data-th]').forEach(x => x.onclick = () => { cur = d.threads.find(t => t.id === x.dataset.th); cur.unread = 0; drawList(); drawThread(); bind(); });
        el.querySelector('#msend').onclick = send; el.querySelector('#min').onkeydown = e => { if (e.key === 'Enter') send(); };
        drawList(); drawThread(); bind();
      }
    };
  }
  function announcements(canAnnounce) {
    const d = D();
    return {
      html: `<div class="grid g-main"><div class="stack">${d.announcements.map(a => `<div class="card" style="padding:20px"><div class="row between"><div class="row">${a.pinned ? `<span style="color:var(--gold)">${icon('bookmark', 'sm')}</span>` : ''}<h3 style="font-size:15.5px">${esc(a.title)}</h3></div><span class="muted" style="font-size:12px">${dateShort(a.date)}</span></div><p class="muted" style="margin-top:8px;line-height:1.6">${esc(a.body)}</p><div class="row mt-s" style="gap:6px">${badge(a.audience, 'navy')}<span class="muted" style="font-size:12px;margin-left:auto">${icon('eye', 'sm').replace('class="icon sm"', 'class="icon sm" style="display:inline;vertical-align:-3px"')} ${300 + DB.hash(a.title) % 400} lectures</span></div></div>`).join('')}</div>
        ${card('Canaux de diffusion', ['Application (in-app)', 'Email', 'Notifications push', 'SMS (urgences)'].map((x, i) => `<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line-2)"><span>${x}</span><button class="switch ${i < 3 ? 'on' : ''}" onclick="this.classList.toggle('on')"></button></div>`).join('') + '<p class="muted mt" style="font-size:12.5px">Les SMS sont réservés aux alertes critiques (absence, retard de bus, urgence) pour maîtriser les coûts.</p>')}</div>`
    };
  }
  function groups() {
    const d = D();
    const g = [['Tous les parents', d.parents.length, 'parents'], ['Équipe pédagogique', d.teachers.length, 'teachers'], ...d.classes.slice(0, 6).map(c => ['Parents — ' + c.name, c.studentIds.length * 2 - 3, 'classes']), ['Conseil d\'établissement', 12, 'shield'], ['Club Robotique', 18, 'activities']];
    return { html: `<div class="grid g-3">${g.map(x => `<div class="card hover" style="padding:18px;display:flex;gap:14px;align-items:center"><div class="dot-ic navy">${icon(x[2], 'sm')}</div><div style="flex:1"><div style="font-weight:500">${esc(x[0])}</div><div class="muted" style="font-size:12px">${x[1]} membres</div></div><a class="btn btn-sm btn-ghost" href="#/communication/messages">${icon('communication', 'sm')}</a></div>`).join('')}</div>` };
  }
  function newAnnouncement() {
    const d = D();
    UI.modal('Nouvelle annonce', `<div class="stack"><div class="field"><label>Titre</label><input class="input" id="at"></div><div class="field"><label>Message</label><textarea class="input" id="ab" rows="4"></textarea></div><div class="form-grid"><div class="field"><label>Destinataires</label><select class="select" id="aa"><option>Toute l'école</option><option>Tous les parents</option><option>Enseignants</option>${d.classes.map(c => `<option>Classe ${c.name}</option>`).join('')}</select></div><div class="field"><label>Canaux</label><div class="row wrap" style="gap:10px;padding-top:6px"><label class="check"><input type="checkbox" checked> App</label><label class="check"><input type="checkbox" checked> Email</label><label class="check"><input type="checkbox" checked> Push</label><label class="check"><input type="checkbox"> SMS</label></div></div></div><label class="check"><input type="checkbox" id="ap"> Épingler en haut</label></div>`, {
      ok: 'Publier', onOk: m => { const t = m.querySelector('#at').value.trim(); if (!t) { UI.toast('Titre requis', 'alert'); return false; } d.announcements.unshift({ title: t, body: m.querySelector('#ab').value, date: DB.iso(DB.TODAY), audience: m.querySelector('#aa').value, pinned: m.querySelector('#ap').checked }); location.hash = '#/communication/announcements'; App.route(); UI.toast('Annonce publiée et diffusée', 'send'); }
    });
  }

  // ==========================================================
  // CALENDRIER SCOLAIRE
  // ==========================================================
  const calState = { offset: 0 };
  const KCOL = { 'Réunion': ['#E6EBF5', '#1D3462'], 'Conseil': ['#EAE6F2', '#4E3F73'], 'Examen': ['#F8E6E3', '#B0443B'], 'Sortie': ['#E3EEE8', '#2E5E4E'], 'Événement': ['#EFE3CB', '#7A5A2E'], 'Vacances': ['#F3EDE2', '#8B7B5E'], 'Activité': ['#E5EEF7', '#33679E'] };
  Views.calendar = function () {
    const d = D();
    const base = new Date(DB.TODAY.getFullYear(), DB.TODAY.getMonth() + calState.offset, 1);
    const start = new Date(base); start.setDate(1 - ((base.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) => DB.addDays(start, i));
    const evOn = day => { const k = DB.iso(day); return d.events.filter(e => { const s = new Date(e.date + 'T12:00'); const en = DB.addDays(s, e.days - 1); return day >= DB.addDays(s, -.5) && day <= DB.addDays(en, .5); }); };
    const month = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][base.getMonth()] + ' ' + base.getFullYear();
    const upcoming = d.events.filter(e => e.date >= DB.iso(DB.TODAY)).sort((a, b) => a.date.localeCompare(b.date));
    const html = `
      ${head('Calendrier scolaire', 'Vacances, examens, réunions, sorties, activités et conseils de classe', `${State.role === 'admin' ? `<button class="btn btn-primary" id="newEv">${icon('plus', 'sm')} Événement</button>` : ''}<button class="btn btn-ghost" onclick="UI.toast('Lien iCal copié — synchronisez avec Google / Outlook','link')">${icon('link', 'sm')} Synchroniser</button>`)}
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 300px">
        <div>
          <div class="row between mb"><div class="row"><button class="icon-btn" id="cp">${icon('left', 'sm')}</button><button class="icon-btn" id="cn">${icon('right', 'sm')}</button><h2 class="serif" style="font-size:22px;font-weight:500;margin-left:8px">${month}</h2></div><button class="btn btn-sm btn-ghost" id="ct">Aujourd'hui</button></div>
          <div class="cal">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(x => `<div class="cal-h">${x}</div>`).join('')}
            ${days.map(day => `<div class="cal-d ${day.getMonth() !== base.getMonth() ? 'out' : ''} ${day.toDateString() === DB.TODAY.toDateString() ? 'today' : ''}"><div class="num">${day.getDate()}</div>${evOn(day).map(e => `<div class="ev" style="background:${KCOL[e.kind][0]};color:${KCOL[e.kind][1]}" data-tip="${esc('<b>' + e.title + '</b><br>' + e.kind + ' · ' + e.time)}">${esc(e.title)}</div>`).join('')}</div>`).join('')}
          </div>
        </div>
        <div class="stack">
          ${card('Légende', `<div class="stack" style="gap:8px">${Object.entries(KCOL).map(([k, c]) => `<div class="row" style="font-size:12.5px"><i style="width:10px;height:10px;border-radius:3px;background:${c[1]}"></i>${k}</div>`).join('')}</div>`)}
          ${card('À venir', `<div class="list">${upcoming.slice(0, 6).map(e => `<div class="li" style="padding-left:0;padding-right:0"><div class="dot-ic" style="background:${KCOL[e.kind][0]};color:${KCOL[e.kind][1]};flex-direction:column;line-height:1;font-size:10px"><b style="font-size:14px">${new Date(e.date + 'T12:00').getDate()}</b>${UI.MOIS[new Date(e.date + 'T12:00').getMonth()]}</div><div class="grow"><div class="t">${esc(e.title)}</div><div class="s">${e.kind} · ${e.time}</div></div></div>`).join('')}</div>`)}
        </div>
      </div>`;
    return {
      html, mount: el => {
        el.querySelector('#cp').onclick = () => { calState.offset--; App.route(); };
        el.querySelector('#cn').onclick = () => { calState.offset++; App.route(); };
        el.querySelector('#ct').onclick = () => { calState.offset = 0; App.route(); };
        const nb = el.querySelector('#newEv'); if (nb) nb.onclick = () => UI.modal('Nouvel événement', `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Titre</label><input class="input" id="et"></div><div class="field"><label>Type</label><select class="select" id="ek">${Object.keys(KCOL).map(k => `<option>${k}</option>`).join('')}</select></div><div class="field"><label>Date</label><input class="input" type="date" id="ed" value="${DB.iso(DB.TODAY)}"></div><div class="field"><label>Heure</label><input class="input" type="time" id="eh" value="14:00"></div><div class="field"><label>Participants</label><select class="select"><option>Toute l'école</option><option>Parents</option><option>Enseignants</option></select></div></div>`, { ok: 'Créer', onOk: m => { d.events.push({ id: 'ev' + Date.now(), title: m.querySelector('#et').value || 'Événement', kind: m.querySelector('#ek').value, date: m.querySelector('#ed').value, days: 1, time: m.querySelector('#eh').value }); App.route(); UI.toast('Événement ajouté — invitations envoyées', 'calendar'); } });
      }
    };
  };

  // ==========================================================
  // SUPPORT / RÉCLAMATIONS
  // ==========================================================
  Views.support = function (p) {
    const d = D();
    if (p[0]) return ticketView(p[0]);
    const isAdmin = State.role === 'admin';
    const u = currentUser();
    const list = isAdmin ? d.tickets : d.tickets.filter((t, i) => i % 3 === 0);
    const ST = ['Nouveau', 'En cours', 'Résolu', 'Fermé'];
    const html = `
      ${head(isAdmin ? 'Réclamations & support' : 'Mes demandes', isAdmin ? 'Tickets des parents, enseignants et élèves' : 'Contactez l\'administration et suivez vos demandes', `<button class="btn btn-primary" id="newTk">${icon('plus', 'sm')} Nouveau ticket</button>`)}
      ${isAdmin ? `<div class="grid g-4 mb">${ST.map((s, i) => kpi(s, list.filter(t => t.status === s).length, ['inbox', 'clock', 'checkc', 'lock'][i], i === 1 ? '<span>Délai moyen de résolution : 1,8 j</span>' : ''))}</div>` : ''}
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Réf.</th><th>Sujet</th><th>Catégorie</th><th>Émetteur</th><th>Priorité</th><th>Date</th><th>Statut</th></tr></thead><tbody>
        ${list.map(t => `<tr class="click" onclick="location.hash='#/support/${t.id}'"><td class="muted">${t.id}</td><td style="font-weight:500">${esc(t.subject)}</td><td>${t.cat}</td><td><div style="font-size:12.5px">${esc(t.author)}</div><div class="muted" style="font-size:11.5px">${t.from} → Administration</div></td><td>${badge(t.priority)}</td><td>${dateShort(t.date)}</td><td>${badge(t.status)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return {
      html, mount: el => el.querySelector('#newTk').onclick = () => UI.modal('Nouveau ticket', `<div class="stack"><div class="field"><label>Sujet</label><input class="input" id="ts"></div><div class="form-grid"><div class="field"><label>Catégorie</label><select class="select" id="tc"><option>Scolarité</option><option>Finance</option><option>Transport</option><option>Cantine</option><option>Vie scolaire</option><option>Technique</option><option>Logistique</option></select></div><div class="field"><label>Priorité</label><select class="select" id="tp"><option>Normale</option><option>Haute</option><option>Basse</option></select></div></div><div class="field"><label>Description</label><textarea class="input" rows="4"></textarea></div></div>`, { ok: 'Envoyer', onOk: m => { const s = m.querySelector('#ts').value.trim(); if (!s) { UI.toast('Sujet requis', 'alert'); return false; } d.tickets.unshift({ id: 'TK-' + (1100 + d.tickets.length), subject: s, cat: m.querySelector('#tc').value, from: App.ROLES[State.role], author: u.first + ' ' + u.last, status: 'Nouveau', priority: m.querySelector('#tp').value, date: DB.iso(DB.TODAY), msgs: 1 }); App.route(); UI.toast('Ticket créé — vous serez notifié à chaque réponse'); } })
    };
  };
  function ticketView(id) {
    const d = D(), t = d.tickets.find(x => x.id === id);
    const ST = ['Nouveau', 'En cours', 'Résolu', 'Fermé'];
    const hist = [['in', t.author, `Bonjour, je vous contacte au sujet de : ${t.subject.toLowerCase()}. Merci de votre retour.`, dateShort(t.date) + ' · 08:42'], ['out', 'Service ' + t.cat, 'Bonjour, merci pour votre message. Nous étudions votre demande et revenons vers vous rapidement.', dateShort(t.date) + ' · 10:15']];
    if (t.status === 'Résolu' || t.status === 'Fermé') hist.push(['out', 'Service ' + t.cat, 'Le nécessaire a été fait. N\'hésitez pas à nous recontacter si besoin.', 'Hier · 15:02']);
    const html = `
      <div class="crumbs"><a href="#/support">Support</a>${icon('right', 'sm')}<span>${t.id}</span></div>
      ${head(esc(t.subject), `${t.id} · ${t.cat} · ouvert par ${esc(t.author)} (${t.from})`, State.role === 'admin' ? `<select class="select" id="tst">${ST.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select>` : badge(t.status))}
      <div class="row mb" style="gap:0">${ST.map((s, i) => `<div style="flex:1"><div class="bar ${ST.indexOf(t.status) >= i ? 'gold' : ''}" style="border-radius:0"><i style="width:${ST.indexOf(t.status) >= i ? 100 : 0}%"></i></div><div style="font-size:12px;margin-top:6px;color:${ST.indexOf(t.status) >= i ? 'var(--ink)' : 'var(--ink-3)'}">${s}</div></div>`).join('')}</div>
      <div class="grid g-main"><div class="card"><div class="chat-msgs" style="min-height:280px" id="tmsgs">${hist.map(h => `<div class="msg ${h[0]}"><div style="font-size:11px;font-weight:600;opacity:.7;margin-bottom:3px">${esc(h[1])}</div>${esc(h[2])}<div class="time">${h[3]}</div></div>`).join('')}</div><div class="chat-input"><input class="input" id="tin" placeholder="Répondre…"><button class="btn btn-primary" id="tsend">${icon('send', 'sm')}</button></div></div>
        ${card('Détails', `<div class="info-grid" style="grid-template-columns:1fr">${[['Priorité', badge(t.priority)], ['Catégorie', t.cat], ['Assigné à', 'Service ' + t.cat], ['Créé le', date(t.date)], ['SLA', 'Réponse sous 24 h ouvrées']].map(x => `<div><div class="k">${x[0]}</div><div class="v">${x[1]}</div></div>`).join('')}</div>`)}</div>`;
    return {
      html, mount: el => {
        const s = el.querySelector('#tst'); if (s) s.onchange = () => { t.status = s.value; App.route(); UI.toast('Statut mis à jour — émetteur notifié', 'bell'); };
        const send = () => { const i = el.querySelector('#tin'); if (!i.value.trim()) return; el.querySelector('#tmsgs').insertAdjacentHTML('beforeend', `<div class="msg out"><div style="font-size:11px;font-weight:600;opacity:.7;margin-bottom:3px">Vous</div>${esc(i.value)}<div class="time">À l'instant</div></div>`); i.value = ''; };
        el.querySelector('#tsend').onclick = send; el.querySelector('#tin').onkeydown = e => { if (e.key === 'Enter') send(); };
      }
    };
  }
})();
