import { describe, it, expect } from 'vitest';
import { faceFramingFocus } from '@/lib/face-framing';
import { photoCropGeometry } from '@/lib/photo-framing';

describe('face-aware crop suggestion', () => {
  it('frames the chosen face instead of the photo center', () => {
    const left = faceFramingFocus(
      { x: 0.1, y: 0.2, width: 0.15, height: 0.25 },
      4000,
      3000,
    );
    const right = faceFramingFocus(
      { x: 0.75, y: 0.2, width: 0.15, height: 0.25 },
      4000,
      3000,
    );
    expect(left.focusX).toBeLessThan(right.focusX);
    for (const [box, focus] of [
      [0.175, left],
      [0.825, right],
    ] as const) {
      const crop = photoCropGeometry(
        4000,
        3000,
        1080,
        1920,
        focus.focusX,
        focus.focusY,
        1,
      );
      expect(box * 4000).toBeGreaterThan(crop.sourceX);
      expect(box * 4000).toBeLessThan(crop.sourceX + crop.cropWidth);
    }
  });
  it('keeps headroom in tall photos and clamps edge faces', () => {
    const focus = faceFramingFocus(
      { x: 0.4, y: 0.45, width: 0.2, height: 0.1 },
      1200,
      4000,
    );
    const crop = photoCropGeometry(
      1200,
      4000,
      1080,
      1920,
      focus.focusX,
      focus.focusY,
      1,
    );
    expect((2000 - crop.sourceY) / crop.cropHeight).toBeCloseTo(0.35);
    for (const y of [0, 0.95]) {
      const edge = faceFramingFocus(
        { x: 0, y, width: 0.1, height: 0.1 },
        1200,
        4000,
      );
      expect(edge.focusY).toBeGreaterThanOrEqual(0);
      expect(edge.focusY).toBeLessThanOrEqual(100);
    }
  });
});
