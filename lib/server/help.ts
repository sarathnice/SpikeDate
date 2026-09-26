export type HelpTopic = 'billing' | 'verification' | 'location' | 'profile' | 'safety' | 'general';

const articles: Record<HelpTopic, string> = {
  billing: 'SpikeDate subscriptions and purchases are currently in test mode. A store purchase cannot be restored or refunded from Help yet. If you believe a charge or credit is wrong, send a support request so the owner can review the transaction.',
  verification: 'Photo Verified requires both a successful live video check and a match against an approved primary profile photo. A camera check alone does not issue the badge. If a check fails repeatedly, use a clear, well-lit main photo and contact support with the error shown. Never send your verification video in chat.',
  location: 'Nearby discovery uses your current location when location permission is enabled. Enable location for SpikeDate in your device settings, then reopen Galaxy. If permission is declined, nearby profiles are not shown. Your exact coordinates are not displayed to other members.',
  profile: 'Open Profile to edit each section independently. Edit photos opens the photo studio, where you can choose the main photo, crop, and save. Changes may take a moment to appear in discovery after moderation.',
  safety: 'You can block or report a profile from its safety menu. For urgent danger, contact local emergency services. For a SpikeDate safety concern, send a support request with the profile name and what happened; do not share passwords or private verification media.',
  general: 'I can help with photo verification, nearby profiles, profile edits, billing status, and safety. Choose a topic or describe the issue. If I cannot resolve it, send a support request for the owner to review.',
};

export function helpTopic(question: string): HelpTopic {
  const q = question.toLowerCase();
  if (/refund|charg|pay|bill|purchas|credit|subscription|spike.*remaining|like.*remaining/.test(q)) return 'billing';
  if (/verif|selfie|liveness|camera check|badge|face/.test(q)) return 'verification';
  if (/locat|nearby|galaxy|city|distance|travel/.test(q)) return 'location';
  if (/photo|upload|crop|edit|profile|bio/.test(q)) return 'profile';
  if (/report|block|harass|scam|unsafe|abuse|safety/.test(q)) return 'safety';
  return 'general';
}

export function approvedHelp(topic: HelpTopic) { return articles[topic]; }

export function accountHelp(topic: HelpTopic, facts: {
  phoneVerified: boolean; verificationStatus: string | null;
  subscription: { plan: string; status: string; provider: string } | null;
  discoveryLocationMode: string | null;
}): string {
  if (topic === 'billing') return `${articles.billing} Your latest subscription: ${facts.subscription ? `${facts.subscription.plan} (${facts.subscription.status}, ${facts.subscription.provider})` : 'none on this account'}. This is an account record, not a store receipt.`;
  if (topic === 'verification') return `${articles.verification} Your current photo-verification status: ${facts.verificationStatus ?? 'not started'}. Phone verified: ${facts.phoneVerified ? 'yes' : 'no'}.`;
  if (topic === 'location') return `${articles.location} Your current discovery-location mode: ${facts.discoveryLocationMode ?? 'not set'}.`;
  return articles[topic];
}
