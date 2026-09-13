import { env } from 'cloudflare:workers';

export type D1Row = Record<string, unknown>;

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first<T = D1Row>(): Promise<T | null>;
  all<T = D1Row>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta: Record<string, unknown> }>;
};

export type D1DatabaseLike = {
  prepare: (sql: string) => D1Statement;
  batch: (
    statements: D1Statement[],
  ) => Promise<Array<{ success: boolean; meta: Record<string, unknown> }>>;
};

export function getDb(): D1DatabaseLike {
  const db = (env as unknown as { DB?: D1DatabaseLike }).DB;
  if (!db)
    throw new Response('Database is unavailable for this deployment.', {
      status: 503,
    });
  return db;
}

export async function withDatabase<T>(
  operation: (db: D1DatabaseLike) => Promise<T>,
): Promise<T | Response> {
  try {
    return await operation(getDb());
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Database operation failed', error);
    return Response.json(
      { error: 'The service is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
