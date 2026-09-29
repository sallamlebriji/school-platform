import { useCallback, useEffect, useState, createContext, useContext } from 'react';
import { api, errorMessage } from '../api/client';
import { useT } from '../i18n';
import { STATUS, initials } from '../lib/format';

// ---------- Icônes (traits fins, 24×24) ----------
const P = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  students: 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c3 2 9 2 12 0v-5M22 10v6',
  parents: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M17.5 12a2.5 2.5 0 1 0 0-5M16.5 14.6c2.6-.3 4.6 1.3 5 4.4',
  teachers: 'M3 4h18v12H3zM7 20l2-4M17 20l-2-4M8 9h5M8 12h8',
  classes: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5',
  timetable: 'M3 4.5h18v16H3zM3 9.5h18M8 3v3M16 3v3M12 13v3l2 1',
  attendance: 'M5 3.5h14v18H5zM9 3.5h6v3H9zM9 14l2 2 4-4.5',
  grades: 'M12 14.5A5.5 5.5 0 1 0 12 3.5a5.5 5.5 0 0 0 0 11ZM8.5 13.5l-1.5 7 5-2.5 5 2.5-1.5-7',
  homework: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  elearning: 'M2.5 4h19v13h-19zM8 21h8M12 17v4M10 8.5l4.5 2-4.5 2z',
  library: 'M4 19.5V5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 1 6 18h13',
  transport: 'M4 3h16v15H4zM4 11h16M8 18v2.5M16 18v2.5M9 6.5h6',
  canteen: 'M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1.5-3 4-3 7h3',
  activities: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  health: 'M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.7ZM12 10v5M9.5 12.5h5',
  lost: 'M3 8 12 3l9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8',
  documents: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h4',
  communication: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12ZM8.5 11h7M8.5 14h4',
  calendar: 'M3 4.5h18v16H3zM3 9.5h18M8 3v3M16 3v3',
  finance: 'M3 6h18v14H3zM3 10h18M6 3.5h12',
  analytics: 'M3 3v18h18M7 15l4-5 3 3 5-6',
  support: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15.8a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.8 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3.2 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3.2a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0 1.1 2.8 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.4 1Z',
  enroll: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  plus: 'M12 5v14M5 12h14', upload: 'M12 15V3M7 8l5-5 5 5M5 21h14', file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5', globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c.8-4 4-6 8-6s7.2 2 8 6', card: 'M2 5h20v14H2zM2 10h20M6 15h4', play: 'm7 4 13 8-13 8V4Z', map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14', x: 'M18 6 6 18M6 6l12 12', right: 'm9 18 6-6-6-6', check: 'M20 6 9 17l-5-5',
  sparkles: 'M12 3l1.8 4.9 4.9 1.8-4.9 1.8L12 16.4l-1.8-4.9-4.9-1.8 4.9-1.8Z',
  send: 'm22 2-7 20-4-9-9-4ZM22 2 11 13', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14', alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4',
  lock: 'M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
};
export const Icon = ({ name, size = 18, className = '' }) => (
  <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={P[name] || P.dashboard} /></svg>
);

// ---------- Primitives ----------
export const Badge = ({ status, children, kind }) => {
  const [label, k] = STATUS[status] || [children || status, kind || ''];
  return <span className={`badge ${kind || k}`}>{children || label}</span>;
};
const AV = [['#E8DFCF', '#13254A'], ['#E6EBF5', '#1D3462'], ['#EFE3CB', '#7A5A2E'], ['#E3EEE8', '#2E5E4E'], ['#F1E4E6', '#5A2E3A']];
export const Avatar = ({ person, size = '' }) => { const c = AV[((person && person.id) || 0) % AV.length]; return <div className={`avatar ${size}`} style={{ background: c[0], color: c[1] }}>{initials(person)}</div>; };
export const Who = ({ person, sub }) => <div className="who"><Avatar person={person} size="sm" /><div><div className="n">{person ? `${person.firstName} ${person.lastName}` : '—'}</div>{sub && <div className="s">{sub}</div>}</div></div>;

