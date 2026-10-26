CREATE TABLE IF NOT EXISTS `submission_audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `submission_audit_logs_submission_created_idx` (`submission_id`, `created_at`),
  KEY `submission_audit_logs_user_idx` (`user_id`),
  CONSTRAINT `submission_audit_logs_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submission_audit_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
