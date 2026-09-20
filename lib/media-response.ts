// Legacy R2 objects may lack MIME metadata. Detect bytes, not user filenames.
export async function mediaResponseBody(
  body: ReadableStream<Uint8Array>,
  storedType?: string,
) {
  if (storedType && storedType !== 'application/octet-stream')
    return { body, contentType: storedType };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let prefix = new Uint8Array();
  let done = false;
  while (prefix.length < 16) {
    const next = await reader.read();
    if (next.done) {
      done = true;
      break;
    }
    chunks.push(next.value);
    const sample = next.value.slice(0, 16 - prefix.length);
    const joined = new Uint8Array(prefix.length + sample.length);
    joined.set(prefix);
    joined.set(sample, prefix.length);
    prefix = joined;
  }
  const text = String.fromCharCode(...prefix);
  const contentType =
    prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff
      ? 'image/jpeg'
      : prefix[0] === 0x89 && text.slice(1, 8) === 'PNG\r\n\x1a\n'
        ? 'image/png'
        : text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP'
          ? 'image/webp'
          : /^(GIF87a|GIF89a)/.test(text)
            ? 'image/gif'
            : text.slice(4, 8) === 'ftyp' && /^(avif|avis)/.test(text.slice(8))
              ? 'image/avif'
              : text.slice(4, 8) === 'ftyp' &&
                  /^(heic|heix|hevc|hevx)/.test(text.slice(8))
                ? 'image/heic'
                : 'application/octet-stream';
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (done) {
        controller.close();
        reader.releaseLock();
      }
    },
    async pull(controller) {
      if (done) return;
      try {
        const next = await reader.read();
        if (next.done) {
          done = true;
          controller.close();
          reader.releaseLock();
        } else controller.enqueue(next.value);
      } catch (error) {
        done = true;
        controller.error(error);
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      if (!done) {
        done = true;
        await reader.cancel(reason);
        reader.releaseLock();
      }
    },
  });
  return { body: stream, contentType };
}
