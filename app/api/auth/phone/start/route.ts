import { z } from 'zod';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import {
  hashRequestIp,
  normalizePhone,
  phoneProvider,
  startFirebasePhoneVerification,
} from '@/lib/server/phone-verification';

export const runtime = 'edge';

const schema = z.object({
  phoneNumber: z.string().trim().min(8).max(30),
  recaptchaToken: z.string().trim().max(4096).optional(),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  const phoneNumber = parsed.success
    ? normalizePhone(parsed.data.phoneNumber)
    : null;
  if (!parsed.success || !phoneNumber)
    return json(
      { error: 'Enter a complete mobile number including country code.' },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const now = Date.now();
    const ipHash = await hashRequestIp(request);
    const [recentPhone, recentIp, existingUser] = await Promise.all([
      db
        .prepare(
          'SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM phone_verification_challenges WHERE phone_number = ? AND created_at > ?',
        )
        .bind(phoneNumber, now - 24 * 60 * 60 * 1000)
        .first<{ total: number; latest: number | null }>(),
      db
        .prepare(
          'SELECT COUNT(*) AS total FROM phone_verification_challenges WHERE ip_hash = ? AND created_at > ?',
        )
        .bind(ipHash, now - 60 * 60 * 1000)
        .first<{ total: number }>(),
      db
        .prepare('SELECT id FROM users WHERE phone_number = ? LIMIT 1')
        .bind(phoneNumber)
        .first(),
    ]);
    if (existingUser)
      return json(
        { error: 'This mobile number is already connected to an account.' },
        { status: 409 },
      );
    if ((recentPhone?.latest ?? 0) > now - 30_000)
      return json(
        { error: 'Please wait 30 seconds before requesting another code.' },
        { status: 429 },
      );
    if ((recentPhone?.total ?? 0) >= 5 || (recentIp?.total ?? 0) >= 20)
      return json(
        { error: 'Verification limit reached. Please try again later.' },
        { status: 429 },
      );

    const provider = phoneProvider(request);
    if (provider === 'firebase' && !parsed.data.recaptchaToken)
      return json(
        { error: 'Complete the security check before requesting a code.' },
        { status: 400 },
      );
    let providerRef: string;
    try {
      providerRef =
        provider === 'mock'
          ? '123456'
          : await startFirebasePhoneVerification(
              phoneNumber,
              parsed.data.recaptchaToken!,
            );
    } catch (error) {
      console.error('Phone verification start failed', error);
      return json(
        { error: 'Unable to send a verification code right now.' },
        { status: 503 },
      );
    }

    const id = identifier('phone');
    const expiresAt = now + 10 * 60 * 1000;
    await db
      .prepare(
        'INSERT INTO phone_verification_challenges ' +
          '(id, phone_number, provider, provider_ref, status, attempts, ip_hash, expires_at, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        phoneNumber,
        provider,
        providerRef,
        'pending',
        0,
        ipHash,
        expiresAt,
        now,
        now,
      )
      .run();
    return json(
      {
        challengeId: id,
        expiresAt,
        maskedPhone: `••• ••• ${phoneNumber.slice(-4)}`,
        ...(provider === 'mock' ? { testCode: '123456' } : {}),
      },
      { status: 201 },
    );
  });
}
