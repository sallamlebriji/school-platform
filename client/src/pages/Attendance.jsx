import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, ErrorBox, FileUpload, Icon, Modal, PageHeader, Table, Who, useFetch, useToast } from '../components/ui';
import { useI18n } from '../i18n';
import { date, today } from '../lib/format';

export default function Attendance() {
  const { can } = useAuth();
  return can('attendance:write') ? <RollCall /> : <FamilyAttendance />;
}

/** Appel d'une classe. */
function RollCall() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const classes = useFetch('/classes');
  const classId = params.get('classId') || (classes.data && classes.data.data[0] && String(classes.data.data[0].id));
  const cls = useFetch(classId ? `/classes/${classId}` : null);
  const existing = useFetch(classId ? `/attendance?date=${today()}&classId=${classId}` : null);
  const [status, setStatus] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cls.data) return;
    const init = {};
    cls.data.students.forEach(s => { init[s.id] = 'present'; });
    (existing.data ? existing.data.data : []).forEach(a => { init[a.studentId] = a.status; });
    setStatus(init);
  }, [cls.data, existing.data]);

  const count = k => Object.values(status).filter(v => v === k).length;
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/attendance/roll', { classId: Number(classId), entries: Object.entries(status).map(([studentId, st]) => ({ studentId: Number(studentId), status: st })) });
      toast(`Appel enregistré — ${data.notifiedFamilies} famille(s) notifiée(s)`, 'bell');
    } catch (e) { toast(errorMessage(e), 'alert'); }
    setSaving(false);
  };

  return (
    <>
      <PageHeader title="Présences" sub={`Appel du ${date(today())}`} />
      <div className="card">
        <div className="toolbar">
          <select className="select" value={classId || ''} onChange={e => setParams({ classId: e.target.value })}>{classes.data && classes.data.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="row" style={{ marginLeft: 'auto', gap: 6 }}><Badge kind="success">{count('present')} présents</Badge><Badge kind="danger">{count('absent')} absents</Badge><Badge kind="warning">{count('late')} retards</Badge></div>
        </div>
        {cls.error && <ErrorBox error={cls.error} />}
        {cls.data && <Table rows={cls.data.students} columns={[
          { label: 'Élève', render: s => <Who person={s} sub={s.matricule} /> },
          { label: 'Statut', render: s => <div className="att-btns">{[['present', 'P'], ['absent', 'A'], ['late', 'R']].map(([k, l]) => <button key={k} className={`${l} ${status[s.id] === k ? 'on' : ''}`} onClick={() => setStatus({ ...status, [s.id]: k })}>{l}</button>)}</div> },
        ]} />}
        <div className="row between" style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>Les parents des absents sont notifiés immédiatement (push + SMS).</span>
          <button className="btn btn-primary" disabled={saving || !cls.data} onClick={save}><Icon name="check" size={15} /> Valider l'appel</button>
        </div>
      </div>
    </>
  );
}

/** Espace parent : historique + justification avec pièce jointe. */
function FamilyAttendance() {
  const toast = useToast();
  const { t, locale } = useI18n();
  const list = useFetch('/attendance?limit=100');
  const [justify, setJustify] = useState(null);
  const [reason, setReason] = useState('sick');
  const [file, setFile] = useState(null);
  const send = async () => {
    try {
      await api.patch(`/attendance/${justify.id}/justify`, { reason: t(`att.reason.${reason}`), ...(file ? { fileId: file.id } : {}) });
      toast(t('att.sent')); setJustify(null); setFile(null); list.reload();
    } catch (e) { toast(errorMessage(e), 'alert'); }
  };
  return (
    <>
      <PageHeader title={t('att.title')} sub={t('att.sub')} />
      {list.error && <ErrorBox error={list.error} />}
      <Card flush>
        <Table rows={list.data ? list.data.data : []} empty={t('att.none')} columns={[
          { label: t('common.student'), render: a => `${a.student.firstName} ${a.student.lastName}` },
          { label: t('common.date'), render: a => new Date(`${a.onDate}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) },
          { label: t('common.type'), render: a => <Badge status={a.status}>{t(`status.${a.status}`)}</Badge> },
          { label: t('common.reason'), render: a => a.reason || '—' },
          { label: '', render: a => (a.status === 'absent' && !a.justified ? <button className="btn btn-sm btn-primary" onClick={() => setJustify(a)}>{t('att.justify')}</button> : a.status === 'absent' ? <Badge kind="success">{t('att.justified')}</Badge> : null) },
        ]} />
      </Card>
      {justify && (
        <Modal title={t('att.justifyTitle')} onClose={() => setJustify(null)} footer={<><button className="btn btn-ghost" onClick={() => setJustify(null)}>{t('common.cancel')}</button><button className="btn btn-primary" onClick={send}>{t('common.send')}</button></>}>
          <div className="stack">
            <div className="field"><label>{t('common.reason')}</label><select className="select" value={reason} onChange={e => setReason(e.target.value)}>{['sick', 'medical', 'family', 'other'].map(k => <option key={k} value={k}>{t(`att.reason.${k}`)}</option>)}</select></div>
            <div className="field"><label>{t('att.proof')}</label><FileUpload kind="attendance_proof" value={file} onUploaded={setFile} onClear={() => setFile(null)} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}
