-- Publicación: DOI y galeradas PDF/HTML de cada envío.
DROP PROCEDURE IF EXISTS `add_publication_metadata_to_submissions`;
DELIMITER //
CREATE PROCEDURE `add_publication_metadata_to_submissions`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'doi'
  ) THEN
    ALTER TABLE `submissions` ADD COLUMN `doi` varchar(255) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'pdf_galley_url'
  ) THEN
    ALTER TABLE `submissions` ADD COLUMN `pdf_galley_url` varchar(2048) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'submissions'
      AND COLUMN_NAME = 'html_galley_url'
  ) THEN
    ALTER TABLE `submissions` ADD COLUMN `html_galley_url` varchar(2048) DEFAULT NULL;
  END IF;
END //
DELIMITER ;
CALL `add_publication_metadata_to_submissions`();
DROP PROCEDURE `add_publication_metadata_to_submissions`;
