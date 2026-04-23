-- 切到 TiDB 原生 hybrid search。
-- TiDB 限制：不能 ALTER TABLE 直接给现有表加 STORED 生成列（错误 3106）。
-- 对策：建一张 tasks_new 带生成列 + fulltext/vector 索引，把行搬过来，再换名字。
-- 生成列 embedding 在 INSERT 时会自动调 EMBED_TEXT 计算。

-- Step 1: 建新表
CREATE TABLE `tasks_new` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `raw_text` text NOT NULL,
  `action_type` varchar(50) DEFAULT NULL,
  `entities` json DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `text` text NOT NULL,
  `place` varchar(10) NOT NULL DEFAULT 'any',
  `task_window` varchar(10) NOT NULL DEFAULT 'today',
  `energy` int NOT NULL DEFAULT '2',
  `priority` int NOT NULL DEFAULT '2',
  `tag` varchar(32) DEFAULT NULL,
  `deadline` varchar(64) DEFAULT NULL,
  `ai_reason` text DEFAULT NULL,
  `linked_to` varchar(36) DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `due_at` timestamp NULL DEFAULT NULL,
  `audio_key` varchar(512) DEFAULT NULL,
  `expect_at` timestamp NULL DEFAULT NULL,
  `embedding` vector(1024)
    GENERATED ALWAYS AS (EMBED_TEXT("tidbcloud_free/amazon/titan-embed-text-v2", `text`)) STORED,
  PRIMARY KEY (`id`),
  FULLTEXT INDEX `idx_fts_text`(`text`) WITH PARSER MULTILINGUAL,
  VECTOR INDEX `idx_vec_embedding`((VEC_COSINE_DISTANCE(`embedding`)))
);--> statement-breakpoint

-- Step 2: 搬数据（不传 embedding，让生成列自动算）
INSERT INTO `tasks_new` (
  `id`, `user_id`, `raw_text`, `action_type`, `entities`, `status`,
  `created_at`, `updated_at`, `text`, `place`, `task_window`, `energy`,
  `priority`, `tag`, `deadline`, `ai_reason`, `linked_to`, `completed_at`,
  `due_at`, `audio_key`, `expect_at`
)
SELECT
  `id`, `user_id`, `raw_text`, `action_type`, `entities`, `status`,
  `created_at`, `updated_at`, `text`, `place`, `task_window`, `energy`,
  `priority`, `tag`, `deadline`, `ai_reason`, `linked_to`, `completed_at`,
  `due_at`, `audio_key`, `expect_at`
FROM `tasks`;--> statement-breakpoint

-- Step 3: 换名
DROP TABLE `tasks`;--> statement-breakpoint
RENAME TABLE `tasks_new` TO `tasks`;
