'use client';

import { useState, type FormEvent } from 'react';

type Match = { id: string; displayName: string | null; email: string; status: string };
export default function AdminAssistant({ onOpen }: { onOpen: (id: string) => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [mode, setMode] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);
  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAnswer(''); setMatches([]);
    try {
      const response = await fetch('/api/admin/assistant', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const body = await response.json() as { answer?: string; mode?: string; matches?: Match[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Assistant unavailable.');
      setAnswer(body.answer ?? ''); setMatches(body.matches ?? []); setMode(body.mode ?? 'structured');
    } catch (cause) { setAnswer((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-assistant"><span className="admin-eyebrow">SpikeDate data assistant</span><h2>Ask about accounts</h2><p>Ask “How many people?” or find one account by name, email, phone, or ID. More complex questions are not supported yet. It cannot read private chats, camera captures, or change an account.</p><form onSubmit={(event) => void ask(event)}><input aria-label="Ask the admin assistant" value={question} maxLength={240} onChange={(event) => setQuestion(event.target.value)} placeholder="How many people? · Find user by email…" /><button type="submit" disabled={busy || question.trim().length < 3}>{busy ? 'Searching…' : 'Ask'}</button></form>{answer && <div className="admin-assistant-answer"><p>{answer}</p><small>{mode === 'workers_ai' ? 'AI summary of approved database facts' : 'Database answer'} · Verify details in the account record.</small>{matches.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)}>{item.displayName || item.email} · {item.status} →</button>)}</div>}</section>;
}
