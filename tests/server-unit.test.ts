import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';
import { canonicalPair } from '@/lib/server/http';
import { passwordSchema } from '@/lib/server/validation';
import { products } from '@/lib/server/products';

describe('server security and product rules', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const password = 'SpikeDate2026!';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
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
    expect(products['spikedate.lifts.3']).toEqual({
      type: 'consumable',
      profileLifts: 3,
    });
  });
});
