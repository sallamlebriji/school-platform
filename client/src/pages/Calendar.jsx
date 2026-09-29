import { useMemo, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Card, ErrorBox, Icon, Modal, PageHeader, useFetch, useToast } from '../components/ui';

const KINDS = { 'Réunion': ['#E6EBF5', '#1D3462'], 'Conseil': ['#EAE6F2', '#4E3F73'], 'Examen': ['#F8E6E3', '#B0443B'], 'Contrôle': ['#F8E6E3', '#B0443B'], 'Sortie': ['#E3EEE8', '#2E5E4E'], 'Événement': ['#EFE3CB', '#7A5A2E'], 'Vacances': ['#F3EDE2', '#8B7B5E'], 'Activité': ['#E5EEF7', '#33679E'] };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Calendrier scolaire mensuel. La direction crée un événement en cliquant sur un jour. */
export default function Calendar() {
  const { can } = useAuth();
  const { t, locale } = useI18n();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(null);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(base); start.setDate(1 - ((base.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + 41);
  const { data, error, reload } = useFetch(`/events?from=${iso(start)}&to=${iso(end)}`);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }), [start.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = data ? data.data : [];
  const on = d => events.filter(e => { const s = e.startsAt.slice(0, 10); const f = (e.endsAt || e.startsAt).slice(0, 10); const k = iso(d); return k >= s && k <= f; });
  const canEdit = can('events:write');

  const create = async f => {
    try { await api.post('/events', f); toast('Événement ajouté — invitations envoyées', 'calendar'); setCreating(null); reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const upcoming = events.filter(e => e.startsAt.slice(0, 10) >= iso(now)).slice(0, 8);

  return (
    <>
      <PageHeader title={t('cal.title')} sub={t('cal.sub')} actions={canEdit && <button className="btn btn-primary" onClick={() => setCreating(iso(now))}><Icon name="plus" size={15} /> {t('cal.new')}</button>} />
      {error && <ErrorBox error={error} />}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 280px' }}>
        <div>
          <div className="row between mb">
            <div className="row">
              <button className="icon-btn" onClick={() => setOffset(o => o - 1)} aria-label="Mois précédent"><Icon name="right" className="flip" size={15} /></button>
              <button className="icon-btn" onClick={() => setOffset(o => o + 1)} aria-label="Mois suivant"><Icon name="right" size={15} /></button>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: '0 8px', textTransform: 'capitalize' }}>{base.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h2>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setOffset(0)}>{t('cal.today')}</button>
          </div>
          <div className="cal">
            {t('cal.days').split(',').map(d => <div className="cal-h" key={d}>{d}</div>)}
            {days.map(d => (
              <div key={iso(d)} className={`cal-d ${d.getMonth() !== base.getMonth() ? 'out' : ''} ${iso(d) === iso(now) ? 'today' : ''} ${canEdit ? 'click' : ''}`} onClick={() => canEdit && setCreating(iso(d))}>
                <div className="num">{d.getDate()}</div>
                {on(d).map(e => { const c = KINDS[e.kind] || KINDS['Événement']; return <div key={e.id} className="ev" style={{ background: c[0], color: c[1] }} title={`${e.title} · ${e.kind}`}>{e.title}</div>; })}
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <Card title={t('cal.upcoming')} flush>
            <div className="list">{upcoming.map(e => { const d = new Date(e.startsAt.replace(' ', 'T')); const c = KINDS[e.kind] || KINDS['Événement']; return (
              <div className="li" key={e.id}><div className="dot-ic" style={{ background: c[0], color: c[1], flexDirection: 'column', lineHeight: 1, fontSize: 10 }}><b style={{ fontSize: 14 }}>{d.getDate()}</b>{d.toLocaleDateString(locale, { month: 'short' })}</div><div className="grow"><div className="t">{e.title}</div><div className="s">{e.kind} · {d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div></div></div>
            ); })}{!upcoming.length && <div className="empty">—</div>}</div>
          </Card>
          <Card><div className="stack" style={{ gap: 8 }}>{Object.entries(KINDS).map(([k, c]) => <div className="row" key={k} style={{ fontSize: 12.5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: c[1] }} />{k}</div>)}</div></Card>
        </div>
      </div>
      {creating && <NewEvent day={creating} onClose={() => setCreating(null)} onSave={create} t={t} />}
    </>
  );
}

function NewEvent({ day, onClose, onSave, t }) {
  const [f, setF] = useState({ title: '', kind: 'Événement', start: `${day}T14:00`, end: '', audience: 'all' });
  const save = () => onSave({ title: f.title, kind: f.kind, startsAt: f.start.replace('T', ' ') + ':00', endsAt: f.end ? f.end.replace('T', ' ') + ':00' : undefined, audience: f.audience });
  return (
    <Modal title={t('cal.new')} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={!f.title} onClick={save}>{t('common.save')}</button></>}>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: '1/-1' }}><label>{t('cal.eventTitle')}</label><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></div>
        <div className="field"><label>{t('cal.kind')}</label><select className="select" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.keys(KINDS).map(k => <option key={k}>{k}</option>)}</select></div>
        <div className="field"><label>Public</label><select className="select" value={f.audience} onChange={e => setF({ ...f, audience: e.target.value })}><option value="all">Toute l'école</option><option value="parents">Parents</option><option value="teachers">Enseignants</option></select></div>
        <div className="field"><label>{t('cal.start')}</label><input className="input" type="datetime-local" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></div>
        <div className="field"><label>{t('cal.end')}</label><input className="input" type="datetime-local" value={f.end} onChange={e => setF({ ...f, end: e.target.value })} /></div>
      </div>
    </Modal>
  );
}
