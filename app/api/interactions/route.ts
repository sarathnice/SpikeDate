import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { protectedSend } from '@/lib/server/protected-send';

export const runtime = 'edge';

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const rows = await db
      .prepare(
        'SELECT i.id, i.actor_id, i.kind, i.note, i.target_ref, p.display_name, p.gender, p.bio, p.city, p.relationship_goal, p.verification_status, ' +
          "(CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', u.birth_date) AS INTEGER) - (strftime('%m-%d', 'now') < strftime('%m-%d', u.birth_date))) AS age, " +
          "(SELECT m.id FROM profile_media m WHERE m.user_id = i.actor_id AND m.type = 'photo' AND m.moderation_status = 'approved' ORDER BY m.position LIMIT 1) AS media_id " +
          'FROM interactions i JOIN users u ON u.id = i.actor_id JOIN profiles p ON p.user_id = i.actor_id ' +
          "WHERE i.target_id = ? AND i.kind IN ('like', 'super_spike') AND i.undone_at IS NULL AND u.status = 'active' " +
          "AND NOT EXISTS (SELECT 1 FROM interactions newer WHERE newer.actor_id = i.actor_id AND newer.target_id = i.target_id AND newer.kind IN ('like', 'super_spike', 'pass') AND newer.undone_at IS NULL AND (newer.created_at > i.created_at OR (newer.created_at = i.created_at AND newer.id > i.id))) " +
          "AND NOT EXISTS (SELECT 1 FROM matches mat WHERE mat.status = 'active' AND ((mat.user_a_id = i.actor_id AND mat.user_b_id = ?) OR (mat.user_b_id = i.actor_id AND mat.user_a_id = ?))) " +
          "AND NOT EXISTS (SELECT 1 FROM safety_actions s WHERE s.kind = 'block' AND ((s.reporter_id = ? AND s.subject_id = i.actor_id) OR (s.reporter_id = i.actor_id AND s.subject_id = ?))) " +
          "AND NOT EXISTS (SELECT 1 FROM interactions declined WHERE declined.actor_id = ? AND declined.target_id = i.actor_id AND declined.kind = 'pass' AND declined.undone_at IS NULL AND declined.created_at >= i.created_at) " +
          "ORDER BY (i.kind = 'super_spike') DESC, i.created_at DESC LIMIT 100",
      )
      .bind(user.id, user.id, user.id, user.id, user.id, user.id)
      .all<{ id: string; media_id: string | null }>();
    const outgoing = await db
      .prepare(
        "SELECT i.target_id, CASE WHEN MAX(i.kind = 'super_spike') THEN 'super_spike' ELSE 'like' END AS kind, p.display_name, p.gender, p.bio, p.city, p.relationship_goal, (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', u.birth_date) AS INTEGER) - (strftime('%m-%d', 'now') < strftime('%m-%d', u.birth_date))) AS age, (SELECT id FROM profile_media WHERE user_id = i.target_id AND type = 'photo' AND moderation_status = 'approved' ORDER BY position LIMIT 1) AS media_id, EXISTS (SELECT 1 FROM matches WHERE status = 'active' AND ((user_a_id = i.actor_id AND user_b_id = i.target_id) OR (user_b_id = i.actor_id AND user_a_id = i.target_id))) AS matched FROM interactions i JOIN profiles p ON p.user_id = i.target_id JOIN users u ON u.id = i.target_id WHERE i.actor_id = ? AND i.kind IN ('like', 'super_spike') AND i.undone_at IS NULL AND u.status = 'active' AND NOT EXISTS (SELECT 1 FROM safety_actions WHERE kind = 'block' AND ((reporter_id = i.actor_id AND subject_id = i.target_id) OR (reporter_id = i.target_id AND subject_id = i.actor_id))) GROUP BY i.target_id ORDER BY MAX(i.updated_at) DESC",
      )
      .bind(user.id)
      .all();
    const outgoingMedia = await db
      .prepare(
        "SELECT DISTINCT m.id, m.user_id, m.type, m.position FROM profile_media m JOIN interactions i ON i.target_id = m.user_id WHERE i.actor_id = ? AND i.kind IN ('like', 'super_spike') AND i.undone_at IS NULL AND m.moderation_status = 'approved' ORDER BY m.position",
      )
      .bind(user.id)
      .all<{ id: string; user_id: string; type: 'photo' | 'video' }>();
    return json({
      outgoing: outgoing.results.map((row) => ({
        ...row,
        media: outgoingMedia.results
          .filter((media) => media.user_id === row.target_id)
          .map((media) => ({
            type: media.type,
            src: `/api/media/${media.id}?variant=full`,
          })),
      })),
      incoming: rows.results.map((row) => ({
        ...row,
        imageUrl: row.media_id
          ? `/api/media/${row.media_id}?variant=full`
          : null,
      })),
    });
  });
}

const schema = z.object({
  targetUserId: z.string().min(5).max(80),
  kind: z.enum(['like', 'super_spike', 'pass', 'save', 'rewind']),
  note: z.string().trim().max(140).optional(),
  targetType: z
    .enum(['profile', 'photo', 'prompt', 'daily_update'])
    .default('profile'),
  targetRef: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
  upgrade: z.boolean().optional(),
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
    if (prior)
      return json({
        interaction: prior,
        duplicate: true,
        charged: false,
        superSpikesRemaining:
          (
            await db
              .prepare(
                'SELECT super_spikes FROM entitlement_wallets WHERE user_id = ?',
              )
              .bind(user.id)
              .first<{ super_spikes: number }>()
          )?.super_spikes ?? 0,
      });
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
    if (parsed.data.kind === 'like' || parsed.data.kind === 'super_spike')
      return protectedSend(db, user.id, {
        ...parsed.data,
        kind: parsed.data.kind,
      });
    const now = Date.now();
    const id = identifier('int');
    await db
      .prepare(
        'INSERT INTO interactions (id, actor_id, target_id, kind, note, target_type, target_ref, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        user.id,
        parsed.data.targetUserId,
        parsed.data.kind,
        parsed.data.note || null,
        parsed.data.targetType,
        parsed.data.targetRef || null,
        parsed.data.idempotencyKey,
        now,
        now,
      )
      .run();
    return json(
      { interaction: { id, kind: parsed.data.kind }, match: null },
      { status: 201 },
    );
  });
}
