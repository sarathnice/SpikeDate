import { describe, expect, it } from 'vitest';
import {
  decidePhotoVerification,
  type VerificationPhotoMatch,
} from '@/lib/photo-verification-decision';

const match = (
  position: number,
  decision: VerificationPhotoMatch['decision'],
): VerificationPhotoMatch => ({
  mediaId: `photo-${position}`,
  position,
  similarityBps: decision === 'not_comparable' ? null : 9500,
  decision,
});

describe('AWS photo verification decisions', () => {
  it('verifies only when the primary photo matches', () => {
    expect(decidePhotoVerification([match(0, 'matched')])).toBe(
      'photo_verified',
    );
  });

  it('requires a retry when the primary photo does not match', () => {
    expect(decidePhotoVerification([match(0, 'mismatched')])).toBe(
      'needs_retry',
    );
    expect(decidePhotoVerification([match(0, 'not_comparable')])).toBe(
      'needs_retry',
    );
  });

  it('routes a mismatched secondary photo to human review', () => {
    expect(
      decidePhotoVerification([match(0, 'matched'), match(1, 'mismatched')]),
    ).toBe('needs_review');
  });

  it('routes an unreadable secondary photo to human review', () => {
    expect(
      decidePhotoVerification([
        match(0, 'matched'),
        match(1, 'not_comparable'),
      ]),
    ).toBe('needs_review');
  });
});
