'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AdminUserDetail from './AdminUserDetail';
import AdminAssistant from './AdminAssistant';
import AdminPeople from './AdminPeople';
import AdminSupport from './AdminSupport';
import { Activity, BadgeDollarSign, CalendarDays, FileClock, Flag, ImageIcon, LockKeyhole, LogOut, MessageCircle, RefreshCw, Scale, ShieldCheck, Sparkles, Users } from 'lucide-react';
import './admin.css';

type View = 'overview' | 'reports' | 'media' | 'users' | 'support' | 'privacy' | 'appeals' | 'audit';
type Overview = {
  admin: { email: string; roles: string[] };
  metrics: Record<string, number>;
  openCases: Array<{ id: string; reason: string; details: string | null; created_at: number; reporter_name: string; subject_name: string }>;
  moderationQueue: Array<{ id: string; type: 'photo' | 'video'; created_at: number; display_name: string }>;
};
type Row = { id: string; email?: string; display_name?: string; city?: string; region?: string; status?: string; kind?: string; due_at?: number; created_at?: number; last_active_at?: number; verification_status?: string; reports?: number; statement?: string; reason?: string; action?: string; entity_type?: string; entity_id?: string; actor_email?: string };
const nav: Array<{ id: View; label: string; icon: typeof Activity; roles?: string[] }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'reports', label: 'Reports', icon: Flag, roles: ['super_admin', 'safety_reviewer', 'moderator'] },
  { id: 'media', label: 'Media', icon: ImageIcon, roles: ['super_admin', 'safety_reviewer', 'moderator'] },
  { id: 'users', label: 'People', icon: Users, roles: ['super_admin', 'safety_reviewer', 'moderator', 'support_agent', 'billing_analyst'] },
  { id: 'support', label: 'Support', icon: MessageCircle, roles: ['super_admin', 'support_agent'] },
  { id: 'privacy', label: 'Privacy', icon: FileClock, roles: ['super_admin', 'support_agent'] },
  { id: 'appeals', label: 'Appeals', icon: Scale, roles: ['super_admin', 'safety_reviewer', 'moderator'] },
  { id: 'audit', label: 'Activity', icon: ShieldCheck, roles: ['super_admin'] },
];
const metrics = [
  ['allUsers', 'All accounts', Users], ['activeUsers', 'Active accounts', Users], ['openReports', 'Open reports', Flag],
  ['pendingMedia', 'Media to review', ShieldCheck], ['activeSubscriptions', 'Subscriptions', BadgeDollarSign],
  ['activeLifts', 'Profile Lifts', Sparkles], ['messages24h', 'Messages · 24h', MessageCircle],
  ['upcomingPlans', 'Upcoming plans', CalendarDays], ['privacyRequests', 'Privacy requests', FileClock],
] as const;
const date = (value?: number) => value ? new Date(value).toLocaleString() : 'Not recorded';

