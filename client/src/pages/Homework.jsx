import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Badge, Card, ErrorBox, FileUpload, Icon, Modal, PageHeader, Table, openFile, useFetch, useToast } from '../components/ui';

const HW_STATUS = { todo: 'hw.todo', submitted: 'hw.done', late: 'hw.lateStatus', graded: 'hw.graded' };

export default function Homework() {
  const { can, session } = useAuth();
  const { t, locale } = useI18n();
  const toast = useToast();
  const list = useFetch('/homework');
  const classes = useFetch(can('homework:write') ? '/classes' : null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ title: '', classId: '', subjectId: '', dueAt: '', instructions: '' });
  const cls = useFetch(f.classId ? `/classes/${f.classId}` : null);
  const [submitting, setSubmitting] = useState(null);
  const [file, setFile] = useState(null);
  const [grading, setGrading] = useState(null);
  const isFamily = ['parent', 'student'].includes(session.user.role);
  const fmt = d => new Date(d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const create = async () => {
    try { await api.post('/homework', { ...f, classId: Number(f.classId), subjectId: Number(f.subjectId) }); toast('Devoir publié — élèves et parents notifiés', 'bell'); setCreating(false); list.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const submit = async () => {
    try { await api.post(`/homework/${submitting.id}/submit`, { fileId: file.id }); toast(t('hw.submitted')); setSubmitting(null); setFile(null); list.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };

  return (
    <>
      <PageHeader title={t('hw.title')} sub={t('hw.sub')} actions={can('homework:write') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Créer un devoir</button>} />
      {list.error && <ErrorBox error={list.error} />}
      <Card flush>
        <Table rows={list.data ? list.data.data : []} columns={[
          { label: t('hw.title'), render: h => <div><div style={{ fontWeight: 500 }}>{h.title}</div><div className="muted" style={{ fontSize: 12 }}>{h.subject.name} · {h.class.name}</div></div> },
          { label: t('hw.deadline'), render: h => fmt(h.dueAt) },
          isFamily
            ? { label: t('common.status'), render: h => { const s = h.submissions[0]; return s ? <Badge status={s.status}>{t(HW_STATUS[s.status])}</Badge> : '—'; } }
            : { label: t('hw.submissions'), render: h => `${h.stats.submitted}/${h.submissions.length} · ${h.stats.graded} corrigés` },
          { label: '', render: h => {
            const s = h.submissions[0];
            if (session.user.role === 'student' && s && s.status === 'todo') return <button className="btn btn-sm btn-primary" onClick={() => setSubmitting(h)}><Icon name="upload" size={14} /> {t('hw.submit')}</button>;
            if (isFamily && s && s.score != null) return <span className="badge navy plain">{s.score}/20</span>;
            if (isFamily && s && s.fileUrl) return <button className="btn btn-sm btn-ghost" onClick={() => openFile(s.fileUrl)}><Icon name="file" size={14} /></button>;
            if (!isFamily && can('homework:write')) return <button className="btn btn-sm btn-ghost" onClick={() => setGrading(h)}>Corriger</button>;
            return null;
          } },
        ]} />
      </Card>

      {submitting && (
        <Modal title={t('hw.submitTitle')} onClose={() => setSubmitting(null)} footer={<><button className="btn btn-ghost" onClick={() => setSubmitting(null)}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={!file} onClick={submit}>{t('common.send')}</button></>}>
          <div className="stack"><div style={{ fontWeight: 500 }}>{submitting.title}</div><div className="field"><label>{t('hw.file')}</label><FileUpload kind="homework" value={file} onUploaded={setFile} onClear={() => setFile(null)} /></div></div>
        </Modal>
      )}

      {grading && <GradeSubmissions hw={grading} onClose={() => { setGrading(null); list.reload(); }} />}

      {creating && (
        <Modal title="Nouveau devoir" onClose={() => setCreating(false)} footer={<><button className="btn btn-ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={create}>Publier</button></>}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Titre</label><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
            <div className="field"><label>Classe</label><select className="select" value={f.classId} onChange={e => setF({ ...f, classId: e.target.value, subjectId: '' })}><option value="">—</option>{classes.data && classes.data.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Matière</label><select className="select" value={f.subjectId} onChange={e => setF({ ...f, subjectId: e.target.value })}><option value="">—</option>{cls.data && cls.data.classSubjects.filter(cs => !session.teacher || (cs.teacher && cs.teacher.id === session.teacher.id)).map(cs => <option key={cs.subjectId} value={cs.subjectId}>{cs.subject.name}</option>)}</select></div>
            <div className="field"><label>Date limite</label><input className="input" type="datetime-local" value={f.dueAt} onChange={e => setF({ ...f, dueAt: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Consignes</label><textarea className="input" value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Correction : l'enseignant ouvre chaque copie rendue et saisit note + commentaire. */
function GradeSubmissions({ hw, onClose }) {
  const toast = useToast();
  const [scores, setScores] = useState({});
  const submitted = hw.submissions.filter(s => s.status !== 'todo');
  const cls = useFetch(`/classes/${hw.classId}`);
  const name = id => { const s = cls.data && cls.data.students.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}` : `#${id}`; };
  const save = async s => {
    const v = scores[s.id] || {};
    try { await api.patch(`/homework/submissions/${s.id}`, { score: v.score === '' || v.score == null ? null : Number(String(v.score).replace(',', '.')), feedback: v.feedback }); toast('Correction publiée — élève et parents notifiés', 'bell'); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  return (
    <Modal wide title={`Correction — ${hw.title}`} onClose={onClose}>
      <Table rows={submitted} empty="Aucune copie rendue" columns={[
        { label: 'Élève', render: s => name(s.studentId) },
        { label: 'Copie', render: s => (s.fileUrl ? <button className="btn btn-sm btn-ghost" onClick={() => openFile(s.fileUrl)}><Icon name="file" size={14} /> Ouvrir</button> : '—') },
        { label: 'Statut', render: s => <Badge status={s.status} /> },
        { label: 'Note /20', render: s => <input className="grade-in" defaultValue={s.score ?? ''} onChange={e => setScores({ ...scores, [s.id]: { ...(scores[s.id] || {}), score: e.target.value } })} /> },
        { label: 'Commentaire', render: s => <input className="input" style={{ height: 30, width: '100%' }} defaultValue={s.feedback || ''} onChange={e => setScores({ ...scores, [s.id]: { ...(scores[s.id] || {}), feedback: e.target.value } })} /> },
        { label: '', render: s => <button className="btn btn-sm btn-primary" onClick={() => save(s)}>OK</button> },
      ]} />
    </Modal>
  );
}
