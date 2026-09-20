// Self-host the pinned runtime: camera images never go to a model CDN.
import { cp, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const model = await readFile(
  new URL(
    '../public/verification/blaze_face_short_range.tflite',
    import.meta.url,
  ),
);
if (
  createHash('sha256').update(model).digest('hex') !==
  'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f'
) {
  throw new Error(
    'The versioned face detector model is missing or has changed.',
  );
}
const target = new URL('../public/verification/wasm/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(
  new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  target,
  { recursive: true },
);
