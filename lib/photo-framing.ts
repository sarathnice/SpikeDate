export function photoCropGeometry(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  focusX: number,
  focusY: number,
  zoom: number,
) {
  if (
    ![sourceWidth, sourceHeight, targetWidth, targetHeight, zoom].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error('Invalid photo dimensions.');
  const ratio = targetWidth / targetHeight;
  let cropWidth = Math.min(sourceWidth, sourceHeight * ratio);
  let cropHeight = cropWidth / ratio;
  cropWidth /= Math.max(1, zoom);
  cropHeight /= Math.max(1, zoom);
  const clamp = (value: number) =>
    Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50));
  const scale = Math.min(1, cropWidth / targetWidth, cropHeight / targetHeight);
  return {
    sourceX: ((sourceWidth - cropWidth) * clamp(focusX)) / 100,
    sourceY: ((sourceHeight - cropHeight) * clamp(focusY)) / 100,
    cropWidth,
    cropHeight,
    width: Math.max(1, Math.floor(targetWidth * scale)),
    height: Math.max(1, Math.floor(targetHeight * scale)),
    lowResolution:
      cropWidth < Math.min(900, targetWidth) ||
      cropHeight < Math.min(1125, targetHeight),
  };
}

export const photoVariants = {
  full: { width: 1440, height: 1800, label: 'Profile 4:5' },
  card: { width: 1080, height: 1920, label: 'Discovery 9:16' },
  avatar: { width: 480, height: 480, label: 'Avatar 1:1' },
};

/** Explicit, small lighting adjustment. No face reshaping or saturation changes. */
export function applyGentleLight(
  pixels: Uint8ClampedArray,
  brightness: number,
) {
  const factor = Number.isFinite(brightness)
    ? Math.max(1, Math.min(1.06, brightness))
    : 1;
  if (factor === 1) return;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = Math.round(pixels[index] * factor);
    pixels[index + 1] = Math.round(pixels[index + 1] * factor);
    pixels[index + 2] = Math.round(pixels[index + 2] * factor);
  }
}
