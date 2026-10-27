import { describe, expect, it } from 'vitest';
import { stageDemoProfiles } from '@/lib/stage-demo-profiles';

describe('stage demo profile plan', () => {
  it('defines 50 distinct adult identities across multiple locations', () => {
    expect(stageDemoProfiles).toHaveLength(50);
    expect(new Set(stageDemoProfiles.map((profile) => profile.id)).size).toBe(50);
    expect(new Set(stageDemoProfiles.map((profile) => profile.email)).size).toBe(50);
    expect(new Set(stageDemoProfiles.map((profile) => profile.city)).size).toBe(20);
    expect(stageDemoProfiles.filter((profile) => profile.gender === 'woman')).toHaveLength(25);
    expect(stageDemoProfiles.filter((profile) => profile.gender === 'man')).toHaveLength(25);
    for (const profile of stageDemoProfiles) {
      expect(Number(profile.birthDate.slice(0, 4))).toBeLessThanOrEqual(2003);
      expect(profile.bio).not.toMatch(/synthetic|test profile/i);
    }
  });

  it('requires six non-reused assets per person', () => {
    const allPhotos = stageDemoProfiles.flatMap((profile) => profile.photoPaths);
    expect(allPhotos).toHaveLength(300);
    expect(new Set(allPhotos).size).toBe(300);
    for (const profile of stageDemoProfiles)
      expect(profile.photoPaths).toHaveLength(6);
  });
});
