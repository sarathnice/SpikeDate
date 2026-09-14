import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';

export const runtime = 'edge';

const schema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(80),
});

type AvailabilityRow = {
  local_date: string;
  start_at: number;
  end_at: number;
  timezone: string;
};

function serialize(row: AvailabilityRow | null) {
  if (!row) return null;
  return {
    localDate: row.local_date,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    timezone: row.timezone,
  };
}

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const row = await db
      .prepare(
        'SELECT local_date, start_at, end_at, timezone FROM daily_availability WHERE user_id = ? AND end_at > ?',
      )
      .bind(user.id, Date.now())
      .first<AvailabilityRow>();
    return json({ availability: serialize(row) });
  });
}

export async function PUT(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json(
      { error: 'Choose a valid date and time window.' },
      { status: 400 },
    );

  const startAt = Date.parse(parsed.data.startAt);
  const endAt = Date.parse(parsed.data.endAt);
  const now = Date.now();
  if (
    !Number.isFinite(startAt) ||
    !Number.isFinite(endAt) ||
    endAt <= startAt ||
    endAt - startAt > 18 * 60 * 60 * 1000 ||
    endAt <= now ||
    startAt > now + 8 * 24 * 60 * 60 * 1000
  )
    return json(
      { error: 'Choose an upcoming window of 18 hours or less.' },
      { status: 400 },
    );

  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    await db
      .prepare(
        'INSERT INTO daily_availability (user_id, local_date, start_at, end_at, timezone, visibility, created_at, updated_at) ' +
          "VALUES (?, ?, ?, ?, ?, 'matches', ?, ?) ON CONFLICT(user_id) DO UPDATE SET " +
          'local_date = excluded.local_date, start_at = excluded.start_at, end_at = excluded.end_at, ' +
          'timezone = excluded.timezone, visibility = excluded.visibility, updated_at = excluded.updated_at',
      )
      .bind(
        user.id,
        parsed.data.localDate,
        startAt,
        endAt,
        parsed.data.timezone,
        now,
        now,
      )
      .run();
    return json({
      availability: serialize({
        local_date: parsed.data.localDate,
        start_at: startAt,
        end_at: endAt,
        timezone: parsed.data.timezone,
      }),
    });
  });
}

export async function DELETE(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    await db
      .prepare('DELETE FROM daily_availability WHERE user_id = ?')
      .bind(user.id)
      .run();
    return json({ ok: true });
  });
}
