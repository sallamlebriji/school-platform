import { useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, ErrorBox, Kpi, Loader, PageHeader, useFetch } from '../components/ui';
import { dec } from '../lib/format';

export default function Analytics() {
  const levels = useFetch('/levels?limit=50&sort=position');
  const [levelId, setLevelId] = useState('');
  const { data, loading, error } = useFetch(`/analytics/overview${levelId ? `?levelId=${levelId}` : ''}`);
  const subjects = useFetch('/subjects?limit=50');
  if (error) return <><PageHeader title="Analytics" /><ErrorBox error={error} /></>;
  const sName = id => { const s = subjects.data && subjects.data.data.find(x => Number(x.id) === Number(id)); return s ? s.shortName : id; };
  const bySubject = data ? Object.values(data.bySubject.reduce((acc, r) => { const k = r.subjectId; acc[k] = acc[k] || { subject: sName(k), sum: 0, n: 0 }; acc[k].sum += Number(r.average); acc[k].n++; return acc; }, {})).map(x => ({ subject: x.subject, moyenne: Math.round(x.sum / x.n * 100) / 100 })) : [];

  return (
    <>
      <PageHeader title="Analytics & BI" sub="Pilotage stratégique" actions={<select className="select" value={levelId} onChange={e => setLevelId(e.target.value)}><option value="">Tous les niveaux</option>{levels.data && levels.data.data.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>} />
      {loading ? <Loader /> : (
        <>
          <div className="grid g-3 mb">
            <Kpi label="Moyenne des classes" value={dec(data.byClass.filter(c => c.average).reduce((a, c, _, arr) => a + c.average / arr.length, 0))} icon="grades" />
            <Kpi label="Taux de paiement" value={`${dec(data.paymentRate, 1)} %`} icon="finance" gold />
            <Kpi label="Classes analysées" value={data.byClass.length} icon="classes" />
          </div>
          <div className="grid g-2">
            <Card title="Performance par classe"><ResponsiveContainer width="100%" height={240}><BarChart data={data.byClass}><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[8, 16]} tick={{ fontSize: 11 }} /><Tooltip /><RBar dataKey="average" name="Moyenne" fill="#1D3462" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card>
            <Card title="Performance par matière"><ResponsiveContainer width="100%" height={240}><BarChart data={bySubject}><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="subject" tick={{ fontSize: 11 }} /><YAxis domain={[8, 16]} tick={{ fontSize: 11 }} /><Tooltip /><RBar dataKey="moyenne" fill="#B08D57" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Card>
          </div>
          <Card title="Absentéisme hebdomadaire" className="mt"><ResponsiveContainer width="100%" height={220}><LineChart data={data.attendanceByWeek.map(w => ({ semaine: String(w.week).slice(4), justifiées: Number(w.justified), nonJustifiées: Number(w.unjustified), retards: Number(w.lates) }))}><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="semaine" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line dataKey="justifiées" stroke="#6F8FC4" strokeWidth={2} /><Line dataKey="nonJustifiées" stroke="#B0443B" strokeWidth={2} /><Line dataKey="retards" stroke="#B08D57" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
        </>
      )}
    </>
  );
}
