CREATE TABLE `recurrences` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`text` text NOT NULL,
	`place` varchar(10) NOT NULL DEFAULT 'any',
	`task_window` varchar(10) NOT NULL DEFAULT 'today',
	`energy` int NOT NULL DEFAULT 2,
	`priority` int NOT NULL DEFAULT 2,
	`tag` varchar(32),
	`freq` varchar(10) NOT NULL DEFAULT 'weekly',
	`repeat_interval` int NOT NULL DEFAULT 1,
	`anchor_at` timestamp NOT NULL,
	`tz_offset` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_id` varchar(36);--> statement-breakpoint
ALTER TABLE `tasks` ADD `period_index` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `uq_tasks_recurrence_period` UNIQUE(`recurrence_id`,`period_index`);