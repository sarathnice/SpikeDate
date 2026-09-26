import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin', 'safety_reviewer', 'moderator']);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const media = await db.prepare('SELECT user_id, object_key, original_object_key, type FROM profile_media WHERE id = ? LIMIT 1')
      .bind(id).first<{ user_id: string; object_key: string; original_object_key: string | null; type: string }>();
    if (!media) return json({ error: 'Media not found.' }, { status: 404 });
    const original = new URL(request.url).searchParams.get('variant') === 'original';
    const bucket = (env as unknown as { MEDIA?: { get: (key: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null> } }).MEDIA;
    if (!bucket) return json({ error: 'Media storage is unavailable.' }, { status: 503 });
    const object = await bucket.get(original ? (media.original_object_key ?? media.object_key) : media.object_key);
    if (!object) return json({ error: 'Media not found.' }, { status: 404 });
    await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(identifier('aud'), admin.user.id, 'admin.media.view', 'profile_media', id, JSON.stringify({ original }), Date.now()).run();
    return new Response(object.body, { headers: {
      'content-type': object.httpMetadata?.contentType ?? (media.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      'cache-control': 'private, no-store', 'content-disposition': 'inline', 'x-content-type-options': 'nosniff',
    } });
  });
}