export default function AdminPage() {
  const authEpoch = useRef(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'forbidden'>('loading');
  const [view, setView] = useState<View>('overview');
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [peopleRefresh, setPeopleRefresh] = useState(0);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadOverview() {
    const epoch = authEpoch.current;
    const response = await fetch('/api/admin/overview', { credentials: 'include', cache: 'no-store' });
    if (epoch !== authEpoch.current) return;
    if (response.status === 401) { setState('login'); return; }
    if (response.status === 403) { setState('forbidden'); return; }
    if (!response.ok) throw new Error('Unable to load operations. Try again.');
    const body = await response.json() as Overview;
    if (epoch !== authEpoch.current) return;
    setOverview(body);
    setState('ready');
  }
  async function loadRows(next: View, search = '') {
    if (['overview', 'reports', 'media', 'users', 'support'].includes(next)) return;
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({ view: next });
      if (next === 'users' && search.trim()) params.set('q', search.trim());
      const response = await fetch(`/api/admin/operations?${params}`, { credentials: 'include', cache: 'no-store' });
      const body = await response.json() as { rows?: Row[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to load this section.');
      setRows(body.rows ?? []);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoadingRows(false); }
  }
  useEffect(() => { void loadOverview().catch((reason: Error) => { setError(reason.message); setState('login'); }); }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to sign in.');
      authEpoch.current += 1;
      setPassword(''); await loadOverview();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }
  async function logout() {
    authEpoch.current += 1;
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setOverview(null); setRows([]); setView('overview'); setState('login'); setError('');
  }
  function select(next: View) { setView(next); setSelectedUserId(null); setError(''); setNote(''); setReviewing(null); setRows([]); window.scrollTo(0, 0); void loadRows(next); }
  function openUser(id: string) { setSelectedUserId(id); window.scrollTo(0, 0); }
  async function save(url: string, payload: object) {
    setSaving(true); setError('');
    try {
      const response = await fetch(url, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to save the decision.');
      setReviewing(null); setNote(''); await loadOverview(); await loadRows(view);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }
  const can = (roles: string[]) => !!overview?.admin.roles.some((role) => roles.includes(role));
  const superAdmin = can(['super_admin']);
  const review = (id: string, actions: Array<{ label: string; run: () => void; danger?: boolean }>, min = 3) => reviewing === id ?
    <div className="admin-review"><label htmlFor={`note-${id}`}>Decision note · required</label><textarea id={`note-${id}`} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Record the reason and evidence…" /><div>{actions.map((action) => <button key={action.label} className={action.danger ? 'admin-danger' : ''} type="button" disabled={saving || note.trim().length < min} onClick={action.run}>{action.label}</button>)}<button type="button" onClick={() => { setReviewing(null); setNote(''); }}>Cancel</button></div></div> :
    <button className="admin-review-trigger" type="button" onClick={() => { setReviewing(id); setNote(''); }}>Review</button>;

  return <main className="admin-shell">
    {state === 'loading' ? <section className="admin-state"><Activity className="admin-spin" aria-hidden /><p>Checking staff access…</p></section> :
    state === 'login' ? <section className="admin-login"><div className="admin-login-brand"><Image src="/brand/spikedate-symbol-vermilion.svg" alt="" width={56} height={56} /><span>SpikeDate <small>TRUST & OPERATIONS</small></span></div><div className="admin-login-panel"><span className="admin-eyebrow">Staff access</span><h1>Welcome back.</h1><p>Sign in with an approved administrator account. There is no public admin registration.</p><form onSubmit={(event) => void login(event)}><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />{error && <p className="admin-error" role="alert">{error}</p>}<button type="submit" disabled={saving}><LockKeyhole size={17} aria-hidden /> {saving ? 'Signing in…' : 'Sign in securely'}</button></form><small>Staff actions are recorded. Cloudflare Access can add a second gate in production.</small></div><Link href="/">← Back to SpikeDate</Link></section> :
    state === 'forbidden' ? <section className="admin-state"><LockKeyhole aria-hidden /><h1>Staff access required</h1><p>This account has no administrator role, or its Cloudflare Access identity is missing.</p><button type="button" onClick={() => void logout()}>Sign out and use another account</button></section> : overview && <>
      <header className="admin-header"><div className="admin-brand"><Image src="/brand/spikedate-symbol-vermilion.svg" alt="" width={42} height={42} /><div><strong>SpikeDate</strong><span>Trust & operations</span></div></div><div className="admin-identity"><span>{overview.admin.email}</span><small>{overview.admin.roles.join(' · ').replaceAll('_', ' ')}</small></div><button className="admin-signout" type="button" onClick={() => void logout()}><LogOut size={16} aria-hidden /> Sign out</button></header>
      <div className="admin-workspace"><nav className="admin-nav" aria-label="Admin sections">{nav.filter((item) => !item.roles || can(item.roles)).map(({ id, label, icon: Icon }) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => select(id)}><Icon size={18} aria-hidden /> {label}{id === 'reports' && overview.metrics.openReports > 0 ? <b>{overview.metrics.openReports}</b> : null}</button>)}</nav><div className="admin-content"><div className="admin-page-head"><div><span className="admin-eyebrow">Staff workspace</span><h1>{nav.find((item) => item.id === view)?.label}</h1><p>{view === 'overview' ? 'What needs attention across SpikeDate.' : view === 'privacy' ? 'Track requests; fulfillment is a separate workflow.' : view === 'audit' ? 'Recent admin decisions, read-only.' : 'Review each item with a recorded reason.'}</p></div><button type="button" className="admin-refresh" onClick={() => { void loadOverview(); if (view === 'users') setPeopleRefresh((value) => value + 1); else void loadRows(view); }}><RefreshCw size={16} aria-hidden /> Refresh</button></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {view === 'overview' && <><div className="admin-metrics">{metrics.map(([key, label, Icon]) => <article key={key}><Icon size={19} aria-hidden /><strong>{overview.metrics[key] ?? 0}</strong><span>{label}</span></article>)}</div><div className="admin-quick"><button type="button" disabled={!can(['super_admin', 'safety_reviewer', 'moderator'])} onClick={() => select('reports')}><Flag aria-hidden /> Reports <span>{overview.metrics.openReports ?? 0} open</span></button><button type="button" disabled={!can(['super_admin', 'safety_reviewer', 'moderator'])} onClick={() => select('media')}><ImageIcon aria-hidden /> Media <span>{overview.metrics.pendingMedia ?? 0} pending</span></button><button type="button" disabled={!can(['super_admin', 'support_agent'])} onClick={() => select('privacy')}><FileClock aria-hidden /> Privacy <span>{overview.metrics.privacyRequests ?? 0} open</span></button></div><p className="admin-disclaimer">“Active accounts” is not a live online count. No systems-health status is inferred from these metrics.</p><AdminAssistant onOpen={(id) => { select('users'); openUser(id); }} /></>}
      {view === 'reports' && <section className="admin-panel"><h2>Oldest open reports</h2>{overview.openCases.length ? overview.openCases.map((item) => <article className="admin-item" key={item.id}><div className="admin-item-top"><strong>{item.subject_name}</strong><small>{date(item.created_at)}</small></div><p>Reported by {item.reporter_name} · {item.reason}</p>{item.details && <p>{item.details}</p>}{review(item.id, ['dismissed', 'warned', 'suspended'].map((outcome) => ({ label: outcome === 'dismissed' ? 'Dismiss' : outcome === 'warned' ? 'Record warning' : 'Suspend account', danger: outcome === 'suspended', run: () => void save(`/api/admin/cases/${item.id}`, { outcome, note }) })))}</article>) : <p className="admin-empty">No open reports.</p>}</section>}
      {view === 'media' && <section className="admin-panel"><h2>Pending uploads</h2>{overview.moderationQueue.length ? overview.moderationQueue.map((item) => <article className="admin-item admin-media-item" key={item.id}><div className="admin-media-preview">{item.type === 'photo' ? <Image src={`/api/admin/media/${item.id}/view`} alt={`Pending upload from ${item.display_name}`} width={86} height={104} unoptimized /> : <video src={`/api/admin/media/${item.id}/view`} muted controls playsInline><track kind="captions" /></video>}</div><div><div className="admin-item-top"><strong>{item.display_name}</strong><small>{date(item.created_at)}</small></div><p>{item.type} awaiting review</p>{review(item.id, [{ label: 'Approve', run: () => void save(`/api/admin/media/${item.id}`, { outcome: 'approved', note }) }, { label: 'Reject', danger: true, run: () => void save(`/api/admin/media/${item.id}`, { outcome: 'rejected', note }) }])}</div></article>) : <p className="admin-empty">No pending uploads.</p>}</section>}
      {view === 'users' && <><div hidden={!!selectedUserId}><AdminPeople onOpen={openUser} superAdmin={superAdmin} refreshKey={peopleRefresh} /></div>{selectedUserId && <AdminUserDetail id={selectedUserId} superAdmin={superAdmin} canViewMessages={can(['super_admin', 'safety_reviewer'])} onBack={() => { setSelectedUserId(null); setPeopleRefresh((value) => value + 1); window.scrollTo(0, 0); }} />}</>}
      {view === 'support' && <AdminSupport />}
      {view === 'privacy' && <section className="admin-panel"><h2>Data requests</h2><p className="admin-section-note">Marking a request in progress does not export or delete data.</p>{loadingRows ? <p>Loading requests…</p> : rows.length ? rows.map((item) => <article className="admin-item" key={item.id}><div className="admin-item-top"><strong>{item.display_name ?? item.email}</strong><span className={`admin-status ${item.status}`}>{item.status}</span></div><p>{item.kind === 'delete' ? 'Deletion' : 'Export'} request · {item.email}</p><small>Due {date(item.due_at)}</small>{item.status === 'requested' && review(item.id, [{ label: 'Mark in progress', run: () => void save(`/api/admin/privacy/${item.id}`, { note }) }], 10)}</article>) : <p className="admin-empty">No privacy requests.</p>}</section>}
      {view === 'appeals' && <section className="admin-panel"><h2>Moderation appeals</h2><p className="admin-section-note">Overturning does not automatically restore an account; review other restrictions separately.</p>{loadingRows ? <p>Loading appeals…</p> : rows.length ? rows.map((item) => <article className="admin-item" key={item.id}><div className="admin-item-top"><strong>{item.display_name ?? item.email}</strong><span className={`admin-status ${item.status}`}>{item.status}</span></div><p>{item.statement}</p><small>Original reason: {item.reason ?? 'Not recorded'} · {date(item.created_at)}</small>{item.status === 'open' && review(item.id, [{ label: 'Uphold decision', run: () => void save(`/api/admin/appeals/${item.id}`, { outcome: 'upheld', note }) }, ...(superAdmin ? [{ label: 'Overturn decision', run: () => void save(`/api/admin/appeals/${item.id}`, { outcome: 'overturned', note }) }] : [])], 10)}</article>) : <p className="admin-empty">No appeals to review.</p>}</section>}
      {view === 'audit' && <section className="admin-panel"><h2>Recent activity</h2>{loadingRows ? <p>Loading activity…</p> : rows.length ? rows.map((item) => <article className="admin-item admin-audit-item" key={item.id}><div><strong>{item.action}</strong><p>{item.actor_email ?? 'System'} · {item.entity_type} · {item.entity_id}</p></div><small>{date(item.created_at)}</small></article>) : <p className="admin-empty">No recorded activity.</p>}</section>}
      </div></div></>}
  </main>;
}
