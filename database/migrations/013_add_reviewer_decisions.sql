ALTER TABLE `submission_reviews`
  ADD COLUMN `recomendacion` varchar(40) DEFAULT NULL AFTER `estado`,
  ADD COLUMN `comentarios_autor` text DEFAULT NULL AFTER `recomendacion`,
  ADD COLUMN `comentarios_editor` JSON DEFAULT NULL AFTER `comentarios_autor`,
  ADD COLUMN `fecha_dictamen` timestamp NULL DEFAULT NULL AFTER `comentarios_editor`;
