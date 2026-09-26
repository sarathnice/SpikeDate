import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';
import { accountHelp, helpTopic } from '@/lib/server/help';
import { notifySupportEmail } from '@/lib/server/support-email';

export const runtime = 'edge';
const chatSchema = z.object({ message: z.string().trim().min(2).max(1000), threadId: z.string().max(80).optional() });
const escalateSchema = z.object({ threadId: z.string().max(80), category: z.enum(['billing', 'verification', 'location', 'profile', 'safety', 'general']), subject: z.string().trim().min(3).max(100) });
type Ai = { run: (model: string, input: { messages: Array<{ role: string; content: string }>; max_tokens: number }) => Promise<{ response?: string }> };

export async function GET(request: Request) {
  return withDatabase(async (db) => {
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const threads = await db.prepare('SELECT id, category, subject, status, created_at, updated_at FROM support_threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20').bind(user.id).all<{ id: string; category: string; subject: string; status: string; created_at: number; updated_at: number }>();
    const requested = new URL(request.url).searchParams.get('id');
    const thread = requested ? threads.results.find((item) => item.id === requested) : threads.results[0];
    if (requested && !thread) return json({ error: 'Conversation not found.' }, { status: 404 });
    if (!thread) return json({ thread: null, threads: [], messages: [] });
    const messages = await db.prepare('SELECT id, sender, body, created_at FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 100').bind(thread.id).all();
    return json({ thread, threads: threads.results, messages: messages.results });
  });
}

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = chatSchema.safeParse(input);
  if (!parsed.success) return json({ error: 'Enter a question of up to 1,000 characters.' }, { status: 400 });
  return withDatabase(async (db) => {
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const now = Date.now();
    const recent = await db.prepare("SELECT COUNT(*) AS count FROM support_messages JOIN support_threads ON support_threads.id = support_messages.thread_id WHERE support_threads.user_id = ? AND support_messages.sender = 'user' AND support_messages.created_at > ?").bind(user.id, now - 3600000).first<{ count: number }>();
    if (Number(recent?.count ?? 0) >= 30) return json({ error: 'You have reached the hourly Help limit. You can still contact support from this conversation.' }, { status: 429 });
    let thread = parsed.data.threadId ? await db.prepare('SELECT id, status FROM support_threads WHERE id = ? AND user_id = ?').bind(parsed.data.threadId, user.id).first<{ id: string; status: string }>() : null;
    if (parsed.data.threadId && !thread) return json({ error: 'Conversation not found.' }, { status: 404 });
    if (thread?.status === 'resolved') thread = null;
    const id = thread?.id ?? identifier('sup');
    const topic = helpTopic(parsed.data.message);
    if (!thread) await db.prepare('INSERT INTO support_threads (id, user_id, category, status, subject, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, topic, 'self_service', parsed.data.message.slice(0, 100), now, now).run();
    if (thread && thread.status !== 'self_service') {
      await db.batch([
        db.prepare('INSERT INTO support_messages (id, thread_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(identifier('sm'), id, 'user', parsed.data.message, now),
        db.prepare("UPDATE support_threads SET status = 'open', updated_at = ? WHERE id = ?").bind(now, id),
      ]);
      return json({ threadId: id, status: 'open', answer: 'Your update was added to the support request. The owner can see it.' });
    }
    const [account, profile, subscription] = await Promise.all([
      db.prepare('SELECT phone_verified_at FROM users WHERE id = ?').bind(user.id).first<{ phone_verified_at: number | null }>(),
      db.prepare('SELECT verification_status, discovery_location_mode FROM profiles WHERE user_id = ?').bind(user.id).first<{ verification_status: string | null; discovery_location_mode: string | null }>(),
      db.prepare('SELECT plan, status, provider FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first<{ plan: string; status: string; provider: string }>(),
    ]);
    const approved = accountHelp(topic, { phoneVerified: Boolean(account?.phone_verified_at), verificationStatus: profile?.verification_status ?? null, discoveryLocationMode: profile?.discovery_location_mode ?? null, subscription });
    let answer = approved;
    let mode: 'approved' | 'workers_ai' = 'approved';
    // Exact account facts and billing responses stay deterministic; AI may only rephrase general approved help.
    const ai = (env as unknown as { AI?: Ai }).AI;
    if (ai && !['billing', 'verification', 'location'].includes(topic)) {
      try {
        const result = await ai.run('@cf/meta/llama-3.2-3b-instruct', { max_tokens: 180, messages: [
          { role: 'system', content: 'You are SpikeDate Help. Answer only using the approved help text. Do not invent features, promise an outcome, request private data, or give legal/medical advice. If the text does not answer the question, say you can send it to the owner. Keep it brief.' },
          { role: 'user', content: JSON.stringify({ question: parsed.data.message, approvedHelp: approved }) },
        ] });
        if (result.response?.trim()) { answer = result.response.trim().slice(0, 900); mode = 'workers_ai'; }
      } catch { /* The approved answer remains available if Workers AI is unavailable. */ }
    }
    await db.batch([
      db.prepare('INSERT INTO support_messages (id, thread_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(identifier('sm'), id, 'user', parsed.data.message, now),
      db.prepare('INSERT INTO support_messages (id, thread_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(identifier('sm'), id, 'assistant', answer, now + 1),
      db.prepare('UPDATE support_threads SET updated_at = ? WHERE id = ?').bind(now + 1, id),
    ]);
    return json({ threadId: id, answer, mode, topic, canEscalate: true });
  });
}

export async function PATCH(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = escalateSchema.safeParse(input);
  if (!parsed.success) return json({ error: 'Choose a topic and subject.' }, { status: 400 });
  return withDatabase(async (db) => {
    const user = await requireUser(request, db);
    if (user instanceof Response) return user;
    const thread = await db.prepare('SELECT id, status FROM support_threads WHERE id = ? AND user_id = ?').bind(parsed.data.threadId, user.id).first<{ id: string; status: string }>();
    if (!thread) return json({ error: 'Conversation not found.' }, { status: 404 });
    if (thread.status !== 'self_service') return json({ error: 'This request has already been sent.' }, { status: 409 });
    const now = Date.now();
    await db.batch([
      db.prepare("UPDATE support_threads SET status = 'open', category = ?, subject = ?, updated_at = ? WHERE id = ?").bind(parsed.data.category, parsed.data.subject, now, thread.id),
      db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(identifier('aud'), user.id, 'support.escalate', 'support_thread', thread.id, now),
    ]);
    try { await notifySupportEmail('new_request', thread.id); } catch (error) { console.error('Support notification failed', error); }
    return json({ status: 'open', message: 'Sent to SpikeDate support. You can return here for a reply.' });
  });
}
