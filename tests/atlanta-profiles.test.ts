import { expect, it } from 'vitest';
import { generateManifest } from '../scripts/atlanta-profile-assets.mjs';

it('plans 200 distinct local Atlanta identities, 100 women and 100 men',()=>{
  const m=generateManifest();
  expect(m.profiles).toHaveLength(200);
  for(const key of ['id','email','displayName','bio','prompt']) expect(new Set(m.profiles.map(p=>p[key])).size).toBe(200);
  expect(m.profiles.filter(p=>p.gender==='woman')).toHaveLength(100);
  expect(m.profiles.filter(p=>p.gender==='man')).toHaveLength(100);
  for(const duplicate of ['Vivian B.','Zara B.','Morgan C.','Laila D.','Yusuf H.']) expect(m.profiles.some(p=>p.displayName===duplicate)).toBe(false);
  expect(new Set(m.profiles.map(p=>p.city)).size).toBeGreaterThan(15);
  for(const p of m.profiles) {
    expect(p.age).toBeGreaterThanOrEqual(18);expect(p.region).toBe('GA');expect(p.fictional).toBe(true);expect(p.verified).toBe(false);
    expect(p.latitudeE6).toBeGreaterThan(33_000_000);expect(p.latitudeE6).toBeLessThan(35_000_000);
    expect(p.longitudeE6).toBeGreaterThan(-85_000_000);expect(p.longitudeE6).toBeLessThan(-83_000_000);
    expect(p.photos).toHaveLength(0);expect(p.status).toBe('awaiting-images');
  }
});
