// API activity is throttled to five-minute writes. This is recent activity,
// not proof that a device is currently connected or available to chat.
export const RECENT_ACTIVITY_MS = 15 * 60 * 1000;
export const PRESENCE_LABEL = 'Active recently';
export const ONLINE_TTL_MS = 90_000;
export type LivePresenceState = {
  id: string;
  state: 'online' | 'recent' | 'offline' | 'hidden';
  onlineUntil: number | null;
  lastActiveAt: number | null;
};

export function isOnline(
  onlineUntil: number | null | undefined,
  now = Date.now(),
) {
  return (
    typeof onlineUntil === 'number' &&
    Number.isFinite(onlineUntil) &&
    onlineUntil > now &&
    onlineUntil <= now + ONLINE_TTL_MS
  );
}

export function isRecentlyActive(
  lastActiveAt: number | null | undefined,
  now = Date.now(),
) {
  return (
    typeof lastActiveAt === 'number' &&
    Number.isFinite(lastActiveAt) &&
    lastActiveAt > 0 &&
    lastActiveAt <= now &&
    now - lastActiveAt < RECENT_ACTIVITY_MS
  );
}
