import { useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, errorMessage, openPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Badge, Card, ErrorBox, Icon, Kpi, PageHeader, Table, useFetch, useToast } from '../components/ui';
import { dec, kmoney, money } from '../lib/format';

export default function Finance() {
  const { can, session } = useAuth();
  const { t, locale } = useI18n();
  const toast = useToast();
  const cur = session.tenant.currency;
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const isFamily = ['parent', 'student'].includes(session.user.role);
  const stats = useFetch(!isFamily && (can('finance:write') || can('analytics:read')) ? '/finance/stats' : null);
  const list = useFetch(`/finance/invoices?page=${page}&limit=25${status ? `&status=${status}` : ''}`);

  /** Guichet : encaissement espèces/chèque par la comptabilité. */
  const cashDesk = async inv => {
    try { await api.post(`/finance/invoices/${inv.id}/pay`, { method: 'cash' }); toast('Paiement encaissé — reçu envoyé'); list.reload(); stats.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  /** Famille : paiement en ligne → page sécurisée du prestataire. */
  const payOnline = async inv => {
    setPaying(inv.id);
    try { const { data } = await api.post(`/finance/invoices/${inv.id}/checkout`); toast(t('pay.redirecting'), 'card'); window.location.assign(data.url); }
    catch (e) { toast(errorMessage(e), 'alert'); setPaying(null); }
  };
  const remind = async () => {
    try { const { data } = await api.post('/finance/reminders'); toast(`${data.notifications} relance(s) envoyée(s)`, 'send'); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };

  const s = stats.data;
  const rows = list.data ? list.data.data : [];
  const due = rows.filter(i => ['due', 'overdue'].includes(i.status));
  const fmtDate = d => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <PageHeader title={isFamily ? t('pay.title') : 'Finance'} sub={isFamily ? t('pay.sub') : "Frais d'inscription, scolarité, transport, cantine et activités"}
        actions={can('finance:write') && <button className="btn btn-ghost" onClick={remind}><Icon name="send" size={15} /> Relancer les impayés</button>} />
      {isFamily && due.length > 0 && (
        <div className="card navy mb" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: '#AEB9D2' }}>{t('dash.pendingPayments', { n: due.length })}</div><div className="serif" style={{ fontSize: 32, color: '#fff' }}>{money(due.reduce((a, i) => a + i.amountCents, 0), cur)}</div></div>
          <div className="row" style={{ color: '#C9D2E6', fontSize: 12.5, maxWidth: 320 }}><Icon name="lock" /><span>{t('pay.secureText')}</span></div>
        </div>
      )}
      {s && (
        <>
          <div className="grid g-4 mb">
            <Kpi label="Paiements reçus" value={kmoney(s.paidCents, cur)} icon="check" gold />
            <Kpi label="En attente" value={kmoney(s.dueCents, cur)} icon="clock" />
            <Kpi label="Impayés" value={kmoney(s.overdueCents, cur)} icon="alert" />
            <Kpi label="Taux de recouvrement" value={`${dec(s.collectionRate, 1)} %`} icon="finance" />
          </div>
          <Card title="Revenus par mois" className="mb">
            <ResponsiveContainer width="100%" height={220}><BarChart data={s.revenueByMonth.map(m => ({ month: m.month, montant: m.amountCents / 100 }))}><CartesianGrid strokeDasharray="3 4" stroke="#E9E4DA" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} /><Tooltip formatter={v => money(v * 100, cur)} /><RBar dataKey="montant" fill="#1D3462" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </Card>
        </>
      )}
      <div className="card">
        <div className="toolbar"><div className="pill-filter">{[['', isFamily ? '—' : 'Toutes'], ['due', t('inv.due')], ['overdue', t('inv.overdue')], ['paid', t('inv.paid')]].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>)}</div></div>
        {list.error ? <ErrorBox error={list.error} /> : (
          <Table rows={rows} columns={[
            { label: t('pay.invoice'), key: 'number' },
            { label: t('common.student'), render: i => `${i.student.firstName} ${i.student.lastName}` },
            { label: t('pay.label'), key: 'label' },
            { label: t('pay.due'), render: i => fmtDate(i.dueOn) },
            { label: t('common.amount'), num: true, render: i => money(i.amountCents, cur) },
            { label: t('common.status'), render: i => <Badge status={i.status}>{t(`inv.${i.status}`)}</Badge> },
            { label: '', render: i => (i.status === 'paid'
              ? <button className="btn btn-sm btn-ghost" onClick={() => openPdf(`/finance/invoices/${i.id}/receipt.pdf`)}><Icon name="download" size={14} /> {t('pay.receipt')}</button>
              : isFamily ? can('finance:pay') && <button className="btn btn-sm btn-primary" disabled={paying === i.id} onClick={() => payOnline(i)}><Icon name="card" size={14} /> {t('pay.payOnline')}</button>
                : can('finance:write') && <button className="btn btn-sm btn-soft" onClick={() => cashDesk(i)}>Encaisser</button>) },
          ]} />
        )}
        <div className="row between" style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>{list.data ? t('common.page', { n: page, total: Math.max(1, Math.ceil(list.data.total / 25)) }) : ''}</span>
          <div className="row"><button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common.previous')}</button><button className="btn btn-sm btn-ghost" disabled={!list.data || page * 25 >= list.data.total} onClick={() => setPage(p => p + 1)}>{t('common.next')}</button></div>
        </div>
      </div>
    </>
  );
}
