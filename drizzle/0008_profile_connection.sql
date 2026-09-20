CREATE TABLE `profile_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`relationship_style` text DEFAULT '' NOT NULL,
	`dating_pace` text DEFAULT '' NOT NULL,
	`communication_preference` text DEFAULT '' NOT NULL,
	`values_json` text DEFAULT '[]' NOT NULL,
	`rhythm_json` text DEFAULT '[]' NOT NULL,
	`languages_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
