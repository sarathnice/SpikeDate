'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Switch } from '@/components/ui/switch';
import type { LivePresenceState } from '@/lib/presence';

type PresenceContextValue = {
  enabled: boolean;
  rows: Record<string, LivePresenceState>;
  register: (id: string) => () => void;
  showOnline: boolean | null;
  savePreference: (value: boolean) => Promise<void>;
};
const PresenceContext = createContext<PresenceContextValue | null>(null);
async function presenceRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok)
    throw new Error('Activity status is temporarily unavailable.');
  return (await response.json()) as T;
}

export function LivePresenceProvider({
  enabled,
  account,
  children,
}: {
  enabled: boolean;
  account: string;
  children: ReactNode;
}) {
  const [showOnline, setShowOnline] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Record<string, LivePresenceState>>({});
  const registrations = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const register = useCallback((id: string) => {
    registrations.current.set(id, (registrations.current.get(id) ?? 0) + 1);
    setVersion((value) => value + 1);
    return () => {
      const count = (registrations.current.get(id) ?? 1) - 1;
      if (count) registrations.current.set(id, count);
      else registrations.current.delete(id);
      setVersion((value) => value + 1);
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void presenceRequest<{ showOnline: boolean }>('/api/presence')
      .then((data) => {
        if (!cancelled) setShowOnline(data.showOnline);
      })
      .catch(() => {
        /* Do not broadcast until the privacy preference is known. */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, account]);

  useEffect(() => {
    if (!enabled || !showOnline) return;
    const clientId = crypto.randomUUID();
    const body = JSON.stringify({ clientId });
    let stopped = false;
    let busy = false;
    const leave = () => {
      void fetch('/api/presence', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    };
    const beat = async () => {
      if (
        stopped ||
        busy ||
        document.visibilityState !== 'visible' ||
        !navigator.onLine
      )
        return;
      busy = true;
      try {
        await presenceRequest('/api/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        // A request may have completed after the page became hidden.
        if (stopped || document.visibilityState !== 'visible') leave();
      } catch {
        /* A dropped connection automatically expires server-side. */
      } finally {
        busy = false;
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') void beat();
      else leave();
    };
    void beat();
    const timer = window.setInterval(() => void beat(), 30_000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    window.addEventListener('online', beat);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('online', beat);
      leave();
    };
  }, [enabled, account, showOnline]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      const ids = [...registrations.current.keys()];
      if (!ids.length) return;
      try {
        const next: Record<string, LivePresenceState> = {};
        for (let offset = 0; offset < ids.length; offset += 50) {
          const data = await presenceRequest<{ presence: LivePresenceState[] }>(
            `/api/presence?ids=${encodeURIComponent(ids.slice(offset, offset + 50).join(','))}`,
            { signal: controller.signal },
          );
          for (const row of data.presence as LivePresenceState[])
            next[row.id] = row;
        }
        if (!controller.signal.aborted) setRows(next);
      } catch {
        /* Keep the last expiry; never extend online status on failure. */
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, account, version]);

  const savePreference = async (value: boolean) => {
    const data = await presenceRequest<{ showOnline: boolean }>(
      '/api/presence',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showOnline: value }),
      },
    );
    setShowOnline(data.showOnline);
  };
  return (
    <PresenceContext.Provider
      value={{ enabled, rows, register, showOnline, savePreference }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function useLivePresence(id?: string) {
  const context = useContext(PresenceContext);
  const register = context?.register;
  const enabled = context?.enabled;
  useEffect(() => {
    if (enabled && register && id) return register(id);
  }, [enabled, register, id]);
  return { enabled: Boolean(enabled), row: id ? context?.rows[id] : undefined };
}

export function PresencePreferences() {
  const context = useContext(PresenceContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!context?.enabled) return null;
  return (
    <section className="presence-settings">
      <div className="engagement-setting-toggle">
        <span>
          <strong>Show my activity status</strong>
          <p>
            Show Online now and Active recently. This does not mean you are
            available tonight.
          </p>
        </span>
        <Switch
          aria-label="Show my activity status"
          checked={context.showOnline === true}
          disabled={busy || context.showOnline === null}
          onCheckedChange={async (checked) => {
            setBusy(true);
            setError('');
            try {
              await context.savePreference(checked);
            } catch {
              setError('Could not save. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {error && <small role="alert">{error}</small>}
    </section>
  );
}
