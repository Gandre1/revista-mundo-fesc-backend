-- Portada de cada número de la revista.
DROP PROCEDURE IF EXISTS `add_issue_cover_url`;
DELIMITER //
CREATE PROCEDURE `add_issue_cover_url`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'issues'
      AND COLUMN_NAME = 'cover_url'
  ) THEN
    ALTER TABLE `issues`
      ADD COLUMN `cover_url` varchar(2048) DEFAULT NULL AFTER `description`;
  END IF;
END //
DELIMITER ;
CALL `add_issue_cover_url`();
DROP PROCEDURE `add_issue_cover_url`;
