import type { D1DatabaseLike } from './db';
import { getDb } from './db';
import { json } from './http';

const SESSION_COOKIE = 'spikedate_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export { hashPassword, verifyPassword } from './crypto';

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const pair of cookies.split(';')) {
    const [key, ...parts] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return null;
}

export async function createSession(
  db: D1DatabaseLike,
  userId: string,
  request: Request,
) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const sessionId = 'ses_' + crypto.randomUUID().replaceAll('-', '');
  const tokenHash = await sha256(token);
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  await db
    .prepare(
      'INSERT INTO sessions ' +
        '(id, user_id, token_hash, expires_at, ip_hash, user_agent, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      sessionId,
      userId,
      tokenHash,
      now + SESSION_DURATION_MS,
      ip ? await sha256(ip) : null,
      request.headers.get('user-agent')?.slice(0, 500) ?? null,
      now,
      now,
    )
    .run();
  return {
    token,
    cookie:
      SESSION_COOKIE +
      '=' +
      encodeURIComponent(token) +
      '; HttpOnly; SameSite=Lax; Path=/; ' +
      (new URL(request.url).protocol === 'https:' ? 'Secure; ' : '') +
      'Max-Age=' +
      SESSION_DURATION_MS / 1000,
  };
}

export async function currentUser(request: Request, db = getDb()) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return db
    .prepare(
      'SELECT users.id, users.email, users.status, sessions.id AS sessionId ' +
        'FROM sessions JOIN users ON users.id = sessions.user_id ' +
        'WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL ' +
        "AND sessions.expires_at > ? AND users.status = 'active' LIMIT 1",
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; email: string; status: string; sessionId: string }>();
}

export async function requireUser(request: Request, db = getDb()) {
  const user = await currentUser(request, db);
  if (!user) return json({ error: 'Sign in required.' }, { status: 401 });
  const now = Date.now();
  await db
    .prepare(
      'UPDATE users SET last_active_at = ?, updated_at = ? WHERE id = ? ' +
        'AND (last_active_at IS NULL OR last_active_at < ?)',
    )
    .bind(now, now, user.id, now - 5 * 60 * 1000)
    .run();
  return user;
}

export async function revokeSession(request: Request, db = getDb()) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return;
  const now = Date.now();
  await db
    .prepare(
      'UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE token_hash = ?',
    )
    .bind(now, now, await sha256(token))
    .run();
}

export function expiredSessionCookie(request: Request) {
  return (
    SESSION_COOKIE +
    '=; HttpOnly; SameSite=Lax; Path=/; ' +
    (new URL(request.url).protocol === 'https:' ? 'Secure; ' : '') +
    'Max-Age=0'
  );
}
