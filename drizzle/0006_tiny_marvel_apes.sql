CREATE TABLE `game_answers` (
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`round` integer NOT NULL,
	`answer` text NOT NULL,
	`guess` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `user_id`, `round`),
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`inviter_id` text NOT NULL,
	`invitee_id` text NOT NULL,
	`game_json` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_active_game` ON `game_sessions` (`conversation_id`) WHERE "game_sessions"."status" IN ('waiting','active');--> statement-breakpoint
CREATE INDEX `idx_game_conversation` ON `game_sessions` (`conversation_id`,`created_at`);