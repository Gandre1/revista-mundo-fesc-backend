-- Calendario editorial y estado programado de los volúmenes.
DROP PROCEDURE IF EXISTS `add_issue_publishing_schedule`;
DELIMITER //
CREATE PROCEDURE `add_issue_publishing_schedule`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'issues'
      AND COLUMN_NAME = 'published_at'
  ) THEN
    ALTER TABLE `issues`
      ADD COLUMN `published_at` datetime DEFAULT NULL AFTER `status`;
  END IF;

  ALTER TABLE `issues`
    DROP CONSTRAINT IF EXISTS `issues_status_check`;
  ALTER TABLE `issues`
    ADD CONSTRAINT `issues_status_check`
    CHECK (`status` IN ('draft', 'scheduled', 'published'));
END //
DELIMITER ;
CALL `add_issue_publishing_schedule`();
DROP PROCEDURE `add_issue_publishing_schedule`;
