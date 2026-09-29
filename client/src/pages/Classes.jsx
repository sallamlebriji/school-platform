import { useNavigate } from 'react-router-dom';
import { Bar, ErrorBox, Loader, PageHeader, useFetch } from '../components/ui';
import { fullName } from '../lib/format';

/** Vue de composition des classes (effectif, capacité, répartition filles/garçons). */
export default function Classes() {
  const nav = useNavigate();
  const { data, loading, error } = useFetch('/classes');
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  const cycles = [...new Set(data.data.map(c => c.level.cycle))];
  return (
    <>
      <PageHeader title="Classes" sub={`${data.data.length} classes · ${data.data.reduce((a, c) => a + c.studentCount, 0)} élèves`} />
      {cycles.map(cy => (
        <div key={cy}>
          <h3 className="serif" style={{ fontSize: 19, fontWeight: 500, margin: '8px 0 12px' }}>{cy}</h3>
          <div className="grid g-4 mb">{data.data.filter(c => c.level.cycle === cy).map(c => (
            <div key={c.id} className="card hover" style={{ cursor: 'pointer' }} onClick={() => nav(`/classes/${c.id}`)}>
              <div className="card-h"><div><h3 className="serif" style={{ fontSize: 17 }}>{c.name}</h3><div className="sub">Salle {c.room ? c.room.name : '—'} · {c.mainTeacher ? fullName(c.mainTeacher.user) : '—'}</div></div></div>
              <div className="card-b">
                <div className="row between" style={{ fontSize: 12, marginBottom: 6 }}><span className="muted">Effectif</span><b>{c.studentCount}/{c.capacity}</b></div>
                <Bar value={c.studentCount} max={c.capacity} kind={c.studentCount / c.capacity > 0.95 ? 'gold' : ''} />
                <div className="row" style={{ gap: 2, marginTop: 12, height: 8, borderRadius: 4, overflow: 'hidden' }}><div style={{ flex: c.girls || 0.01, background: 'var(--c2)', height: '100%' }} /><div style={{ flex: c.studentCount - c.girls || 0.01, background: 'var(--c1)', height: '100%' }} /></div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{c.girls} filles · {c.studentCount - c.girls} garçons</div>
              </div>
            </div>
          ))}</div>
        </div>
      ))}
    </>
  );
}
