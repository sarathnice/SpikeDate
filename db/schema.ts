import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
};

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    phoneNumber: text('phone_number'),
    phoneVerifiedAt: integer('phone_verified_at', { mode: 'timestamp_ms' }),
    passwordHash: text('password_hash'),
    status: text('status', {
      enum: ['pending', 'active', 'paused', 'suspended', 'deleted'],
    })
      .notNull()
      .default('pending'),
    birthDate: text('birth_date').notNull(),
    termsVersion: text('terms_version').notNull(),
    termsAcceptedAt: integer('terms_accepted_at', {
      mode: 'timestamp_ms',
    }).notNull(),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_users_email').on(table.email),
    uniqueIndex('idx_users_phone_number').on(table.phoneNumber),
    index('idx_users_status_last_active').on(table.status, table.lastActiveAt),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_sessions_token_hash').on(table.tokenHash),
    index('idx_sessions_user_expires').on(table.userId, table.expiresAt),
  ],
);

export const presencePreferences = sqliteTable('presence_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  showOnline: integer('show_online', { mode: 'boolean' })
    .notNull()
    .default(true),
});

export const livePresence = sqliteTable(
  'live_presence',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.clientId] })],
);

export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    gender: text('gender').notNull(),
    pronouns: text('pronouns'),
    bio: text('bio').notNull().default(''),
    occupation: text('occupation'),
    education: text('education'),
    heightCm: integer('height_cm'),
    ethnicity: text('ethnicity'),
    relationshipGoal: text('relationship_goal').notNull(),
    kids: text('kids'),
    wantsKids: text('wants_kids'),
    drinking: text('drinking'),
    smoking: text('smoking'),
    pets: text('pets'),
    latitudeE6: integer('latitude_e6'),
    longitudeE6: integer('longitude_e6'),
    city: text('city'),
    country: text('country'),
    verificationStatus: text('verification_status')
      .notNull()
      .default('unverified'),
    discoverable: integer('discoverable', { mode: 'boolean' })
      .notNull()
      .default(false),
    discoverableRequested: integer('discoverable_requested', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_profiles_discoverable_city').on(table.discoverable, table.city),
    index('idx_profiles_goal').on(table.relationshipGoal),
  ],
);

export const profileConnections = sqliteTable('profile_connections', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  relationshipStyle: text('relationship_style').notNull().default(''),
  datingPace: text('dating_pace').notNull().default(''),
  communicationPreference: text('communication_preference')
    .notNull()
    .default(''),
  valuesJson: text('values_json').notNull().default('[]'),
  rhythmJson: text('rhythm_json').notNull().default('[]'),
  languagesJson: text('languages_json').notNull().default('[]'),
  ...timestamps,
});

export const phoneVerificationChallenges = sqliteTable(
  'phone_verification_challenges',
  {
    id: text('id').primaryKey(),
    phoneNumber: text('phone_number').notNull(),
    provider: text('provider', { enum: ['mock', 'firebase'] }).notNull(),
    providerRef: text('provider_ref').notNull(),
    status: text('status', {
      enum: ['pending', 'verified', 'consumed', 'expired', 'blocked'],
    })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    ipHash: text('ip_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_phone_challenges_phone_created').on(
      table.phoneNumber,
      table.createdAt,
    ),
    index('idx_phone_challenges_ip_created').on(table.ipHash, table.createdAt),
    index('idx_phone_challenges_status_expires').on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export const profileMedia = sqliteTable(
  'profile_media',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalObjectKey: text('original_object_key'),
    cardObjectKey: text('card_object_key'),
    avatarObjectKey: text('avatar_object_key'),
    type: text('type', { enum: ['photo', 'video'] }).notNull(),
    position: integer('position').notNull(),
    width: integer('width'),
    height: integer('height'),
    sourceWidth: integer('source_width'),
    sourceHeight: integer('source_height'),
    focalX: integer('focal_x'),
    focalY: integer('focal_y'),
    cropZoom: integer('crop_zoom'),
    moderationStatus: text('moderation_status').notNull().default('pending'),
    blurHash: text('blur_hash'),
    explicit: integer('explicit', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_profile_media_user_position').on(
      table.userId,
      table.position,
    ),
    index('idx_profile_media_moderation').on(table.moderationStatus),
  ],
);

export const preferences = sqliteTable('preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  gendersJson: text('genders_json').notNull(),
  minAge: integer('min_age').notNull(),
  maxAge: integer('max_age').notNull(),
  maxDistanceKm: integer('max_distance_km').notNull(),
  relationshipGoalsJson: text('relationship_goals_json').notNull(),
  dealbreakersJson: text('dealbreakers_json').notNull().default('[]'),
  ...timestamps,
});

export const interests = sqliteTable('interests', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  category: text('category').notNull(),
});

export const userInterests = sqliteTable(
  'user_interests',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    interestId: text('interest_id')
      .notNull()
      .references(() => interests.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.interestId] }),
    index('idx_user_interests_interest').on(table.interestId),
  ],
);

export const profilePrompts = sqliteTable(
  'profile_prompts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    answer: text('answer').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [
    index('idx_profile_prompts_user').on(table.userId, table.position),
  ],
);

