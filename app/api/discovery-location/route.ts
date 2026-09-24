import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getDb, withDatabase } from '@/lib/server/db';
import { json, readJson } from '@/lib/server/http';
import { coarseCoordinateE6 } from '@/lib/discovery-location';

export const runtime = 'edge';

const schema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('device'),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  z.object({
    mode: z.literal('city'),
    city: z.string().trim().min(2).max(100),
  }),
  z.object({ mode: z.literal('denied') }),
]);

type Row = {
  discovery_location_mode: string;
  discovery_city: string | null;
  discovery_location_updated_at: number | null;
};

function publicLocation(row: Row | null) {
  return {
    mode:
      row?.discovery_location_mode === 'device' ||
      row?.discovery_location_mode === 'city' ||
      row?.discovery_location_mode === 'denied'
        ? row.discovery_location_mode
        : 'unset',
    city: row?.discovery_city ?? null,
    updatedAt: row?.discovery_location_updated_at ?? null,
  };
}

export async function GET(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const row = await db
      .prepare(
        'SELECT discovery_location_mode, discovery_city, discovery_location_updated_at FROM profiles WHERE user_id = ?',
      )
      .bind(user.id)
      .first<Row>();
    return json({ location: publicLocation(row) });
  });
}

export async function PUT(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return json({ error: 'Choose a valid discovery area.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    const data = parsed.data;
    await db
      .prepare(
        'UPDATE profiles SET discovery_location_mode = ?, discovery_city = ?, latitude_e6 = ?, longitude_e6 = ?, discovery_location_updated_at = ?, updated_at = ? WHERE user_id = ?',
      )
      .bind(
        data.mode,
        data.mode === 'city' ? data.city.replace(/\s+/g, ' ') : null,
        data.mode === 'device' ? coarseCoordinateE6(data.latitude) : null,
        data.mode === 'device' ? coarseCoordinateE6(data.longitude) : null,
        now,
        now,
        user.id,
      )
      .run();
    return json({
      location: {
        mode: data.mode,
        city: data.mode === 'city' ? data.city.replace(/\s+/g, ' ') : null,
        updatedAt: now,
      },
    });
  });
}

export async function DELETE(request: Request) {
  return withDatabase(async () => {
    const db = getDb();
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    await db
      .prepare(
        "UPDATE profiles SET discovery_location_mode = 'unset', discovery_city = NULL, latitude_e6 = NULL, longitude_e6 = NULL, discovery_location_updated_at = NULL, updated_at = ? WHERE user_id = ?",
      )
      .bind(Date.now(), user.id)
      .run();
    return json({
      location: { mode: 'unset', city: null, updatedAt: null },
    });
  });
}
