// Dictionnaire de référence (français). Toute nouvelle clé doit être ajoutée ici d'abord.
export default {
  // Navigation
  'nav.section.pilotage': 'Pilotage', 'nav.section.community': 'Communauté', 'nav.section.pedagogy': 'Pédagogie',
  'nav.section.life': 'Vie scolaire', 'nav.section.exchanges': 'Échanges', 'nav.section.admin': 'Administration',
  'nav.dashboard': 'Tableau de bord', 'nav.analytics': 'Analytics', 'nav.students': 'Élèves', 'nav.guardians': 'Parents',
  'nav.teachers': 'Enseignants', 'nav.enrollments': 'Inscriptions', 'nav.classes': 'Classes', 'nav.timetable': 'Emploi du temps',
  'nav.attendance': 'Présences', 'nav.grades': 'Notes & évaluations', 'nav.homework': 'Devoirs', 'nav.courses': 'Cours en ligne',
  'nav.library': 'Bibliothèque', 'nav.transport': 'Transport', 'nav.canteen': 'Cantine', 'nav.activities': 'Activités',
  'nav.health': 'Infirmerie', 'nav.lost': 'Objets perdus', 'nav.messages': 'Communication', 'nav.announcements': 'Annonces',
  'nav.calendar': 'Calendrier', 'nav.finance': 'Finance', 'nav.payments': 'Paiements', 'nav.support': 'Support',
  'nav.settings': 'Paramètres', 'nav.account': 'Mon compte',

  // Mise en page
  'layout.plan': 'Plan', 'layout.logout': 'Quitter', 'layout.notifications': 'Notifications', 'layout.noNotifications': 'Aucune notification',
  'layout.ai': 'Assistant IA', 'layout.language': 'Langue',
  'role.admin': 'Direction', 'role.staff': 'Scolarité', 'role.accountant': 'Comptabilité', 'role.teacher': 'Enseignant',
  'role.nurse': 'Infirmerie', 'role.parent': 'Parent', 'role.student': 'Élève', 'role.driver': 'Transport',

  // Commun
  'common.cancel': 'Annuler', 'common.save': 'Enregistrer', 'common.send': 'Envoyer', 'common.add': 'Ajouter', 'common.loading': 'Chargement…',
  'common.empty': 'Aucune donnée', 'common.noResults': 'Aucun résultat', 'common.previous': 'Précédent', 'common.next': 'Suivant',
  'common.page': 'Page {n}/{total}', 'common.search': 'Rechercher…', 'common.download': 'Télécharger', 'common.close': 'Fermer',
  'common.upload': 'Ajouter un fichier', 'common.uploading': 'Envoi…', 'common.fileHint': 'PDF, image, Word ou Excel — {max} Mo max',
  'common.remove': 'Retirer', 'common.date': 'Date', 'common.status': 'Statut', 'common.student': 'Élève', 'common.amount': 'Montant',
  'common.reason': 'Motif', 'common.type': 'Type', 'common.subject': 'Matière', 'common.class': 'Classe', 'common.average': 'Moyenne',

  // Connexion
  'login.title': 'Connexion', 'login.subtitle': "Accédez à l'espace de votre établissement.", 'login.school': 'Établissement',
  'login.email': 'Email', 'login.password': 'Mot de passe', 'login.code': 'Code de vérification (2FA)', 'login.submit': 'Se connecter',
  'login.submitting': 'Connexion…', 'login.demo': 'Comptes de démonstration (mot de passe dans le README) :',
  'login.hero1': 'Toute votre école.', 'login.hero2': 'Une seule plateforme.',
  'login.heroText': 'Élèves, enseignants, parents, cours, transport, paiements et communication depuis un espace unique.',
  'login.trust': 'Données isolées par établissement · Chiffrement · 2FA',

  // Tableau de bord
  'dash.hello': 'Bonjour, {name}', 'dash.evening': 'Bonsoir, {name}', 'dash.children': 'Suivi de {n} enfant(s)',
  'dash.average': 'Moyenne générale', 'dash.rank': 'Classement', 'dash.present': 'Présent(e)', 'dash.absentToday': "Absent(e) aujourd'hui",
  'dash.stop': 'Arrêt : {name}', 'dash.dueOn': 'pour le {date}', 'dash.pendingPayments': '{n} paiement(s) en attente',
  'dash.announcements': 'Annonces', 'dash.menu': 'Menu du jour', 'dash.noMenu': "Pas de menu aujourd'hui", 'dash.events': 'Prochains événements',
  'dash.todo': "À traiter aujourd'hui", 'dash.todoSub': 'Priorités opérationnelles', 'dash.revenue': 'Revenus encaissés',
  'dash.revenueSub': '12 derniers mois', 'dash.byCycle': 'Répartition des élèves', 'dash.enrollments': 'Évolution des inscriptions',
  'dash.recent': 'Activité récente', 'dash.rollCall': "Faire l'appel", 'dash.todayClasses': "Mon emploi du temps du jour",
  'dash.noClassToday': "Pas de cours aujourd'hui", 'dash.toGrade': '{n} à corriger', 'dash.upToDate': 'À jour',

  // Présences (familles)
  'att.title': 'Absences & retards', 'att.sub': "Suivi de l'assiduité", 'att.justify': 'Justifier', 'att.justified': 'Justifiée',
  'att.justifyTitle': 'Justifier une absence', 'att.proof': 'Justificatif (certificat médical…)', 'att.sent': 'Justificatif transmis à la vie scolaire',
  'att.none': 'Aucune absence ni retard', 'att.reason.sick': 'Maladie', 'att.reason.medical': 'Rendez-vous médical', 'att.reason.family': 'Raison familiale', 'att.reason.other': 'Autre',
  'status.absent': 'Absence', 'status.late': 'Retard', 'status.present': 'Présent',

  // Notes (familles)
  'grades.title': 'Notes & bulletins', 'grades.reportCard': 'Bulletin PDF', 'grades.classAverage': 'Moyenne de la classe',
  'grades.bySubject': 'Résultats par matière', 'grades.notes': 'Notes', 'grades.fullProfile': 'Voir la fiche complète →',

  // Devoirs
  'hw.title': 'Devoirs', 'hw.sub': 'Rappels automatiques avant la date limite', 'hw.deadline': 'Date limite', 'hw.submit': 'Rendre',
  'hw.submitTitle': 'Rendre mon devoir', 'hw.submitted': 'Devoir rendu', 'hw.file': 'Votre travail (PDF, Word, photo)', 'hw.submissions': 'Rendus',
  'hw.todo': 'À faire', 'hw.done': 'Rendu', 'hw.graded': 'Corrigé', 'hw.lateStatus': 'En retard',

  // Paiements
  'pay.title': 'Paiements', 'pay.sub': 'Factures, échéances et reçus', 'pay.payOnline': 'Payer en ligne', 'pay.receipt': 'Reçu',
  'pay.invoice': 'Facture', 'pay.label': 'Libellé', 'pay.due': 'Échéance', 'pay.redirecting': 'Redirection vers la page de paiement sécurisée…',
  'pay.secure': 'Paiement sécurisé', 'pay.secureText': "Vos données bancaires sont saisies chez le prestataire de paiement et ne transitent jamais par l'école.",
  'pay.simTitle': 'Paiement de démonstration', 'pay.simText': "Aucune clé de paiement n'est configurée : cette page simule la banque. En production, vous serez redirigé vers Stripe ou CMI.",
  'pay.simPay': 'Simuler un paiement accepté', 'pay.simFail': 'Simuler un refus', 'pay.success': 'Paiement confirmé — merci !',
  'pay.failed': "Le paiement n'a pas abouti.", 'pay.pending': 'Paiement en cours de confirmation…', 'pay.back': 'Retour aux paiements',
  'inv.paid': 'Payé', 'inv.due': 'En attente', 'inv.overdue': 'En retard', 'inv.cancelled': 'Annulé',

  // Transport
  'bus.title': 'Transport scolaire', 'bus.sub': 'Suivi GPS en temps réel', 'bus.lines': 'Lignes', 'bus.eta': 'Arrivée estimée',
  'bus.students': '{n} élèves', 'bus.delay': '+{n} min', 'bus.onTime': "À l'heure", 'bus.none': 'Aucun bus associé à votre compte.',
  'bus.live': 'Positions mises à jour en direct', 'bus.driver': 'Chauffeur',

  // Cantine, calendrier, annonces
  'canteen.title': 'Cantine', 'canteen.sub': 'Menu de la semaine', 'canteen.none': 'Aucun menu publié',
  'cal.title': 'Calendrier scolaire', 'cal.sub': 'Vacances, examens, réunions, sorties', 'cal.today': "Aujourd'hui", 'cal.new': 'Événement',
  'cal.days': 'Lun,Mar,Mer,Jeu,Ven,Sam,Dim', 'cal.upcoming': 'À venir', 'cal.eventTitle': 'Titre', 'cal.kind': 'Type', 'cal.start': 'Début', 'cal.end': 'Fin',
  'ann.title': 'Annonces', 'ann.sub': 'Diffusées par application, email, push et SMS',

  // Messagerie
  'msg.title': 'Communication', 'msg.sub': 'Parents, enseignants et administration', 'msg.placeholder': 'Écrire un message…',
  'msg.none': 'Aucune conversation', 'msg.pick': 'Sélectionnez une conversation',

  // Compte & notifications
  'account.title': 'Mon compte', 'account.sub': 'Langue, notifications et sécurité', 'account.language': "Langue de l'interface",
  'account.notifications': 'Canaux de notification', 'account.notificationsSub': "Les alertes importantes (absence, bus, paiement) vous sont aussi envoyées par ces canaux.",
  'account.email': 'Email', 'account.push': 'Notifications sur cet appareil', 'account.sms': 'SMS (alertes urgentes)', 'account.phone': 'Téléphone pour les SMS',
  'account.pushEnable': 'Activer sur cet appareil', 'account.pushOn': 'Activées sur cet appareil', 'account.pushUnsupported': 'Votre navigateur ne prend pas en charge les notifications push.',
  'account.pushDenied': 'Les notifications sont bloquées dans les réglages du navigateur.', 'account.pushDisabled': "Notifications push non configurées sur le serveur (clés VAPID).",
  'account.saved': 'Préférences enregistrées',
};
