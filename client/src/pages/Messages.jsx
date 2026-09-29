import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Avatar, Empty, ErrorBox, Icon, PageHeader, useFetch, useToast } from '../components/ui';
import { ROLES, dateTime, fullName } from '../lib/format';

/** Messagerie temps réel (Socket.IO, salon conv:<id>). */
export default function Messages() {
  const { session, socket } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const convs = useFetch('/conversations');
  const [cur, setCur] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const box = useRef(null);

  useEffect(() => { if (!cur && convs.data && convs.data.data[0]) setCur(convs.data.data[0]); }, [convs.data, cur]);
  useEffect(() => {
    if (!cur) return undefined;
    api.get(`/conversations/${cur.id}/messages`).then(r => setMsgs(r.data.data)).catch(e => toast(errorMessage(e), 'alert'));
    if (!socket) return undefined;
    socket.emit('conv:join', cur.id);
    const onMsg = m => { if (Number(m.conversationId) === Number(cur.id)) setMsgs(list => (list.some(x => x.id === m.id) ? list : [...list, m])); };
    socket.on('message', onMsg);
    return () => socket.off('message', onMsg);
  }, [cur, socket, toast]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  const send = async e => {
    e.preventDefault();
    if (!text.trim()) return;
    try { const { data } = await api.post(`/conversations/${cur.id}/messages`, { body: text }); setMsgs(list => (list.some(x => x.id === data.id) ? list : [...list, data])); setText(''); }
    catch (err) { toast(errorMessage(err), 'alert'); }
  };
  const other = c => c.members.map(m => m.user).find(u => u.id !== session.user.id) || c.members[0].user;

  return (
    <>
      <PageHeader title={t('msg.title')} sub={t('msg.sub')} />
      {convs.error && <ErrorBox error={convs.error} />}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="chat">
          <div className="chat-list"><div className="list">{convs.data && convs.data.data.map(c => { const u = other(c); return (
            <div key={c.id} className="li click" style={cur && cur.id === c.id ? { background: 'var(--beige-50)' } : undefined} onClick={() => setCur(c)}>
              <Avatar person={u} /><div className="grow"><div className="t">{c.title || fullName(u)}</div><div className="s">{c.lastMessage ? c.lastMessage.body : ROLES[u.role]}</div></div>
            </div>); })}{convs.data && !convs.data.data.length && <Empty>{t('msg.none')}</Empty>}</div></div>
          <div className="chat-main">
            {cur ? <>
              <div className="row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}><Avatar person={other(cur)} /><div><b>{cur.title || fullName(other(cur))}</b><div className="muted" style={{ fontSize: 12 }}>{ROLES[other(cur).role]}</div></div></div>
              <div className="chat-msgs" ref={box}>{msgs.map(m => <div key={m.id} className={`msg ${m.senderId === session.user.id ? 'out' : 'in'}`}>{m.body}<div className="time">{dateTime(m.createdAt)}</div></div>)}</div>
              <form className="chat-input" onSubmit={send}><input className="input" value={text} onChange={e => setText(e.target.value)} placeholder={t('msg.placeholder')} /><button className="btn btn-primary"><Icon name="send" size={15} /></button></form>
            </> : <Empty>{t('msg.pick')}</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
