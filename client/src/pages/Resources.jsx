import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { AuthImage, Badge, Card, Empty, ErrorBox, FileUpload, Icon, Loader, Modal, PageHeader, Table, useFetch, useToast } from '../components/ui';
import { date, dateTime, money } from '../lib/format';

/**
 * Pages "catalogue" construites sur les endpoints CRUD génériques.
 */
function ResourceList({ title, sub, path, columns, filters, createFields, createPerm, onCreate, cards, reloadKey }) {
  const { can } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({});
  const url = `${path}${path.includes('?') ? '&' : '?'}limit=100${filter ? `&${filter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const list = useFetch(url, [reloadKey]);
  const rows = list.data ? list.data.data : [];

  const save = async () => {
    try { await api.post(path.split('?')[0], onCreate ? onCreate(form) : form); toast(t('common.save')); setCreating(false); setForm({}); list.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };

  return (
    <>
      <PageHeader title={title} sub={sub} actions={createFields && can(createPerm) && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> {t('common.add')}</button>} />
      <div className="card mb"><div className="toolbar" style={{ border: 0 }}>
        <div className="input-ic" style={{ flex: 1, minWidth: 200 }}><Icon name="search" size={15} /><input className="input" style={{ width: '100%' }} placeholder={t('common.search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        {filters && <div className="pill-filter">{filters.map(([v, l]) => <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>)}</div>}
      </div></div>
      {list.error ? <ErrorBox error={list.error} /> : list.loading ? <Loader /> : cards ? <div className="grid g-3">{rows.map(r => cards(r, list.reload))}{!rows.length && <Empty />}</div> : <Card flush><Table rows={rows} columns={columns} /></Card>}
      {creating && (
        <Modal title={`${t('common.add')} — ${title}`} onClose={() => setCreating(false)} footer={<><button className="btn btn-ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={save}>{t('common.save')}</button></>}>
          <div className="form-grid">{createFields.map(f => (
            <div className="field" key={f.key} style={f.wide || f.file ? { gridColumn: '1/-1' } : undefined}><label>{f.label}</label>
              {f.file ? <FileUpload kind={f.file} accept={f.accept} hint={f.hint} value={form[f.key]} onUploaded={v => setForm({ ...form, [f.key]: v })} onClear={() => setForm({ ...form, [f.key]: null })} />
                : f.options ? <select className="select" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}><option value="">—</option>{f.options.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}</select>
                  : <input className="input" type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />}
            </div>
          ))}</div>
        </Modal>
      )}
    </>
  );
}

export const Library = () => (
  <ResourceList title="Bibliothèque numérique" sub="Livres, manuels, PDF, vidéos et supports de cours" path="/library" createPerm="library:write"
    filters={[['', 'Tous'], ['kind=Livre', 'Livres'], ['kind=Manuel', 'Manuels'], ['kind=PDF', 'PDF'], ['kind=Vidéo', 'Vidéos']]}
    createFields={[{ key: 'title', label: 'Titre', wide: true }, { key: 'author', label: 'Auteur' }, { key: 'kind', label: 'Type', options: ['Livre', 'Manuel', 'PDF', 'Vidéo', 'Support de cours', 'Référence'] }]}
    cards={b => <div key={b.id} className="card hover" style={{ padding: 16, display: 'flex', gap: 14 }}><div className="cover" style={{ width: 70, background: 'linear-gradient(160deg,#1D3462,#1D3462cc)' }}><span style={{ fontSize: 9 }}>{b.kind}</span></div><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{b.title}</div><div className="muted" style={{ fontSize: 12.5 }}>{b.author}</div><div className="muted" style={{ fontSize: 12 }}>{b.subject ? b.subject.name : ''} · {b.downloads} téléchargements</div></div></div>} />
);

export function Courses() {
  const nav = useNavigate();
  return (
    <ResourceList title="Cours en ligne" sub="Cours, chapitres, vidéos, exercices et quiz" path="/courses" createPerm="courses:write"
      cards={c => <div key={c.id} className="card hover" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => nav(`/courses/${c.id}`)}><div style={{ height: 90, background: `linear-gradient(135deg,${c.subject.color},${c.subject.color}bb)`, color: '#fff', padding: 16, display: 'flex', alignItems: 'flex-end' }}><div className="serif" style={{ fontSize: 18 }}>{c.title}</div></div><div className="card-b row between"><div className="muted" style={{ fontSize: 12.5 }}>{c.subject.name} · {c.teacher ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : ''}</div><Badge kind={c.status === 'published' ? 'success' : 'plain'}>{c.status === 'published' ? 'Publié' : 'Brouillon'}</Badge></div></div>} />
  );
}

export const Activities = () => {
  const { session } = useAuth();
  const toast = useToast();
  const enroll = async a => {
    const kid = (session.children && session.children[0]) || session.student;
    if (!kid) return;
    try { await api.post(`/activities/${a.id}/enroll`, { studentId: kid.id }); toast(`${kid.firstName} inscrit(e) à ${a.name}`); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  return (
    <ResourceList title="Événements & activités" sub="Clubs, sports, sorties, voyages, compétitions" path="/activities" createPerm="activities:write"
      filters={[['', 'Toutes'], ['kind=Club', 'Clubs'], ['kind=Sport', 'Sport'], ['kind=Sortie', 'Sorties'], ['kind=Compétition', 'Compétitions']]}
      createFields={[{ key: 'name', label: 'Nom', wide: true }, { key: 'kind', label: 'Type', options: ['Club', 'Sport', 'Sortie', 'Voyage', 'Compétition', 'Événement'] }, { key: 'capacity', label: 'Capacité', type: 'number' }, { key: 'place', label: 'Lieu' }, { key: 'schedule', label: 'Horaire' }]}
      onCreate={f => ({ ...f, capacity: f.capacity ? Number(f.capacity) : undefined })}
      cards={a => <div key={a.id} className="card hover" style={{ padding: 20 }}><div className="row between"><div className="dot-ic navy"><Icon name="activities" size={15} /></div><Badge kind="navy">{a.kind}</Badge></div><div style={{ fontWeight: 600, marginTop: 12 }}>{a.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{a.schedule} · {a.place}</div><div className="row between mt-s"><b>{a.priceCents ? money(a.priceCents, session.tenant.currency) : 'Gratuit'}</b>{['parent', 'student'].includes(session.user.role) && <button className="btn btn-sm btn-primary" onClick={() => enroll(a)}>Inscrire</button>}</div></div>} />
  );
};

/** Objets perdus / trouvés : photo, correspondances suggérées (FULLTEXT MySQL), marquage « récupéré ». */
export function LostFound() {
  const toast = useToast();
  const { session } = useAuth();
  const [matches, setMatches] = useState(null);
  const showMatches = async item => {
    try { const { data } = await api.get(`/lost/${item.id}/matches`); setMatches({ item, list: data.data }); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const markReturned = async (item, reload) => {
    try { await api.patch(`/lost/${item.id}`, { status: 'returned' }); toast('Objet marqué comme récupéré'); reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const staff = ['admin', 'staff'].includes(session.user.role);
  return (
    <>
      <ResourceList title="Objets perdus & trouvés" sub="Déclarez un objet ; les correspondances possibles sont suggérées automatiquement" path="/lost" createPerm="lost:write"
        filters={[['', 'Tous'], ['kind=lost', 'Perdus'], ['kind=found', 'Trouvés'], ['status=returned', 'Récupérés']]}
        createFields={[{ key: 'kind', label: 'Type', options: [['lost', "J'ai perdu"], ['found', "J'ai trouvé"]] }, { key: 'category', label: 'Catégorie', options: ['Téléphone', 'Sac', 'Cahier', 'Vêtement', 'Lunettes', 'Clés', 'Carte scolaire', 'Accessoires', 'Autre'] }, { key: 'description', label: 'Description (couleur, marque, signes distinctifs)', wide: true }, { key: 'place', label: 'Lieu' }, { key: 'onDate', label: 'Date', type: 'date' }, { key: 'photo', label: 'Photo', file: 'lost_photo', accept: '.jpg,.jpeg,.png,.webp', hint: 'Photo JPG, PNG ou WebP — 10 Mo max' }]}
        onCreate={({ photo, ...f }) => ({ ...f, ...(photo ? { photoFileId: photo.id } : {}) })}
        cards={(x, reload) => (
          <div key={x.id} className="card hover" style={{ padding: 14 }}>
            {x.photoUrl ? <AuthImage src={x.photoUrl} className="thumb" style={{ width: '100%', objectFit: 'cover' }} /> : <div className="thumb"><Icon name="lost" size={28} /></div>}
            <div className="row between mt-s"><Badge status={x.kind}>{x.kind === 'lost' ? 'Perdu' : 'Trouvé'}</Badge><Badge status={x.status}>{x.status === 'open' ? 'Ouvert' : 'Récupéré'}</Badge></div>
            <div style={{ fontWeight: 500, marginTop: 8, fontSize: 13.5 }}>{x.description}</div>
            <div className="muted" style={{ fontSize: 12 }}>{x.category} · {x.place || '—'} · {date(x.onDate)}</div>
            {x.status === 'open' && <div className="row mt-s" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-soft" style={{ flex: 1 }} onClick={() => showMatches(x)}><Icon name="sparkles" size={14} /> Correspondances</button>
              {(staff || x.reportedBy === session.user.id) && <button className="btn btn-sm btn-ghost" onClick={() => markReturned(x, reload)}><Icon name="check" size={14} /></button>}
            </div>}
          </div>
        )} />
      {matches && (
        <Modal title="Correspondances possibles" onClose={() => setMatches(null)}>
          <p className="muted mb">Pour « {matches.item.description} » — comparaison de la catégorie, de la description et du lieu.</p>
          {matches.list.length ? <div className="list">{matches.list.map((m, i) => <div className="li" key={m.id} style={{ paddingLeft: 0, paddingRight: 0 }}>{m.photoUrl ? <AuthImage src={m.photoUrl} style={{ width: 54, height: 54, borderRadius: 8, objectFit: 'cover' }} /> : <div className="dot-ic"><Icon name="lost" size={15} /></div>}<div className="grow"><div className="t" style={{ whiteSpace: 'normal' }}>{m.description}</div><div className="s">{m.place} · {date(m.onDate)}</div></div><Badge kind={i === 0 ? 'gold' : 'plain'}>{i === 0 ? 'Très proche' : 'Possible'}</Badge></div>)}</div>
            : <Empty>Aucune correspondance pour le moment. Vous serez prévenu dès qu'un objet similaire est déclaré.</Empty>}
          <p className="muted mt" style={{ fontSize: 12.5 }}>Présentez-vous à la vie scolaire pour récupérer l'objet.</p>
        </Modal>
      )}
    </>
  );
}

export const Canteen = () => {
  const { t, locale } = useI18n();
  const { data, loading, error } = useFetch('/canteen/menus');
  return (
    <>
      <PageHeader title={t('canteen.title')} sub={t('canteen.sub')} />
      {loading ? <Loader /> : error ? <ErrorBox error={error} /> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>{data.data.map(m => (
          <div className="card" key={m.id} style={{ padding: 18 }}><div className="eyebrow">{new Date(`${m.onDate}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric' })}</div>
            <div className="stack" style={{ gap: 8, marginTop: 12, fontSize: 13 }}><div>{m.starter}</div><b>{m.main}</b><div className="muted">{m.side}</div><div>{m.dessert}</div><span className="badge success" style={{ height: 'auto', whiteSpace: 'normal', padding: '4px 9px' }}>{m.vegetarian}</span></div></div>
        ))}{!data.data.length && <Empty>{t('canteen.none')}</Empty>}</div>
      )}
    </>
  );
};

export const Announcements = () => {
  const { t } = useI18n();
  return (
    <ResourceList title={t('ann.title')} sub={t('ann.sub')} path="/announcements" createPerm="announcements:write"
      createFields={[{ key: 'title', label: 'Titre', wide: true }, { key: 'body', label: 'Message', wide: true }, { key: 'audience', label: 'Destinataires', options: [['all', "Toute l'école"], ['parents', 'Parents'], ['teachers', 'Enseignants'], ['students', 'Élèves'], ['staff', 'Personnel']] }]}
      onCreate={f => ({ ...f, audience: f.audience || 'all', channels: ['app', 'push', 'email'] })}
      cards={a => <div key={a.id} className="card" style={{ padding: 20 }}><div className="row between"><h3 style={{ fontSize: 15 }}>{a.title}</h3>{a.pinned && <Badge kind="gold">📌</Badge>}</div><p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>{a.body}</p><div className="muted mt-s" style={{ fontSize: 12 }}>{dateTime(a.publishedAt)}</div></div>} />
  );
};
