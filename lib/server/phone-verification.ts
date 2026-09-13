import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();

type PhoneEnvironment = {
  SPIKEDATE_PHONE_VERIFICATION_PROVIDER?: string;
  SPIKEDATE_PHONE_VERIFICATION_TOKEN_SECRET?: string;
  SPIKEDATE_TEST_SEED_SECRET?: string;
  FIREBASE_IDENTITY_PLATFORM_API_KEY?: string;
};

export type PhoneProvider = 'mock' | 'firebase';

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  );
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
}

export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

export function phoneProvider(request: Request): PhoneProvider {
  const configured = (env as unknown as PhoneEnvironment)
    .SPIKEDATE_PHONE_VERIFICATION_PROVIDER;
  if (configured === 'firebase') return 'firebase';
  if (configured === 'mock') return 'mock';
  const hostname = new URL(request.url).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1'
    ? 'mock'
    : 'firebase';
}

export function phoneVerificationRequired() {
  return (
    (env as unknown as { SPIKEDATE_PHONE_VERIFICATION_REQUIRED?: string })
      .SPIKEDATE_PHONE_VERIFICATION_REQUIRED === 'true'
  );
}

function tokenSecret(request: Request) {
  const configured = env as unknown as PhoneEnvironment;
  const explicit = configured.SPIKEDATE_PHONE_VERIFICATION_TOKEN_SECRET;
  if (explicit) return explicit;
  const hostname = new URL(request.url).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1')
    return (
      configured.SPIKEDATE_TEST_SEED_SECRET || 'spikedate-local-phone-only'
    );
  throw new Error('Phone verification signing is not configured.');
}

export async function createPhoneRegistrationToken(
  request: Request,
  payload: { challengeId: string; phoneNumber: string; expiresAt: number },
) {
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = base64Url(await hmac(body, tokenSecret(request)));
  return body + '.' + signature;
}

export async function verifyPhoneRegistrationToken(
  request: Request,
  token: string,
) {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  let supplied: Uint8Array;
  try {
    supplied = decodeBase64Url(signature);
  } catch {
    return null;
  }
  const expected = await hmac(body, tokenSecret(request));
  if (!safeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(body)),
    ) as { challengeId?: string; phoneNumber?: string; expiresAt?: number };
    if (
      !payload.challengeId ||
      !payload.phoneNumber ||
      !payload.expiresAt ||
      payload.expiresAt < Date.now()
    )
      return null;
    return {
      challengeId: payload.challengeId,
      phoneNumber: payload.phoneNumber,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function startFirebasePhoneVerification(
  phoneNumber: string,
  recaptchaToken: string,
) {
  const apiKey = (env as unknown as PhoneEnvironment)
    .FIREBASE_IDENTITY_PLATFORM_API_KEY;
  if (!apiKey)
    throw new Error('Firebase phone verification is not configured.');
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber, recaptchaToken }),
    },
  );
  const result = (await response.json()) as {
    sessionInfo?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.sessionInfo)
    throw new Error(
      result.error?.message || 'Unable to send verification code.',
    );
  return result.sessionInfo;
}

export async function completeFirebasePhoneVerification(
  sessionInfo: string,
  code: string,
) {
  const apiKey = (env as unknown as PhoneEnvironment)
    .FIREBASE_IDENTITY_PLATFORM_API_KEY;
  if (!apiKey)
    throw new Error('Firebase phone verification is not configured.');
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionInfo, code }),
    },
  );
  const result = (await response.json()) as {
    phoneNumber?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.phoneNumber)
    throw new Error(
      result.error?.message || 'The verification code is invalid.',
    );
  return result.phoneNumber;
}

export async function hashRequestIp(request: Request) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local';
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(ip));
  return base64Url(new Uint8Array(digest));
}
