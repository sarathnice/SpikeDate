import { describe, expect, it } from 'vitest';
import {
  applyGentleLight,
  photoCropGeometry,
  photoVariants,
} from '@/lib/photo-framing';

describe('saved photo framing', () => {
  it('leaves Natural untouched and applies only a capped, alpha-preserving light adjustment', () => {
    const pixels = new Uint8ClampedArray([100, 150, 250, 120]);
    applyGentleLight(pixels, 1);
    expect([...pixels]).toEqual([100, 150, 250, 120]);
    applyGentleLight(pixels, 1.06);
    expect([...pixels]).toEqual([106, 159, 255, 120]);
    const capped = new Uint8ClampedArray([100, 100, 100, 255]);
    applyGentleLight(capped, 2);
    expect([...capped]).toEqual([106, 106, 106, 255]);
  });
  for (const [name, target] of Object.entries(photoVariants)) {
    it(`${name} fills the frame without stretching or sampling outside the source`, () => {
      for (const [width, height] of [
        [4000, 3000],
        [1200, 2400],
        [320, 240],
      ]) {
        for (const zoom of [1, 1.5, 2.2]) {
          for (const focus of [0, 36, 100]) {
            const crop = photoCropGeometry(
              width,
              height,
              target.width,
              target.height,
              focus,
              focus,
              zoom,
            );
            expect(crop.cropWidth / crop.cropHeight).toBeCloseTo(
              target.width / target.height,
              6,
            );
            expect(crop.sourceX).toBeGreaterThanOrEqual(0);
            expect(crop.sourceY).toBeGreaterThanOrEqual(0);
            expect(crop.sourceX + crop.cropWidth).toBeLessThanOrEqual(
              width + 0.00001,
            );
            expect(crop.sourceY + crop.cropHeight).toBeLessThanOrEqual(
              height + 0.00001,
            );
            expect(crop.width).toBeLessThanOrEqual(crop.cropWidth);
            expect(crop.height).toBeLessThanOrEqual(crop.cropHeight);
            expect(crop.width).toBeLessThanOrEqual(target.width);
            expect(crop.height).toBeLessThanOrEqual(target.height);
          }
        }
      }
    });
  }
  it('warns on limited source detail rather than inflating output dimensions', () => {
    const crop = photoCropGeometry(320, 240, 1440, 1800, 50, 36, 1);
    expect(crop.width).toBe(192);
    expect(crop.height).toBe(240);
    expect(crop.lowResolution).toBe(true);
    expect(
      photoCropGeometry(4000, 5000, 1440, 1800, 50, 36, 1).lowResolution,
    ).toBe(false);
  });
  it('clamps focal positions and rejects invalid source dimensions', () => {
    expect(photoCropGeometry(2000, 2000, 480, 480, -50, 300, 2)).toMatchObject({
      sourceX: 0,
      sourceY: 1000,
    });
    expect(() => photoCropGeometry(0, 100, 480, 480, 50, 50, 1)).toThrow(
      'Invalid photo dimensions',
    );
  });
});