export const PageHeader = ({ title, sub, actions, crumbs }) => (
  <div className="page-head"><div>{crumbs && <div className="crumbs">{crumbs}</div>}<h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>{actions && <div className="actions">{actions}</div>}</div>
);
export const Card = ({ title, sub, action, children, flush, className = '', style }) => (
  <div className={`card ${className}`} style={style}>
    {title && <div className="card-h"><div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>{action}</div>}
    <div className={`card-b ${flush ? 'flush' : ''}`}>{children}</div>
  </div>
);
export const Kpi = ({ label, value, icon, foot, gold, onClick, mini }) => (
  <div className={`card kpi ${mini ? 'mini' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
    <div className="kpi-top"><span className="kpi-label">{label}</span><span className={`kpi-ic ${gold ? 'gold' : ''}`}><Icon name={icon} size={15} /></span></div>
    <div className="kpi-val">{value}</div>
    {foot && <div className="kpi-foot">{foot}</div>}
  </div>
);
export const Bar = ({ value, max = 100, kind = '' }) => <div className={`bar ${kind}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
export const Empty = ({ children }) => { const t = useT(); return <div className="empty">{children || t('common.empty')}</div>; };
export const Loader = () => { const t = useT(); return <div className="empty">{t('common.loading')}</div>; };
export const ErrorBox = ({ error }) => <div className="lock" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'transparent' }}><Icon name="alert" /><span>{error}</span></div>;

export function Table({ columns, rows, onRowClick, empty }) {
  const t = useT();
  empty = empty || t('common.noResults');
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr>{columns.map(c => <th key={c.key || c.label} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => (
            <tr key={r.id || i} className={onRowClick ? 'click' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map(c => <td key={c.key || c.label} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          )) : <tr><td colSpan={columns.length}><Empty>{empty}</Empty></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, children, onClose, footer, wide }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-h"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><Icon name="x" /></button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export const Tabs = ({ items, value, onChange }) => (
  <div className="tabs">{items.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>
);

// ---------- Toasts ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, icon = 'check') => { const id = Math.random(); setItems(t => [...t, { id, msg, icon }]); setTimeout(() => setItems(t => t.filter(x => x.id !== id)), 3500); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts">{items.map(t => <div className="toast" key={t.id}><Icon name={t.icon} /><span>{t.msg}</span></div>)}</div></ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

// ---------- Chargement de données ----------
export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = useCallback(() => {
    if (!path) return;
    setState(s => ({ ...s, loading: true }));
    api.get(path).then(r => setState({ data: r.data, loading: false, error: null })).catch(e => setState({ data: null, loading: false, error: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

// ---------- Fichiers ----------
/**
 * Zone de dépôt : téléverse immédiatement vers POST /api/files?kind=… et
 * renvoie { id, url, name } via onUploaded. Glisser-déposer ou clic.
 */
export function FileUpload({ kind, onUploaded, accept = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx,.csv', value, onClear, label, hint }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const send = async file => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/files?kind=${kind}`, fd);
      onUploaded(data);
    } catch (e) { toast(errorMessage(e), 'alert'); }
    setBusy(false);
  };
  if (value) return <div className="file-chip"><Icon name="file" size={16} /><span className="grow">{value.name}</span><button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>{t('common.remove')}</button></div>;
  return (
    <label className={`dropzone ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); send(e.dataTransfer.files[0]); }}>
      <input type="file" accept={accept} hidden onChange={e => send(e.target.files[0])} disabled={busy} />
      <Icon name="upload" /><div style={{ marginTop: 6, fontWeight: 500, color: 'var(--ink-2)' }}>{busy ? t('common.uploading') : label || t('common.upload')}</div>
      <div style={{ fontSize: 11.5, marginTop: 2 }}>{hint || t('common.fileHint', { max: 10 })}</div>
    </label>
  );
}

/** Image protégée (le jeton est envoyé en en-tête, pas dans l'URL). */
export function AuthImage({ src, alt = '', style, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!src) return undefined;
    let revoke;
    api.get(src.replace(/^\/api/, ''), { responseType: 'blob' }).then(r => { revoke = URL.createObjectURL(r.data); setUrl(revoke); }).catch(() => setUrl(null));
    return () => revoke && URL.revokeObjectURL(revoke);
  }, [src]);
  return url ? <img src={url} alt={alt} style={style} className={className} /> : <div className={className} style={{ ...style, background: 'var(--beige-100)' }} />;
}

/** Ouvre un fichier protégé dans un nouvel onglet. */
export async function openFile(src) {
  const r = await api.get(src.replace(/^\/api/, ''), { responseType: 'blob' });
  window.open(URL.createObjectURL(r.data), '_blank');
}
