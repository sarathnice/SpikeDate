import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ProfileActionIcon } from '@/components/profile-action-icon';

describe('shared profile action icons', () => {
  it('renders a single filled heart, not a brand mark, for Like', () => {
    const markup = renderToStaticMarkup(createElement(ProfileActionIcon, { action: 'like' }));
    expect(markup.match(/<svg/g)).toHaveLength(1);
    expect(markup).toContain('lucide-heart');
    expect(markup).toContain('fill="currentColor"');
    expect(markup).not.toContain('brand-heart-mark');
  });
  it('keeps the same dimensions and stroke on basic action glyphs', () => {
    for (const action of ['like', 'pass', 'message', 'save'] as const) {
      const markup = renderToStaticMarkup(createElement(ProfileActionIcon, { action }));
      expect(markup).toContain('width="24"');
      expect(markup).toContain('height="24"');
      expect(markup).toContain('stroke-width="1.8"');
      expect(markup).toContain('aria-hidden="true"');
    }
  });
  it('uses one composite Spike introduction instead of the branding logo', () => {
    const markup = renderToStaticMarkup(createElement(ProfileActionIcon, { action: 'spike' }));
    expect(markup).toContain('spike-intro-icon');
    expect(markup).toContain('lucide-message-circle');
    expect(markup).toContain('spike-intro-star');
    expect(markup).toContain('spike-intro-plus');
  });
  it('fills Save only when saved', () => {
    expect(renderToStaticMarkup(createElement(ProfileActionIcon, { action: 'save' }))).toContain('fill="none"');
    expect(renderToStaticMarkup(createElement(ProfileActionIcon, { action: 'save', saved: true }))).toContain('fill="currentColor"');
  });
});
