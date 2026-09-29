import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n, LANGS } from '../i18n';
import { api } from '../api/client';
import { Avatar, Icon } from '../components/ui';
import AiAssistant from '../components/AiAssistant';

export default function AppLayout({ nav }) {
  const { session, can, logout, unread, setUnread } = useAuth();
  const { t, lang, setLang, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState(null);
  const [ai, setAi] = useState(false);
  const loc = useLocation();
  const { user, tenant } = session;
  const features = (tenant.plan && tenant.plan.features) || {};
  const isFamily = ['parent', 'student'].includes(user.role);
  const visible = nav.filter(n => n.sec || (can(n.perm) && (!n.feature || features[n.feature]) && !(n.hideFor || []).includes(user.role)));

  const openNotifs = async () => {
    const { data } = await api.get('/notifications');
    setNotifs(data.data);
    await api.post('/notifications/read');
    setUnread(0);
  };
  const changeLang = l => { setLang(l); api.patch('/auth/me/preferences', { locale: l }).catch(() => {}); };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark">A</div><div><div className="brand-name">Athénée</div><div className="brand-sub">School OS</div></div></div>
        <div className="tenant-card">
          <div className="tenant-logo" style={{ background: tenant.primaryColor }}>{tenant.name.split(' ').filter(w => w.length > 2).slice(-2).map(w => w[0]).join('')}</div>
          <div style={{ minWidth: 0, flex: 1 }}><div className="tenant-name">{tenant.name}</div><div className="tenant-meta">{tenant.city} · {tenant.schoolYear}</div></div>
        </div>
        <nav className="nav">
          {visible.map((n, i) => n.sec
            ? (visible[i + 1] && !visible[i + 1].sec ? <div key={n.sec} className="nav-section">{t(n.sec)}</div> : null)
            : <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={n.icon} /><span>{t(isFamily && n.parentKey ? n.parentKey : n.key)}</span></NavLink>)}
        </nav>
        <div className="sidebar-foot"><div className="plan-pill"><span>{t('layout.plan')} <b style={{ color: 'var(--gold-soft)', fontWeight: 500 }}>{tenant.plan && tenant.plan.name}</b></span><button className="btn btn-sm" style={{ color: '#9AA6C2', background: 'transparent' }} onClick={logout}><Icon name="logout" size={15} /> {t('layout.logout')}</button></div></div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(o => !o)}><Icon name="dashboard" /></button>
          <div className="spacer" />
          <select className="lang-switch" value={lang} onChange={e => changeLang(e.target.value)} aria-label={t('layout.language')}>{LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <span className="badge navy plain">{t(`role.${user.role}`)}</span>
          <button className="icon-btn" title={t('layout.notifications')} onClick={openNotifs}><Icon name="bell" />{unread > 0 && <span className="dot" />}</button>
          <Link to="/account" className="user-chip"><Avatar person={user} /><div className="txt"><div className="n">{user.firstName} {user.lastName}</div><div className="r">{user.email}</div></div></Link>
        </header>
        <main className="content"><div className="view" key={loc.pathname}><Outlet /></div></main>
      </div>
      {can('ai:use') && features.ai && <button className="ai-fab" onClick={() => setAi(true)}><Icon name="sparkles" /><span>{t('layout.ai')}</span></button>}
      {ai && <AiAssistant onClose={() => setAi(false)} />}
      {notifs && (
        <>
          <div className="overlay" style={{ background: 'rgba(8,18,38,.18)' }} onClick={() => setNotifs(null)} />
          <aside className="drawer open">
            <div className="drawer-h"><h3 className="serif" style={{ fontSize: 20 }}>{t('layout.notifications')}</h3><button className="icon-btn" onClick={() => setNotifs(null)}><Icon name="x" /></button></div>
            <div className="drawer-b"><div className="list">{notifs.length ? notifs.map(n => (
              <div className="li" key={n.id}><div className="dot-ic navy"><Icon name="bell" size={15} /></div><div className="grow"><div className="t" style={{ whiteSpace: 'normal' }}>{n.title}</div>{n.body && <div className="s" style={{ whiteSpace: 'normal' }}>{n.body}</div>}<div className="s">{new Date(n.createdAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div></div>
            )) : <div className="empty">{t('layout.noNotifications')}</div>}</div></div>
          </aside>
        </>
      )}
    </div>
  );
}
