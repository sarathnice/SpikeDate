'use client';

import { useEffect, useState } from 'react';
import { bannerText, type BannerLabel } from '@/lib/environment-banner';

type Setting = { environment: string; label: BannerLabel; text: string; version: number; updatedAt: number | null; affectedProfiles: number; labels: BannerLabel[] };

export default function AdminBanner({ refreshKey = 0 }: { refreshKey?: number }) {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [label, setLabel] = useState<BannerLabel>('Staging');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSetting(null); setError(''); setReview(false); setMessage('');
    void fetch('/api/admin/environment/banner', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json() as Setting & { error?: string }; if (!response.ok) throw new Error(data.error ?? 'Unable to load the banner.'); return data; })
      .then(data => { if (!controller.signal.aborted) { setSetting(data); setLabel(data.label); } })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [refreshKey, reload]);

  async function apply() {
    if (!setting || !review || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/environment/banner', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label, reason, expectedVersion: setting.version }) });
      const result = await response.json() as Partial<Setting> & { error?: string; text?: string };
      if (!response.ok) throw new Error(result.error ?? 'Unable to update the banner.');
      setSetting({ ...setting, ...result }); setReview(false); setReason('');
      setMessage(`Banner updated for all ${setting.affectedProfiles} profiles in this environment. Other open pages show it after reloading. No profile records were edited.`);
      const banner = document.querySelector('[data-environment-banner]');
      if (banner && result.text) banner.textContent = result.text;
    } catch (failure) { setError((failure as Error).message); setReview(false); }
    finally { setBusy(false); }
  }

  return <section className="admin-panel admin-banner-settings" aria-label="Environment banner settings">
    <h2>Banner label · apply to all profiles</h2>
    <p className="admin-section-note">One shared banner setting—not a bulk edit of member bios. Local and cloud staging have separate settings. Changing this label does not move profiles or switch servers.</p>
    {error && <div className="admin-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Reload current setting</button></div>}
    {!setting && !error && <p role="status">Loading banner settings…</p>}
    {setting && <div className="admin-banner-grid"><div className="admin-banner-form">
      <p>Environment: <strong>{setting.environment}</strong> · <strong>{setting.affectedProfiles}</strong> profiles · version {setting.version}</p>
      <label htmlFor="environment-banner-label">Banner label</label>
      <select id="environment-banner-label" disabled={busy} value={label} onChange={event => { setLabel(event.target.value as BannerLabel); setReview(false); setMessage(''); }}>
        {setting.labels.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <label htmlFor="environment-banner-reason">Change reason · required</label>
      <textarea id="environment-banner-reason" maxLength={500} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setReview(false); }} placeholder="Why should this environment-wide label change?" />
      <small>The “fictional profiles” disclosure stays visible. Only approved display labels can be saved.</small>
      <button type="button" disabled={busy || label === setting.label || reason.trim().length < 10} onClick={() => { setReview(true); setError(''); }}>Review banner update</button>
    </div><aside className="admin-banner-preview" aria-label="Banner update preview">
      <h3>Before</h3><span className="admin-banner-sample">{setting.text}</span>
      <h3>After</h3><span className="admin-banner-sample">{bannerText(label)}</span>
      <p>Applies to every page using this environment’s shared banner. Member names, bios, photos, locations and verification badges remain unchanged.</p>
      {review && <div className="admin-banner-confirm" role="region" aria-label="Confirm environment-wide banner change"><strong>Confirm all {setting.affectedProfiles} profiles</strong><p>Apply “{bannerText(label)}” throughout <strong>{setting.environment}</strong>?</p><button type="button" disabled={busy} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply label for all profiles'}</button><button type="button" disabled={busy} onClick={() => setReview(false)}>Cancel</button></div>}
    </aside></div>}
    {message && <p className="admin-banner-success" role="status">{message}</p>}
  </section>;
}
