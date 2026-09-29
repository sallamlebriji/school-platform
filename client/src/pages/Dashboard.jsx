import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Badge, Card, Empty, ErrorBox, Icon, Kpi, Loader, PageHeader, useFetch } from '../components/ui';
import { date, dateTime, dec, fullName, gradeColor, kmoney, money, num } from '../lib/format';

const COLORS = ['#1D3462', '#B08D57', '#6F8FC4', '#8FB0A0'];
const hello = () => (new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir');
const longDate = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function Dashboard() {
  const { session } = useAuth();
  const { data, loading, error } = useFetch('/dashboard');
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  if (data.role === 'admin') return <AdminDash d={data} session={session} />;
  if (data.role === 'teacher') return <TeacherDash d={data} session={session} />;
  return <FamilyDash d={data} session={session} />;
}

function AdminDash({ d, session }) {
  const nav = useNavigate();
  const cur = session.tenant.currency;
  const k = d.kpis;
  const todo = [['finance', 'warning', d.todo.payments, 'Paiements en attente', '/finance'], ['attendance', 'danger', d.todo.unjustifiedAbsences, 'Absences non justifiées', '/attendance'], ['documents', 'info', d.todo.missingDocuments, 'Dossiers à compléter', '/enrollments'], ['enroll', 'navy', d.todo.applications, 'Inscriptions à valider', '/enrollments'], ['support', 'warning', d.todo.tickets, 'Réclamations', '/support'], ['transport', 'danger', d.todo.transportAlerts, 'Alertes transport', '/transport']];
  const revenue = d.charts.revenueByMonth.map(r => ({ month: r.month.slice(5) + '/' + r.month.slice(2, 4), montant: r.amountCents / 100 }));
  return (
    <>
      <PageHeader title={`${hello()}, ${session.user.firstName}`} sub={`${longDate()} · ${session.tenant.name}`} />
      <div className="grid g-6">
        <Kpi label="Élèves" value={num(k.students)} icon="students" onClick={() => nav('/students')} />
        <Kpi label="Enseignants" value={num(k.teachers)} icon="teachers" onClick={() => nav('/teachers')} />
        <Kpi label="Classes" value={k.classes} icon="classes" onClick={() => nav('/classes')} />
        <Kpi label="Taux de présence" value={`${dec(k.presence, 1)} %`} icon="attendance" foot={<span>{k.absences} absences · {k.lates} retards</span>} />
        <Kpi label="Paiements en attente" value={num(k.pendingPayments)} icon="finance" foot={<span>{kmoney(k.pendingAmountCents, cur)}</span>} gold />
        <Kpi label="Transport actif" value={<>{k.busesInService}<small>/ {k.buses} bus</small></>} icon="transport" />
      </div>
      <Card title="À traiter aujourd'hui" sub="Priorités opérationnelles" className="mt">
        <div className="todo-grid">{todo.map(t => <div key={t[3]} className="todo" onClick={() => nav(t[4])}><div className={`dot-ic ${t[1]}`}><Icon name={t[0]} size={15} /></div><div className="n">{t[2]}</div><div className="l">{t[3]}</div></div>)}</div>
      </Card>
      <div className="grid g-main mt">
        <Card title="Revenus encaissés" sub="12 derniers mois">
          {revenue.length ? <ResponsiveContainer width="100%" height={240}><AreaChart data={revenue}><defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D3462" stopOpacity={0.25} /><stop offset="1" stopColor="#1D3462" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} /><Tooltip formatter={v => money(v * 100, cur)} /><Area dataKey="montant" stroke="#1D3462" strokeWidth={2.2} fill="url(#rv)" /></AreaChart></ResponsiveContainer> : <Empty />}
        </Card>
        <Card title="Répartition des élèves" sub="Par cycle">
          <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={d.charts.byCycle} dataKey="count" nameKey="cycle" innerRadius={55} outerRadius={80} paddingAngle={2}>{d.charts.byCycle.map((_, i) => <Cell key={i} fill={COLORS[i % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <div className="legend" style={{ justifyContent: 'center' }}>{d.charts.byCycle.map((c, i) => <span key={c.cycle}><i style={{ background: COLORS[i % 4] }} />{c.cycle} · {c.count}</span>)}</div>
        </Card>
      </div>
      <div className="grid g-main mt">
        <Card title="Évolution des inscriptions" sub="Élèves par année d'arrivée">
          <ResponsiveContainer width="100%" height={200}><BarChart data={d.charts.enrolledByYear}><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><RBar dataKey="count" name="Élèves" fill="#B08D57" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </Card>
        <Card title="Activité récente" sub="Journal d'audit" flush>
          <div className="list">{d.recent.map(a => <div className="li" key={a.id}><div className="grow"><div className="t">{a.action}</div><div className="s">{a.user ? fullName(a.user) : 'Système'} · {dateTime(a.createdAt)}</div></div></div>)}{!d.recent.length && <Empty />}</div>
        </Card>
      </div>
    </>
  );
}

function TeacherDash({ d, session }) {
  const nav = useNavigate();
  return (
    <>
      <PageHeader title={`${hello()}, ${session.user.firstName}`} sub={`${longDate()} · ${session.teacher && session.teacher.subject ? session.teacher.subject.name : ''}`} actions={<button className="btn btn-primary" onClick={() => nav('/attendance')}><Icon name="attendance" size={15} /> Faire l'appel</button>} />
      <div className="grid g-3">
        <Kpi label="Classes" value={d.classes.length} icon="classes" />
        <Kpi label="Cours aujourd'hui" value={d.today.length} icon="timetable" />
        <Kpi label="Copies à corriger" value={d.homework.reduce((a, h) => a + h.toGrade, 0)} icon="homework" gold />
      </div>
      <div className="grid g-2 mt">
        <Card title="Mon emploi du temps du jour" flush>
          <div className="list">{d.today.length ? d.today.map(s => <div className="li" key={s.id}><span style={{ width: 90, fontSize: 12, color: 'var(--ink-3)' }}>{s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}</span><div className="grow"><div className="t">{s.class.name} — {s.subject.name}</div><div className="s">Salle {s.room ? s.room.name : '—'}</div></div></div>) : <Empty>Pas de cours aujourd'hui</Empty>}</div>
        </Card>
        <Card title="Devoirs" flush>
          <div className="list">{d.homework.map(h => <div className="li" key={h.id}><div className="grow"><div className="t">{h.title}</div><div className="s">à rendre le {date(h.dueAt)}</div></div>{h.toGrade ? <Badge kind="warning">{h.toGrade} à corriger</Badge> : <Badge kind="success">À jour</Badge>}</div>)}</div>
        </Card>
      </div>
    </>
  );
}

function FamilyDash({ d, session }) {
  const nav = useNavigate();
  const { t, locale } = useI18n();
  const cur = session.tenant.currency;
  const when = x => new Date(x).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const greet = new Date().getHours() < 18 ? 'dash.hello' : 'dash.evening';
  return (
    <>
      <PageHeader title={t(greet, { name: session.user.firstName })} sub={`${new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${t('dash.children', { n: d.children.length })}`} />
      <div className={`grid ${d.children.length > 1 ? 'g-2' : ''}`}>
        {d.children.map(c => (
          <div className="card" key={c.student.id}>
            <div className="hero-360" style={{ padding: '20px 20px 12px', cursor: 'pointer' }} onClick={() => nav(`/students/${c.student.id}`)}>
              <div className="avatar lg" style={{ background: '#E8DFCF' }}>{c.student.firstName[0]}{c.student.lastName[0]}</div>
              <div style={{ flex: 1 }}><div className="serif" style={{ fontSize: 22 }}>{fullName(c.student)}</div><div className="muted">{c.student.class ? c.student.class.name : ''}</div></div>
              {c.absentToday ? <Badge kind="danger">{t('dash.absentToday')}</Badge> : <Badge kind="success">{t('dash.present')}</Badge>}
            </div>
            <div className="grid g-2" style={{ padding: '0 20px', gap: 10 }}>
              <div className="card beige kpi mini"><span className="kpi-label">{t('dash.average')}</span><span className="kpi-val" style={{ color: gradeColor(c.average) }}>{dec(c.average)}</span></div>
              <div className="card beige kpi mini"><span className="kpi-label">{t('dash.rank')}</span><span className="kpi-val">{c.rank || '—'}</span></div>
            </div>
            <div className="list mt-s">
              {c.student.busAssignment && <div className="li click" onClick={() => nav('/transport')}><div className="dot-ic info"><Icon name="transport" size={15} /></div><div className="grow"><div className="t">{c.student.busAssignment.bus.lineName}</div><div className="s">{t('dash.stop', { name: c.student.busAssignment.stop.name })} · {c.student.busAssignment.stop.scheduledTime.slice(0, 5)}</div></div></div>}
              {c.homework.map(h => <div className="li click" key={h.id} onClick={() => nav('/homework')}><div className="dot-ic warning"><Icon name="homework" size={15} /></div><div className="grow"><div className="t">{h.title}</div><div className="s">{h.subject.name} · {t('dash.dueOn', { date: when(h.dueAt) })}</div></div></div>)}
              {c.pendingInvoices.length > 0 && <div className="li click" onClick={() => nav('/finance')}><div className="dot-ic danger"><Icon name="finance" size={15} /></div><div className="grow"><div className="t">{t('dash.pendingPayments', { n: c.pendingInvoices.length })}</div><div className="s">{money(c.pendingInvoices.reduce((a, i) => a + i.amountCents, 0), cur)}</div></div><span className="btn btn-sm btn-primary">{t('pay.payOnline')}</span></div>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid g-3 mt">
        <Card title={t('dash.announcements')} flush><div className="list">{d.announcements.map(a => <div className="li" key={a.id}><div className="grow"><div className="t">{a.title}</div><div className="s" style={{ whiteSpace: 'normal' }}>{a.body}</div></div></div>)}</div></Card>
        <Card title={t('dash.menu')}>{d.menu ? <div className="stack" style={{ gap: 8 }}><div>{d.menu.starter}</div><b>{d.menu.main}</b><div>{d.menu.dessert}</div><span className="badge success">{d.menu.vegetarian}</span></div> : <Empty>{t('dash.noMenu')}</Empty>}</Card>
        <Card title={t('dash.events')} flush><div className="list">{d.events.map(e => <div className="li" key={e.id}><div className="grow"><div className="t">{e.title}</div><div className="s">{e.kind} · {when(e.startsAt.replace(' ', 'T'))}</div></div></div>)}</div></Card>
      </div>
    </>
  );
}
