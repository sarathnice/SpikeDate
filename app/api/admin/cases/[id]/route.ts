import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  outcome: z.enum(['dismissed', 'warned', 'suspended']),
  note: z.string().trim().min(3).max(1000),
});

export async function PATCH(request: Request, context: Context) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Choose an outcome and add a review note.' },
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
    const report = await db
      .prepare(
        "SELECT id, subject_id, status FROM safety_actions WHERE id = ? AND kind = 'report' LIMIT 1",
      )
      .bind(id)
      .first<{ id: string; subject_id: string; status: string }>();
    if (!report) return json({ error: 'Case not found.' }, { status: 404 });
    if (report.status !== 'open')
      return json(
        { error: 'This case has already been resolved.' },
        { status: 409 },
      );
    const now = Date.now();
    const statements = [
      db
        .prepare(
          'UPDATE safety_actions SET status = ?, details = ?, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?',
        )
        .bind(
          parsed.data.outcome,
          parsed.data.note,
          admin.user.id,
          now,
          now,
          id,
        ),
      db
        .prepare(
          'INSERT INTO audit_logs ' +
            '(id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          identifier('aud'),
          admin.user.id,
          'moderation.resolve',
          'safety_action',
          id,
          JSON.stringify(parsed.data),
          now,
        ),
    ];
    if (parsed.data.outcome === 'suspended')
      statements.push(
        db
          .prepare(
            "UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?",
          )
          .bind(now, report.subject_id),
      );
    await db.batch(statements);
    return json({ case: { id, status: parsed.data.outcome } });
  });
}
