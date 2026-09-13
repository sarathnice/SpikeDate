import { z } from 'zod';
import { createSession, hashPassword } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import {
  emailSchema,
  passwordSchema,
  validationError,
} from '@/lib/server/validation';
import {
  phoneVerificationRequired,
  verifyPhoneRegistrationToken,
} from '@/lib/server/phone-verification';

export const runtime = 'edge';

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  birthDate: z.iso.date(),
  displayName: z.string().trim().min(2).max(50),
  gender: z.string().trim().min(1).max(40),
  relationshipGoal: z.string().trim().min(1).max(80),
  termsAccepted: z.literal(true),
  phoneVerificationToken: z.string().trim().max(4096).optional(),
});

function isAdult(birthDate: string) {
  const birthday = new Date(birthDate + 'T00:00:00Z');
  if (Number.isNaN(birthday.valueOf())) return false;
  const threshold = new Date();
  threshold.setUTCFullYear(threshold.getUTCFullYear() - 18);
  return birthday <= threshold;
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      {
        error: 'Check the highlighted details.',
        fields: validationError(parsed.error),
      },
      { status: 400 },
    );
  if (!isAdult(parsed.data.birthDate))
    return json(
      { error: 'SpikeDate is for adults 18 and older.' },
      { status: 400 },
    );

  const phoneProof = parsed.data.phoneVerificationToken
    ? await verifyPhoneRegistrationToken(
        request,
        parsed.data.phoneVerificationToken,
      )
    : null;
  if (phoneVerificationRequired() && !phoneProof)
    return json(
      { error: 'Verify your mobile number before creating your account.' },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const [existing, phoneOwner, challenge] = await Promise.all([
      db
        .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
        .bind(parsed.data.email)
        .first(),
      phoneProof
        ? db
            .prepare('SELECT id FROM users WHERE phone_number = ? LIMIT 1')
            .bind(phoneProof.phoneNumber)
            .first()
        : Promise.resolve(null),
      phoneProof
        ? db
            .prepare(
              "SELECT status FROM phone_verification_challenges WHERE id = ? AND phone_number = ? AND status = 'verified' LIMIT 1",
            )
            .bind(phoneProof.challengeId, phoneProof.phoneNumber)
            .first<{ status: string }>()
        : Promise.resolve(null),
    ]);
    if (existing)
      return json(
        { error: 'An account already exists for this email.' },
        { status: 409 },
      );
    if (phoneOwner)
      return json(
        { error: 'This mobile number is already connected to an account.' },
        { status: 409 },
      );
    if (phoneProof && !challenge)
      return json(
        { error: 'Phone verification expired. Request a new code.' },
        { status: 409 },
      );

    const now = Date.now();
    const userId = identifier('usr');
    const passwordHash = await hashPassword(parsed.data.password);
    await db.batch([
      db
        .prepare(
          'INSERT INTO users ' +
            '(id, email, phone_number, phone_verified_at, password_hash, status, birth_date, terms_version, terms_accepted_at, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          userId,
          parsed.data.email,
          phoneProof?.phoneNumber ?? null,
          phoneProof ? now : null,
          passwordHash,
          'active',
          parsed.data.birthDate,
          '2026-09-12',
          now,
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO profiles ' +
            '(user_id, display_name, gender, relationship_goal, discoverable, discoverable_requested, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          userId,
          parsed.data.displayName,
          parsed.data.gender,
          parsed.data.relationshipGoal,
          0,
          1,
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO preferences ' +
            '(user_id, genders_json, min_age, max_age, max_distance_km, relationship_goals_json, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(userId, '[]', 18, 99, 80, '[]', now, now),
      db
        .prepare(
          'INSERT INTO entitlement_wallets ' +
            '(user_id, super_spikes, profile_lifts, weekly_lift_available, version, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(userId, 1, 0, 0, 0, now, now),
      ...(phoneProof
        ? [
            db
              .prepare(
                "UPDATE phone_verification_challenges SET status = 'consumed', consumed_at = ?, updated_at = ? WHERE id = ? AND status = 'verified'",
              )
              .bind(now, now, phoneProof.challengeId),
          ]
        : []),
    ]);
    const session = await createSession(db, userId, request);
    return json(
      {
        user: {
          id: userId,
          email: parsed.data.email,
          phoneVerified: Boolean(phoneProof),
        },
        profile: { displayName: parsed.data.displayName },
      },
      { status: 201, headers: { 'set-cookie': session.cookie } },
    );
  });
}
