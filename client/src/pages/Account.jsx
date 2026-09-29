import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n, LANGS } from '../i18n';
import { Card, Icon, PageHeader, useToast } from '../components/ui';
import { disablePush, enablePush, pushStatus } from '../lib/push';

export default function Account() {
  const { session, reload } = useAuth();
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const [prefs, setPrefs] = useState(session.user.notifyPrefs || { email: true, push: true, sms: true });
  const [phone, setPhone] = useState(session.user.phone || '');
  const [push, setPush] = useState('…');

  useEffect(() => { pushStatus().then(setPush); }, []);

  const save = async (patch) => {
    try { await api.patch('/auth/me/preferences', patch); await reload(); toast(t('account.saved')); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const toggle = k => { const next = { ...prefs, [k]: !prefs[k] }; setPrefs(next); save({ notifyPrefs: next }); };
  const changeLang = l => { setLang(l); save({ locale: l }); };
  const togglePush = async () => {
    try { setPush(push === 'on' ? await disablePush() : await enablePush()); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const pushMsg = { unsupported: t('account.pushUnsupported'), denied: t('account.pushDenied'), disabled: t('account.pushDisabled') }[push];

  return (
    <>
      <PageHeader title={t('account.title')} sub={t('account.sub')} />
      <div className="grid g-2">
        <Card title={t('account.language')}>
          <div className="pill-filter">{LANGS.map(([k, l]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => changeLang(k)}>{l}</button>)}</div>
        </Card>
        <Card title={t('account.notifications')} sub={t('account.notificationsSub')}>
          {[['email', 'account.email'], ['push', 'account.push'], ['sms', 'account.sms']].map(([k, label]) => (
            <div key={k} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
              <span>{t(label)}</span><button className={`switch ${prefs[k] ? 'on' : ''}`} onClick={() => toggle(k)} aria-pressed={prefs[k]} />
            </div>
          ))}
          <div className="field mt"><label>{t('account.phone')}</label>
            <div className="row"><input className="input" style={{ flex: 1 }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+212 6…" /><button className="btn btn-ghost" onClick={() => save({ phone })}>{t('common.save')}</button></div>
          </div>
          <div className="divider" />
          <div className="row between">
            <span className="row"><Icon name="bell" />{push === 'on' ? t('account.pushOn') : t('account.push')}</span>
            {pushMsg ? <span className="muted" style={{ fontSize: 12.5, maxWidth: 260 }}>{pushMsg}</span>
              : <button className={`btn btn-sm ${push === 'on' ? 'btn-ghost' : 'btn-primary'}`} onClick={togglePush}>{push === 'on' ? t('common.remove') : t('account.pushEnable')}</button>}
          </div>
        </Card>
      </div>
    </>
  );
}
