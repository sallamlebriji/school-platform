import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, ErrorBox, Icon, Modal, PageHeader, Table, useFetch, useToast } from '../components/ui';
import { dateTime, fullName } from '../lib/format';

const FLOW = { new: ['in_progress', 'resolved', 'closed'], in_progress: ['resolved', 'closed'], resolved: ['closed', 'in_progress'], closed: [] };

export default function Support() {
  const { session } = useAuth();
  const toast = useToast();
  const list = useFetch('/tickets');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ subject: '', category: 'Scolarité', body: '' });
  const ticket = useFetch(open ? `/tickets/${open}` : null);
  const [reply, setReply] = useState('');
  const isStaff = ['admin', 'staff', 'accountant'].includes(session.user.role);

  const create = async () => {
    try { await api.post('/tickets', f); toast('Demande envoyée'); setCreating(false); list.reload(); }
    catch (e) { toast(errorMessage(e), 'alert'); }
  };
  const send = async () => { if (!reply.trim()) return; await api.post(`/tickets/${open}/messages`, { body: reply }); setReply(''); ticket.reload(); };
  const move = async status => { try { await api.patch(`/tickets/${open}/status`, { status }); ticket.reload(); list.reload(); } catch (e) { toast(errorMessage(e), 'alert'); } };

  return (
    <>
      <PageHeader title={isStaff ? 'Réclamations & support' : 'Mes demandes'} sub="Nouveau → En cours → Résolu → Fermé" actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} /> Nouveau ticket</button>} />
      {list.error && <ErrorBox error={list.error} />}
      <Card flush>
        <Table rows={list.data ? list.data.data : []} onRowClick={t => setOpen(t.id)} columns={[
          { label: 'Réf.', key: 'number' }, { label: 'Sujet', key: 'subject' }, { label: 'Catégorie', key: 'category' },
          { label: 'Émetteur', render: t => fullName(t.author) }, { label: 'Mis à jour', render: t => dateTime(t.updatedAt) }, { label: 'Statut', render: t => <Badge status={t.status} /> },
        ]} />
      </Card>
      {creating && (
        <Modal title="Nouveau ticket" onClose={() => setCreating(false)} footer={<><button className="btn btn-ghost" onClick={() => setCreating(false)}>Annuler</button><button className="btn btn-primary" onClick={create}>Envoyer</button></>}>
          <div className="stack">
            <div className="field"><label>Sujet</label><input className="input" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></div>
            <div className="field"><label>Catégorie</label><select className="select" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{['Scolarité', 'Finance', 'Transport', 'Cantine', 'Vie scolaire', 'Technique', 'Logistique'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Message</label><textarea className="input" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></div>
          </div>
        </Modal>
      )}
      {open && ticket.data && (
        <Modal wide title={`${ticket.data.number} — ${ticket.data.subject}`} onClose={() => setOpen(null)} footer={isStaff && FLOW[ticket.data.status].map(s => <button key={s} className="btn btn-ghost" onClick={() => move(s)}><Badge status={s} /></button>)}>
          <div className="chat-msgs" style={{ maxHeight: 360, borderRadius: 12 }}>{ticket.data.messages.map(m => <div key={m.id} className={`msg ${m.authorId === session.user.id ? 'out' : 'in'}`}><div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{fullName(m.author)}</div>{m.body}<div className="time">{dateTime(m.createdAt)}</div></div>)}</div>
          {ticket.data.status !== 'closed' && <div className="chat-input" style={{ padding: '14px 0 0' }}><input className="input" value={reply} onChange={e => setReply(e.target.value)} placeholder="Répondre…" /><button className="btn btn-primary" onClick={send}><Icon name="send" size={15} /></button></div>}
        </Modal>
      )}
    </>
  );
}
