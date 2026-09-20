import type { D1DatabaseLike } from './db';
import { canonicalPair, identifier, json } from './http';
import { notifyUser } from './notifications';

type Send = {
  targetUserId: string;
  kind: 'like' | 'super_spike';
  note?: string;
  targetType: string;
  targetRef?: string;
  idempotencyKey: string;
  upgrade?: boolean;
};

export async function protectedSend(
  db: D1DatabaseLike,
  actor: string,
  input: Send,
) {
  const target = input.targetUserId;
  const [a, b] = canonicalPair(actor, target);
  const wallet = async () =>
    (
      await db
        .prepare(
          'SELECT super_spikes FROM entitlement_wallets WHERE user_id = ?',
        )
        .bind(actor)
        .first<{ super_spikes: number }>()
    )?.super_spikes ?? 0;
  const existing = () =>
    db
      .prepare(
        "SELECT id, kind FROM interactions WHERE actor_id = ? AND target_id = ? AND kind IN ('like', 'super_spike') AND undone_at IS NULL ORDER BY (kind = 'super_spike') DESC, created_at DESC LIMIT 1",
      )
      .bind(actor, target)
      .first<{ id: string; kind: string }>();
  const match = await db
    .prepare(
      "SELECT id FROM matches WHERE user_a_id = ? AND user_b_id = ? AND status = 'active'",
    )
    .bind(a, b)
    .first<{ id: string }>();
  if (match)
    return json({
      match,
      duplicate: true,
      charged: false,
      superSpikesRemaining: await wallet(),
    });
  const previous = await existing();
  if (previous && (input.kind === 'like' || previous.kind === 'super_spike'))
    return json({
      interaction: previous,
      duplicate: true,
      charged: false,
      superSpikesRemaining: await wallet(),
    });
  if (previous && !input.upgrade)
    return json(
      {
        error:
          'You already liked this profile. Confirm the upgrade to use 1 Spike.',
        upgradeRequired: true,
      },
      { status: 409 },
    );
  if (input.kind === 'super_spike' && (await wallet()) < 1)
    return json({ error: 'No Spikes remain this week.' }, { status: 409 });
  const now = Date.now();
  const id = previous?.id ?? identifier('int');
  const ledger = identifier('led');
  // D1 batches are atomic. The send guards, ledger and wallet debit run together;
  // changes() refers to the immediately preceding send mutation, not a stale read.
  const send = previous
    ? db
        .prepare(
          "UPDATE interactions SET kind = 'super_spike', note = ?, target_type = ?, target_ref = ?, updated_at = ? WHERE id = ? AND kind = 'like' AND undone_at IS NULL AND EXISTS (SELECT 1 FROM entitlement_wallets WHERE user_id = ? AND super_spikes > 0) AND NOT EXISTS (SELECT 1 FROM interactions WHERE actor_id = ? AND target_id = ? AND kind = 'super_spike' AND undone_at IS NULL)",
        )
        .bind(
          input.note || null,
          input.targetType,
          input.targetRef || null,
          now,
          id,
          actor,
          actor,
          target,
        )
    : db
        .prepare(
          "INSERT INTO interactions (id, actor_id, target_id, kind, note, target_type, target_ref, idempotency_key, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM interactions WHERE actor_id = ? AND target_id = ? AND kind IN ('like', 'super_spike') AND undone_at IS NULL) AND (? != 'super_spike' OR EXISTS (SELECT 1 FROM entitlement_wallets WHERE user_id = ? AND super_spikes > 0))",
        )
        .bind(
          id,
          actor,
          target,
          input.kind,
          input.note || null,
          input.targetType,
          input.targetRef || null,
          input.idempotencyKey,
          now,
          now,
          actor,
          target,
          input.kind,
          actor,
        );
  const statements = [send];
  if (input.kind === 'super_spike')
    statements.push(
      db
        .prepare(
          "INSERT INTO entitlement_ledger (id, user_id, kind, delta, reason, idempotency_key, created_at, updated_at) SELECT ?, ?, 'super_spike', -1, ?, ?, ?, ? WHERE changes() = 1",
        )
        .bind(
          ledger,
          actor,
          previous ? 'upgrade' : 'sent',
          input.idempotencyKey,
          now,
          now,
        ),
      db
        .prepare(
          'UPDATE entitlement_wallets SET super_spikes = super_spikes - 1, version = version + 1, updated_at = ? WHERE user_id = ? AND super_spikes > 0 AND EXISTS (SELECT 1 FROM entitlement_ledger WHERE id = ?)',
        )
        .bind(now, actor, ledger),
    );
  const matchId = identifier('mat');
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO matches (id, user_a_id, user_b_id, status, matched_at, created_at, updated_at) SELECT ?, ?, ?, 'active', ?, ?, ? WHERE EXISTS (SELECT 1 FROM interactions WHERE actor_id = ? AND target_id = ? AND kind IN ('like', 'super_spike') AND undone_at IS NULL) AND EXISTS (SELECT 1 FROM interactions WHERE actor_id = ? AND target_id = ? AND kind IN ('like', 'super_spike') AND undone_at IS NULL) AND NOT EXISTS (SELECT 1 FROM interactions WHERE actor_id = ? AND target_id = ? AND kind = 'pass' AND undone_at IS NULL)",
      )
      .bind(
        matchId,
        a,
        b,
        now,
        now,
        now,
        actor,
        target,
        target,
        actor,
        target,
        actor,
      ),
    db
      .prepare(
        'INSERT OR IGNORE INTO conversations (id, match_id, created_at, updated_at) SELECT ?, id, ?, ? FROM matches WHERE user_a_id = ? AND user_b_id = ? AND status = ? AND NOT EXISTS (SELECT 1 FROM conversations WHERE match_id = matches.id)',
      )
      .bind(identifier('con'), now, now, a, b, 'active'),
  );
  const results = await db.batch(statements);
  if (!Number(results[0].meta.changes)) {
    const actual = await existing();
    if (!actual)
      return json(
        { error: 'The Spike was not sent. Your balance has not changed.' },
        { status: 409 },
      );
    return json({
      interaction: actual,
      duplicate: true,
      charged: false,
      superSpikesRemaining: await wallet(),
    });
  }
  const matched = await db
    .prepare(
      "SELECT id FROM matches WHERE user_a_id = ? AND user_b_id = ? AND status = 'active'",
    )
    .bind(a, b)
    .first<{ id: string }>();
  // A delivery failure must not turn a committed send into a failed-send UI.
  try {
    const actorName =
      (
        await db
          .prepare('SELECT display_name FROM profiles WHERE user_id = ?')
          .bind(actor)
          .first<{ display_name: string }>()
      )?.display_name || 'Someone';
    await notifyUser(db, {
      userId: target,
      type: matched ? 'new_match' : 'new_like',
      title: matched
        ? "It's a Spike"
        : input.kind === 'super_spike'
          ? 'New Spike'
          : 'Someone likes you',
      body: matched
        ? `You and ${actorName} liked each other.`
        : `${actorName} ${input.kind === 'super_spike' ? 'sent you a Spike' : 'liked your profile'}.`,
      data: {
        url: matched ? '/?tab=Chat' : '/?incoming=1',
        interactionId: id,
        ...(matched ? { matchId: matched.id } : {}),
      },
    });
    if (matched)
      await notifyUser(db, {
        userId: actor,
        type: 'new_match',
        title: "It's a Spike",
        body: 'You have a new match.',
        data: { url: '/?tab=Chat', matchId: matched.id },
      });
  } catch {
    console.error('Connection notification could not be delivered.');
  }
  return json(
    {
      interaction: { id, kind: input.kind },
      match: matched,
      duplicate: false,
      upgraded: Boolean(previous),
      charged: input.kind === 'super_spike',
      superSpikesRemaining: await wallet(),
    },
    { status: 201 },
  );
}
