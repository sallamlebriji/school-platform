import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Bar, Card, Empty, ErrorBox, FileUpload, Icon, Loader, Modal, PageHeader, openFile, useFetch, useToast } from '../components/ui';

const KIND_ICON = { video: 'play', pdf: 'file', slides: 'file', exercise: 'homework', quiz: 'grades', assignment: 'upload' };
const KIND_LABEL = { video: 'Vidéo', pdf: 'PDF', slides: 'Présentation', exercise: 'Exercice', quiz: 'Quiz', assignment: 'Devoir' };

/** Lecteur de cours : chapitres, contenus, quiz auto-corrigés et progression de l'élève. */
export default function CoursePlayer() {
  const { id } = useParams();
  const { session, can } = useAuth();
  const toast = useToast();
  const { data: course, loading, error, reload } = useFetch(`/courses/${id}`);
  const [current, setCurrent] = useState(null);
  const [adding, setAdding] = useState(false);
  const isStudent = session.user.role === 'student';
  const canEdit = can('courses:write');

  const lessons = useMemo(() => (course ? course.lessons : []), [course]);
  const done = useMemo(() => new Set((course ? course.progress : []).filter(p => p.completedAt).map(p => Number(p.lessonId))), [course]);
  const lesson = lessons.find(l => l.id === current) || lessons[0];
  const chapters = useMemo(() => lessons.reduce((acc, l) => { (acc[l.chapter] = acc[l.chapter] || []).push(l); return acc; }, {}), [lessons]);

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;

  const complete = async (l, score) => {
    try { await api.post(`/courses/lessons/${l.id}/complete`, score != null ? { score } : {}); reload(); toast(score != null ? `Quiz terminé : ${score}/20` : 'Leçon terminée ✓'); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };

  return (
    <>
      <PageHeader crumbs={<><Link to="/courses">Cours en ligne</Link><Icon name="right" size={13} className="flip" /><span>{course.title}</span></>} title={course.title} sub={`${course.subject.name}${course.description ? ' · ' + course.description : ''}`}
        actions={canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Ajouter une leçon</button>} />
      <div className="grid g-main">
        <div className="stack">
          {lesson ? <LessonView key={lesson.id} lesson={lesson} done={done.has(lesson.id)} isStudent={isStudent} onComplete={complete} /> : <Card><Empty>Aucune leçon pour l'instant.</Empty></Card>}
        </div>
        <Card title="Programme" sub={isStudent ? `${pct} % terminé` : `${lessons.length} leçons`}>
          {isStudent && <div className="mb"><Bar value={pct} kind="gold" /></div>}
          {Object.entries(chapters).map(([ch, ls]) => (
            <div key={ch} className="mb">
              <div className="eyebrow" style={{ marginBottom: 8 }}>{ch}</div>
              {ls.map(l => (
                <button key={l.id} className="li click" style={{ width: '100%', border: 0, background: lesson && lesson.id === l.id ? 'var(--beige-50)' : 'transparent', textAlign: 'start', borderRadius: 8, padding: '8px 10px' }} onClick={() => setCurrent(l.id)}>
                  <div className={`dot-ic ${done.has(l.id) ? 'success' : ''}`}><Icon name={done.has(l.id) ? 'check' : KIND_ICON[l.kind]} size={14} /></div>
                  <div className="grow"><div className="t">{l.title}</div><div className="s">{KIND_LABEL[l.kind]}</div></div>
                </button>
              ))}
            </div>
          ))}
        </Card>
      </div>
      {adding && <AddLesson courseId={course.id} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

function LessonView({ lesson, done, isStudent, onComplete }) {
  const quiz = Array.isArray(lesson.quiz) ? lesson.quiz : null;
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const score = quiz ? Math.round((quiz.filter((q, i) => answers[i] === q.answer).length / quiz.length) * 20 * 4) / 4 : null;
  const youtube = lesson.contentUrl && lesson.contentUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return (
    <Card title={lesson.title} sub={`${lesson.chapter} · ${KIND_LABEL[lesson.kind]}`} action={done && <span className="badge success">Terminée</span>}>
      {lesson.kind === 'video' && (youtube
        ? <div style={{ aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }}><iframe title={lesson.title} src={`https://www.youtube-nocookie.com/embed/${youtube[1]}`} style={{ width: '100%', height: '100%', border: 0 }} allowFullScreen /></div>
        : lesson.contentUrl ? <video src={lesson.contentUrl} controls style={{ width: '100%', borderRadius: 12 }} />
          : <div style={{ aspectRatio: '16/9', borderRadius: 12, background: 'linear-gradient(135deg,var(--navy-900),var(--navy-600))', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="play" size={40} /></div>)}
      {lesson.file && <button className="btn btn-ghost mt" onClick={() => openFile(`/api/files/${lesson.fileId}`)}><Icon name="file" size={15} /> {lesson.file.originalName || 'Ouvrir le document'}</button>}
      {lesson.fileId && !lesson.file && <button className="btn btn-ghost mt" onClick={() => openFile(`/api/files/${lesson.fileId}`)}><Icon name="file" size={15} /> Ouvrir le document</button>}
      {lesson.contentUrl && lesson.kind !== 'video' && <a className="btn btn-ghost mt" href={lesson.contentUrl} target="_blank" rel="noreferrer"><Icon name="globe" size={15} /> Ouvrir la ressource</a>}
      {quiz && (
        <div className="stack mt">
          {quiz.map((q, i) => (
            <div key={i}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{i + 1}. {q.q}</div>
              <div className="grid g-2" style={{ gap: 8 }}>{q.options.map((o, j) => {
                const picked = answers[i] === j;
                const good = checked && j === q.answer, bad = checked && picked && j !== q.answer;
                return <button key={j} className="card" disabled={checked} onClick={() => setAnswers({ ...answers, [i]: j })} style={{ padding: 10, cursor: 'pointer', textAlign: 'start', borderWidth: 1.5, borderColor: good ? 'var(--success)' : bad ? 'var(--danger)' : picked ? 'var(--navy-500)' : 'var(--line)', background: good ? 'var(--success-bg)' : bad ? 'var(--danger-bg)' : 'var(--paper)' }}>{o}</button>;
              })}</div>
            </div>
          ))}
          {!checked ? <button className="btn btn-primary" disabled={Object.keys(answers).length < quiz.length} onClick={() => { setChecked(true); if (isStudent) onComplete(lesson, score); }}>Valider mes réponses</button>
            : <div className="lock"><Icon name="grades" /><span>Résultat : <b>{score}/20</b></span></div>}
        </div>
      )}
      {!quiz && isStudent && !done && <button className="btn btn-primary mt" onClick={() => onComplete(lesson)}><Icon name="check" size={15} /> Marquer comme terminée</button>}
    </Card>
  );
}

function AddLesson({ courseId, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ chapter: 'Chapitre 1', title: '', kind: 'pdf', contentUrl: '' });
  const [file, setFile] = useState(null);
  const [quiz, setQuiz] = useState([{ q: '', options: ['', ''], answer: 0 }]);
  const save = async () => {
    const body = { chapter: f.chapter, title: f.title, kind: f.kind, ...(f.contentUrl ? { contentUrl: f.contentUrl } : {}), ...(file ? { fileId: file.id } : {}) };
    if (f.kind === 'quiz') body.quiz = quiz.filter(q => q.q && q.options.filter(Boolean).length >= 2).map(q => ({ ...q, options: q.options.filter(Boolean) }));
    try { await api.post(`/courses/${courseId}/lessons`, body); toast('Leçon ajoutée'); onDone(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const setQ = (i, patch) => setQuiz(quiz.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <Modal wide title="Nouvelle leçon" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!f.title} onClick={save}>Ajouter</button></>}>
      <div className="form-grid">
        <div className="field"><label>Chapitre</label><input className="input" value={f.chapter} onChange={e => setF({ ...f, chapter: e.target.value })} /></div>
        <div className="field"><label>Type</label><select className="select" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Titre</label><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
        {f.kind === 'video' && <div className="field" style={{ gridColumn: '1/-1' }}><label>Lien de la vidéo (YouTube ou fichier .mp4)</label><input className="input" value={f.contentUrl} onChange={e => setF({ ...f, contentUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></div>}
        {['pdf', 'slides', 'exercise', 'assignment'].includes(f.kind) && <div className="field" style={{ gridColumn: '1/-1' }}><label>Document</label><FileUpload kind="course" value={file} onUploaded={setFile} onClear={() => setFile(null)} /></div>}
      </div>
      {f.kind === 'quiz' && (
        <div className="stack mt">
          {quiz.map((q, i) => (
            <div key={i} className="card beige" style={{ padding: 14 }}>
              <input className="input" style={{ width: '100%' }} placeholder={`Question ${i + 1}`} value={q.q} onChange={e => setQ(i, { q: e.target.value })} />
              {q.options.map((o, j) => (
                <div key={j} className="row mt-s"><input type="radio" name={`ans${i}`} checked={q.answer === j} onChange={() => setQ(i, { answer: j })} title="Bonne réponse" /><input className="input" style={{ flex: 1 }} placeholder={`Réponse ${j + 1}`} value={o} onChange={e => setQ(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} /></div>
              ))}
              {q.options.length < 6 && <button className="btn btn-sm btn-ghost mt-s" onClick={() => setQ(i, { options: [...q.options, ''] })}>+ Réponse</button>}
            </div>
          ))}
          <button className="btn btn-soft" onClick={() => setQuiz([...quiz, { q: '', options: ['', ''], answer: 0 }])}>+ Question</button>
        </div>
      )}
    </Modal>
  );
}
