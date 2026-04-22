ALTER TABLE `tasks` MODIFY COLUMN `status` varchar(20) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `tasks` ADD `text` text NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `place` varchar(10) DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `task_window` varchar(10) DEFAULT 'today' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `energy` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `priority` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tag` varchar(32);--> statement-breakpoint
ALTER TABLE `tasks` ADD `deadline` varchar(64);--> statement-breakpoint
ALTER TABLE `tasks` ADD `ai_reason` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `linked_to` varchar(36);--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` timestamp;