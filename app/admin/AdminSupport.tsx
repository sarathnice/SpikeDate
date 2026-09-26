'use client';

import { useCallback, useEffect, useState } from 'react';

type Thread = { id: string; category: string; subject: string; status: string; updated_at: number; email: string; display_name: string | null };
type Message = { id: string; sender: string; body: string; created_at: number };

export default function AdminSupport() {
  const [rows, setRows] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/support', { credentials: 'include', cache: 'no-store' });
    const body = await response.json() as { rows?: Thread[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'Could not load support requests.');
    setRows(body.rows ?? []);
  }, []);
  const open = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/support?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
    const body = await response.json() as { thread?: Thread; messages?: Message[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? 'Could not open the request.');
    setSelected(body.thread ?? null);
    setMessages(body.messages ?? []);
  }, []);
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [load]);
  async function act(action: 'reply' | 'resolve' | 'reopen') {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/support', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ threadId: selected.id, action, message: reply }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not update the request.');
      setReply(''); await Promise.all([load(), open(selected.id)]);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-support"><h2>Member support</h2><p className="admin-section-note">Only requests members send to staff appear here. AI-only conversations are not in this queue.</p>{error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-support-grid"><div className="admin-support-list">{rows.length ? rows.map((row) => <button key={row.id} type="button" className={selected?.id === row.id ? 'active' : ''} onClick={() => void open(row.id).catch((reason: Error) => setError(reason.message))}><strong>{row.display_name || row.email}</strong><small>{row.category} · {row.status} · {new Date(row.updated_at).toLocaleString()}</small><span>{row.subject}</span></button>) : <p className="admin-empty">No support requests yet.</p>}</div>
    <div className="admin-support-detail">{selected ? <><h3>{selected.subject}</h3><p>{selected.display_name || selected.email} · {selected.email} · {selected.category} · {selected.status}</p><div className="admin-support-messages">{messages.map((message) => <article key={message.id} data-sender={message.sender}><small>{message.sender} · {new Date(message.created_at).toLocaleString()}</small><p>{message.body}</p></article>)}</div><label htmlFor="admin-support-reply">Reply to member</label><textarea id="admin-support-reply" value={reply} maxLength={2000} onChange={(event) => setReply(event.target.value)} placeholder="Write a clear response…" /><div className="admin-support-actions"><button type="button" disabled={busy || !reply.trim()} onClick={() => void act('reply')}>Send reply</button><button type="button" disabled={busy || selected.status === 'resolved'} onClick={() => void act('resolve')}>Mark resolved</button><button type="button" disabled={busy || selected.status !== 'resolved'} onClick={() => void act('reopen')}>Reopen</button></div></> : <p className="admin-empty">Select a request to view its conversation.</p>}</div></div>
  </section>;
}
