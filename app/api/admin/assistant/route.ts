import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json, readJson } from '@/lib/server/http';

export const runtime = 'edge';
const schema = z.object({ question: z.string().trim().min(3).max(240), userId: z.string().trim().max(100).optional() });
type AiBinding = { run: (model: string, input: { messages: Array<{ role: string; content: string }>; max_tokens: number }) => Promise<{ response?: string }> };

export async function POST(request: Request) {
  const input = await readJson<unknown>(request);
  if (input instanceof Response) return input;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: 'Ask a short question about a SpikeDate account.' }, { status: 400 });
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, ['super_admin', 'safety_reviewer', 'moderator', 'support_agent', 'billing_analyst']);
    if (admin instanceof Response) return admin;
    const question = parsed.data.question.toLowerCase().replace(/[?.!]/g, '').trim();
    if (/^(how many|count|number of|total(?: number of)?)\b/.test(question) && /\b(people|users|accounts)\b/.test(question)) {
      const remainder = question.replace(/^(how many|count|number of|total(?: number of)?)\s*/, '')
        .replace(/\b(all|the|are|there|of|people|users|accounts)\b/g, '').trim();
      let answer: string;
      if (remainder === '' || remainder === 'active' || remainder === 'suspended') {
        const status = remainder;
        const row = status
          ? await db.prepare('SELECT COUNT(*) AS count FROM users WHERE status = ?').bind(status).first<{ count: number }>()
          : await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
        answer = `${Number(row?.count ?? 0).toLocaleString('en-US')} ${status || 'total'} accounts in SpikeDate. This is an account count, not a live online count.`;
      } else {
        answer = 'I can count all, active, or suspended accounts. For other combinations, use the People directory filters.';
      }
      await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(identifier('aud'), admin.user.id, 'admin.assistant.ask', 'user', 'count', JSON.stringify({ mode: 'structured', questionLength: parsed.data.question.length, countQuery: true }), Date.now()).run();
      return json({ answer, mode: 'structured', matches: [], sourceUserId: null });
    }
    const safeQuery = parsed.data.question.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? parsed.data.question.replace(/^(find|show|search|summarize|tell me about)\s+/i, '').trim();
    const term = safeQuery.slice(0, 80);
    const candidates = parsed.data.userId ? await db.prepare(
      'SELECT users.id, users.email, users.status, profiles.display_name, profiles.verification_status FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.id = ? LIMIT 1',
    ).bind(parsed.data.userId).all() : await db.prepare(
      'SELECT users.id, users.email, users.status, profiles.display_name, profiles.verification_status FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.email LIKE ? OR profiles.display_name LIKE ? OR users.phone_number LIKE ? OR users.id = ? LIMIT 5',
    ).bind(`%${term}%`, `%${term}%`, `%${term}%`, term).all();
    const rows = candidates.results as Array<{ id: string; email: string; status: string; display_name: string | null; verification_status: string | null }>;
    const subject = rows.length === 1 ? rows[0] : null;
    let facts: Record<string, unknown> | null = null;
    if (subject) {
      const safety = admin.roles.some((role) => ['super_admin', 'safety_reviewer', 'moderator'].includes(role));
      const [matches, reports, blocks, subscriptions] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS count FROM matches WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'").bind(subject.id, subject.id).first<{ count: number }>(),
        safety ? db.prepare("SELECT COUNT(*) AS count FROM safety_actions WHERE subject_id = ? AND kind = 'report'").bind(subject.id).first<{ count: number }>() : null,
        safety ? db.prepare("SELECT COUNT(*) AS count FROM safety_actions WHERE reporter_id = ? AND kind = 'block'").bind(subject.id).first<{ count: number }>() : null,
        admin.roles.some((role) => ['super_admin', 'billing_analyst'].includes(role)) ? db.prepare("SELECT plan, provider, status, current_period_ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(subject.id).first() : null,
      ]);
      facts = { userId: subject.id, displayName: subject.display_name, status: subject.status,
        verificationStatus: subject.verification_status, activeMatches: matches?.count ?? 0,
        ...(safety ? { reportsAgainst: reports?.count ?? 0, blocksMade: blocks?.count ?? 0 } : {}),
        ...(subscriptions ? { latestSubscription: subscriptions } : {}) };
    }
    let answer = subject ? `${subject.display_name ?? 'This account'} is ${subject.status}. Photo verification: ${subject.verification_status ?? 'unverified'}. Active connections: ${Number(facts?.activeMatches ?? 0)}.${'reportsAgainst' in (facts ?? {}) ? ` Reports against: ${Number(facts?.reportsAgainst ?? 0)}. Blocks made: ${Number(facts?.blocksMade ?? 0)}.` : ''} Open the account record for source details.` :
      rows.length ? `I found ${rows.length} possible accounts. Select one to see its verified details.` :
      'No matching account was found. Search by exact email, user ID, phone, or display name.';
    let mode: 'workers_ai' | 'structured' = 'structured';
    const ai = (env as unknown as { AI?: AiBinding }).AI;
    if (ai && facts) {
      try {
        const result = await ai.run('@cf/meta/llama-3.2-3b-instruct', { max_tokens: 160, messages: [
          { role: 'system', content: 'Summarize only the supplied SpikeDate database facts in two short factual sentences. No speculation, advice, decisions, or claims beyond the JSON. Do not mention private chats or camera images.' },
          { role: 'user', content: JSON.stringify({ question: parsed.data.question, facts }) },
        ] });
        if (result.response?.trim()) { answer = result.response.trim().slice(0, 800); mode = 'workers_ai'; }
      } catch { /* Database-only answer remains available when Workers AI is unavailable. */ }
    }
    await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(identifier('aud'), admin.user.id, 'admin.assistant.ask', 'user', subject?.id ?? 'search', JSON.stringify({ mode, questionLength: parsed.data.question.length, matches: rows.length }), Date.now()).run();
    return json({ answer, mode, matches: rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, status: row.status })), sourceUserId: subject?.id ?? null });
  });
}
