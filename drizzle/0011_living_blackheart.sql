ALTER TABLE `profiles` ADD `discovery_location_mode` text DEFAULT 'unset' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `discovery_city` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `discovery_location_updated_at` integer;--> statement-breakpoint
-- Only the synthetic QA profiles get test-area coordinates. Real members opt in.
UPDATE `profiles` SET `latitude_e6` = 42360000, `longitude_e6` = -71060000 WHERE `user_id` LIKE 'test-%' AND `city` = 'Boston' AND `latitude_e6` IS NULL AND `discovery_location_mode` = 'unset';--> statement-breakpoint
UPDATE `profiles` SET `latitude_e6` = 42370000, `longitude_e6` = -71110000 WHERE `user_id` LIKE 'test-%' AND `city` = 'Cambridge' AND `latitude_e6` IS NULL AND `discovery_location_mode` = 'unset';