export const dailyUpdates = sqliteTable(
  'daily_updates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    visibility: text('visibility', {
      enum: ['discover', 'liked', 'matches'],
    })
      .notNull()
      .default('discover'),
    availableTonight: integer('available_tonight', { mode: 'boolean' })
      .notNull()
      .default(false),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_daily_updates_user_active').on(
      table.userId,
      table.expiresAt,
      table.deletedAt,
    ),
  ],
);

export const dailyAvailability = sqliteTable(
  'daily_availability',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
    endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
    timezone: text('timezone').notNull(),
    visibility: text('visibility', { enum: ['matches'] })
      .notNull()
      .default('matches'),
    ...timestamps,
  },
  (table) => [
    index('idx_daily_availability_end').on(table.endAt),
    index('idx_daily_availability_date_start').on(
      table.localDate,
      table.startAt,
    ),
  ],
);

export const interactions = sqliteTable(
  'interactions',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetId: text('target_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['like', 'super_spike', 'pass', 'save', 'rewind'],
    }).notNull(),
    note: text('note'),
    targetType: text('target_type', {
      enum: ['profile', 'photo', 'prompt', 'daily_update'],
    })
      .notNull()
      .default('profile'),
    targetRef: text('target_ref'),
    idempotencyKey: text('idempotency_key').notNull(),
    undoneAt: integer('undone_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_interactions_actor_created').on(table.actorId, table.createdAt),
    index('idx_interactions_target_kind').on(table.targetId, table.kind),
    uniqueIndex('idx_interactions_actor_idempotency').on(
      table.actorId,
      table.idempotencyKey,
    ),
  ],
);

export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    userAId: text('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: text('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['active', 'unmatched', 'blocked'],
    })
      .notNull()
      .default('active'),
    matchedAt: integer('matched_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_matches_pair').on(table.userAId, table.userBId),
    index('idx_matches_user_b_status').on(table.userBId, table.status),
  ],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_conversations_match').on(table.matchId)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    clientId: text('client_id').notNull(),
    deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_messages_sender_client').on(
      table.senderId,
      table.clientId,
    ),
    index('idx_messages_conversation_created').on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const messageMedia = sqliteTable(
  'message_media',
  {
    messageId: text('message_id')
      .primaryKey()
      .references(() => messages.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    kind: text('kind', { enum: ['photo', 'voice'] }).notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationMs: integer('duration_ms'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_message_media_kind').on(table.kind)],
);

export const safetyActions = sqliteTable(
  'safety_actions',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['block', 'report', 'unmatch'] }).notNull(),
    reason: text('reason'),
    details: text('details'),
    status: text('status').notNull().default('open'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_safety_actions_subject_status').on(
      table.subjectId,
      table.status,
    ),
    index('idx_safety_actions_reporter').on(table.reporterId, table.createdAt),
  ],
);

export const verificationRequests = sqliteTable(
  'verification_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    status: text('status').notNull().default('pending'),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_verification_status').on(table.status, table.submittedAt),
  ],
);

export const verificationPhotoMatches = sqliteTable(
  'verification_photo_matches',
  {
    requestId: text('request_id')
      .notNull()
      .references(() => verificationRequests.id, { onDelete: 'cascade' }),
    mediaId: text('media_id')
      .notNull()
      .references(() => profileMedia.id, { onDelete: 'cascade' }),
    similarityBps: integer('similarity_bps'),
    decision: text('decision', {
      enum: ['matched', 'mismatched', 'not_comparable'],
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.requestId, table.mediaId] }),
    index('idx_verification_photo_matches_media').on(table.mediaId),
  ],
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', {
      enum: ['mock', 'apple', 'google'],
    }).notNull(),
    providerSubscriptionId: text('provider_subscription_id').notNull(),
    plan: text('plan', {
      enum: ['weekly', 'monthly', 'annual'],
    }).notNull(),
    status: text('status').notNull(),
    currentPeriodEndsAt: integer('current_period_ends_at', {
      mode: 'timestamp_ms',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_subscriptions_provider_id').on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index('idx_subscriptions_user_status').on(table.userId, table.status),
  ],
);

export const purchases = sqliteTable(
  'purchases',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['mock', 'apple', 'google'] }).notNull(),
    providerTransactionId: text('provider_transaction_id').notNull(),
    productId: text('product_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    status: text('status').notNull(),
    purchasedAt: integer('purchased_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_purchases_provider_transaction').on(
      table.provider,
      table.providerTransactionId,
    ),
    index('idx_purchases_user').on(table.userId, table.purchasedAt),
  ],
);

export const entitlementWallets = sqliteTable('entitlement_wallets', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  superSpikes: integer('super_spikes').notNull().default(0),
  profileLifts: integer('profile_lifts').notNull().default(0),
  weeklyLiftAvailable: integer('weekly_lift_available', { mode: 'boolean' })
    .notNull()
    .default(false),
  version: integer('version').notNull().default(0),
  ...timestamps,
});

