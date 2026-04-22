CREATE TABLE `attachments` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`r2_key` varchar(512) NOT NULL,
	`mime` varchar(128) NOT NULL,
	`size` int NOT NULL,
	`original_name` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
