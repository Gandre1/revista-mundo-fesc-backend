CREATE TABLE IF NOT EXISTS `article_metrics` (
  `submission_id` varchar(36) NOT NULL,
  `views` bigint(20) unsigned NOT NULL DEFAULT 0,
  `downloads` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `article_metrics_submission_fk`
    FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
