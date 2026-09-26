'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

type Person = {
  id: string; email: string; display_name: string | null; status: string;
  city: string | null; region: string | null; verification_status: string | null;
  last_active_at: number | null; created_at: number | null; reports: number | null;
};
type Directory = { rows: Person[]; total: number; allTotal: number; page: number; pageSize: number; pages: number };
type AssistantMatch = { id: string; displayName: string | null; email: string; status: string };
const empty: Directory = { rows: [], total: 0, allTotal: 0, page: 1, pageSize: 25, pages: 1 };
const date = (value: number | null) => value ? new Date(value).toLocaleString() : 'Not recorded';

export default function AdminPeople({ onOpen, superAdmin, refreshKey = 0 }: { onOpen: (id: string) => void; superAdmin: boolean; refreshKey?: number }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [verification, setVerification] = useState('all');
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<Directory>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState(false);
  const [matches, setMatches] = useState<AssistantMatch[]>([]);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ view: 'users', page: String(page), status, verification });
    if (query) params.set('q', query);
    setLoading(true); setError('');
    void fetch(`/api/admin/operations?${params}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as Directory & { error?: string };
        if (!response.ok) throw new Error(body.error ?? 'Unable to load people.');
        if (!controller.signal.aborted) { setDirectory(body); if (body.page !== page) setPage(body.page); }
      })
      .catch((cause: Error) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, status, verification, page, reload, refreshKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setQuery(search.trim());
  }
  async function ask() {
    const question = search.trim();
    if (question.length < 3) return;
    setAsking(true); setAnswer(''); setMatches([]); setAnswerError(false);
    try {
      const response = await fetch('/api/admin/assistant', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const body = await response.json() as { answer?: string; matches?: AssistantMatch[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to answer this question.');
      setAnswer(body.answer ?? 'No answer was returned.'); setMatches(body.matches ?? []);
    } catch (cause) { setAnswer((cause as Error).message); setAnswerError(true); }
    finally { setAsking(false); requestAnimationFrame(() => answerRef.current?.scrollIntoView({ block: 'nearest' })); }
  }
  async function changeStatus(person: Person) {
    const action = person.status === 'active' ? 'suspend' : 'restore';
    if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Restore'} ${person.email}?`)) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(person.id)}`, {
        method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, note: reason.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to update account.');
      setReviewing(null); setReason(''); setReload((value) => value + 1);
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  const start = directory.total ? (directory.page - 1) * directory.pageSize + 1 : 0;
  const end = Math.min(directory.page * directory.pageSize, directory.total);
  return <section className="admin-panel admin-people-directory">
    <div className="admin-directory-head"><div><h2>All people</h2><p>{directory.allTotal.toLocaleString()} total accounts · {directory.total.toLocaleString()} match current filters</p></div><span>25 per page</span></div>
    <form className="admin-search" onSubmit={submit}><label htmlFor="admin-user-query">Find a person or ask a question</label><div className="admin-search-field"><Search size={17} aria-hidden /><input id="admin-user-query" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Maya, email, phone, ID, or “How many people?”" /></div><div className="admin-search-actions"><button type="submit">Search people</button><button type="button" disabled={asking || search.trim().length < 3} onClick={() => void ask()}>{asking ? 'Asking…' : 'Ask about this'}</button></div></form>
    {answer && <div ref={answerRef} className="admin-assistant-answer admin-directory-answer" role={answerError ? 'alert' : 'status'}><p>{answer}</p>{matches.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)}>{item.displayName || item.email} · {item.status} →</button>)}</div>}
    <div className="admin-directory-filters"><label>Account status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><label>Photo verification<select value={verification} onChange={(event) => { setVerification(event.target.value); setPage(1); }}><option value="all">All states</option><option value="verified">Verified</option><option value="unverified">Not verified</option></select></label><button type="button" onClick={() => { setSearch(''); setQuery(''); setStatus('all'); setVerification('all'); setPage(1); }}>Clear filters</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading ? <p>Loading people…</p> : directory.rows.length ? directory.rows.map((person) => <article className="admin-item" key={person.id}>
      <div className="admin-item-top"><strong>{person.display_name ?? 'Profile incomplete'}</strong><span className={`admin-status ${person.status}`}>{person.status}</span></div>
      <p>{person.email} · {[person.city, person.region].filter(Boolean).join(', ') || 'No city'}</p>
      <small>{person.verification_status ?? 'unverified'}{person.reports != null ? ` · ${person.reports} reports` : ''} · joined {date(person.created_at)} · last active {date(person.last_active_at)}</small>
      <button type="button" onClick={() => onOpen(person.id)}>Open account →</button>
      {superAdmin && ['active', 'suspended'].includes(person.status) && (reviewing === person.id ? <div className="admin-review"><label htmlFor={`admin-note-${person.id}`}>Decision note · required</label><textarea id={`admin-note-${person.id}`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Record the reason and evidence…" /><div><button type="button" className={person.status === 'active' ? 'admin-danger' : ''} disabled={saving || reason.trim().length < 10} onClick={() => void changeStatus(person)}>{person.status === 'active' ? 'Suspend account' : 'Restore account'}</button><button type="button" onClick={() => { setReviewing(null); setReason(''); }}>Cancel</button></div></div> : <button type="button" className="admin-review-trigger" onClick={() => { setReviewing(person.id); setReason(''); }}>Review</button>)}
    </article>) : <p className="admin-empty">No accounts match these filters.</p>}
    <div className="admin-directory-pagination"><span aria-live="polite">Showing {start}–{end} of {directory.total.toLocaleString()} · page {directory.page} of {directory.pages}</span><div><button type="button" disabled={loading || directory.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={loading || directory.page >= directory.pages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
  </section>;
}