export const entitlementLedger = sqliteTable(
  'entitlement_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['super_spike', 'profile_lift', 'weekly_lift'],
    }).notNull(),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_entitlement_ledger_idempotency').on(table.idempotencyKey),
    index('idx_entitlement_ledger_user_created').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const profileLiftActivations = sqliteTable(
  'profile_lift_activations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['purchased', 'weekly'] }).notNull(),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    endsAt: integer('ends_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (table) => [index('idx_profile_lifts_active').on(table.userId, table.endsAt)],
);

export const galaxyPlans = sqliteTable(
  'galaxy_plans',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    activity: text('activity').notNull(),
    venueName: text('venue_name').notNull(),
    venueAddress: text('venue_address').notNull(),
    latitudeE6: integer('latitude_e6'),
    longitudeE6: integer('longitude_e6'),
    startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', {
      enum: ['draft', 'sent', 'accepted', 'declined', 'cancelled', 'completed'],
    })
      .notNull()
      .default('draft'),
    ...timestamps,
  },
  (table) => [
    index('idx_galaxy_plans_creator_start').on(table.creatorId, table.startsAt),
  ],
);

export const galaxyPlanInvites = sqliteTable(
  'galaxy_plan_invites',
  {
    planId: text('plan_id')
      .notNull()
      .references(() => galaxyPlans.id, { onDelete: 'cascade' }),
    inviteeId: text('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['pending', 'accepted', 'declined', 'alternate'],
    })
      .notNull()
      .default('pending'),
    respondedAt: integer('responded_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.inviteeId] }),
    index('idx_galaxy_invites_invitee_status').on(
      table.inviteeId,
      table.status,
    ),
  ],
);

export const safetyCheckIns = sqliteTable(
  'safety_check_ins',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => galaxyPlans.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trustedContact: text('trusted_contact').notNull(),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    escalatedAt: integer('escalated_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_safety_checkins_due').on(table.scheduledAt, table.completedAt),
  ],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    dataJson: text('data_json').notNull().default('{}'),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_notifications_user_unread').on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const deviceTokens = sqliteTable(
  'device_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform', { enum: ['ios', 'android', 'web'] }).notNull(),
    token: text('token').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_device_tokens_token').on(table.token),
    index('idx_device_tokens_user_active').on(table.userId, table.active),
  ],
);

export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  newLikes: integer('new_likes', { mode: 'boolean' }).notNull().default(true),
  newMatches: integer('new_matches', { mode: 'boolean' })
    .notNull()
    .default(true),
  messages: integer('messages', { mode: 'boolean' }).notNull().default(true),
  planUpdates: integer('plan_updates', { mode: 'boolean' })
    .notNull()
    .default(true),
  activityBriefing: integer('activity_briefing', { mode: 'boolean' })
    .notNull()
    .default(false),
  quietHoursJson: text('quiet_hours_json').notNull().default('{}'),
  ...timestamps,
});

export const billingEvents = sqliteTable(
  'billing_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider', { enum: ['apple', 'google'] }).notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadHash: text('payload_hash').notNull(),
    status: text('status').notNull().default('received'),
    processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
    error: text('error'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_billing_events_provider_event').on(
      table.provider,
      table.providerEventId,
    ),
    index('idx_billing_events_status').on(table.status, table.createdAt),
  ],
);

export const moderationAppeals = sqliteTable(
  'moderation_appeals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    safetyActionId: text('safety_action_id')
      .notNull()
      .references(() => safetyActions.id, { onDelete: 'cascade' }),
    statement: text('statement').notNull(),
    status: text('status').notNull().default('open'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_moderation_appeals_status').on(table.status, table.createdAt),
    index('idx_moderation_appeals_user').on(table.userId, table.createdAt),
  ],
);

export const featureFlags = sqliteTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  rolloutPercent: integer('rollout_percent').notNull().default(0),
  configJson: text('config_json').notNull().default('{}'),
  updatedBy: text('updated_by').notNull(),
  ...timestamps,
});

export const adminUsers = sqliteTable(
  'admin_users',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: [
        'super_admin',
        'safety_reviewer',
        'moderator',
        'support_agent',
        'billing_analyst',
        'read_only_analyst',
      ],
    }).notNull(),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    ipHash: text('ip_hash'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_actor_created').on(table.actorId, table.createdAt),
  ],
);

export const dataRequests = sqliteTable(
  'data_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['export', 'delete'] }).notNull(),
    status: text('status').notNull().default('requested'),
    objectKey: text('object_key'),
    dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (table) => [
    index('idx_data_requests_status_due').on(table.status, table.dueAt),
  ],
);

export const gameSessions = sqliteTable(
  'game_sessions',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: text('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameJson: text('game_json').notNull(),
    status: text('status').notNull().default('waiting'),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_one_active_game')
      .on(table.conversationId)
      .where(sql`${table.status} IN ('waiting','active')`),
    index('idx_game_conversation').on(table.conversationId, table.createdAt),
  ],
);

export const gameAnswers = sqliteTable(
  'game_answers',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    answer: text('answer').notNull(),
    guess: text('guess'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userId, table.round] }),
  ],
);
