import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, ErrorBox, Loader, PageHeader, useFetch, useToast } from '../components/ui';
import { date } from '../lib/format';

const COLS = [['new', 'Nouveau'], ['review', 'En vérification'], ['accepted', 'Accepté'], ['enrolled', 'Inscrit']];

/** Pipeline d'inscription en kanban (glisser-déposer). */
export default function Enrollments() {
  const { can } = useAuth();
  const toast = useToast();
  const apps = useFetch('/enrollments?limit=200');
  const classes = useFetch('/classes');
  const [drag, setDrag] = useState(null);

  const move = async (app, status) => {
    if (app.status === status) return;
    let classId;
    if (status === 'enrolled') {
      const options = (classes.data ? classes.data.data : []).filter(c => !app.levelId || c.levelId === app.levelId);
      if (!options.length) return toast('Aucune classe disponible pour ce niveau', 'alert');
      classId = options[0].id;
    }
    try { await api.patch(`/enrollments/${app.id}/status`, { status, classId }); toast(status === 'enrolled' ? 'Élève inscrit — dossier et responsable créés' : 'Statut mis à jour'); apps.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };

  if (apps.loading) return <Loader />;
  if (apps.error) return <ErrorBox error={apps.error} />;
  return (
    <>
      <PageHeader title="Inscriptions en ligne" sub="Glissez une carte pour faire avancer un dossier" />
      <div className="kanban">{COLS.map(([k, l]) => (
        <div key={k} className="col" onDragOver={e => { if (can('enrollments:write')) { e.preventDefault(); e.currentTarget.classList.add('over'); } }} onDragLeave={e => e.currentTarget.classList.remove('over')} onDrop={e => { e.currentTarget.classList.remove('over'); if (drag) move(drag, k); setDrag(null); }}>
          <div className="col-h"><span>{l}</span><span className="badge plain">{apps.data.data.filter(a => a.status === k).length}</span></div>
          {apps.data.data.filter(a => a.status === k).map(a => (
            <div key={a.id} className="kcard" draggable onDragStart={() => setDrag(a)}>
              <div className="row between"><b style={{ fontSize: 13.5 }}>{a.studentFirstName} {a.studentLastName}</b>{a.level && <span className="badge navy plain">{a.level.name}</span>}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{a.guardianName} · {a.source}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{date(a.createdAt)} · {a.paid ? 'Frais payés' : 'Non payé'}</div>
            </div>
          ))}
        </div>
      ))}</div>
      <Card className="mt" title="Formulaire public"><p className="muted">Les familles déposent leur candidature sans compte via <code>POST /api/public/enrollments</code> (limité à 10 envois / heure / IP). La direction et la scolarité sont notifiées.</p></Card>
    </>
  );
}
