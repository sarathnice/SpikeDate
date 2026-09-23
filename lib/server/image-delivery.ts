type ImageBinding = {
  input: (body: ReadableStream) => {
    transform: (options: {
      width: number;
      fit: 'scale-down' | 'contain';
      upscale?: 'generate';
    }) => {
      output: (options: {
        format: string;
        quality: number;
      }) => Promise<{ response: () => Response }>;
    };
  };
};
type ImageEnvironment = {
  SPIKEDATE_IMAGES_ENABLED?: string;
  IMAGES?: ImageBinding;
};
type ImageCache = {
  match: (key: Request) => Promise<Response | undefined>;
  put: (key: Request, response: Response) => Promise<void>;
};

/** Call ONLY after authentication, block checks and moderation checks. */
export async function optimizeProfileImage(
  request: Request,
  source: Response,
  environment: ImageEnvironment,
  variant: 'full' | 'card' | 'avatar' | 'original',
  cache?: ImageCache,
  options: { lowResolution?: boolean } = {},
) {
  if (
    environment.SPIKEDATE_IMAGES_ENABLED !== 'true' ||
    !environment.IMAGES ||
    variant === 'original' ||
    !source.body ||
    !/^image\/(jpeg|png|webp)$/.test(source.headers.get('content-type') || '')
  )
    return source;
  const accept = request.headers.get('accept') || '';
  const format = accept.includes('image/avif')
    ? 'image/avif'
    : accept.includes('image/webp')
      ? 'image/webp'
      : 'image/jpeg';
  const width = variant === 'avatar' ? 480 : variant === 'card' ? 1080 : 1440;
  const aiUpscale = options.lowResolution === true;
  const keyUrl = new URL(request.url);
  keyUrl.pathname = '/__private-image-cache' + keyUrl.pathname;
  keyUrl.search = new URLSearchParams({
    variant,
    format,
    width: String(width),
    revision: source.headers.get('etag') || 'uncached',
    pipeline: aiUpscale ? 'ai-upscale-v2' : 'natural-v1',
  }).toString();
  const key = new Request(keyUrl, { method: 'GET' });
  // Without a source revision, do not risk reusing a stale image after an edit.
  const revisionedCache = source.headers.has('etag') ? cache : undefined;
  try {
    const hit = await revisionedCache?.match(key);
    let result = hit;
    if (!result) {
      const optimized = await environment.IMAGES.input(source.clone().body!)
        .transform(
          aiUpscale
            ? {
                width,
                fit: 'contain',
                upscale: 'generate',
              }
            : { width, fit: 'scale-down' },
        )
        .output({ format, quality: 90 });
      result = optimized.response();
      if (!result.ok || !result.body) return source;
      if (revisionedCache) {
        const stored = new Response(result.clone().body, {
          headers: result.headers,
        });
        stored.headers.set('cache-control', 'public, max-age=3600');
        // A cache outage must never hide a successfully transformed photo.
        try {
          await revisionedCache.put(key, stored);
        } catch {
          /* serve result */
        }
      }
    }
    const headers = new Headers(source.headers);
    headers.delete('etag');
    headers.delete('content-length');
    headers.set('content-type', result.headers.get('content-type') || format);
    headers.set('vary', 'Accept');
    headers.set('cache-control', 'private, max-age=3600');
    headers.set(
      'x-spikedate-image-delivery',
      hit ? 'optimized-cache' : 'optimized',
    );
    headers.set(
      'x-spikedate-image-enhancement',
      aiUpscale ? 'ai-upscaled' : 'natural',
    );
    void source.body.cancel().catch(() => {});
    return new Response(result.body, { headers });
  } catch (error) {
    console.warn('Profile image optimization unavailable; serving R2 source.', error);
    // Images is optional: retain working R2 delivery if disabled/unavailable.
    return source;
  }
}
