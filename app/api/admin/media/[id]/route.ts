import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { reconcileDiscoverability } from '@/lib/server/profile-readiness';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  outcome: z.enum(['approved', 'rejected']),
  note: z.string().trim().min(3).max(500),
});

export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Choose a decision and add a short review note.' },
      { status: 400 },
    );
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, [
      'super_admin',
      'safety_reviewer',
      'moderator',
    ]);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const media = await db
      .prepare(
        'SELECT id, user_id, moderation_status FROM profile_media WHERE id = ? LIMIT 1',
      )
      .bind(id)
      .first<{ id: string; user_id: string; moderation_status: string }>();
    if (!media) return json({ error: 'Media not found.' }, { status: 404 });
    if (media.moderation_status !== 'pending')
      return json(
        { error: 'This media has already been reviewed.' },
        { status: 409 },
      );
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          'UPDATE profile_media SET moderation_status = ?, updated_at = ? WHERE id = ?',
        )
        .bind(parsed.data.outcome, now, id),
      db
        .prepare(
          'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          identifier('aud'),
          admin.user.id,
          'media.review',
          'profile_media',
          id,
          JSON.stringify(parsed.data),
          now,
        ),
    ]);
    const readiness = await reconcileDiscoverability(db, media.user_id);
    return json({ media: { id, status: parsed.data.outcome }, readiness });
  });
}
