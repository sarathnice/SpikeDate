import { env } from 'cloudflare:workers';
import type { D1DatabaseLike } from '@/lib/server/db';
import { identifier } from '@/lib/server/http';

type NotificationKind =
  | 'new_like'
  | 'new_match'
  | 'message'
  | 'plan_update'
  | 'activity_briefing';

type FirebaseCredentials = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type PushEnvironment = {
  SPIKEDATE_PUSH_PROVIDER?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_PROJECT_ID?: string;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function pemToBytes(value: string) {
  const content = value
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(content);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function firebaseAccessToken(credentials: FirebaseCredentials) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000)
    return cachedAccessToken.value;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(
    encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  );
  const claims = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
        iat: nowSeconds,
        exp: nowSeconds + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoder.encode(unsigned),
    ),
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch(
    credentials.token_uri || 'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    },
  );
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !result.access_token)
    throw new Error('Unable to authorize Firebase push delivery.');
  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.value;
}

function parseCredentials() {
  const configured = env as unknown as PushEnvironment;
  if (
    configured.SPIKEDATE_PUSH_PROVIDER !== 'fcm' ||
    !configured.FIREBASE_SERVICE_ACCOUNT_JSON
  )
    return null;
  try {
    return JSON.parse(
      configured.FIREBASE_SERVICE_ACCOUNT_JSON,
    ) as FirebaseCredentials;
  } catch {
    throw new Error('Firebase push credentials are invalid.');
  }
}

const preferenceColumn: Record<NotificationKind, string> = {
  new_like: 'new_likes',
  new_match: 'new_matches',
  message: 'messages',
  plan_update: 'plan_updates',
  activity_briefing: 'activity_briefing',
};

function insideQuietHours(
  value: { start?: string; end?: string; timeZone?: string } | null,
) {
  if (!value?.start || !value.end) return false;
  let clock: string;
  try {
    clock = new Intl.DateTimeFormat('en-GB', {
      timeZone: value.timeZone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
  } catch {
    return false;
  }
  return value.start <= value.end
    ? clock >= value.start && clock < value.end
    : clock >= value.start || clock < value.end;
}

export async function notifyUser(
  db: D1DatabaseLike,
  input: {
    userId: string;
    type: NotificationKind;
    title: string;
    body: string;
    data?: Record<string, string>;
  },
) {
  try {
    const preference = await db
      .prepare(
        `SELECT ${preferenceColumn[input.type]} AS enabled, quiet_hours_json FROM notification_preferences WHERE user_id = ? LIMIT 1`,
      )
      .bind(input.userId)
      .first<{ enabled: number; quiet_hours_json: string }>();
    if (preference && !preference.enabled) return { queued: false };
    const now = Date.now();
    await db
      .prepare(
        'INSERT INTO notifications (id, user_id, type, title, body, data_json, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        identifier('not'),
        input.userId,
        input.type,
        input.title,
        input.body,
        JSON.stringify(input.data ?? {}),
        now,
        now,
      )
      .run();

    const credentials = parseCredentials();
    if (!credentials) return { queued: true, delivered: 0 };
    let quietHours: { start?: string; end?: string; timeZone?: string } | null =
      null;
    try {
      quietHours = preference?.quiet_hours_json
        ? JSON.parse(preference.quiet_hours_json)
        : null;
    } catch {
      quietHours = null;
    }
    if (insideQuietHours(quietHours))
      return { queued: true, delivered: 0, quietHours: true };
    const devices = await db
      .prepare(
        'SELECT id, token FROM device_tokens WHERE user_id = ? AND active = 1 ORDER BY last_seen_at DESC LIMIT 10',
      )
      .bind(input.userId)
      .all<{ id: string; token: string }>();
    if (!devices.results.length) return { queued: true, delivered: 0 };
    const accessToken = await firebaseAccessToken(credentials);
    const projectId =
      (env as unknown as PushEnvironment).FIREBASE_PROJECT_ID ||
      credentials.project_id;
    let delivered = 0;
    for (const device of devices.results) {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: input.title, body: input.body },
              data: input.data ?? {},
              android: { priority: 'high' },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        },
      );
      if (response.ok) delivered += 1;
      else if (response.status === 404 || response.status === 410)
        await db
          .prepare(
            'UPDATE device_tokens SET active = 0, updated_at = ? WHERE id = ?',
          )
          .bind(Date.now(), device.id)
          .run();
    }
    return { queued: true, delivered };
  } catch (error) {
    console.error('Push notification delivery failed', error);
    return { queued: false, delivered: 0 };
  }
}
