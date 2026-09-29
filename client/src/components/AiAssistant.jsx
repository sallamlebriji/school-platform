import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { Icon } from './ui';

const SUGGESTIONS = ['Génère un quiz sur les fractions', 'Fiche de révision sur la cellule', 'Analyse les résultats de mon enfant', 'Absences du jour'];
const md = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

export default function AiAssistant({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages, busy]);

  const ask = async q => {
    if (!q.trim() || busy) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next); setInput(''); setBusy(true);
    try { const { data } = await api.post('/ai/chat', { messages: next }); setMessages([...next, { role: 'assistant', content: data.text }]); }
    catch (e) { setMessages([...next, { role: 'assistant', content: `Erreur : ${errorMessage(e)}` }]); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="overlay" style={{ background: 'rgba(8,18,38,.18)' }} onClick={onClose} />
      <aside className="drawer open ai-panel" style={{ width: 460 }}>
        <div className="drawer-h"><div className="row"><div className="dot-ic" style={{ background: 'var(--navy-800)', color: 'var(--gold-soft)' }}><Icon name="sparkles" size={15} /></div><b>Assistant IA</b></div><button className="icon-btn" onClick={onClose}><Icon name="x" /></button></div>
        <div className="chat-msgs" ref={box} style={{ flex: 1 }}>
          {!messages.length && <div className="msg in">Bonjour ! Comment puis-je vous aider ?</div>}
          {messages.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'out' : 'in'}`} style={{ maxWidth: '88%' }} dangerouslySetInnerHTML={{ __html: md(m.content) }} />)}
          {busy && <div className="msg in typing"><span /><span /><span /></div>}
        </div>
        <div className="ai-sugg">{SUGGESTIONS.map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
        <form className="chat-input" onSubmit={e => { e.preventDefault(); ask(input); }}><input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder="Posez votre question…" /><button className="btn btn-primary"><Icon name="send" size={15} /></button></form>
      </aside>
    </>
  );
}
