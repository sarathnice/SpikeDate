import { expect, it } from 'vitest';
import { mediaResponseBody } from '@/lib/media-response';
const bytes = (text: string) =>
  Uint8Array.from(text, (character) => character.charCodeAt(0));
const stream = (data: Uint8Array, chunkSize = data.length) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < data.length; i += chunkSize)
        controller.enqueue(data.slice(i, i + chunkSize));
      controller.close();
    },
  });
for (const [type, sample] of [
  ['image/png', '\x89PNG\r\n\x1a\nexample-image-body'],
  ['image/jpeg', '\xff\xd8\xffexample-image-body'],
  ['image/webp', 'RIFF0000WEBPexample-image-body'],
  ['image/gif', 'GIF89aexample-image-body'],
  ['image/avif', '0000ftypavifexample-image-body'],
  ['application/octet-stream', 'unknown-binary-body'],
] as const) {
  it(`detects legacy ${type} and preserves streamed bytes`, async () => {
    const data = bytes(sample);
    const response = await mediaResponseBody(stream(data, 2));
    expect(response.contentType).toBe(type);
    expect(
      new Uint8Array(await new Response(response.body).arrayBuffer()),
    ).toEqual(data);
  });
}
it('preserves known metadata without reading the stream', async () => {
  const body = stream(bytes('body'));
  const response = await mediaResponseBody(body, 'video/mp4');
  expect(response.body).toBe(body);
  expect(response.contentType).toBe('video/mp4');
  expect(body.locked).toBe(false);
});
it('handles empty legacy objects safely', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  const response = await mediaResponseBody(body);
  expect(response.contentType).toBe('application/octet-stream');
  expect(await new Response(response.body).text()).toBe('');
});
