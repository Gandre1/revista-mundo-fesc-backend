CREATE TABLE IF NOT EXISTS `issues` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `volume` int(11) NOT NULL,
  `number` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `issues_volume_number_year_unique` (`volume`, `number`, `year`),
  CONSTRAINT `issues_status_check` CHECK (`status` IN ('draft', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS `add_issue_relation_to_submissions`;
DELIMITER //
CREATE PROCEDURE `add_issue_relation_to_submissions`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'issue_id'
  ) THEN
    ALTER TABLE `submissions`
      ADD COLUMN `issue_id` bigint(20) unsigned DEFAULT NULL,
      ADD KEY `submissions_issue_idx` (`issue_id`),
      ADD CONSTRAINT `submissions_issue_fk`
        FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL `add_issue_relation_to_submissions`();
DROP PROCEDURE `add_issue_relation_to_submissions`;
