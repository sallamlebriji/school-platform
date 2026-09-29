import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, ErrorBox, Icon, Kpi, Loader, PageHeader, Table, Who, useFetch } from '../components/ui';
import { dec, fullName, gradeColor } from '../lib/format';

export default function ClassDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: c, loading, error } = useFetch(`/classes/${id}`);
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  const avg = c.averages || { students: {} };
  return (
    <>
      <PageHeader crumbs={<><Link to="/classes">Classes</Link><Icon name="right" size={13} /><span>{c.name}</span></>} title={`Classe ${c.name}`} sub={`${c.level.cycle} · Salle ${c.room ? c.room.name : '—'}`}
        actions={<><button className="btn btn-ghost" onClick={() => nav(`/timetable?classId=${c.id}`)}><Icon name="timetable" size={15} /> Emploi du temps</button><button className="btn btn-primary" onClick={() => nav(`/attendance?classId=${c.id}`)}><Icon name="attendance" size={15} /> Faire l'appel</button></>} />
      <div className="grid g-3 mb">
        <Kpi label="Effectif" value={<>{c.students.length}<small>/ {c.capacity}</small></>} icon="students" />
        <Kpi label="Moyenne de la classe" value={<>{dec(avg.classAverage)}<small>/20</small></>} icon="grades" />
        <Kpi label="Matières" value={c.classSubjects.length} icon="library" gold />
      </div>
      <div className="grid g-main">
        <Card title="Élèves" flush>
          <Table rows={c.students} onRowClick={s => nav(`/students/${s.id}`)} columns={[
            { label: 'Élève', render: s => <Who person={s} sub={s.matricule} /> },
            { label: 'Moyenne', num: true, render: s => { const a = avg.students[s.id]; return <b style={{ color: gradeColor(a && a.general) }}>{dec(a && a.general)}</b>; } },
            { label: 'Rang', num: true, render: s => (avg.students[s.id] && avg.students[s.id].rank) || '—' },
          ]} />
        </Card>
        <Card title="Matières & enseignants" flush>
          <div className="list">{c.classSubjects.map(cs => <div className="li" key={cs.id}><i style={{ width: 4, height: 32, borderRadius: 2, background: cs.subject.color }} /><div className="grow"><div className="t">{cs.subject.name}</div><div className="s">{cs.teacher ? fullName(cs.teacher.user) : '—'} · {cs.weeklyHours} h/sem · coef {cs.subject.coefficient}</div></div></div>)}</div>
        </Card>
      </div>
    </>
  );
}
