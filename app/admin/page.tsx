'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  BadgeDollarSign,
  CalendarDays,
  CircleAlert,
  FileClock,
  Flag,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import './admin.css';

type Overview = {
  admin: { email: string; roles: string[] };
  metrics: Record<string, number>;
  openCases: Array<{
    id: string;
    reason: string;
    details: string | null;
    created_at: number;
    reporter_name: string;
    subject_name: string;
  }>;
};

const metricDetails = [
  ['activeUsers', 'Active users', Users],
  ['openReports', 'Open reports', Flag],
  ['pendingMedia', 'Media review', ShieldCheck],
  ['activeSubscriptions', 'Subscriptions', BadgeDollarSign],
  ['activeLifts', 'Profile Lifts', Sparkles],
  ['messages24h', 'Messages · 24h', MessageCircle],
  ['upcomingPlans', 'Upcoming plans', CalendarDays],
  ['privacyRequests', 'Privacy requests', FileClock],
] as const;

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch('/api/admin/overview', { credentials: 'include' })
      .then(async (response) => {
        const body = (await response.json()) as Overview & { error?: string };
        if (!response.ok)
          throw new Error(body.error || 'Unable to load operations.');
        setOverview(body);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function resolveCase(
    id: string,
    outcome: 'dismissed' | 'warned' | 'suspended',
  ) {
    if (note.trim().length < 3) {
      setError('Add a short review note before resolving the case.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/cases/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome, note: note.trim() }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to save review.');
      setOverview((current) =>
        current
          ? {
              ...current,
              metrics: {
                ...current.metrics,
                openReports: Math.max(0, current.metrics.openReports - 1),
              },
              openCases: current.openCases.filter((item) => item.id !== id),
            }
          : current,
      );
      setReviewing(null);
      setNote('');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <Image
            src="/brand/spikedate-symbol-gradient.svg"
            alt=""
            width={42}
            height={42}
          />
          <div>
            <strong>SpikeDate</strong>
            <span>Trust & operations</span>
          </div>
        </div>
        {overview && (
          <div className="admin-identity">
            <span>{overview.admin.email}</span>
            <small>
              {overview.admin.roles.join(' · ').replaceAll('_', ' ')}
            </small>
          </div>
        )}
      </header>
      {error ? (
        <section className="admin-state">
          <CircleAlert aria-hidden />
          <h1>Protected operations area</h1>
          <p>{error}</p>
          <Link href="/">Return to SpikeDate</Link>
        </section>
      ) : !overview ? (
        <section className="admin-state">
          <Activity className="admin-spin" aria-hidden />
          <p>Loading current operations…</p>
        </section>
      ) : (
        <>
          <section className="admin-intro">
            <div>
              <span className="admin-eyebrow">Live overview</span>
              <h1>Keep every connection safe.</h1>
              <p>
                Prioritized queues, transparent actions, and immutable audit
                history.
              </p>
            </div>
            <span className="admin-health">
              <i /> Systems healthy
            </span>
          </section>
          <section className="admin-metrics" aria-label="Operations metrics">
            {metricDetails.map(([key, label, Icon]) => (
              <article key={key}>
                <Icon aria-hidden />
                <strong>{overview.metrics[key] ?? 0}</strong>
                <span>{label}</span>
              </article>
            ))}
          </section>
          <section className="admin-panel">
            <div className="admin-panel-title">
              <div>
                <span className="admin-eyebrow">Safety queue</span>
                <h2>Oldest open reports</h2>
              </div>
              <span>{overview.openCases.length} shown</span>
            </div>
            {overview.openCases.length ? (
              <div className="admin-case-list">
                {overview.openCases.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.subject_name}</strong>
                      <span>Reported by {item.reporter_name}</span>
                    </div>
                    <p>{item.reason}</p>
                    <time>{new Date(item.created_at).toLocaleString()}</time>
                    {reviewing === item.id ? (
                      <div className="admin-review">
                        <label htmlFor={`note-${item.id}`}>Review note</label>
                        <textarea
                          id={`note-${item.id}`}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          maxLength={1000}
                          placeholder="Record the evidence and decision…"
                        />
                        <div>
                          {(['dismissed', 'warned', 'suspended'] as const).map(
                            (outcome) => (
                              <button
                                key={outcome}
                                type="button"
                                disabled={saving}
                                onClick={() => resolveCase(item.id, outcome)}
                              >
                                {outcome === 'dismissed'
                                  ? 'Dismiss'
                                  : outcome === 'warned'
                                    ? 'Warn'
                                    : 'Suspend'}
                              </button>
                            ),
                          )}
                          <button
                            type="button"
                            onClick={() => setReviewing(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReviewing(item.id)}
                      >
                        Review case
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-empty">
                <ShieldCheck aria-hidden />
                <strong>No open reports</strong>
                <span>The queue is clear.</span>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
