import { env } from 'cloudflare:workers';

type MailConfig = { SUPPORT_RESEND_API_KEY?: string; SUPPORT_FROM_EMAIL?: string; SUPPORT_OWNER_EMAIL?: string };

// Notification mail contains no conversation content or private account facts.
export async function notifySupportEmail(kind: 'new_request' | 'reply', ticketId: string, memberEmail?: string) {
  const config = env as unknown as MailConfig;
  const to = kind === 'new_request' ? config.SUPPORT_OWNER_EMAIL : memberEmail;
  if (!config.SUPPORT_RESEND_API_KEY || !config.SUPPORT_FROM_EMAIL || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.SUPPORT_RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `${kind}-${ticketId}-${Date.now()}` },
    body: JSON.stringify({
      from: config.SUPPORT_FROM_EMAIL,
      to: [to],
      subject: kind === 'new_request' ? 'New SpikeDate support request' : 'SpikeDate support replied',
      text: kind === 'new_request' ? `A member sent support request ${ticketId}. Sign in to the SpikeDate admin Support queue to review it.` : `SpikeDate support replied to request ${ticketId}. Open Help in your SpikeDate Profile to read the reply.`,
    }),
  });
  if (!response.ok) throw new Error(`Support email provider returned ${response.status}`);
  return true;
}
