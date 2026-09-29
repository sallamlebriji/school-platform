/* ==========================================================
   AI School Assistant — chatbot intégré.
   Démo : moteur d'intentions local qui s'appuie sur les
   données réelles du tenant. En production, ces requêtes
   passent par le backend (/api/ai) vers un LLM, avec le
   contexte filtré par tenant et par rôle (voir docs).
   ========================================================== */
(function () {
  'use strict';
  const { icon, esc, dec, fullName } = UI;
  const { D, S, State, currentUser } = App;
  const history = [];

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^• /gm, '<span style="color:var(--gold)">•</span> ').replace(/\n/g, '<br>');

  function findStudent(q) {
    const n = norm(q);
    return D().students.find(s => n.includes(norm(s.first + ' ' + s.last))) || D().students.find(s => n.includes(norm(s.last)) && n.includes(norm(s.first)));
  }

  function answer(q) {
    const n = norm(q), d = D(), u = currentUser();
    // --- Analyse d'un élève
    const st = findStudent(q) || (State.role === 'parent' && /analys|progres|difficult|matiere/.test(n) ? S.stu(u.childIds[0]) : null) || (State.role === 'student' && /analys|progres|matiere/.test(n) ? u : null);
    if (st && /analys|perform|progres|difficult|matiere|attention/.test(n)) {
      const a = S.averages(st); const subs = Object.entries(a.subjects).sort((x, y) => y[1].avg - x[1].avg);
      if (!subs.length) return `**${fullName(st)}** est en maternelle : l'évaluation se fait par compétences, sans moyennes chiffrées.`;
      const c = S.cls(st.classId);
      const weak = subs.filter(([sid, v]) => v.avg < S.classSubjectAvg(c, sid) - .5).slice(-3);
      return `**Analyse de ${fullName(st)}** (${c.name})\n\nMoyenne générale : **${dec(a.general)}/20** (classe : ${dec(S.classAvg(c))}) · assiduité ${Math.round(st.attendance * 100)} %\n\n**Points forts**\n${subs.slice(0, 2).map(([sid, v]) => `• ${S.subj(sid).name} : ${dec(v.avg)}/20`).join('\n')}\n\n**Matières nécessitant plus d'attention**\n${(weak.length ? weak : subs.slice(-2)).map(([sid, v]) => `• ${S.subj(sid).name} : ${dec(v.avg)}/20 (classe ${dec(S.classSubjectAvg(c, sid))})`).join('\n')}\n\n**Recommandations**\n• 2 séances de remédiation ciblées par semaine sur la matière la plus faible\n• Exercices adaptés publiés sur l'espace e-learning\n• Point d'étape avec le professeur principal dans 3 semaines`;
    }
    // --- Quiz
    if (/quiz|qcm/.test(n)) {
      const topic = (q.match(/sur (les |la |le |l')?(.+?)( niveau| pour|$)/i) || [])[2] || 'les fractions';
      return `**Quiz — ${topic}** (5 questions, niveau adapté)\n\n**1.** Quelle est la valeur de 3/4 + 1/8 ?\n   a) 4/12  b) **7/8** ✓  c) 1  d) 3/32\n**2.** Simplifier 18/24.\n   a) **3/4** ✓  b) 9/12  c) 2/3  d) 6/8\n**3.** Quelle fraction est la plus grande ?\n   a) 2/5  b) 3/10  c) **1/2** ✓  d) 4/9\n**4.** 3/5 de 40 est égal à :\n   a) 20  b) **24** ✓  c) 15  d) 30\n**5.** Vrai ou faux : 5/6 > 6/7\n   **Faux** ✓\n\nJe peux l'**ajouter directement à un cours en ligne** avec correction automatique et envoi des résultats au Learning Dashboard.`;
    }
    if (/exercice/.test(n)) return `**Série d'exercices générée** (difficulté progressive)\n\n**Échauffement**\n• Calcule : 2/3 + 1/6\n• Range dans l'ordre croissant : 3/4 ; 2/3 ; 5/6\n\n**Application**\n• Un réservoir contient 60 L. On utilise 2/5 du volume puis 1/3 du reste. Combien reste-t-il ?\n\n**Approfondissement**\n• Démontre que pour tout entier n > 0, 1/n − 1/(n+1) = 1/(n(n+1)).\n\nCorrigés détaillés inclus · temps estimé : 35 min.`;
    if (/resum/.test(n)) { const t = (q.split(':')[1] || 'ce cours').trim(); return `**Résumé — ${t}**\n\n• **Idée clé 1** : les notions fondamentales sont définies et illustrées par des exemples concrets.\n• **Idée clé 2** : les méthodes de résolution suivent une démarche en 3 étapes (analyser, appliquer, vérifier).\n• **Idée clé 3** : les erreurs fréquentes concernent l'application des règles hors de leur cadre.\n\n**À retenir** : 5 définitions, 2 théorèmes, 3 méthodes types.\n**Durée de lecture** : 4 min.`; }
    if (/fiche|revision/.test(n)) { const t = (q.split(':')[1] || 'le chapitre').trim(); return `**Fiche de révision — ${t}**\n\n**1. Définitions essentielles**\n• Notion A — définition courte et exemple\n• Notion B — définition courte et exemple\n\n**2. Méthodes**\n• Méthode 1 : étapes numérotées\n• Méthode 2 : cas particuliers\n\n**3. Pièges à éviter**\n• Confondre A et B\n• Oublier de vérifier le résultat\n\n**4. Auto-évaluation** : 5 questions flash + quiz de 10 min.\n\nExportable en PDF aux couleurs de l'établissement.`; }
    if (/rapport de classe|rapport.*classe/.test(n)) {
      const c = d.classes.find(x => n.includes(norm(x.name))) || d.classes[5];
      const sid = (d.subjects.find(s => n.includes(norm(s.name))) || {}).id || c.subjects[0];
      const studs = c.studentIds.map(S.stu).map(s => ({ s, a: (S.averages(s).subjects[sid] || {}).avg })).filter(x => x.a != null).sort((a, b) => b.a - a.a);
      return `**Rapport — ${c.name} · ${S.subj(sid).name}**\n\nMoyenne de classe : **${dec(S.classSubjectAvg(c, sid))}/20** · ${studs.filter(x => x.a >= 10).length}/${studs.length} élèves au-dessus de la moyenne.\n\n**Têtes de classe** : ${studs.slice(0, 3).map(x => x.s.first + ' ' + x.s.last[0] + '.').join(', ')}\n**À accompagner** : ${studs.slice(-3).map(x => x.s.first + ' ' + x.s.last[0] + '.').join(', ')}\n\n**Analyse** : la dispersion des notes suggère de proposer deux parcours différenciés (consolidation / approfondissement).\n**Action suggérée** : quiz diagnostique sur les notions du dernier chapitre.`;
    }
    if (/difficult|accompagn|decroch/.test(n)) {
      const list = d.students.map(s => ({ s, a: S.averages(s).general })).filter(x => x.a && x.a < 9.5).sort((a, b) => a.a - b.a).slice(0, 6);
      return `**${list.length} élèves identifiés en difficulté** (moyenne < 9,5)\n\n${list.map(x => `• ${fullName(x.s)} — ${S.cls(x.s.classId).name} · ${dec(x.a)}/20 · assiduité ${Math.round(x.s.attendance * 100)} %`).join('\n')}\n\n**Plan proposé**\n• Tutorat par les pairs 2 × 45 min / semaine\n• Parcours e-learning de remédiation personnalisé\n• Rendez-vous parents sous 15 jours\n• Suivi hebdomadaire par le professeur principal`;
    }
    if (/impaye|paiement|recouvr|finance/.test(n)) {
      if (State.role === 'parent') { const inv = u.childIds.flatMap(id => S.invoicesOf(id)).filter(i => i.status === 'En attente' || i.status === 'En retard'); return inv.length ? `Vous avez **${inv.length} paiement(s) en attente** pour un total de **${S.money(inv.reduce((a, i) => a + i.amount, 0))}**. Vous pouvez régler en ligne depuis l'onglet **Paiements** (carte, virement).` : 'Tous vos paiements sont **à jour** ✓. Vos reçus sont téléchargeables dans l\'onglet Paiements.'; }
      const late = d.invoices.filter(i => i.status === 'En retard'), pend = d.invoices.filter(i => i.status === 'En attente');
      return `**Situation financière**\n\n• Impayés : **${S.money(late.reduce((a, i) => a + i.amount, 0))}** (${late.length} factures)\n• En attente : **${S.money(pend.reduce((a, i) => a + i.amount, 0))}** (${pend.length} factures)\n• CA annuel : ${S.kmoney(d.revenue.reduce((a, b) => a + b, 0))}\n\n**Recommandation** : relance automatique J+5 (email), J+10 (SMS), puis proposition d'échéancier. Les 10 familles aux plus gros encours représentent environ 18 % des impayés.`;
    }
    if (/rapport.*direction|mensuel|synthese|kpi|indicateur/.test(n)) return `**Rapport de direction — ${UI.longDate(DB.TODAY)}**\n\n• Effectif : **${d.students.length} élèves** (+4,8 % vs N-1)\n• Présence du jour : **${dec(100 - d.todayAbsences.length / d.students.length * 100, 1)} %**\n• Moyenne générale : **${dec(S.schoolAvg())}/20**\n• Revenus du mois : **${S.kmoney(d.revenue[1])}**\n• Candidatures en cours : ${d.applications.filter(a => a.status !== 'Inscrit').length}\n• Tickets ouverts : ${d.tickets.filter(t => t.status === 'Nouveau' || t.status === 'En cours').length}\n\n**Points d'attention** : retards sur ${d.buses.filter(b => b.delay).length} ligne(s) de bus, ${d.students.filter(s => s.docsMissing.length).length} dossiers incomplets.`;
    if (/absen/.test(n)) {
      if (State.role === 'parent') return `Aucune absence aujourd'hui pour vos enfants. Pour justifier une absence passée, rendez-vous dans **Présences → Justifier** et joignez un certificat si nécessaire.`;
      return `**${d.todayAbsences.length} absences aujourd'hui**, dont **${d.todayAbsences.filter(a => !a.justified).length} non justifiées**. Les parents ont été notifiés automatiquement par SMS et notification push. ${d.todayLates.length} retards enregistrés.`;
    }
    if (/bus|transport/.test(n)) { const b = State.role === 'parent' ? S.bus((u.childIds.map(S.stu).find(k => k.bus) || {}).bus) || d.buses[0] : d.buses[0]; return `Le bus **${b.line}** est en circulation${b.delay ? ` avec **${b.delay} min de retard**` : ' à l\'heure'}. Arrivée estimée à l'école dans **${Math.max(1, Math.round((1 - b.progress) * 38 + b.delay))} min**. Suivi en direct dans l'onglet **Transport**.`; }
    if (/menu|cantine|manger|repas/.test(n)) { const m = d.menu[Math.min(4, Math.max(0, DB.TODAY.getDay() - 1))]; return `**Menu du jour** : ${m.starter} · **${m.main}** (${m.side}) · ${m.dessert}.\nOption végétarienne : ${m.veg}.`; }
    if (/vacance|conge/.test(n)) { const v = d.events.find(e => e.kind === 'Vacances'); return v ? `Les prochaines **vacances d'automne** commencent le **${UI.date(v.date)}** pour ${v.days} jours. Le calendrier complet est dans l'onglet **Calendrier**.` : 'Consultez l\'onglet Calendrier pour les prochaines vacances.'; }
    if (/horaire|heure|ouvert/.test(n)) return `L'établissement accueille les élèves de **7h30 à 17h30**. Cours de 8h00 à 16h00 (17h00 au lycée), mercredi après-midi libre. Le secrétariat est ouvert de 8h00 à 17h00.`;
    if (/inscri/.test(n)) return `Les inscriptions se font **en ligne** : formulaire → dépôt des documents → validation par l'administration → paiement des frais → confirmation. Délai moyen de traitement : **4 jours**.`;
    return `Je suis l'**assistant IA** de ${d.tenant.short}. Je peux notamment :\n\n• Générer des **exercices**, des **quiz** et des **fiches de révision**\n• **Résumer** un cours\n• **Analyser les performances** d'un élève (ex : « Analyse les performances de ${d.students[4].first} ${d.students[4].last} »)\n• Identifier les **élèves en difficulté**\n• Produire des **rapports** (classe, direction, finances)\n• Répondre aux **questions fréquentes** des parents (horaires, cantine, bus, vacances, paiements)`;
  }

  function suggestions() {
    if (State.role === 'parent') return ['Analyse les progrès de mon enfant', 'Où est le bus ?', 'Menu de la cantine', 'Mes paiements en attente', 'Prochaines vacances'];
    if (State.role === 'student') return ['Génère un quiz sur les fractions', 'Fiche de révision : la cellule', 'Analyse mes matières', 'Génère des exercices'];
    if (State.role === 'teacher') return ['Génère un quiz sur les fractions', 'Génère des exercices', 'Rapport de classe', 'Élèves en difficulté'];
    return ['Rapport de direction', 'Élèves en difficulté', 'Situation des impayés', 'Absences du jour', 'Génère un quiz sur les fractions'];
  }

  function open(prefill) {
    const el = UI.drawer(`<div class="row"><div class="dot-ic" style="background:linear-gradient(145deg,var(--navy-800),var(--navy-950));color:var(--gold-soft)">${icon('sparkles', 'sm')}</div><div><div style="font-weight:600">Assistant IA</div><div class="muted" style="font-size:11.5px">Contexte : ${App.ROLES[State.role]} · ${esc(D().tenant.short)}</div></div></div>`,
      `<div class="chat-msgs" id="aimsgs" style="height:100%"></div>`, {
        cls: 'ai-panel',
        foot: `<div class="ai-sugg" id="aisugg">${suggestions().map(s => `<button>${s}</button>`).join('')}</div><div class="chat-input"><input class="input" id="aiin" placeholder="Posez votre question…"><button class="btn btn-primary" id="aisend">${icon('send', 'sm')}</button></div><div class="muted" style="font-size:10.5px;padding:0 14px 10px">Démo : réponses générées localement à partir des données de l'école. Données filtrées par tenant & rôle.</div>`
      });
    el.style.width = '460px';
    const box = el.querySelector('#aimsgs');
    const render = () => { box.innerHTML = (history.length ? '' : `<div class="msg in">${md('Bonjour ' + currentUser().first + ' ! Comment puis-je vous aider aujourd\'hui ?')}</div>`) + history.map(h => `<div class="msg ${h[0]}" style="max-width:88%">${h[0] === 'in' ? md(h[1]) : esc(h[1])}</div>`).join(''); box.scrollTop = box.scrollHeight; };
    const ask = q => {
      if (!q.trim()) return;
      history.push(['out', q]); render();
      box.insertAdjacentHTML('beforeend', '<div class="msg in typing" id="aityping"><span></span><span></span><span></span></div>'); box.scrollTop = box.scrollHeight;
      setTimeout(() => { history.push(['in', answer(q)]); render(); }, 700 + Math.random() * 500);
    };
    el.querySelector('#aisend').onclick = () => { const i = el.querySelector('#aiin'); ask(i.value); i.value = ''; };
    el.querySelector('#aiin').onkeydown = e => { if (e.key === 'Enter') { ask(e.target.value); e.target.value = ''; } };
    el.querySelectorAll('#aisugg button').forEach(b => b.onclick = () => ask(b.textContent));
    render();
    if (prefill) ask(prefill);
  }

  window.AI = { open, answer };
})();
