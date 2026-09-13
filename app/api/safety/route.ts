import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { validationError } from '@/lib/server/validation';

export const runtime = 'edge';

const schema = z.object({
  targetUserId: z.string().min(5).max(80),
  action: z.enum(['block', 'report', 'unmatch']),
  reason: z.string().trim().min(3).max(80).optional(),
  details: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      {
        error: 'Check the safety report.',
        fields: validationError(parsed.error),
      },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    if (user.id === parsed.data.targetUserId)
      return json(
        { error: 'You cannot report your own profile.' },
        { status: 400 },
      );
    const target = await db
      .prepare('SELECT id FROM users WHERE id = ? AND status != ? LIMIT 1')
      .bind(parsed.data.targetUserId, 'deleted')
      .first();
    if (!target) return json({ error: 'Profile not found.' }, { status: 404 });
    if (parsed.data.action === 'report' && !parsed.data.reason)
      return json(
        { error: 'Choose a reason for the report.' },
        { status: 400 },
      );

    const now = Date.now();
    const actionId = identifier('safe');
    const statements = [
      db
        .prepare(
          'INSERT INTO safety_actions ' +
            '(id, reporter_id, subject_id, kind, reason, details, status, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          actionId,
          user.id,
          parsed.data.targetUserId,
          parsed.data.action,
          parsed.data.reason ?? null,
          parsed.data.details ?? null,
          parsed.data.action === 'report' ? 'open' : 'applied',
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO audit_logs ' +
            '(id, actor_id, action, entity_type, entity_id, after_json, created_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          identifier('aud'),
          user.id,
          'safety.' + parsed.data.action,
          'user',
          parsed.data.targetUserId,
          JSON.stringify({ reason: parsed.data.reason ?? null }),
          now,
        ),
      db
        .prepare(
          "UPDATE galaxy_plans SET status = 'cancelled', updated_at = ? " +
            "WHERE status IN ('sent', 'accepted') AND (" +
            '(creator_id = ? AND id IN (SELECT plan_id FROM galaxy_plan_invites WHERE invitee_id = ?)) OR ' +
            '(creator_id = ? AND id IN (SELECT plan_id FROM galaxy_plan_invites WHERE invitee_id = ?)))',
        )
        .bind(
          now,
          user.id,
          parsed.data.targetUserId,
          parsed.data.targetUserId,
          user.id,
        ),
    ];
    if (parsed.data.action === 'block' || parsed.data.action === 'unmatch')
      statements.push(
        db
          .prepare(
            'UPDATE matches SET status = ?, ended_at = ?, updated_at = ? ' +
              'WHERE status = ? AND ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))',
          )
          .bind(
            parsed.data.action === 'block' ? 'blocked' : 'unmatched',
            now,
            now,
            'active',
            user.id,
            parsed.data.targetUserId,
            parsed.data.targetUserId,
            user.id,
          ),
      );
    await db.batch(statements);
    return json(
      {
        ok: true,
        actionId,
        message:
          parsed.data.action === 'report'
            ? 'Report received. The safety team will review it.'
            : parsed.data.action === 'block'
              ? 'Profile blocked. You will no longer see each other.'
              : 'Match ended.',
      },
      { status: 201 },
    );
  });
}
