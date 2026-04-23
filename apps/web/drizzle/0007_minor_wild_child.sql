CREATE TABLE `utterances` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`raw_text` text NOT NULL,
	`intent` varchar(16) NOT NULL,
	`effect_kind` varchar(24) NOT NULL,
	`verb` varchar(32),
	`reason` text,
	`task_id` varchar(36),
	`audio_key` varchar(512),
	`dims` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `utterances_id` PRIMARY KEY(`id`)
);
