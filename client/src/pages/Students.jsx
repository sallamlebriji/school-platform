import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, ErrorBox, FileUpload, Icon, Modal, PageHeader, Table, Who, useFetch, useToast } from '../components/ui';

export default function Students() {
  const nav = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const classes = useFetch('/classes');
  const params = new URLSearchParams({ page, limit: 25, ...(q ? { q } : {}), ...(classId ? { classId } : {}) });
  const list = useFetch(`/students?${params}`);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / 25)) : 1;

  return (
    <>
      <PageHeader title="Élèves" sub={list.data ? `${list.data.total} élèves` : ''} actions={can('students:write') && <><button className="btn btn-ghost" onClick={() => setImporting(true)}><Icon name="upload" size={15} /> Importer (Excel)</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Nouvel élève</button></>} />
      <div className="card">
        <div className="toolbar">
          <div className="input-ic" style={{ flex: 1, minWidth: 220 }}><Icon name="search" size={15} /><input className="input" style={{ width: '100%' }} placeholder="Nom, prénom ou matricule…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
          <select className="select" value={classId} onChange={e => { setClassId(e.target.value); setPage(1); }}><option value="">Toutes les classes</option>{classes.data && classes.data.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        {list.error ? <ErrorBox error={list.error} /> : (
          <Table rows={list.data ? list.data.data : []} onRowClick={s => nav(`/students/${s.id}`)} columns={[
            { label: 'Élève', render: s => <Who person={s} sub={s.matricule} /> },
            { label: 'Classe', render: s => (s.class ? s.class.name : '—') },
            { label: 'Naissance', render: s => new Date(s.birthDate).toLocaleDateString('fr-FR') },
            { label: 'Statut', render: s => <Badge kind={s.status === 'enrolled' ? 'success' : 'plain'}>{s.status === 'enrolled' ? 'Inscrit' : s.status}</Badge> },
            { label: 'Paiement', render: s => <Badge status={s.paymentStatus} /> },
          ]} />
        )}
        <div className="row between" style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          <span className="muted">Page {page}/{pages}</span>
          <div className="row"><button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</button><button className="btn btn-sm btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Suivant</button></div>
        </div>
      </div>
      {importing && <ImportStudents onClose={() => setImporting(false)} onDone={n => { setImporting(false); toast(`${n} élève(s) importé(s)`); list.reload(); classes.reload(); }} />}
      {adding && <NewStudent classes={classes.data ? classes.data.data : []} onClose={() => setAdding(false)} onDone={s => { setAdding(false); toast(`Dossier créé — matricule ${s.matricule}`); nav(`/students/${s.id}`); }} />}
    </>
  );
}

function NewStudent({ classes, onClose, onDone }) {
  const [f, setF] = useState({ firstName: '', lastName: '', birthDate: '', gender: 'F', classId: classes[0] ? classes[0].id : '' });
  const [error, setError] = useState(null);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { const { data } = await api.post('/students', { ...f, classId: Number(f.classId) || null }); onDone(data); }
    catch (e) { setError(errorMessage(e)); }
  };
  return (
    <Modal title="Nouvel élève" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Créer le dossier</button></>}>
      {error && <div className="mb"><ErrorBox error={error} /></div>}
      <div className="form-grid">
        <div className="field"><label>Prénom</label><input className="input" value={f.firstName} onChange={set('firstName')} /></div>
        <div className="field"><label>Nom</label><input className="input" value={f.lastName} onChange={set('lastName')} /></div>
        <div className="field"><label>Date de naissance</label><input className="input" type="date" value={f.birthDate} onChange={set('birthDate')} /></div>
        <div className="field"><label>Sexe</label><select className="select" value={f.gender} onChange={set('gender')}><option value="F">Féminin</option><option value="M">Masculin</option></select></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Classe</label><select className="select" value={f.classId} onChange={set('classId')}>{classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentCount}/{c.capacity})</option>)}</select></div>
      </div>
    </Modal>
  );
}

/** Import Excel en 3 étapes : modèle → dépôt → aperçu des erreurs → import en transaction. */
function ImportStudents({ onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const template = async () => {
    const r = await api.get('/students/import/template.xlsx', { responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = 'modele-import-eleves.xlsx'; a.click();
  };
  const analyse = async f => {
    setFile(f); setBusy(true);
    try { const { data } = await api.post('/students/import', { fileId: f.id }); setPreview(data); }
    catch (e) { toast(errorMessage(e), 'alert'); }
    setBusy(false);
  };
  const commit = async () => {
    setBusy(true);
    try { const { data } = await api.post('/students/import', { fileId: file.id, commit: true }); if (data.error) { toast(data.error, 'alert'); setPreview(data); } else onDone(data.created); }
    catch (e) { toast(errorMessage(e), 'alert'); }
    setBusy(false);
  };

  return (
    <Modal wide title="Importer des élèves depuis Excel" onClose={onClose} footer={<>
      <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
      <button className="btn btn-primary" disabled={!preview || preview.invalid > 0 || !preview.valid || busy} onClick={commit}>{preview ? `Importer ${preview.valid} élève(s)` : 'Importer'}</button>
    </>}>
      <div className="stack">
        <div className="row between card beige" style={{ padding: 14 }}>
          <div><b>1. Téléchargez le modèle</b><div className="muted" style={{ fontSize: 12.5 }}>Colonnes attendues, liste des classes en menu déroulant, une ligne d'exemple.</div></div>
          <button className="btn btn-soft" onClick={template}><Icon name="download" size={15} /> Modèle .xlsx</button>
        </div>
        <div><b>2. Déposez le fichier complété</b> <span className="muted" style={{ fontSize: 12.5 }}>(.xlsx ou .csv)</span>
          <div className="mt-s"><FileUpload kind="import" accept=".xlsx,.csv" value={file} onUploaded={analyse} onClear={() => { setFile(null); setPreview(null); }} /></div>
        </div>
        {busy && <div className="muted">Analyse…</div>}
        {preview && (
          <div>
            <b>3. Vérifiez</b>
            <div className="row mt-s" style={{ gap: 6 }}><Badge kind="success">{preview.valid} valide(s)</Badge>{preview.invalid > 0 && <Badge kind="danger">{preview.invalid} en erreur</Badge>}</div>
            {preview.invalid > 0 && <p className="muted mt-s" style={{ fontSize: 12.5 }}>Corrigez les lignes en erreur dans Excel puis déposez à nouveau le fichier. Aucun élève n'est créé tant qu'il reste des erreurs.</p>}
            <div style={{ maxHeight: 300, overflow: 'auto' }} className="mt-s">
              <Table rows={preview.rows} columns={[
                { label: 'Ligne', key: 'line' }, { label: 'Élève', render: r => `${r.firstName || ''} ${r.lastName || ''}` }, { label: 'Naissance', render: r => r.birthDate || '—' },
                { label: 'Classe', key: 'className' }, { label: 'Parent', key: 'guardian' },
                { label: 'Contrôle', render: r => (r.errors.length ? <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>{r.errors.join(' · ')}</span> : <Badge kind="success">OK</Badge>) },
              ]} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
