import { z } from 'zod';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import {
  completeFirebasePhoneVerification,
  createPhoneRegistrationToken,
} from '@/lib/server/phone-verification';

export const runtime = 'edge';

const schema = z.object({
  challengeId: z.string().trim().min(8).max(100),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Enter the six-digit verification code.' },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const challenge = await db
      .prepare(
        'SELECT id, phone_number, provider, provider_ref, status, attempts, expires_at ' +
          'FROM phone_verification_challenges WHERE id = ? LIMIT 1',
      )
      .bind(parsed.data.challengeId)
      .first<{
        id: string;
        phone_number: string;
        provider: 'mock' | 'firebase';
        provider_ref: string;
        status: string;
        attempts: number;
        expires_at: number;
      }>();
    const now = Date.now();
    if (!challenge || challenge.status !== 'pending')
      return json(
        { error: 'This verification session is no longer active.' },
        { status: 409 },
      );
    if (challenge.expires_at < now) {
      await db
        .prepare(
          "UPDATE phone_verification_challenges SET status = 'expired', updated_at = ? WHERE id = ?",
        )
        .bind(now, challenge.id)
        .run();
      return json(
        { error: 'The code expired. Request a new one.' },
        { status: 410 },
      );
    }
    if (challenge.attempts >= 5)
      return json(
        { error: 'Too many attempts. Request a new code.' },
        { status: 429 },
      );

    let verifiedPhone: string | null = null;
    try {
      verifiedPhone =
        challenge.provider === 'mock'
          ? parsed.data.code === challenge.provider_ref
            ? challenge.phone_number
            : null
          : await completeFirebasePhoneVerification(
              challenge.provider_ref,
              parsed.data.code,
            );
    } catch (error) {
      console.warn('Phone verification attempt failed', error);
    }
    if (verifiedPhone !== challenge.phone_number) {
      const attempts = challenge.attempts + 1;
      await db
        .prepare(
          "UPDATE phone_verification_challenges SET attempts = ?, status = CASE WHEN ? >= 5 THEN 'blocked' ELSE status END, updated_at = ? WHERE id = ?",
        )
        .bind(attempts, attempts, now, challenge.id)
        .run();
      return json(
        {
          error:
            attempts >= 5
              ? 'Too many attempts. Request a new code.'
              : 'That code does not match. Please try again.',
          attemptsRemaining: Math.max(0, 5 - attempts),
        },
        { status: attempts >= 5 ? 429 : 400 },
      );
    }

    await db
      .prepare(
        "UPDATE phone_verification_challenges SET status = 'verified', verified_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, now, challenge.id)
      .run();
    const registrationToken = await createPhoneRegistrationToken(request, {
      challengeId: challenge.id,
      phoneNumber: challenge.phone_number,
      expiresAt: now + 15 * 60 * 1000,
    });
    return json({
      verified: true,
      maskedPhone: `••• ••• ${challenge.phone_number.slice(-4)}`,
      registrationToken,
    });
  });
}
