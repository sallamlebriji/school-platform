import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorBox, Loader, PageHeader, useFetch, useToast } from '../components/ui';
import { fullName } from '../lib/format';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const HOURS = [['08:00', '09:00'], ['09:00', '10:00'], ['10:15', '11:15'], ['11:15', '12:15'], ['14:00', '15:00'], ['15:00', '16:00']];

/** Planning interactif : glisser-déposer un cours (direction/scolarité). Les conflits sont refusés par l'API (409). */
export default function Timetable() {
  const { can, session } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const classes = useFetch('/classes');
  const defaultClass = session.children ? session.children[0] && session.children[0].classId : session.student ? session.student.classId : null;
  const isTeacher = session.user.role === 'teacher';
  const classId = params.get('classId') || (isTeacher ? '' : defaultClass || (classes.data && classes.data.data[0] && classes.data.data[0].id));
  const path = classId ? `/timetable?classId=${classId}` : isTeacher ? '/timetable' : null;
  const tt = useFetch(path);
  const [drag, setDrag] = useState(null);
  const editable = can('timetable:write') && !!classId;

  const drop = async (weekday, [startTime, endTime]) => {
    if (!drag) return;
    try { await api.patch(`/timetable/${drag.id}/move`, { weekday, startTime, endTime }); toast('Cours déplacé — enseignant, élèves et parents notifiés', 'bell'); tt.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
    setDrag(null);
  };

  const slots = tt.data ? tt.data.data : [];
  const at = (d, h) => slots.find(s => s.weekday === d && s.startTime.slice(0, 5) === h);
  return (
    <>
      <PageHeader title="Emploi du temps" sub={editable ? 'Glissez-déposez un cours pour le déplacer' : 'Planning hebdomadaire'}
        actions={!isTeacher && classes.data && <select className="select" value={classId || ''} onChange={e => setParams({ classId: e.target.value })}>{classes.data.data.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>} />
      {tt.error && <ErrorBox error={tt.error} />}
      {tt.loading && path ? <Loader /> : (
        <div className="tt">
          <div className="tt-h" />{DAYS.map(d => <div className="tt-h" key={d}>{d}</div>)}
          {HOURS.map(h => [
            <div className="tt-time" key={h[0]}>{h[0]}</div>,
            ...DAYS.map((_, di) => {
              const s = at(di + 1, h[0]);
              return (
                <div key={h[0] + di} className="tt-cell" onDragOver={e => { if (editable) { e.preventDefault(); e.currentTarget.classList.add('over'); } }} onDragLeave={e => e.currentTarget.classList.remove('over')} onDrop={e => { e.currentTarget.classList.remove('over'); drop(di + 1, h); }}>
                  {s && (
                    <div className="lesson" draggable={editable} onDragStart={() => setDrag(s)} style={{ background: `${s.subject.color}14`, borderColor: s.subject.color, position: 'relative' }} title={`${s.subject.name} · ${fullName(s.teacher.user)}`}>
                      <b style={{ color: s.subject.color }}>{s.subject.shortName}</b>
                      <span className="muted">{isTeacher ? s.class.name : s.teacher.user.lastName} · {s.room ? s.room.name : ''}</span>
                      {s.exceptions && s.exceptions.length > 0 && <span className="tag">Modif.</span>}
                    </div>
                  )}
                </div>
              );
            }),
          ])}
        </div>
      )}
    </>
  );
}
