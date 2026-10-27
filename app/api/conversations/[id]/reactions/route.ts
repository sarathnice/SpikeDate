import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import { requireConnectionReady } from '@/lib/server/profile-readiness';
import { reactionEmojis } from '@/lib/chat-quiet';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({
  messageId: z.string().min(1).max(120),
  emoji: z.enum(reactionEmojis).nullable(),
});

async function handle(request: Request, context: Context, write: boolean) {
  const input = write ? await readJson<unknown>(request) : null;
  if (input instanceof Response) return input;
  const parsed = write ? inputSchema.safeParse(input) : null;
  if (parsed && !parsed.success)
    return json({ error: 'Choose a supported reaction.' }, { status: 400 });
  return withDatabase(async (db) => {
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const { id } = await context.params;
    const access = await db
      .prepare(
        "SELECT c.id FROM conversations c JOIN matches m ON m.id = c.match_id WHERE c.id = ? AND m.status = 'active' AND (m.user_a_id = ? OR m.user_b_id = ?) LIMIT 1",
      )
      .bind(id, user.id, user.id)
      .first();
    if (!access)
      return json({ error: 'Conversation not found.' }, { status: 404 });
    if (write && !(await requireConnectionReady(db, user.id)))
      return json(
        { error: 'Complete and verify your profile before reacting.' },
        { status: 403 },
      );
    if (parsed?.success) {
      const { messageId, emoji } = parsed.data;
      const message = await db
        .prepare(
          'SELECT id FROM messages WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL',
        )
        .bind(messageId, id)
        .first();
      if (!message)
        return json({ error: 'Message not found.' }, { status: 404 });
      if (emoji === null)
        await db
          .prepare(
            'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?',
          )
          .bind(messageId, user.id)
          .run();
      else
        await db
          .prepare(
            'INSERT INTO message_reactions (message_id, user_id, emoji, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, updated_at = excluded.updated_at',
          )
          .bind(messageId, user.id, emoji, Date.now())
          .run();
    }
    const result = await db
      .prepare(
        'SELECT r.message_id, r.emoji, COUNT(*) AS count, MAX(CASE WHEN r.user_id = ? THEN 1 ELSE 0 END) AS mine FROM message_reactions r JOIN messages m ON m.id = r.message_id WHERE m.conversation_id = ? AND m.deleted_at IS NULL GROUP BY r.message_id, r.emoji',
      )
      .bind(user.id, id)
      .all();
    return json({ reactions: result.results });
  });
}
export const GET = (request: Request, context: Context) =>
  handle(request, context, false);
export const PUT = (request: Request, context: Context) =>
  handle(request, context, true);
