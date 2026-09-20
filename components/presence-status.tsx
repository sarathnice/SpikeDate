'use client';

import { useEffect, useState } from 'react';
import { isOnline, isRecentlyActive, PRESENCE_LABEL } from '@/lib/presence';
import { useLivePresence } from '@/components/live-presence';

export function PresenceStatus({
  name,
  userId,
  lastActiveAt,
  demoActive = false,
  variant = 'profile',
}: {
  name: string;
  userId?: string;
  lastActiveAt?: number | null;
  demoActive?: boolean;
  variant?: 'profile' | 'chat' | 'dot';
}) {
  const live = useLivePresence(userId);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [lastActiveAt]);
  const online =
    live.row?.state === 'online' && isOnline(live.row.onlineUntil, now);
  const active = live.enabled
    ? Boolean(
        live.row &&
        live.row.state !== 'hidden' &&
        (online || isRecentlyActive(live.row.lastActiveAt, now)),
      )
    : lastActiveAt === undefined
      ? demoActive
      : isRecentlyActive(lastActiveAt, now);
  const description = online
    ? `${name} is online now`
    : `${name} was active in the last 15 minutes`;
  const label = online ? 'Online now' : PRESENCE_LABEL;
  if (!active) return variant === 'chat' ? <>Matched on SpikeDate</> : null;
  if (variant === 'dot')
    return <i aria-label={description} title={description} />;
  if (variant === 'chat')
    return (
      <span
        aria-label={description}
        title={description}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <i aria-hidden="true" /> {label}
      </span>
    );
  return (
    <p
      className="profile-presence"
      aria-label={description}
      title={description}
    >
      <span aria-hidden="true" />
      {label}
    </p>
  );
}
