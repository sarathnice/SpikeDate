CREATE TABLE `phone_verification_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_number` text NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`ip_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phone_challenges_phone_created` ON `phone_verification_challenges` (`phone_number`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_phone_challenges_ip_created` ON `phone_verification_challenges` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_phone_challenges_status_expires` ON `phone_verification_challenges` (`status`,`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`gender` text NOT NULL,
	`pronouns` text,
	`bio` text DEFAULT '' NOT NULL,
	`occupation` text,
	`education` text,
	`height_cm` integer,
	`ethnicity` text,
	`relationship_goal` text NOT NULL,
	`kids` text,
	`wants_kids` text,
	`drinking` text,
	`smoking` text,
	`pets` text,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`city` text,
	`country` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`discoverable` integer DEFAULT false NOT NULL,
	`discoverable_requested` integer DEFAULT true NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("user_id", "display_name", "gender", "pronouns", "bio", "occupation", "education", "height_cm", "ethnicity", "relationship_goal", "kids", "wants_kids", "drinking", "smoking", "pets", "latitude_e6", "longitude_e6", "city", "country", "verification_status", "discoverable", "discoverable_requested", "completed_at", "created_at", "updated_at") SELECT "user_id", "display_name", "gender", "pronouns", "bio", "occupation", "education", "height_cm", "ethnicity", "relationship_goal", "kids", "wants_kids", "drinking", "smoking", "pets", "latitude_e6", "longitude_e6", "city", "country", "verification_status", "discoverable", "discoverable", "completed_at", "created_at", "updated_at" FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_profiles_discoverable_city` ON `profiles` (`discoverable`,`city`);--> statement-breakpoint
CREATE INDEX `idx_profiles_goal` ON `profiles` (`relationship_goal`);--> statement-breakpoint
ALTER TABLE `users` ADD `phone_number` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_verified_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_phone_number` ON `users` (`phone_number`);
