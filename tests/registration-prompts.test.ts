import { expect, it } from 'vitest';
import { vibePrompts, vibeSetupSteps } from '@/lib/registration-prompts';

it('offers five short setup stages and seventeen optional, unique starters', () => {
  expect(vibeSetupSteps).toEqual([0, 4, 7, 5, 8]);
  expect(vibePrompts).toHaveLength(17);
  expect(new Set(vibePrompts.map((item) => item.question)).size).toBe(17);
  for (const item of vibePrompts) {
    expect(item.question.length).toBeLessThanOrEqual(120);
    for (const idea of item.ideas) expect(idea.length).toBeLessThanOrEqual(180);
  }
  expect(vibePrompts.slice(0, 3).every((item) => item.ideas.length === 4)).toBe(
    true,
  );
});
