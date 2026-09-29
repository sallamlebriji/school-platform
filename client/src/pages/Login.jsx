import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { errorMessage, getTenantSlug } from '../api/client';
import { ErrorBox } from '../components/ui';
import { useI18n, LANGS } from '../i18n';

const DEMO = ['direction', 'scolarite', 'comptabilite', 'enseignant', 'parent', 'eleve', 'infirmerie', 'chauffeur'];

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [tenant, setTenant] = useState(getTenantSlug());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [need2fa, setNeed2fa] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const r = await login(tenant, email, password, need2fa ? code : undefined); if (r.twoFactorRequired) setNeed2fa(true); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-side">
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark">A</div><div><div className="brand-name">Athénée</div><div className="brand-sub">School OS</div></div></div>
        <div style={{ position: 'relative', zIndex: 1 }}><h1>{t('login.hero1')}<br /><em>{t('login.hero2')}</em></h1><p style={{ color: '#AEB9D2', marginTop: 16, maxWidth: 440, lineHeight: 1.6 }}>{t('login.heroText')}</p></div>
        <div style={{ fontSize: 12.5, color: '#8391B0' }}>{t('login.trust')}</div>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <div className="row between"><h2 className="serif" style={{ fontSize: 30, fontWeight: 500 }}>{t('login.title')}</h2><select className="lang-switch" value={lang} onChange={e => setLang(e.target.value)}>{LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <p className="muted" style={{ marginTop: -6 }}>{t('login.subtitle')}</p>
          {error && <ErrorBox error={error} />}
          <div className="field"><label>{t('login.school')}</label>
            <select className="select" value={tenant} onChange={e => setTenant(e.target.value)}>
              <option value="alfarabi">Groupe Scolaire Al Farabi (Premium)</option>
              <option value="lumiere">École Internationale Lumière (Essentiel)</option>
            </select>
          </div>
          <div className="field"><label>{t('login.email')}</label><input className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="field"><label>{t('login.password')}</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {need2fa && <div className="field"><label>{t('login.code')}</label><input className="input" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} autoFocus /></div>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? t('login.submitting') : t('login.submit')}</button>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('login.demo')}</div>
            <div className="demo-accounts">{DEMO.map(r => <button type="button" key={r} onClick={() => setEmail(`${r}@${tenant}.athenee.app`)}>{r}</button>)}</div>
          </div>
        </form>
      </div>
    </div>
  );
}
