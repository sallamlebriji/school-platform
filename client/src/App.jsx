import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Guardians from './pages/Guardians';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Homework from './pages/Homework';
import Transport from './pages/Transport';
import Finance from './pages/Finance';
import Messages from './pages/Messages';
import Support from './pages/Support';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Health from './pages/Health';
import Enrollments from './pages/Enrollments';
import Account from './pages/Account';
import Calendar from './pages/Calendar';
import CoursePlayer from './pages/CoursePlayer';
import { PaySimulate, PayReturn } from './pages/Pay';
import { Courses, Library, Activities, LostFound, Canteen, Announcements } from './pages/Resources';
import { Loader } from './components/ui';

/**
 * Navigation : chaque entrée n'apparaît que si le rôle possède la permission
 * (et si le module est inclus dans le plan de l'école). Libellés traduits via `key`.
 */
export const NAV = [
  { sec: 'nav.section.pilotage' },
  { to: '/', key: 'nav.dashboard', icon: 'dashboard', perm: 'dashboard:read', el: <Dashboard /> },
  { to: '/analytics', key: 'nav.analytics', icon: 'analytics', perm: 'analytics:read', el: <Analytics />, feature: 'analytics' },
  { sec: 'nav.section.community' },
  { to: '/students', key: 'nav.students', icon: 'students', perm: 'students:read', el: <Students />, hideFor: ['parent', 'student'] },
  { to: '/guardians', key: 'nav.guardians', icon: 'parents', perm: 'guardians:read', el: <Guardians /> },
  { to: '/teachers', key: 'nav.teachers', icon: 'teachers', perm: 'teachers:read', el: <Teachers />, hideFor: ['teacher'] },
  { to: '/enrollments', key: 'nav.enrollments', icon: 'enroll', perm: 'enrollments:read', el: <Enrollments /> },
  { sec: 'nav.section.pedagogy' },
  { to: '/classes', key: 'nav.classes', icon: 'classes', perm: 'classes:read', el: <Classes />, hideFor: ['parent', 'student'] },
  { to: '/timetable', key: 'nav.timetable', icon: 'timetable', perm: 'timetable:read', el: <Timetable /> },
  { to: '/attendance', key: 'nav.attendance', icon: 'attendance', perm: 'attendance:read', el: <Attendance /> },
  { to: '/grades', key: 'nav.grades', icon: 'grades', perm: 'grades:read', el: <Grades /> },
  { to: '/homework', key: 'nav.homework', icon: 'homework', perm: 'homework:read', el: <Homework /> },
  { to: '/courses', key: 'nav.courses', icon: 'elearning', perm: 'courses:read', el: <Courses />, feature: 'elearning' },
  { to: '/library', key: 'nav.library', icon: 'library', perm: 'library:read', el: <Library /> },
  { sec: 'nav.section.life' },
  { to: '/transport', key: 'nav.transport', icon: 'transport', perm: 'transport:read', el: <Transport />, feature: 'transport' },
  { to: '/canteen', key: 'nav.canteen', icon: 'canteen', perm: 'canteen:read', el: <Canteen /> },
  { to: '/activities', key: 'nav.activities', icon: 'activities', perm: 'activities:read', el: <Activities /> },
  { to: '/health', key: 'nav.health', icon: 'health', perm: 'health:read', el: <Health /> },
  { to: '/lost', key: 'nav.lost', icon: 'lost', perm: 'lost:read', el: <LostFound /> },
  { sec: 'nav.section.exchanges' },
  { to: '/messages', key: 'nav.messages', icon: 'communication', perm: 'messages:read', el: <Messages /> },
  { to: '/announcements', key: 'nav.announcements', icon: 'bell', perm: 'announcements:read', el: <Announcements /> },
  { to: '/calendar', key: 'nav.calendar', icon: 'calendar', perm: 'events:read', el: <Calendar /> },
  { sec: 'nav.section.admin' },
  { to: '/finance', key: 'nav.finance', parentKey: 'nav.payments', icon: 'finance', perm: 'finance:read', el: <Finance /> },
  { to: '/support', key: 'nav.support', icon: 'support', perm: 'tickets:read', el: <Support /> },
  { to: '/settings', key: 'nav.settings', icon: 'settings', perm: 'settings:write', el: <Settings /> },
  { to: '/account', key: 'nav.account', icon: 'user', perm: 'profile:read', el: <Account /> },
];

export default function App() {
  const { session, loading, can } = useAuth();
  if (loading) return <Loader />;
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>;
  const features = (session.tenant.plan && session.tenant.plan.features) || {};
  const routes = NAV.filter(n => n.to && can(n.perm) && (!n.feature || features[n.feature]));
  return (
    <Routes>
      <Route element={<AppLayout nav={NAV} />}>
        {routes.map(n => <Route key={n.to} path={n.to} element={n.el} />)}
        {can('students:read') && <Route path="/students/:id" element={<StudentDetail />} />}
        {can('classes:read') && <Route path="/classes/:id" element={<ClassDetail />} />}
        {can('courses:read') && features.elearning && <Route path="/courses/:id" element={<CoursePlayer />} />}
        {can('finance:read') && <Route path="/pay/simulate/:id" element={<PaySimulate />} />}
        {can('finance:read') && <Route path="/pay/return" element={<PayReturn />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
