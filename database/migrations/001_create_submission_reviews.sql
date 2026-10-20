CREATE TABLE IF NOT EXISTS `submission_reviews` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `reviewer_id` varchar(36) NOT NULL,
  `fecha_limite` date NOT NULL,
  `estado` varchar(30) NOT NULL DEFAULT 'asignado',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `submission_reviewer_unique` (`submission_id`, `reviewer_id`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `submission_reviews_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submission_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
