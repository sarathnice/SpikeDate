export const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(jsonHeaders);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return Response.json(data, {
    ...init,
    headers,
  });
}

export async function readJson<T>(request: Request): Promise<T | Response> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: 'JSON is required.' }, { status: 415 });
  try {
    return (await request.json()) as T;
  } catch {
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }
}

export function identifier(prefix: string) {
  return prefix + '_' + crypto.randomUUID().replaceAll('-', '');
}

export function canonicalPair(first: string, second: string) {
  return first < second ? [first, second] : [second, first];
}
