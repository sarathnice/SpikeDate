import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';
import { canonicalPair } from '@/lib/server/http';
import { passwordSchema } from '@/lib/server/validation';
import { products } from '@/lib/server/products';
import { assessCameraFrame } from '@/components/photo-verification-dialog';

describe('server security and product rules', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const password = 'SpikeDate2026!';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash).toContain('pbkdf2-sha256$100000$');
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPassword2026!', hash)).resolves.toBe(
      false,
    );
  });

  it('enforces a strong minimum password', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('SpikeDate2026!').success).toBe(true);
  });

  it('canonicalizes match pairs', () => {
    expect(canonicalPair('user-b', 'user-a')).toEqual(['user-a', 'user-b']);
  });

  it('keeps subscriptions and consumable lifts distinct', () => {
    expect(products['spikedate.plus.weekly'].type).toBe('subscription');
    expect(products['spikedate.plus.monthly'].type).toBe('subscription');
    expect('spikedate.plus.annual' in products).toBe(false);
    expect(products['spikedate.lifts.3']).toEqual({
      type: 'consumable',
      profileLifts: 3,
    });
  });

  it('measures camera brightness and focus without retaining an image', () => {
    const variedFrame = new Uint8ClampedArray(64);
    for (let index = 0; index < variedFrame.length; index += 4) {
      const value = index % 32 === 0 ? 40 : 210;
      variedFrame[index] = value;
      variedFrame[index + 1] = value;
      variedFrame[index + 2] = value;
      variedFrame[index + 3] = 255;
    }
    const metrics = assessCameraFrame(variedFrame);
    expect(metrics.brightness).toBeGreaterThan(40);
    expect(metrics.brightness).toBeLessThan(210);
    expect(metrics.sharpness).toBeGreaterThan(4.5);
  });
});
