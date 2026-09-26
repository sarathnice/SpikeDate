import { describe, expect, it } from 'vitest';
import { accountHelp, helpTopic } from '@/lib/server/help';

describe('SpikeDate member Help', () => {
  it('routes common issues to approved topics', () => {
    expect(helpTopic('I was charged for a subscription')).toBe('billing');
    expect(helpTopic('My photo verification failed')).toBe('verification');
    expect(helpTopic('Why are there no nearby people in Galaxy?')).toBe('location');
    expect(helpTopic('How do I report abuse?')).toBe('safety');
  });

  it('uses only supplied account facts for exact status answers', () => {
    const answer = accountHelp('verification', {
      phoneVerified: false,
      verificationStatus: 'pending',
      subscription: null,
      discoveryLocationMode: null,
    });
    expect(answer).toContain('pending');
    expect(answer).toContain('Phone verified: no');
    expect(answer).not.toContain('Photo Verified badge is active');
  });

  it('does not promise a store refund or restore', () => {
    const answer = accountHelp('billing', {
      phoneVerified: true,
      verificationStatus: 'photo_verified',
      subscription: { plan: 'weekly', status: 'active', provider: 'mock' },
      discoveryLocationMode: 'precise',
    });
    expect(answer).toContain('test mode');
    expect(answer).toContain('weekly (active, mock)');
    expect(answer).toContain('cannot be restored or refunded');
  });
});
