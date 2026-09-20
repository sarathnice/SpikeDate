import { requireUser } from '@/lib/server/auth';
import { withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';
import { connectionFromRow } from '@/lib/profile-connection';
export const runtime = 'edge';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withDatabase(async (db) => {
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const visible = await db
      .prepare(
        "SELECT profiles.user_id FROM profiles JOIN users ON users.id = profiles.user_id WHERE users.id = ? AND users.status = 'active' AND (users.id = ? OR profiles.discoverable = 1 OR EXISTS (SELECT 1 FROM matches WHERE status = 'active' AND ((user_a_id = ? AND user_b_id = ?) OR (user_b_id = ? AND user_a_id = ?)))) AND NOT EXISTS (SELECT 1 FROM safety_actions WHERE kind = 'block' AND ((reporter_id = ? AND subject_id = ?) OR (reporter_id = ? AND subject_id = ?)))",
      )
      .bind(id, user.id, user.id, id, user.id, id, user.id, id, id, user.id)
      .first();
    if (!visible)
      return json({ error: 'Profile unavailable.' }, { status: 404 });
    const profile = await db
      .prepare(
        "SELECT profiles.user_id, display_name, gender, bio, occupation, education, height_cm, kids, wants_kids, smoking, drinking, pets, CAST(strftime('%Y','now') AS INTEGER) - CAST(strftime('%Y', users.birth_date) AS INTEGER) - (strftime('%m-%d','now') < strftime('%m-%d', users.birth_date)) AS age FROM profiles JOIN users ON users.id = profiles.user_id WHERE profiles.user_id = ?",
      )
      .bind(id)
      .first<Record<string, unknown>>();
    const media = await db
      .prepare(
        "SELECT id, type FROM profile_media WHERE user_id = ? AND moderation_status = 'approved' AND type IN ('photo','video') ORDER BY position, id",
      )
      .bind(id)
      .all<{ id: string; type: 'photo' | 'video' }>();
    const prompts = await db
      .prepare(
        'SELECT prompt, answer FROM profile_prompts WHERE user_id = ? ORDER BY position, id',
      )
      .bind(id)
      .all<{ prompt: string; answer: string }>();
    const interests = await db
      .prepare(
        'SELECT interests.label FROM user_interests JOIN interests ON interests.id = user_interests.interest_id WHERE user_interests.user_id = ? ORDER BY interests.label',
      )
      .bind(id)
      .all<{ label: string }>();
    return json({
      profile: {
        id,
        name: profile?.display_name,
        age: profile?.age,
        gender:
          profile?.gender === 'woman'
            ? 'Woman'
            : profile?.gender === 'man'
              ? 'Man'
              : 'Nonbinary',
        prompt: profile?.bio || '',
        prompts: prompts.results,
        media: media.results
          .filter((item) => item.type === 'photo')
          .slice(0, 6)
          .concat(
            media.results.filter((item) => item.type === 'video').slice(0, 1),
          )
          .map((item) => ({
            id: item.id,
            type: item.type,
            src: `/api/media/${item.id}?variant=full`,
          })),
        tags: interests.results.map((item) => item.label),
        facts: {
          height:
            typeof profile?.height_cm === 'number'
              ? `${profile.height_cm} cm`
              : '',
          occupation: profile?.occupation || '',
          education: profile?.education || '',
          kids: profile?.kids || '',
          wantsKids: profile?.wants_kids || '',
          smoking: profile?.smoking || '',
          drinking: profile?.drinking || '',
          pets: profile?.pets || '',
        },
      },
      connection: connectionFromRow(
        await db
          .prepare('SELECT * FROM profile_connections WHERE user_id = ?')
          .bind(id)
          .first(),
      ),
    });
  });
}
