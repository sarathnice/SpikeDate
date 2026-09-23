import type { D1DatabaseLike } from '@/lib/server/db';

export type ProfileReadiness = {
  phoneVerified: boolean;
  profileCompleted: boolean;
  photoVerified: boolean;
  approvedPhoto: boolean;
  ready: boolean;
  missing: string[];
};

export async function getProfileReadiness(
  db: D1DatabaseLike,
  userId: string,
): Promise<ProfileReadiness> {
  const row = await db
    .prepare(
      'SELECT users.phone_verified_at, profiles.completed_at, profiles.verification_status, ' +
        "EXISTS(SELECT 1 FROM profile_media WHERE profile_media.user_id = profiles.user_id AND profile_media.type = 'photo' AND profile_media.moderation_status = 'approved') AS approved_photo " +
        'FROM users JOIN profiles ON profiles.user_id = users.id WHERE users.id = ? LIMIT 1',
    )
    .bind(userId)
    .first<{
      phone_verified_at: number | null;
      completed_at: number | null;
      verification_status: string;
      approved_photo: number;
    }>();
  const readiness = {
    phoneVerified: Boolean(row?.phone_verified_at),
    profileCompleted: Boolean(row?.completed_at),
    photoVerified: ['verified', 'photo_verified', 'identity_verified'].includes(
      row?.verification_status ?? '',
    ),
    approvedPhoto: Boolean(row?.approved_photo),
  };
  const missing = [
    ...(!readiness.phoneVerified ? ['phone verification'] : []),
    ...(!readiness.profileCompleted ? ['completed profile'] : []),
    ...(!readiness.photoVerified ? ['photo verification'] : []),
    ...(!readiness.approvedPhoto ? ['approved profile photo'] : []),
  ];
  return { ...readiness, ready: missing.length === 0, missing };
}

export async function reconcileDiscoverability(
  db: D1DatabaseLike,
  userId: string,
) {
  const readiness = await getProfileReadiness(db, userId);
  const profile = await db
    .prepare(
      'SELECT discoverable_requested FROM profiles WHERE user_id = ? LIMIT 1',
    )
    .bind(userId)
    .first<{ discoverable_requested: number }>();
  const discoverable =
    readiness.ready && Boolean(profile?.discoverable_requested);
  await db
    .prepare(
      'UPDATE profiles SET discoverable = ?, updated_at = ? WHERE user_id = ?',
    )
    .bind(discoverable ? 1 : 0, Date.now(), userId)
    .run();
  return { ...readiness, discoverable };
}

export async function invalidatePhotoVerification(
  db: D1DatabaseLike,
  userId: string,
) {
  await db
    .prepare(
      "UPDATE profiles SET verification_status = 'unverified', discoverable = 0, updated_at = ? " +
        "WHERE user_id = ? AND verification_status IN ('verified', 'photo_verified')",
    )
    .bind(Date.now(), userId)
    .run();
}

export async function requireConnectionReady(
  db: D1DatabaseLike,
  userId: string,
) {
  const row = await db
    .prepare(
      'SELECT users.phone_verified_at, profiles.completed_at, profiles.verification_status ' +
        'FROM users JOIN profiles ON profiles.user_id = users.id WHERE users.id = ? LIMIT 1',
    )
    .bind(userId)
    .first<{
      phone_verified_at: number | null;
      completed_at: number | null;
      verification_status: string;
    }>();
  const ready = Boolean(
    row?.phone_verified_at &&
    row.completed_at &&
    ['verified', 'photo_verified', 'identity_verified'].includes(
      row.verification_status,
    ),
  );
  return ready;
}
