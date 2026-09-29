import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, openPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Card, Empty, ErrorBox, Icon, Modal, PageHeader, Table, Who, useFetch, useToast } from '../components/ui';
import { date, dec, fullName, gradeColor } from '../lib/format';

export default function Grades() {
  const { can } = useAuth();
  return can('grades:write') ? <GradeEntry /> : <MyGrades />;
}

/** Saisie des notes par évaluation (enseignant / direction). */
function GradeEntry() {
  const toast = useToast();
  const classes = useFetch('/classes');
  const [classId, setClassId] = useState('');
  useEffect(() => { if (!classId && classes.data && classes.data.data[0]) setClassId(String(classes.data.data[0].id)); }, [classes.data, classId]);
  const evals = useFetch(classId ? `/evaluations?classId=${classId}` : null);
  const cls = useFetch(classId ? `/classes/${classId}` : null);
  const [evalId, setEvalId] = useState(null);
  const grades = useFetch(evalId ? `/evaluations/${evalId}/grades` : null);
  const [scores, setScores] = useState({});
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (grades.data) setScores(Object.fromEntries(grades.data.data.map(g => [g.studentId, g.score ?? '']))); }, [grades.data]);

  const save = async publish => {
    try {
      const payload = Object.entries(scores).map(([studentId, v]) => ({ studentId: Number(studentId), score: v === '' ? null : Number(String(v).replace(',', '.')) }));
      await api.put(`/evaluations/${evalId}/grades`, { grades: payload, publish });
      toast(publish ? 'Notes publiées — élèves et parents notifiés' : 'Notes enregistrées', 'check');
      evals.reload(); cls.reload();
    } catch (e) { toast(errorMessage(e), 'alert'); }
  };

  const ev = evals.data && evals.data.data.find(e => e.id === evalId);
  return (
    <>
      <PageHeader title="Notes & évaluations" sub="Moyennes calculées automatiquement selon les règles de l'établissement" actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Nouvelle évaluation</button>} />
      <div className="row mb"><select className="select" value={classId} onChange={e => { setClassId(e.target.value); setEvalId(null); }}>{classes.data && classes.data.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="grid g-side">
        <Card title="Évaluations" flush>
          <div className="list">{evals.data && evals.data.data.map(e => (
            <div key={e.id} className="li click" style={e.id === evalId ? { background: 'var(--beige-50)' } : undefined} onClick={() => setEvalId(e.id)}>
              <i style={{ width: 4, height: 30, borderRadius: 2, background: e.subject.color }} />
              <div className="grow"><div className="t">{e.subject.shortName} — {e.title}</div><div className="s">{e.kind} · coef {e.coefficient} · {date(e.heldOn)}</div></div>
              {e.published ? <span className="badge success plain">Publié</span> : <span className="badge plain">Brouillon</span>}
            </div>
          ))}{evals.data && !evals.data.data.length && <Empty />}</div>
        </Card>
        {evalId && cls.data ? (
          <Card title={ev ? `${ev.subject.name} — ${ev.title}` : ''} sub={`Barème /${ev ? ev.maxScore : 20}`} flush action={<div className="row"><button className="btn btn-sm btn-ghost" onClick={() => save(false)}>Enregistrer</button><button className="btn btn-sm btn-primary" onClick={() => save(true)}>Publier</button></div>}>
            {grades.error ? <ErrorBox error={grades.error} /> : <Table rows={cls.data.students} columns={[
              { label: 'Élève', render: s => <Who person={s} /> },
              { label: 'Note', render: s => <input className="grade-in" value={scores[s.id] ?? ''} onChange={e => setScores({ ...scores, [s.id]: e.target.value })} style={{ color: gradeColor(Number(scores[s.id])) }} /> },
              { label: 'Moyenne générale', num: true, render: s => { const a = cls.data.averages && cls.data.averages.students[s.id]; return <b style={{ color: gradeColor(a && a.general) }}>{dec(a && a.general)}</b>; } },
            ]} />}
          </Card>
        ) : <Card><Empty>Sélectionnez une évaluation pour saisir les notes.</Empty></Card>}
      </div>
      {creating && cls.data && <NewEvaluation cls={cls.data} onClose={() => setCreating(false)} onDone={e => { setCreating(false); evals.reload(); setEvalId(e.id); }} />}
    </>
  );
}

