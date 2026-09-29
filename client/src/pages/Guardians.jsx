import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ErrorBox, Icon, PageHeader, Table, Who, useFetch } from '../components/ui';

export default function Guardians() {
  const [q, setQ] = useState('');
  const { data, error } = useFetch(`/guardians?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  return (
    <>
      <PageHeader title="Parents" sub={data ? `${data.total} responsables légaux` : ''} />
      <div className="card">
        <div className="toolbar"><div className="input-ic" style={{ flex: 1 }}><Icon name="search" size={15} /><input className="input" style={{ width: '100%' }} placeholder="Nom, email, téléphone…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
        {error ? <ErrorBox error={error} /> : <Table rows={data ? data.data : []} columns={[
          { label: 'Parent', render: g => <Who person={g} sub={g.job} /> },
          { label: 'Lien', key: 'relation' },
          { label: 'Enfants', render: g => g.childLinks.map(l => <Link key={l.id} to={`/students/${l.student.id}`} className="badge navy plain" style={{ margin: 2 }}>{l.student.firstName} · {l.student.class ? l.student.class.name : ''}</Link>) },
          { label: 'Contact', render: g => <div style={{ fontSize: 12.5 }}>{g.phone}<div className="muted">{g.email}</div></div> },
          { label: 'Espace parent', render: g => (g.user ? <Badge status={g.user.status} /> : <Badge kind="plain">Sans compte</Badge>) },
        ]} />}
      </div>
    </>
  );
}
