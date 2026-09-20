import type { FaceDetector } from '@mediapipe/tasks-vision';

// Load only when a user enters a camera or photo-framing flow. Framing uses
// small on-device samples, never an identity decision or remote upload.
let detectorPromise: Promise<FaceDetector> | undefined;
async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } =
        await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/verification/wasm');
      return FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: '/verification/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.65,
      });
    })().catch((error) => {
      detectorPromise = undefined;
      throw error;
    });
  }
  return detectorPromise;
}

export async function detectCaptureFaces(canvas: HTMLCanvasElement) {
  const detector = await getDetector();
  const faces = detector.detect(canvas).detections;
  const box = faces.length === 1 ? faces[0].boundingBox : undefined;
  const positioned = Boolean(
    box &&
    box.width >= canvas.width * 0.18 &&
    box.width <= canvas.width * 0.8 &&
    box.height >= canvas.height * 0.18 &&
    Math.abs((box.originX + box.width / 2) / canvas.width - 0.5) <= 0.2 &&
    Math.abs((box.originY + box.height / 2) / canvas.height - 0.5) <= 0.25 &&
    box.originX >= 0 &&
    box.originY >= 0 &&
    box.originX + box.width <= canvas.width &&
    box.originY + box.height <= canvas.height,
  );
  return { faceCount: faces.length, positioned };
}

/** On-device photo framing assistance; never an identity decision. */
export async function detectFramingFaces(canvas: HTMLCanvasElement) {
  const detector = await getDetector();
  return detector.detect(canvas).detections.flatMap((face) => {
    const box = face.boundingBox;
    return box
      ? [
          {
            x: box.originX / canvas.width,
            y: box.originY / canvas.height,
            width: box.width / canvas.width,
            height: box.height / canvas.height,
          },
        ]
      : [];
  });
}