function NewEvaluation({ cls, onClose, onDone }) {
  const toast = useToast();
  const { session } = useAuth();
  const subjects = cls.classSubjects.filter(cs => !session.teacher || (cs.teacher && cs.teacher.id === session.teacher.id));
  const [f, setF] = useState({ subjectId: subjects[0] ? subjects[0].subjectId : '', kind: 'Contrôle', title: '', coefficient: 1, heldOn: new Date().toISOString().slice(0, 10) });
  const save = async () => {
    try { const { data } = await api.post('/evaluations', { ...f, classId: cls.id, subjectId: Number(f.subjectId), coefficient: Number(f.coefficient) }); onDone(data); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  return (
    <Modal title="Nouvelle évaluation" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Créer</button></>}>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Titre</label><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Contrôle 4 — Équations" /></div>
        <div className="field"><label>Matière</label><select className="select" value={f.subjectId} onChange={e => setF({ ...f, subjectId: e.target.value })}>{subjects.map(cs => <option key={cs.subjectId} value={cs.subjectId}>{cs.subject.name}</option>)}</select></div>
        <div className="field"><label>Type</label><select className="select" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{['Contrôle', 'Examen', 'Devoir surveillé', 'Interrogation', 'Exposé'].map(k => <option key={k}>{k}</option>)}</select></div>
        <div className="field"><label>Coefficient</label><input className="input" type="number" step="0.5" value={f.coefficient} onChange={e => setF({ ...f, coefficient: e.target.value })} /></div>
        <div className="field"><label>Date</label><input className="input" type="date" value={f.heldOn} onChange={e => setF({ ...f, heldOn: e.target.value })} /></div>
      </div>
    </Modal>
  );
}

/** Parent / élève : moyennes et bulletins. */
function MyGrades() {
  const { session } = useAuth();
  const { t } = useI18n();
  const kids = session.children || (session.student ? [session.student] : []);
  const [kidId, setKidId] = useState(kids[0] && kids[0].id);
  const avg = useFetch(kidId ? `/students/${kidId}/averages` : null);
  const subjects = useFetch('/subjects?limit=50');
  const name = sid => { const s = subjects.data && subjects.data.data.find(x => Number(x.id) === Number(sid)); return s ? s.name : sid; };
  const kid = kids.find(k => k.id === kidId);
  return (
    <>
      <PageHeader title={t('grades.title')} sub={kid ? fullName(kid) : ''} actions={kidId && <button className="btn btn-primary" onClick={() => openPdf(`/students/${kidId}/report-card.pdf`)}><Icon name="download" size={15} /> {t('grades.reportCard')}</button>} />
      {kids.length > 1 && <div className="pill-filter mb">{kids.map(k => <button key={k.id} className={k.id === kidId ? 'on' : ''} onClick={() => setKidId(k.id)}>{k.firstName}</button>)}</div>}
      {avg.error && <ErrorBox error={avg.error} />}
      {avg.data && (
        <>
          <div className="grid g-3 mb">
            <div className="card kpi"><span className="kpi-label">{t('dash.average')}</span><span className="kpi-val" style={{ color: gradeColor(avg.data.general) }}>{dec(avg.data.general)}<small>/20</small></span></div>
            <div className="card kpi"><span className="kpi-label">{t('grades.classAverage')}</span><span className="kpi-val">{dec(avg.data.classAverage)}</span></div>
            <div className="card kpi"><span className="kpi-label">{t('dash.rank')}</span><span className="kpi-val">{avg.data.rank || '—'}<small>{avg.data.of ? `/ ${avg.data.of}` : ''}</small></span></div>
          </div>
          <Card title={t('grades.bySubject')} flush>
            <Table rows={Object.entries(avg.data.subjects || {}).map(([id, v]) => ({ id, ...v }))} columns={[
              { label: t('common.subject'), render: r => name(r.id) },
              { label: t('grades.notes'), render: r => r.grades.map((g, i) => <span key={i} className="badge plain" title={g.title} style={{ marginInlineEnd: 4, background: 'var(--beige-50)', color: gradeColor(g.value) }}>{dec(g.value, 1)}</span>) },
              { label: t('common.average'), num: true, render: r => <b style={{ color: gradeColor(r.average) }}>{dec(r.average)}</b> },
            ]} />
          </Card>
          <p className="muted mt"><Link to={`/students/${kidId}`}>{t('grades.fullProfile')}</Link></p>
        </>
      )}
    </>
  );
}
