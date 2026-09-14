CREATE TABLE `daily_availability` (
	`user_id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`visibility` text DEFAULT 'matches' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_availability_end` ON `daily_availability` (`end_at`);--> statement-breakpoint
CREATE INDEX `idx_daily_availability_date_start` ON `daily_availability` (`local_date`,`start_at`);