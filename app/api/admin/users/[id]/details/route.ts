import { requireAdmin } from '@/lib/server/admin';
import { getDb, withDatabase } from '@/lib/server/db';
import { identifier, json } from '@/lib/server/http';

export const runtime = 'edge';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return withDatabase(async () => {
    const db = getDb();
    const admin = await requireAdmin(request, db, [
      'super_admin', 'safety_reviewer', 'moderator', 'support_agent', 'billing_analyst',
    ]);
    if (admin instanceof Response) return admin;
    const { id } = await context.params;
    const user = await db.prepare(
      'SELECT users.id, users.email, users.phone_number, users.phone_verified_at, users.status, users.created_at, users.last_active_at, ' +
      'profiles.display_name, profiles.city, profiles.region, profiles.country, profiles.verification_status, ' +
      'profiles.discoverable, profiles.bio FROM users LEFT JOIN profiles ON profiles.user_id = users.id WHERE users.id = ? LIMIT 1',
    ).bind(id).first();
    if (!user) return json({ error: 'Account not found.' }, { status: 404 });
    const safety = admin.roles.some((role) => ['super_admin', 'safety_reviewer', 'moderator'].includes(role));
    const billing = admin.roles.some((role) => ['super_admin', 'billing_analyst'].includes(role));
    const [profileDetails, interests, prompts, discovery, today, photos, verification, photoMatches, connections, blocksMade, blocksReceived, reportsMade, reportsReceived, subscriptions, purchases, wallet, ledger] = await Promise.all([
      safety ? db.prepare('SELECT gender, pronouns, bio, occupation, education, height_cm, ethnicity, relationship_goal, kids, wants_kids, drinking, smoking, pets FROM profiles WHERE user_id = ? LIMIT 1').bind(id).first() : null,
      safety ? db.prepare('SELECT interests.label, interests.category FROM user_interests JOIN interests ON interests.id = user_interests.interest_id WHERE user_interests.user_id = ? ORDER BY interests.category, interests.label LIMIT 50').bind(id).all() : { results: [] },
      safety ? db.prepare('SELECT prompt, answer FROM profile_prompts WHERE user_id = ? ORDER BY position LIMIT 10').bind(id).all() : { results: [] },
      safety ? db.prepare('SELECT * FROM preferences WHERE user_id = ? LIMIT 1').bind(id).first() : null,
      safety ? db.prepare('SELECT text, visibility, available_tonight, expires_at FROM daily_updates WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1').bind(id).first() : null,
      safety ? db.prepare('SELECT id, type, position, width, height, moderation_status, created_at FROM profile_media WHERE user_id = ? ORDER BY position LIMIT 12').bind(id).all() : { results: [] },
      safety ? db.prepare('SELECT id, provider, status, submitted_at, reviewed_at FROM verification_requests WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 5').bind(id).all() : { results: [] },
      safety ? db.prepare('SELECT verification_photo_matches.request_id, verification_photo_matches.media_id, verification_photo_matches.similarity_bps, verification_photo_matches.decision FROM verification_photo_matches JOIN verification_requests ON verification_requests.id = verification_photo_matches.request_id WHERE verification_requests.user_id = ? ORDER BY verification_photo_matches.created_at DESC LIMIT 24').bind(id).all() : { results: [] },
      db.prepare('SELECT matches.id, matches.status, matches.matched_at, matches.ended_at, other.id AS other_id, profiles.display_name AS other_name FROM matches JOIN users other ON other.id = CASE WHEN matches.user_a_id = ? THEN matches.user_b_id ELSE matches.user_a_id END LEFT JOIN profiles ON profiles.user_id = other.id WHERE matches.user_a_id = ? OR matches.user_b_id = ? ORDER BY matches.matched_at DESC LIMIT 50').bind(id, id, id).all(),
      safety ? db.prepare("SELECT safety_actions.id, safety_actions.subject_id AS other_id, profiles.display_name AS other_name, safety_actions.created_at FROM safety_actions LEFT JOIN profiles ON profiles.user_id = safety_actions.subject_id WHERE safety_actions.reporter_id = ? AND safety_actions.kind = 'block' ORDER BY safety_actions.created_at DESC LIMIT 50").bind(id).all() : { results: [] },
      safety ? db.prepare("SELECT safety_actions.id, safety_actions.reporter_id AS other_id, profiles.display_name AS other_name, safety_actions.created_at FROM safety_actions LEFT JOIN profiles ON profiles.user_id = safety_actions.reporter_id WHERE safety_actions.subject_id = ? AND safety_actions.kind = 'block' ORDER BY safety_actions.created_at DESC LIMIT 50").bind(id).all() : { results: [] },
      safety ? db.prepare("SELECT id, subject_id AS other_id, reason, details, status, created_at FROM safety_actions WHERE reporter_id = ? AND kind = 'report' ORDER BY created_at DESC LIMIT 50").bind(id).all() : { results: [] },
      safety ? db.prepare("SELECT id, reporter_id AS other_id, reason, details, status, created_at FROM safety_actions WHERE subject_id = ? AND kind = 'report' ORDER BY created_at DESC LIMIT 50").bind(id).all() : { results: [] },
      billing ? db.prepare('SELECT id, provider, provider_subscription_id, plan, status, current_period_ends_at, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').bind(id).all() : { results: [] },
      billing ? db.prepare('SELECT id, provider, provider_transaction_id, product_id, quantity, status, purchased_at FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC LIMIT 30').bind(id).all() : { results: [] },
      billing ? db.prepare('SELECT super_spikes, profile_lifts, weekly_lift_available, version FROM entitlement_wallets WHERE user_id = ? LIMIT 1').bind(id).first() : null,
      billing ? db.prepare('SELECT id, kind, delta, reason, created_at FROM entitlement_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').bind(id).all() : { results: [] },
    ]);
    await db.prepare('INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(identifier('aud'), admin.user.id, 'admin.user.view', 'user', id, Date.now()).run();
    return json({ user, permissions: { safety, billing }, profileDetails, interests: interests.results, prompts: prompts.results,
      discovery, today, photos: photos.results, verification: verification.results,
      photoMatches: photoMatches.results, connections: connections.results, blocksMade: blocksMade.results,
      blocksReceived: blocksReceived.results, reportsMade: reportsMade.results, reportsReceived: reportsReceived.results,
      subscriptions: subscriptions.results, purchases: purchases.results, wallet, ledger: ledger.results,
      captureRetained: false });
  });
}
