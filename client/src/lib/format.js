const nf = new Intl.NumberFormat('fr-FR');
export const num = v => nf.format(Math.round(v || 0));
export const money = (cents, cur = 'MAD') => `${nf.format(Math.round((cents || 0) / 100))} ${cur === 'MAD' ? 'DH' : cur}`;
export const kmoney = (cents, cur = 'MAD') => { const v = (cents || 0) / 100; return v >= 1e6 ? `${(v / 1e6).toFixed(2).replace('.', ',')} M ${cur === 'MAD' ? 'DH' : cur}` : v >= 1e4 ? `${nf.format(Math.round(v / 1000))} k ${cur === 'MAD' ? 'DH' : cur}` : money(cents, cur); };
export const dec = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d).replace('.', ','));
export const date = s => (s ? new Date(String(s).length === 10 ? `${s}T12:00:00` : s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = s => (s ? new Date(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fullName = p => (p ? `${p.firstName} ${p.lastName}` : '—');
export const initials = p => (p ? `${(p.firstName || '?')[0]}${(p.lastName || '')[0] || ''}`.toUpperCase() : '?');
export const gradeColor = g => (g == null ? 'var(--ink-3)' : g >= 16 ? 'var(--success)' : g >= 12 ? 'var(--navy-700)' : g >= 10 ? 'var(--warning)' : 'var(--danger)');
export const today = () => new Date().toISOString().slice(0, 10);

export const STATUS = {
  paid: ['Payé', 'success'], due: ['En attente', 'warning'], overdue: ['En retard', 'danger'], cancelled: ['Annulé', 'plain'],
  new: ['Nouveau', 'info'], review: ['En vérification', 'warning'], accepted: ['Accepté', 'navy'], enrolled: ['Inscrit', 'success'], rejected: ['Refusé', 'danger'],
  in_progress: ['En cours', 'warning'], resolved: ['Résolu', 'success'], closed: ['Fermé', 'plain'],
  present: ['Présent', 'success'], absent: ['Absent', 'danger'], late: ['Retard', 'warning'],
  todo: ['À faire', 'plain'], submitted: ['Rendu', 'info'], graded: ['Corrigé', 'success'],
  open: ['Ouvert', 'warning'], returned: ['Récupéré', 'success'], lost: ['Perdu', 'danger'], found: ['Trouvé', 'info'],
  in_service: ['En circulation', 'success'], parked: ['Au dépôt', 'plain'], maintenance: ['Maintenance', 'warning'],
  active: ['Actif', 'success'], invited: ['Invité', 'warning'], disabled: ['Désactivé', 'plain'],
};
export const ROLES = { admin: 'Direction', staff: 'Scolarité', accountant: 'Comptabilité', teacher: 'Enseignant', nurse: 'Infirmerie', parent: 'Parent', student: 'Élève', driver: 'Transport' };
