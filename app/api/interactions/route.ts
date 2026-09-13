import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { canonicalPair, identifier, json, readJson } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { notifyUser } from '@/lib/server/notifications';

export const runtime = 'edge';

const schema = z.object({
  targetUserId: z.string().min(5).max(80),
  kind: z.enum(['like', 'super_spike', 'pass', 'save', 'rewind']),
  note: z.string().trim().max(140).optional(),
  targetType: z
    .enum(['profile', 'photo', 'prompt', 'daily_update'])
    .default('profile'),
  targetRef: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Interaction details are invalid.' }, { status: 400 });

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    if (
      (parsed.data.kind === 'like' || parsed.data.kind === 'super_spike') &&
      !(await requireConnectionReady(db, user.id))
    )
      return json(
        {
          error:
            'Complete your profile, phone verification, and photo verification before connecting.',
        },
        { status: 403 },
      );
    if (user.id === parsed.data.targetUserId)
      return json({ error: 'Choose another profile.' }, { status: 400 });
    const prior = await db
      .prepare(
        'SELECT id, kind FROM interactions WHERE actor_id = ? AND idempotency_key = ? LIMIT 1',
      )
      .bind(user.id, parsed.data.idempotencyKey)
      .first();
    if (prior) return json({ interaction: prior, duplicate: true });
    const target = await db
      .prepare(
        "SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1",
      )
      .bind(parsed.data.targetUserId)
      .first();
    if (!target) return json({ error: 'Profile not found.' }, { status: 404 });
    const blocked = await db
      .prepare(
        "SELECT id FROM safety_actions WHERE kind = 'block' AND " +
          '((reporter_id = ? AND subject_id = ?) OR (reporter_id = ? AND subject_id = ?)) LIMIT 1',
      )
      .bind(
        user.id,
        parsed.data.targetUserId,
        parsed.data.targetUserId,
        user.id,
      )
      .first();
    if (blocked)
      return json(
        { error: 'This interaction is unavailable.' },
        { status: 403 },
      );
    if (parsed.data.kind === 'super_spike') {
      const wallet = await db
        .prepare(
          'SELECT super_spikes FROM entitlement_wallets WHERE user_id = ? LIMIT 1',
        )
        .bind(user.id)
        .first<{ super_spikes: number }>();
      if (!wallet?.super_spikes)
        return json(
          { error: 'No Super Spikes remain this week.' },
          { status: 409 },
        );
    }

    const now = Date.now();
    const interactionId = identifier('int');
    const statements = [
      db
        .prepare(
          'INSERT INTO interactions ' +
            '(id, actor_id, target_id, kind, note, target_type, target_ref, idempotency_key, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          interactionId,
          user.id,
          parsed.data.targetUserId,
          parsed.data.kind,
          parsed.data.note || null,
          parsed.data.targetType,
          parsed.data.targetRef || null,
          parsed.data.idempotencyKey,
          now,
          now,
        ),
    ];
    if (parsed.data.kind === 'super_spike') {
      statements.push(
        db
          .prepare(
            'UPDATE entitlement_wallets SET super_spikes = super_spikes - 1, version = version + 1, updated_at = ? ' +
              'WHERE user_id = ? AND super_spikes > 0',
          )
          .bind(now, user.id),
        db
          .prepare(
            'INSERT INTO entitlement_ledger ' +
              '(id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            identifier('led'),
            user.id,
            'super_spike',
            -1,
            'sent',
            parsed.data.idempotencyKey,
            now,
            now,
          ),
      );
    }

    let matchId: string | null = null;
    if (parsed.data.kind === 'like' || parsed.data.kind === 'super_spike') {
      const reciprocal = await db
        .prepare(
          "SELECT id FROM interactions WHERE actor_id = ? AND target_id = ? AND kind IN ('like', 'super_spike') AND undone_at IS NULL LIMIT 1",
        )
        .bind(parsed.data.targetUserId, user.id)
        .first();
      if (reciprocal) {
        const [userA, userB] = canonicalPair(user.id, parsed.data.targetUserId);
        const currentMatch = await db
          .prepare(
            'SELECT id FROM matches WHERE user_a_id = ? AND user_b_id = ? LIMIT 1',
          )
          .bind(userA, userB)
          .first<{ id: string }>();
        matchId = currentMatch?.id ?? identifier('mat');
        if (!currentMatch) {
          statements.push(
            db
              .prepare(
                'INSERT INTO matches ' +
                  '(id, user_a_id, user_b_id, status, matched_at, created_at, updated_at) ' +
                  'VALUES (?, ?, ?, ?, ?, ?, ?)',
              )
              .bind(matchId, userA, userB, 'active', now, now, now),
            db
              .prepare(
                'INSERT INTO conversations (id, match_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
              )
              .bind(identifier('con'), matchId, now, now),
          );
        }
      }
    }
    await db.batch(statements);
    if (parsed.data.kind === 'like' || parsed.data.kind === 'super_spike') {
      const actor = await db
        .prepare('SELECT display_name FROM profiles WHERE user_id = ? LIMIT 1')
        .bind(user.id)
        .first<{ display_name: string }>();
      const actorName = actor?.display_name || 'Someone';
      if (matchId) {
        await Promise.all([
          notifyUser(db, {
            userId: parsed.data.targetUserId,
            type: 'new_match',
            title: "It's a Spike",
            body: `You and ${actorName} liked each other.`,
            data: { url: '/?tab=Chat', matchId },
          }),
          notifyUser(db, {
            userId: user.id,
            type: 'new_match',
            title: "It's a Spike",
            body: 'You have a new match. Start with something personal.',
            data: { url: '/?tab=Chat', matchId },
          }),
        ]);
      } else {
        await notifyUser(db, {
          userId: parsed.data.targetUserId,
          type: 'new_like',
          title:
            parsed.data.kind === 'super_spike'
              ? 'New Super Spike'
              : 'Someone likes you',
          body:
            parsed.data.kind === 'super_spike'
              ? `${actorName} sent you a Super Spike${parsed.data.note ? ' with a note' : ''}.`
              : `${actorName} liked your profile.`,
          data: { url: '/?incoming=1', interactionId },
        });
      }
    }
    return json(
      {
        interaction: { id: interactionId, kind: parsed.data.kind },
        match: matchId ? { id: matchId } : null,
      },
      { status: 201 },
    );
  });
}
