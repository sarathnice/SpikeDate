CREATE TABLE `live_presence` (
	`session_id` text NOT NULL,
	`client_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `client_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `presence_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`show_online` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
