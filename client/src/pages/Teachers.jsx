import { Avatar, Badge, ErrorBox, Loader, PageHeader, useFetch } from '../components/ui';
import { date, fullName } from '../lib/format';

export default function Teachers() {
  const { data, loading, error } = useFetch('/teachers');
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader title="Enseignants" sub={`${data.data.length} enseignants`} />
      <div className="grid g-4">{data.data.map(t => (
        <div key={t.id} className="card hover" style={{ padding: 20 }}>
          <div className="row between"><Avatar person={t.user} size="lg" /><Badge kind={t.status === 'active' ? 'success' : 'danger'}>{t.status === 'active' ? 'Actif' : t.status === 'absent' ? 'Absent' : 'Parti'}</Badge></div>
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 14 }}>{fullName(t.user)}</div>
          {t.subject && <div className="row" style={{ gap: 6, marginTop: 4, fontSize: 12.5, color: t.subject.color }}><i style={{ width: 7, height: 7, borderRadius: 2, background: t.subject.color }} />{t.subject.name}</div>}
          <div className="divider" />
          <div className="muted" style={{ fontSize: 12.5 }}>{t.classCount} classes · depuis {date(t.hiredOn)}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t.user.email}</div>
        </div>
      ))}</div>
    </>
  );
}
