import { it, expect, vi } from 'vitest';
import { optimizeProfileImage } from '@/lib/server/image-delivery';
function setup() {
  const output = vi.fn(async () => ({
    response: () =>
      new Response('optimized', { headers: { 'content-type': 'image/webp' } }),
  }));
  const transform = vi.fn(() => ({ output }));
  const input = vi.fn(() => ({ transform }));
  return {
    input,
    transform,
    output,
    env: { SPIKEDATE_IMAGES_ENABLED: 'true', IMAGES: { input } },
  };
}
function source() {
  return new Response('original crop', {
    headers: {
      'content-type': 'image/webp',
      etag: 'revision-1',
      'x-content-type-options': 'nosniff',
    },
  });
}
const request = new Request('https://app.test/api/media/photo-1?variant=card', {
  headers: { accept: 'image/webp' },
});
it('is opt-in, bypasses originals and retains the working R2 response', async () => {
  const s = setup();
  for (const [env, variant] of [
    [{ ...s.env, SPIKEDATE_IMAGES_ENABLED: 'false' }, 'card'],
    [s.env, 'original'],
  ] as const) {
    expect(
      await (
        await optimizeProfileImage(request, source(), env, variant)
      ).text(),
    ).toBe('original crop');
  }
  expect(s.input).not.toHaveBeenCalled();
});
it('uses bounded natural presets without re-cropping and serves private responses', async () => {
  const s = setup();
  const result = await optimizeProfileImage(request, source(), s.env, 'card');
  expect(s.transform).toHaveBeenCalledWith({ width: 1080, fit: 'scale-down' });
  expect(s.output).toHaveBeenCalledWith({ format: 'image/webp', quality: 90 });
  expect(result.headers.get('cache-control')).toContain('private');
  expect(result.headers.get('vary')).toBe('Accept');
  expect(result.headers.get('etag')).toBeNull();
  expect(await result.text()).toBe('optimized');
});
it('uses cached AI upscaling only for a low-resolution crop', async () => {
  const s = setup();
  const result = await optimizeProfileImage(
    request,
    source(),
    s.env,
    'card',
    undefined,
    { lowResolution: true },
  );
  expect(s.transform).toHaveBeenCalledWith({
    width: 1080,
    fit: 'contain',
    upscale: 'generate',
  });
  expect(result.headers.get('x-spikedate-image-enhancement')).toBe(
    'ai-upscaled',
  );
  expect(await result.text()).toBe('optimized');
});
it('uses a revisioned internal cache and falls back on transformation failure', async () => {
  const s = setup();
  const cache = {
    match: vi.fn(async (_key: Request) => new Response('cached')),
    put: vi.fn(),
  };
  expect(
    await (
      await optimizeProfileImage(request, source(), s.env, 'card', cache)
    ).text(),
  ).toBe('cached');
  expect(s.input).not.toHaveBeenCalled();
  expect(cache.match.mock.calls[0][0].url).toContain('revision=revision-1');
  s.input.mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(
    await (await optimizeProfileImage(request, source(), s.env, 'card')).text(),
  ).toBe('original crop');
});
