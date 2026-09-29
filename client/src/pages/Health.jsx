import { Badge, Card, ErrorBox, Icon, Loader, PageHeader, Table, useFetch } from '../components/ui';
import { dateTime } from '../lib/format';

export default function Health() {
  const { data, loading, error } = useFetch('/health/visits');
  return (
    <>
      <PageHeader title="Infirmerie & santé scolaire" sub="Espace confidentiel" />
      <div className="lock mb"><Icon name="lock" /><span><b>Données de santé chiffrées (AES-256-GCM)</b> · accès réservé à l'infirmerie et à la direction · chaque consultation est tracée.</span></div>
      {loading ? <Loader /> : error ? <ErrorBox error={error} /> : (
        <Card title="Registre des passages" flush>
          <Table rows={data.data} columns={[
            { label: 'Élève', render: v => `${v.student.firstName} ${v.student.lastName}` },
            { label: 'Date', render: v => dateTime(v.visitedAt) },
            { label: 'Motif', key: 'reason' },
            { label: 'Soins', key: 'care' },
            { label: 'Type', render: v => <Badge kind={v.kind === 'accident' ? 'danger' : 'plain'}>{v.kind === 'accident' ? 'Accident' : 'Passage'}</Badge> },
            { label: 'Parents', render: v => (v.parentsNotified ? 'Notifiés' : '—') },
          ]} />
        </Card>
      )}
    </>
  );
}
