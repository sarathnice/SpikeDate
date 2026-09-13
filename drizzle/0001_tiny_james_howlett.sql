CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`processed_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_billing_events_provider_event` ON `billing_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_events_status` ON `billing_events` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `device_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_device_tokens_token` ON `device_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_device_tokens_user_active` ON `device_tokens` (`user_id`,`active`);--> statement-breakpoint
CREATE TABLE `moderation_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`safety_action_id` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`safety_action_id`) REFERENCES `safety_actions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_moderation_appeals_status` ON `moderation_appeals` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_moderation_appeals_user` ON `moderation_appeals` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`new_likes` integer DEFAULT true NOT NULL,
	`new_matches` integer DEFAULT true NOT NULL,
	`messages` integer DEFAULT true NOT NULL,
	`plan_updates` integer DEFAULT true NOT NULL,
	`activity_briefing` integer DEFAULT false NOT NULL,
	`quiet_hours_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
