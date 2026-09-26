# SpikeDate member Help

Profile → Help & support opens the member Help desk. The first answer comes from approved SpikeDate guidance, optionally rephrased by the bound Cloudflare Workers AI model for general topics. Billing, photo-verification, and location status are answered from fixed, parameterized queries scoped to the signed-in member. The model cannot run SQL or make account changes.

Members can send a conversation to staff. This changes the thread to `open` and places it in Admin → Support. A super admin or support agent can reply, resolve, or reopen. Replies appear when the member reopens Help. Other staff roles cannot read the queue. An audit event records escalation and staff actions. The chat is limited to 30 member messages per hour.

The support queue and in-app replies work without an email provider. Optional email notifications use Resend and contain only a ticket ID, never chat content. To enable them in a deployed Worker, configure `SUPPORT_FROM_EMAIL` and `SUPPORT_OWNER_EMAIL` as environment variables and store `SUPPORT_RESEND_API_KEY` as a Wrangler secret. Verify the sender domain with Resend first. Without these values, no email is sent and the in-app queue remains authoritative. Do not put the API key in a checked-in Wrangler file.

Run the new D1 migration before deploying this code. Do not display Help as a live billing-restoration or SMS-reverification tool: these services are currently in mock mode. Refunds, credits, subscription overrides, bans, and private-message disclosure always require staff review and are not AI actions.
