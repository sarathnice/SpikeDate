import { photoCropGeometry } from './photo-framing';

export type FramingFace = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Convert a normalized face box into existing crop-offset coordinates. */
export function faceFramingFocus(
  face: FramingFace,
  width: number,
  height: number,
) {
  const crop = photoCropGeometry(width, height, 1080, 1920, 50, 50, 1);
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const x = (face.x + face.width / 2) * width;
  const y = (face.y + face.height / 2) * height;
  return {
    focusX:
      width > crop.cropWidth
        ? clamp(((x - crop.cropWidth / 2) / (width - crop.cropWidth)) * 100)
        : 50,
    focusY:
      height > crop.cropHeight
        ? clamp(
            ((y - crop.cropHeight * 0.35) / (height - crop.cropHeight)) * 100,
          )
        : 50,
  };
}
