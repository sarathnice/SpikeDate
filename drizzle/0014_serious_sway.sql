CREATE TABLE `support_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `support_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_support_messages_thread_created` ON `support_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`status` text DEFAULT 'self_service' NOT NULL,
	`subject` text DEFAULT 'Help conversation' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_support_threads_user_updated` ON `support_threads` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_support_threads_status_updated` ON `support_threads` (`status`,`updated_at`);