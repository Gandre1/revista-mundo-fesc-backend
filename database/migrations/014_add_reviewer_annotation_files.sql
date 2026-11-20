CREATE TABLE `reviewer_review_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `reviewer_id` varchar(36) NOT NULL,
  `fecha_dictamen` timestamp NOT NULL DEFAULT current_timestamp(),
  `recomendacion` varchar(40) NOT NULL,
  `comentarios_autor` text NOT NULL,
  `comentarios_editor` JSON NOT NULL,
  `archivo_nombre` varchar(255) DEFAULT NULL,
  `archivo_ruta` varchar(512) DEFAULT NULL,
  `archivo_tamano` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reviewer_review_history_reviewer_date_idx` (`reviewer_id`, `fecha_dictamen`),
  KEY `reviewer_review_history_submission_idx` (`submission_id`),
  CONSTRAINT `reviewer_review_history_submission_fk`
    FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviewer_review_history_reviewer_fk`
    FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reviewer_review_history` (
  `submission_id`, `reviewer_id`, `fecha_dictamen`, `recomendacion`,
  `comentarios_autor`, `comentarios_editor`
)
SELECT `submission_id`, `reviewer_id`, COALESCE(`fecha_dictamen`, CURRENT_TIMESTAMP),
       `recomendacion`, `comentarios_autor`, `comentarios_editor`
FROM `submission_reviews`
WHERE `estado` = 'completado'
  AND `recomendacion` IS NOT NULL
  AND `comentarios_autor` IS NOT NULL
  AND `comentarios_editor` IS NOT NULL;
