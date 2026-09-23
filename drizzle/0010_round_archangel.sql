CREATE TABLE `verification_photo_matches` (
	`request_id` text NOT NULL,
	`media_id` text NOT NULL,
	`similarity_bps` integer,
	`decision` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`request_id`, `media_id`),
	FOREIGN KEY (`request_id`) REFERENCES `verification_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `profile_media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_verification_photo_matches_media` ON `verification_photo_matches` (`media_id`);