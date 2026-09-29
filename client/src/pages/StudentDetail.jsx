import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { openPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Avatar, Badge, Card, Empty, ErrorBox, Icon, Loader, Table, Tabs, useFetch } from '../components/ui';
import { date, dec, fullName, gradeColor, money } from '../lib/format';

/** Fiche élève 360° */
export default function StudentDetail() {
  const { id } = useParams();
  const { session } = useAuth();
  const [tab, setTab] = useState('overview');
  const { data: s, loading, error } = useFetch(`/students/${id}`);
  const subjects = useFetch('/subjects?limit=50');
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  const subjName = sid => { const x = subjects.data && subjects.data.data.find(v => Number(v.id) === Number(sid)); return x ? x.name : sid; };
  const avg = s.averages || {};
  const age = Math.floor((Date.now() - new Date(s.birthDate)) / 31557600000);

  return (
    <>
      <div className="crumbs"><Link to="/students">Élèves</Link><Icon name="right" size={13} /><span>{fullName(s)}</span></div>
      <div className="card mb" style={{ overflow: 'hidden' }}>
        <div style={{ height: 70, background: 'linear-gradient(120deg,var(--navy-800),var(--navy-950))' }} />
        <div className="hero-360" style={{ marginTop: -40, paddingTop: 0, alignItems: 'flex-end' }}>
          <div style={{ border: '4px solid var(--paper)', borderRadius: '50%' }}><Avatar person={s} size="xl" /></div>
          <div style={{ flex: 1, paddingTop: 48 }}>
            <h1 className="serif" style={{ fontSize: 28, fontWeight: 500 }}>{fullName(s)}</h1>
            <div className="meta"><span>{s.class ? s.class.name : '—'}</span><span>{age} ans</span><span>{s.matricule}</span>{s.busAssignment && <span>{s.busAssignment.bus.lineName}</span>}</div>
          </div>
          <div className="row" style={{ paddingBottom: 4 }}>
            <button className="btn btn-ghost" onClick={() => openPdf(`/documents/certificate/${s.id}`)}><Icon name="documents" size={15} /> Certificat</button>
            <button className="btn btn-primary" onClick={() => openPdf(`/students/${s.id}/report-card.pdf`)}><Icon name="download" size={15} /> Bulletin</button>
          </div>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[['overview', "Vue d'ensemble"], ['grades', 'Notes'], ['attendance', 'Absences & retards'], ['finance', 'Paiements'], ['health', 'Santé']]} />

      {tab === 'overview' && (
        <div className="grid g-main">
          <div className="stack">
            <div className="grid g-3">
              <div className="card kpi"><span className="kpi-label">Moyenne générale</span><span className="kpi-val" style={{ color: gradeColor(avg.general) }}>{dec(avg.general)}<small>/20</small></span><span className="kpi-foot">Classe : {dec(avg.classAverage)}</span></div>
              <div className="card kpi"><span className="kpi-label">Classement</span><span className="kpi-val">{avg.rank || '—'}<small>{avg.of ? `/ ${avg.of}` : ''}</small></span></div>
              <div className="card kpi"><span className="kpi-label">Absences / retards</span><span className="kpi-val">{s.attendance.filter(a => a.status === 'absent').length}<small>/ {s.attendance.filter(a => a.status === 'late').length}</small></span></div>
            </div>
            <Card title="Informations">
              <div className="info-grid">
                {[['Date de naissance', date(s.birthDate)], ['Sexe', s.gender === 'F' ? 'Féminin' : 'Masculin'], ['Adresse', s.address || '—'], ['Inscrit(e) le', date(s.enrolledOn)], ['Professeur principal', s.class && s.class.mainTeacher ? fullName(s.class.mainTeacher.user) : '—'], ['Cantine', s.usesCanteen ? 'Oui' : 'Non']].map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
              </div>
            </Card>
            <Card title="Activités" flush><div className="list">{s.activities.length ? s.activities.map(a => <div className="li" key={a.id}><div className="grow"><div className="t">{a.activity.name}</div><div className="s">{a.activity.schedule}</div></div></div>) : <Empty>Aucune activité</Empty>}</div></Card>
          </div>
          <Card title="Parents & contacts d'urgence">
            <div className="stack" style={{ gap: 14 }}>{s.guardianLinks.map(l => (
              <div className="row" key={l.id} style={{ alignItems: 'flex-start' }}><Avatar person={l.guardian} /><div><div style={{ fontWeight: 500 }}>{fullName(l.guardian)} <span className="muted">· {l.guardian.relation}</span></div><div className="muted" style={{ fontSize: 12 }}>{l.guardian.phone} · {l.guardian.email}</div>{l.isEmergency && <span className="badge danger plain" style={{ marginTop: 4 }}>Contact d'urgence</span>}</div></div>
            ))}</div>
          </Card>
        </div>
      )}

      {tab === 'grades' && (
        <Card title="Résultats par matière" sub="Moyennes pondérées selon les règles de l'établissement" flush>
          <Table rows={Object.entries(avg.subjects || {}).map(([sid, v]) => ({ id: sid, ...v }))} columns={[
            { label: 'Matière', render: r => subjName(r.id) },
            { label: 'Notes', render: r => r.grades.map((g, i) => <span key={i} className="badge plain" style={{ marginRight: 4, background: 'var(--beige-50)', color: gradeColor(g.value) }} title={g.title}>{dec(g.value, 1)}</span>) },
            { label: 'Moyenne', num: true, render: r => <b style={{ color: gradeColor(r.average) }}>{dec(r.average)}</b> },
          ]} />
        </Card>
      )}

      {tab === 'attendance' && (
        <Card flush><Table rows={s.attendance} columns={[{ label: 'Date', render: a => date(a.onDate) }, { label: 'Type', render: a => <Badge status={a.status} /> }, { label: 'Motif', render: a => a.reason || '—' }, { label: 'Justifiée', render: a => (a.status === 'absent' ? <Badge kind={a.justified ? 'success' : 'danger'}>{a.justified ? 'Oui' : 'Non'}</Badge> : '—') }]} empty="Aucune absence ni retard" /></Card>
      )}

      {tab === 'finance' && (
        <Card flush><Table rows={s.invoices} columns={[{ label: 'Facture', key: 'number' }, { label: 'Libellé', key: 'label' }, { label: 'Échéance', render: i => date(i.dueOn) }, { label: 'Montant', num: true, render: i => money(i.amountCents, session.tenant.currency) }, { label: 'Statut', render: i => <Badge status={i.status} /> }, { label: '', render: i => i.status === 'paid' && <button className="btn btn-sm btn-ghost" onClick={() => openPdf(`/finance/invoices/${i.id}/receipt.pdf`)}><Icon name="download" size={14} /> Reçu</button> }]} empty="Accès finance non autorisé ou aucune facture" /></Card>
      )}

      {tab === 'health' && (s.health
        ? <><div className="lock mb"><Icon name="lock" /><span>Données chiffrées — cette consultation a été enregistrée dans le journal d'audit.</span></div><Card title="Dossier médical"><div className="info-grid">{[['Groupe sanguin', s.health.bloodType], ['Allergies', s.health.allergies || 'Aucune'], ['Régime', s.health.diet || 'Standard'], ['Notes', s.health.notes || '—']].map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div></Card></>
        : <div className="lock"><Icon name="lock" /><span>Accès réservé à l'infirmerie et à la direction (ou aucun dossier médical).</span></div>)}
    </>
  );
}
