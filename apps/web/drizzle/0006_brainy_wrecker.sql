ALTER TABLE `tasks` ADD `expect_at` timestamp;--> statement-breakpoint
-- 先前 AI 把「打算做的时间」写进了 due_at，现在 due_at 重新定义为真正 deadline。
-- 把历史 due_at 值挪到 expect_at，再把 due_at 清空让 AI 重新填真 deadline。
UPDATE `tasks` SET `expect_at` = `due_at` WHERE `due_at` IS NOT NULL;--> statement-breakpoint
UPDATE `tasks` SET `due_at` = NULL;
