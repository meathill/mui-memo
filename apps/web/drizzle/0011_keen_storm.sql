ALTER TABLE `recurrences` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tags` json;--> statement-breakpoint
UPDATE `tasks` SET `tags` = JSON_ARRAY(`tag`) WHERE `tag` IS NOT NULL AND `tag` <> '' AND `tags` IS NULL;--> statement-breakpoint
UPDATE `recurrences` SET `tags` = JSON_ARRAY(`tag`) WHERE `tag` IS NOT NULL AND `tag` <> '' AND `tags` IS NULL;