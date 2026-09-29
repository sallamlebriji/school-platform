import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Card, ErrorBox, Icon, Loader } from '../components/ui';
import { money } from '../lib/format';

/** Page de paiement factice (développement, sans clé Stripe). Remplacée en production par la page du prestataire. */
export function PaySimulate() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const { session } = useAuth();
  const [ps, setPs] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/finance/checkout/${id}`).then(r => setPs(r.data)).catch(e => setError(errorMessage(e))); }, [id]);

  const finish = async outcome => {
    setBusy(true);
    try { await api.post(`/finance/checkout/${id}/simulate`, { outcome }); nav(`/pay/return?session=${id}${outcome === 'failed' ? '&cancelled=1' : ''}`); }
    catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  if (error) return <ErrorBox error={error} />;
  if (!ps) return <Loader />;
  return (
    <div style={{ maxWidth: 520, margin: '40px auto' }}>
      <Card>
        <div className="lock mb"><Icon name="alert" /><span><b>{t('pay.simTitle')}</b> — {t('pay.simText')}</span></div>
        <div className="muted" style={{ fontSize: 12.5 }}>{ps.invoice.number} · {ps.invoice.student.firstName} {ps.invoice.student.lastName}</div>
        <div style={{ fontWeight: 600, marginTop: 4 }}>{ps.invoice.label}</div>
        <div className="serif" style={{ fontSize: 36, margin: '14px 0 20px' }}>{money(ps.amountCents, session.tenant.currency)}</div>
        <div className="stack" style={{ gap: 10 }}>
          <button className="btn btn-primary btn-lg" disabled={busy || ps.status !== 'pending'} onClick={() => finish('paid')}><Icon name="card" size={16} /> {t('pay.simPay')}</button>
          <button className="btn btn-ghost" disabled={busy || ps.status !== 'pending'} onClick={() => finish('failed')}>{t('pay.simFail')}</button>
        </div>
      </Card>
    </div>
  );
}

/** Retour du prestataire : on interroge le serveur (seule source de vérité : le webhook). */
export function PayReturn() {
  const [params] = useSearchParams();
  const { t } = useI18n();
  const id = params.get('session');
  const [ps, setPs] = useState(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!id) return undefined;
    const tick = () => api.get(`/finance/checkout/${id}`).then(r => { setPs(r.data); if (r.data.status === 'pending' && tries < 10) setTimeout(() => setTries(n => n + 1), 1500); }).catch(() => {});
    tick();
    return undefined;
  }, [id, tries]);
  const state = !ps ? 'pending' : ps.status === 'paid' || ps.invoice.status === 'paid' ? 'paid' : ps.status === 'pending' && !params.get('cancelled') ? 'pending' : 'failed';
  return (
    <div style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center' }}>
      <Card>
        <div className={`dot-ic ${state === 'paid' ? 'success' : state === 'failed' ? 'danger' : 'info'}`} style={{ margin: '0 auto 16px', width: 56, height: 56 }}><Icon name={state === 'paid' ? 'check' : state === 'failed' ? 'x' : 'clock'} size={24} /></div>
        <h2 className="serif" style={{ fontSize: 24, fontWeight: 500 }}>{t(state === 'paid' ? 'pay.success' : state === 'failed' ? 'pay.failed' : 'pay.pending')}</h2>
        {ps && <p className="muted mt-s">{ps.invoice.label} · {ps.invoice.number}</p>}
        <Link className="btn btn-primary mt" to="/finance">{t('pay.back')}</Link>
      </Card>
    </div>
  );
}
