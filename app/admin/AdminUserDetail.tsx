'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type RecordRow = Record<string, string | number | null>;
type Detail = {
  user: RecordRow;
  permissions: { safety: boolean; billing: boolean };
  profileDetails: RecordRow | null; interests: RecordRow[]; prompts: RecordRow[];
  discovery: RecordRow | null; today: RecordRow | null;
  photos: RecordRow[]; verification: RecordRow[]; photoMatches: RecordRow[];
  connections: RecordRow[]; blocksMade: RecordRow[]; blocksReceived: RecordRow[];
  reportsMade: RecordRow[]; reportsReceived: RecordRow[];
  subscriptions: RecordRow[]; purchases: RecordRow[]; wallet: RecordRow | null; ledger: RecordRow[];
  captureRetained: boolean;
};
type Tab = 'overview' | 'photos' | 'connections' | 'safety' | 'billing';
const when = (value: string | number | null | undefined) => value ? new Date(Number(value)).toLocaleString() : 'Not recorded';
const asText = (value: string | number | null | undefined) => value == null || value === '' ? '—' : String(value);
const asList = (value: string | number | null | undefined) => {
  if (!value) return '—';
  try { const parsed: unknown = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed.join(', ') || '—' : String(value); }
  catch { return String(value); }
};

export default function AdminUserDetail({ id, superAdmin, canViewMessages, onBack }: { id: string; superAdmin: boolean; canViewMessages: boolean; onBack: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<{ reportId: string; messages: RecordRow[] } | null>(null);
  const [grantKind, setGrantKind] = useState<'super_spike' | 'profile_lift'>('super_spike');
  const [grantAmount, setGrantAmount] = useState(1);
  const [grantReason, setGrantReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/details`, { cache: 'no-store', credentials: 'include' });
    const body = await response.json() as Detail & { error?: string };
    if (!response.ok) throw new Error(body.error ?? 'Unable to load account.');
    setError('');
    setData(body);
  }
  function retry() {
    setLoading(true); setError('');
    void refresh().catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }
  useEffect(() => {
    setLoading(true); setError(''); setTab('overview'); setEvidence(null);
    void refresh().catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [id]);
  async function openEvidence(reportId: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/cases/${reportId}/messages`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
      const body = await response.json() as { reportId: string; messages: RecordRow[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Evidence unavailable.');
      setEvidence(body); setReason('');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function grant() {
    if (!window.confirm(`Grant ${grantAmount} ${grantKind.replace('_', ' ')} credit(s) to this account? This does not change an App Store or Google Play subscription.`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/credits`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: grantKind, amount: grantAmount, reason: grantReason, requestId: crypto.randomUUID() }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Grant failed.');
      setGrantReason(''); await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-dossier">
    <button type="button" className="admin-back" onClick={onBack}>← People</button>
    {loading ? <p>Loading account…</p> : error && !data ? <div className="admin-dossier-retry"><p className="admin-error" role="alert">{error}</p><button type="button" onClick={retry}>Retry loading account</button></div> : data && <>
      <div className="admin-dossier-title"><div><span className="admin-eyebrow">Account record</span><h2>{asText(data.user.display_name)}</h2><p>{asText(data.user.email)} · {asText(data.user.phone_number)} · {asText(data.user.status)}</p></div><code>{id}</code></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <nav className="admin-dossier-tabs" aria-label="Account details">{(['overview', 'photos', 'connections', 'safety', 'billing'] as Tab[]).filter((item) => (item !== 'photos' && item !== 'safety' || data.permissions.safety) && (item !== 'billing' || data.permissions.billing)).map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setEvidence(null); }}>{item === 'photos' ? 'Photos & verification' : item}</button>)}</nav>
      {tab === 'overview' && <><div className="admin-detail-grid"><div><span>Account created</span><strong>{when(data.user.created_at)}</strong></div><div><span>Last active</span><strong>{when(data.user.last_active_at)}</strong></div><div><span>Location</span><strong>{[data.user.city, data.user.region, data.user.country].filter(Boolean).join(', ') || 'Not set'}</strong></div><div><span>Phone verified</span><strong>{when(data.user.phone_verified_at)}</strong></div><div><span>Photo verification</span><strong>{asText(data.user.verification_status)}</strong></div><div><span>Discoverable</span><strong>{Number(data.user.discoverable) ? 'Yes' : 'No'}</strong></div><div><span>Connections</span><strong>{data.connections.length}{data.connections.length === 50 ? '+' : ''} recent</strong></div><div><span>Reports against</span><strong>{data.permissions.safety ? data.reportsReceived.length : 'Restricted'}</strong></div></div>{data.profileDetails && <><h3>Profile details</h3><div className="admin-detail-grid">{([['Gender', 'gender'], ['Pronouns', 'pronouns'], ['Work', 'occupation'], ['Education', 'education'], ['Height (cm)', 'height_cm'], ['Ethnicity', 'ethnicity'], ['Looking for', 'relationship_goal'], ['Has kids', 'kids'], ['Open to kids', 'wants_kids'], ['Drinking', 'drinking'], ['Smoking', 'smoking'], ['Pets', 'pets']] as const).map(([label, key]) => <div key={key}><span>{label}</span><strong>{asText(data.profileDetails?.[key])}</strong></div>)}</div><h3>About</h3><p>{asText(data.profileDetails.bio)}</p><h3>Interests</h3><p>{data.interests.map((item) => item.label).join(' · ') || 'None recorded'}</p><h3>Prompts</h3>{data.prompts.map((item, index) => <p key={index}><strong>{item.prompt}</strong> · {item.answer}</p>)}{!data.prompts.length && <p>None recorded</p>}<h3>Discovery preferences</h3><p>Show: {asList(data.discovery?.genders_json)} · ages {asText(data.discovery?.min_age)}–{asText(data.discovery?.max_age)} · distance {asText(data.discovery?.max_distance_km)} km</p><h3>Latest Today</h3><p>{data.today ? `${asText(data.today.text)} · ${Number(data.today.available_tonight) ? 'Available tonight' : 'Not marked available tonight'}` : 'None recorded'}</p></>}</>}
      {tab === 'photos' && <><p className="admin-section-note">Uploaded photos and stored face-comparison results. The live-camera frame is not retained, so it cannot be displayed beside the upload.</p><div className="admin-photo-grid">{data.photos.map((photo) => <article key={String(photo.id)}>{photo.type === 'video' ? <video src={`/api/admin/media/${photo.id}/view`} controls playsInline><track kind="captions" /></video> : <Image src={`/api/admin/media/${photo.id}/view`} alt={`Uploaded ${photo.type}`} width={180} height={220} unoptimized />}<div><strong>{photo.type} {Number(photo.position) + 1}</strong><span>{photo.width} × {photo.height} · {photo.moderation_status}</span><a href={`/api/admin/media/${photo.id}/view?variant=original`} target="_blank" rel="noreferrer">View uploaded original</a></div></article>)}</div>{!data.photos.length && <p>No uploaded media.</p>}<h3>Camera checks</h3>{data.verification.map((item) => <article className="admin-item" key={String(item.id)}><strong>{item.status} · {item.provider}</strong><small>{when(item.submitted_at)}</small>{data.photoMatches.filter((match) => match.request_id === item.id).map((match) => <p key={String(match.media_id)}>{String(match.media_id)} · {match.decision} · {match.similarity_bps == null ? 'No comparison score' : `${(Number(match.similarity_bps) / 100).toFixed(1)}% similarity`}</p>)}</article>)}</>}
      {tab === 'connections' && <><p className="admin-section-note">Recent matches and their current status; message content is not available here.</p>{data.connections.map((item) => <article className="admin-item" key={String(item.id)}><strong>{asText(item.other_name)}</strong><p>{item.status} · matched {when(item.matched_at)}</p><small>User ID: {item.other_id}</small></article>)}{!data.connections.length && <p>No connections recorded.</p>}</>}
      {tab === 'safety' && <><div className="admin-safety-columns"><div><h3>Blocked by this user</h3>{data.blocksMade.map((item) => <p key={String(item.id)}>{asText(item.other_name)} · {when(item.created_at)}</p>)}{!data.blocksMade.length && <p>None</p>}</div><div><h3>Blocked this user</h3>{data.blocksReceived.map((item) => <p key={String(item.id)}>{asText(item.other_name)} · {when(item.created_at)}</p>)}{!data.blocksReceived.length && <p>None</p>}</div></div><h3>Reports made</h3>{data.reportsMade.map((item) => <article className="admin-item" key={String(item.id)}><strong>{asText(item.reason)} · {asText(item.status)}</strong><p>{asText(item.details)}</p><small>{when(item.created_at)} · subject {item.other_id}</small>{canViewMessages && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => void openEvidence(String(item.id))}>View case messages</button>}</article>)}{!data.reportsMade.length && <p>None</p>}<h3>Reports against</h3>{data.reportsReceived.map((item) => <article className="admin-item" key={String(item.id)}><strong>{asText(item.reason)} · {asText(item.status)}</strong><p>{asText(item.details)}</p><small>{when(item.created_at)} · reporter {item.other_id}</small>{canViewMessages && <button type="button" disabled={busy || reason.trim().length < 10} onClick={() => void openEvidence(String(item.id))}>View case messages</button>}</article>)}{!data.reportsReceived.length && <p>None</p>}{canViewMessages && <label className="admin-evidence-reason">Reason for viewing case messages<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Required for each evidence request; at least 10 characters" /></label>}{evidence && <div className="admin-evidence"><h3>Case message evidence · {evidence.reportId}</h3><button type="button" onClick={() => setEvidence(null)}>Close evidence</button>{evidence.messages.length ? evidence.messages.map((message) => <article className="admin-item" key={String(message.id)}><small>{message.sender_id} · {when(message.created_at)}</small><p>{asText(message.body)}</p>{message.media_kind && <small>Attached {message.media_kind}; not opened</small>}</article>) : <p>No retained messages between the report participants.</p>}</div>}</>}
      {tab === 'billing' && <><p className="admin-section-note">Store subscriptions are read-only. Replacement credits are recorded separately and do not alter Apple or Google billing.</p><div className="admin-detail-grid"><div><span>Available Spikes</span><strong>{data.wallet?.super_spikes ?? 0}</strong></div><div><span>Available Lifts</span><strong>{data.wallet?.profile_lifts ?? 0}</strong></div></div><h3>Subscriptions</h3>{data.subscriptions.map((item) => <article className="admin-item" key={String(item.id)}><strong>{item.plan} · {item.status}</strong><p>{item.provider} · period ends {when(item.current_period_ends_at)}</p><small>Provider reference: {item.provider_subscription_id}</small></article>)}{!data.subscriptions.length && <p>No subscription recorded.</p>}<h3>Purchases</h3>{data.purchases.map((item) => <article className="admin-item" key={String(item.id)}><strong>{item.product_id} · {item.status}</strong><p>{item.provider} · {when(item.purchased_at)}</p><small>Transaction: {item.provider_transaction_id}</small></article>)}{!data.purchases.length && <p>No purchases recorded.</p>}<h3>Credit history</h3>{data.ledger.map((item) => <p className="admin-ledger-row" key={String(item.id)}>{item.delta} {item.kind} · {item.reason} · {when(item.created_at)}</p>)}{superAdmin && <div className="admin-credit-form"><h3>Reissue or courtesy credit</h3><p>Use only after checking the purchase and existing ledger to avoid double credit.</p><select value={grantKind} onChange={(event) => setGrantKind(event.target.value as typeof grantKind)}><option value="super_spike">Spike</option><option value="profile_lift">Lift</option></select><input type="number" min={1} max={10} value={grantAmount} onChange={(event) => setGrantAmount(Number(event.target.value))} aria-label="Credit quantity" /><textarea value={grantReason} onChange={(event) => setGrantReason(event.target.value)} placeholder="Why are these credits being granted?" maxLength={500} /><button type="button" disabled={busy || grantReason.trim().length < 10 || grantAmount < 1 || grantAmount > 10} onClick={() => void grant()}>Grant credits</button></div>}</>}
    </>}
  </section>;
}
