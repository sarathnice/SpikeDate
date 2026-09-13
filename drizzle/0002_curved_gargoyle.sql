ALTER TABLE `interactions` ADD `idempotency_key` text;--> statement-breakpoint
UPDATE `interactions` SET `idempotency_key` = `id` WHERE `idempotency_key` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_interactions_actor_idempotency` ON `interactions` (`actor_id`,`idempotency_key`);
