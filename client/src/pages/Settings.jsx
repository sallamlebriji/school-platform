import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthImage, Badge, Bar, Card, ErrorBox, FileUpload, Loader, PageHeader, Table, Tabs, useFetch, useToast } from '../components/ui';
import { dateTime, fullName } from '../lib/format';

export default function Settings() {
  const { reload } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('school');
  const settings = useFetch('/settings');
  const audit = useFetch(tab === 'audit' ? '/audit?limit=100' : null);
  const sessions = useFetch(tab === 'security' ? '/auth/sessions' : null);
  const deliveries = useFetch(tab === 'deliveries' ? '/notifications/deliveries?limit=150' : null);
  const [logo, setLogo] = useState(null);
  const [f, setF] = useState(null);
  const [twofa, setTwofa] = useState(null);
  const [code, setCode] = useState('');

  useEffect(() => { if (settings.data) { const t = settings.data.tenant; setF({ name: t.name, city: t.city, primaryColor: t.primaryColor, grading: { ranking: true, dropLowest: false, decimals: 2, passMark: 10, ...((t.settings || {}).grading || {}) } }); } }, [settings.data]);
  if (settings.loading || !f) return <Loader />;
  if (settings.error) return <ErrorBox error={settings.error} />;
  const { usage, tenant } = settings.data;

  const save = async () => {
    try { await api.patch('/settings', { name: f.name, city: f.city, primaryColor: f.primaryColor, settings: { grading: f.grading }, ...(logo ? { logoFileId: logo.id } : {}) }); setLogo(null); settings.reload(); toast('Paramètres enregistrés — moyennes recalculées avec les nouvelles règles'); reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const setup2fa = async () => { const { data } = await api.post('/auth/2fa/setup'); setTwofa(data); };
  const enable2fa = async () => { try { await api.post('/auth/2fa/enable', { code }); toast('Double authentification activée', 'shield'); setTwofa(null); } catch (e) { toast(errorMessage(e), 'alert'); } };

  return (
    <>
      <PageHeader title="Paramètres" sub={`${tenant.name} · plan ${tenant.plan.name}`} />
      <Tabs value={tab} onChange={setTab} items={[['school', 'Établissement'], ['grading', 'Règles de notes'], ['deliveries', 'Envois'], ['security', 'Sécurité'], ['audit', "Journal d'audit"], ['plan', 'Abonnement']]} />
      {tab === 'school' && (
        <Card title="Identité de l'établissement">
          <div className="form-grid">
            <div className="field"><label>Nom</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
            <div className="field"><label>Ville</label><input className="input" value={f.city || ''} onChange={e => setF({ ...f, city: e.target.value })} /></div>
            <div className="field"><label>Couleur principale</label><div className="row">{['#13254A', '#5A2E3A', '#2E5E4E', '#3F2E5A', '#7A5A2E'].map(c => <button key={c} onClick={() => setF({ ...f, primaryColor: c })} style={{ width: 34, height: 34, borderRadius: 10, background: c, border: `3px solid ${f.primaryColor === c ? 'var(--gold)' : 'transparent'}`, cursor: 'pointer' }} />)}</div></div>
            <div className="field"><label>Domaine</label><input className="input" value={tenant.customDomain || `${tenant.slug}.athenee.app`} disabled /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Logo (PDF, emails, application)</label>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                {tenant.logoUrl && !logo && <AuthImage src={tenant.logoUrl} style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'contain', border: '1px solid var(--line)' }} />}
                <div style={{ flex: 1 }}><FileUpload kind="logo" accept=".png,.jpg,.jpeg,.webp" value={logo} onUploaded={setLogo} onClear={() => setLogo(null)} label="Choisir un logo" hint="PNG, JPG ou WebP — 10 Mo max · idéalement carré, fond transparent" /></div>
              </div>
            </div>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={save}>Enregistrer</button></div>
        </Card>
      )}
      {tab === 'grading' && (
        <Card title="Calcul des moyennes" sub="Appliqué à toutes les classes, bulletins et espaces parents">
          {[['ranking', 'Afficher le classement interne'], ['dropLowest', 'Ignorer la plus mauvaise note (≥ 4 évaluations)']].map(([k, l]) => (
            <div key={k} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}><span>{l}</span><button className={`switch ${f.grading[k] ? 'on' : ''}`} onClick={() => setF({ ...f, grading: { ...f.grading, [k]: !f.grading[k] } })} /></div>
          ))}
          <div className="form-grid mt"><div className="field"><label>Décimales</label><input className="input" type="number" min="0" max="3" value={f.grading.decimals} onChange={e => setF({ ...f, grading: { ...f.grading, decimals: Number(e.target.value) } })} /></div><div className="field"><label>Seuil de réussite</label><input className="input" type="number" value={f.grading.passMark} onChange={e => setF({ ...f, grading: { ...f.grading, passMark: Number(e.target.value) } })} /></div></div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={save}>Enregistrer</button></div>
        </Card>
      )}
      {tab === 'security' && (
        <div className="grid g-2">
          <Card title="Double authentification (2FA)">
            {twofa ? <div className="stack"><p className="muted">Ajoutez ce compte dans Google Authenticator / Authy avec la clé :</p><code style={{ background: 'var(--beige-50)', padding: 10, borderRadius: 8, wordBreak: 'break-all' }}>{twofa.secret}</code><div className="field"><label>Code à 6 chiffres</label><input className="input" value={code} onChange={e => setCode(e.target.value)} /></div><button className="btn btn-primary" onClick={enable2fa}>Activer</button></div>
              : <><p className="muted mb">Protégez votre compte avec un code temporaire à chaque connexion.</p><button className="btn btn-primary" onClick={setup2fa}>Configurer la 2FA</button></>}
          </Card>
          <Card title="Sessions actives" flush>
            <Table rows={sessions.data || []} columns={[{ label: 'Appareil', render: s => (s.userAgent || '').slice(0, 40) }, { label: 'IP', key: 'ip' }, { label: 'Ouverte', render: s => dateTime(s.createdAt) }, { label: '', render: s => <button className="btn btn-sm btn-ghost" onClick={async () => { await api.delete(`/auth/sessions/${s.id}`); sessions.reload(); }}>Révoquer</button> }]} />
          </Card>
        </div>
      )}
      {tab === 'deliveries' && (
        <Card title="Historique des envois" sub="Emails, notifications push et SMS envoyés aux familles et au personnel" flush>
          {deliveries.data && (
            <>
              <div className="row wrap" style={{ gap: 6, padding: '0 20px 12px' }}>{deliveries.data.stats.map(x => <Badge key={x.channel + x.status} kind={x.status === 'sent' ? 'success' : x.status === 'failed' ? 'danger' : 'plain'}>{x.channel} · {x.status} · {x.n}</Badge>)}</div>
              <Table rows={deliveries.data.data} columns={[
                { label: 'Date', render: d => dateTime(d.createdAt) }, { label: 'Destinataire', render: d => (d.user ? fullName(d.user) : '—') },
                { label: 'Canal', key: 'channel' }, { label: 'Fournisseur', key: 'provider' },
                { label: 'Statut', render: d => <Badge kind={d.status === 'sent' ? 'success' : d.status === 'failed' ? 'danger' : 'plain'}>{{ sent: 'Envoyé', failed: 'Échec', skipped: 'Ignoré' }[d.status]}</Badge> },
                { label: 'Détail', render: d => <span className="muted" style={{ fontSize: 12 }}>{d.error || d.destination || ''}</span> },
              ]} />
            </>
          )}
        </Card>
      )}
      {tab === 'audit' && (
        <Card title="Journal d'audit" sub="Toutes les écritures et les accès sensibles" flush>
          {audit.data && <Table rows={audit.data.data} columns={[{ label: 'Date', render: a => dateTime(a.createdAt) }, { label: 'Action', key: 'action' }, { label: 'Utilisateur', render: a => (a.user ? fullName(a.user) : '—') }, { label: 'Code', key: 'statusCode' }, { label: 'IP', key: 'ip' }]} />}
        </Card>
      )}
      {tab === 'plan' && (
        <Card title={`Plan ${tenant.plan.name}`}>
          <div className="row between" style={{ fontSize: 13, marginBottom: 6 }}><span>Élèves inscrits</span><b>{usage.students} / {usage.maxStudents || '∞'}</b></div>
          <Bar value={usage.students} max={usage.maxStudents || usage.students} kind="gold" />
          <div className="row wrap mt" style={{ gap: 8 }}>{Object.entries(tenant.plan.features).map(([k, v]) => <span key={k} className={`badge ${v ? 'success' : 'plain'}`}>{k}</span>)}</div>
        </Card>
      )}
    </>
  );
}
