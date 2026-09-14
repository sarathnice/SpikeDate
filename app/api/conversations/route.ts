import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const runtime = 'edge';

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const result = await db
      .prepare(
        'SELECT conversations.id, conversations.last_message_at, matches.id AS match_id, ' +
          'profiles.user_id AS other_user_id, profiles.display_name, profiles.verification_status, ' +
          'availability.local_date AS availability_local_date, availability.start_at AS availability_start_at, ' +
          'availability.end_at AS availability_end_at, availability.timezone AS availability_timezone, ' +
          '(SELECT body FROM messages latest WHERE latest.conversation_id = conversations.id ' +
          'AND latest.deleted_at IS NULL ORDER BY latest.created_at DESC LIMIT 1) AS preview, ' +
          '(SELECT COUNT(*) FROM messages unread WHERE unread.conversation_id = conversations.id ' +
          'AND unread.sender_id != ? AND unread.read_at IS NULL AND unread.deleted_at IS NULL) AS unread_count ' +
          'FROM conversations JOIN matches ON matches.id = conversations.match_id ' +
          'JOIN profiles ON profiles.user_id = CASE WHEN matches.user_a_id = ? THEN matches.user_b_id ELSE matches.user_a_id END ' +
          'LEFT JOIN daily_availability availability ON availability.user_id = profiles.user_id AND availability.end_at > ? ' +
          "WHERE matches.status = 'active' AND (matches.user_a_id = ? OR matches.user_b_id = ?) " +
          'ORDER BY conversations.last_message_at DESC, conversations.created_at DESC',
      )
      .bind(user.id, user.id, Date.now(), user.id, user.id)
      .all();
    return json({ conversations: result.results });
  });
}
