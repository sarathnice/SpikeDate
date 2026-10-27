CREATE TABLE `environment_banners` (
	`environment` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`version` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`change_id` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
