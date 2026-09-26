'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, LifeBuoy, Send, X } from 'lucide-react';
import './help-desk.css';

type Message = { id: string; sender: string; body: string; created_at: number };
type Thread = { id: string; status: string; category: string; subject: string };
const suggestions = ['Photo verification', 'Nearby profiles', 'Subscription', 'Edit my profile', 'Report a concern'];

export function HelpDesk() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void fetch('/api/help', { credentials: 'include', cache: 'no-store' }).then(async (response) => {
      const body = await response.json() as { thread?: Thread; threads?: Thread[]; messages?: Message[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Help is unavailable.');
      setThread(body.thread ?? null); setThreads(body.threads ?? []); setMessages(body.messages ?? []);
    }).catch((reason: Error) => setError(reason.message));
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  async function selectThread(id: string) {
    if (!id) { setThread(null); setMessages([]); return; }
    setError('');
    const response = await fetch(`/api/help?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
    const body = await response.json() as { thread?: Thread; messages?: Message[]; error?: string };
    if (!response.ok) { setError(body.error ?? 'Could not open the conversation.'); return; }
    setThread(body.thread ?? null); setMessages(body.messages ?? []);
  }
  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/help', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, threadId: thread?.id }) });
      const body = await response.json() as { threadId?: string; answer?: string; status?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not send your message.');
      setThread((current) => ({ id: body.threadId ?? current?.id ?? '', status: body.status ?? current?.status ?? 'self_service', category: current?.category ?? 'general', subject: current?.subject ?? message.slice(0, 100) }));
      if (!thread && body.threadId) setThreads((current) => [{ id: body.threadId!, status: 'self_service', category: 'general', subject: message.slice(0, 100) }, ...current]);
      setMessages((current) => [...current, { id: crypto.randomUUID(), sender: 'user', body: message, created_at: Date.now() }, { id: crypto.randomUUID(), sender: body.status === 'open' ? 'system' : 'assistant', body: body.answer ?? '', created_at: Date.now() + 1 }]);
      setDraft('');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function escalate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!thread) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/help', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ threadId: thread.id, subject, category }) });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not send your request.');
      setThread({ ...thread, status: 'open', subject, category });
      setMessages((current) => [...current, { id: crypto.randomUUID(), sender: 'system', body: body.message ?? 'Sent to support.', created_at: Date.now() }]);
      setEscalating(false);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <><button type="button" onClick={() => setOpen(true)}><LifeBuoy size={19} /><span><strong>Help &amp; support</strong><small>Ask SpikeDate Help or contact the owner</small></span><ChevronRight size={17} /></button>
    {open && createPortal(<div className="help-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="help-panel" role="dialog" aria-modal="true" aria-label="SpikeDate Help"><header><div><small>SPIKEDATE HELP</small><h2>How can we help?</h2></div><button type="button" aria-label="Close Help" onClick={() => setOpen(false)}><X size={22} /></button></header><p className="help-intro">Quick answers from SpikeDate’s help guide and your own account. A person reviews requests you send to support.</p>
      <div className="help-history"><button type="button" onClick={() => { setThread(null); setMessages([]); setEscalating(false); }}>New question</button>{threads.length > 0 && <label>Previous conversations<select aria-label="Previous conversations" value={thread?.id ?? ''} onChange={(event) => void selectThread(event.target.value)}><option value="">New question</option>{threads.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.status.replaceAll('_', ' ')}</option>)}</select></label>}</div>
      <div className="help-feed" aria-live="polite">{messages.length === 0 && <div className="help-suggestions">{suggestions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => void send(item)}>{item}</button>)}</div>}{messages.map((message) => <article className={`help-message ${message.sender}`} key={message.id}><small>{message.sender === 'user' ? 'You' : message.sender === 'admin' ? 'SpikeDate support' : message.sender === 'assistant' ? 'Help AI' : 'Update'}</small><p>{message.body}</p></article>)}</div>
      {error && <p className="help-error" role="alert">{error}</p>}
      {escalating ? <form className="help-escalate" onSubmit={(event) => void escalate(event)}><label>Topic<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="general">General</option><option value="billing">Billing</option><option value="verification">Verification</option><option value="location">Location</option><option value="profile">Profile</option><option value="safety">Safety</option></select></label><label>What should we review?<input value={subject} minLength={3} maxLength={100} required onChange={(event) => setSubject(event.target.value)} placeholder="Short summary" /></label><div><button type="button" onClick={() => setEscalating(false)}>Back</button><button type="submit" disabled={busy}>Send to support</button></div></form> : <><form className="help-compose" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><input aria-label="Ask a question" value={draft} maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder={thread?.status === 'open' || thread?.status === 'waiting_user' ? 'Add a note for support…' : 'Ask a question…'} /><button type="submit" disabled={busy || !draft.trim()} aria-label="Send message"><Send size={18} /></button></form><div className="help-footer">{thread?.status === 'self_service' && <button type="button" onClick={() => { setSubject(thread.subject); setCategory(thread.category); setEscalating(true); }}>Need a person? Send to support</button>}{thread && thread.status !== 'self_service' && <span>Request status: {thread.status.replaceAll('_', ' ')}</span>}<small>AI cannot issue refunds or change accounts.</small></div></>}
    </section></div>, document.body)}</>;
}
