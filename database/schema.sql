-- Esquema local de desarrollo para MariaDB/MySQL.
-- ATENCION: este archivo elimina y vuelve a crear todas las tablas de la base seleccionada.
-- No ejecutarlo en produccion ni sobre una base con datos que se quieran conservar.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `help_contents`;
DROP TABLE IF EXISTS `email_templates`;
DROP TABLE IF EXISTS `reviewer_review_history`;
DROP TABLE IF EXISTS `submission_reviews`;
DROP TABLE IF EXISTS `submission_audit_logs`;
DROP TABLE IF EXISTS `submission_files`;
DROP TABLE IF EXISTS `article_metrics`;
DROP TABLE IF EXISTS `authors`;
DROP TABLE IF EXISTS `submissions`;
DROP TABLE IF EXISTS `issues`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellidos` varchar(100) DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'author',
  `afiliacion` varchar(200) DEFAULT NULL,
  `pais` varchar(100) DEFAULT NULL,
  `orcid` varchar(50) DEFAULT NULL,
  `notificaciones` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `issues` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `volume` int(11) NOT NULL,
  `number` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `cover_url` varchar(2048) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `issues_volume_number_year_unique` (`volume`, `number`, `year`),
  CONSTRAINT `issues_status_check` CHECK (`status` IN ('draft', 'scheduled', 'published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submissions` (
  `id` varchar(36) NOT NULL,
  `titulo` text NOT NULL,
  `resumen` text DEFAULT NULL,
  `palabras_clave` text DEFAULT NULL,
  `seccion` varchar(100) DEFAULT NULL,
  `idioma` varchar(10) DEFAULT 'es',
  `estado` varchar(30) DEFAULT 'Nuevo',
  `borrador` tinyint(1) DEFAULT 1,
  `paso_wizard` int(11) DEFAULT 1,
  `referencias` text DEFAULT NULL,
  `comentarios_editor` text DEFAULT NULL,
  `doi` varchar(255) DEFAULT NULL,
  `pdf_galley_url` varchar(2048) DEFAULT NULL,
  `html_galley_url` varchar(2048) DEFAULT NULL,
  `autor_id` varchar(36) NOT NULL,
  `editor_id` varchar(36) DEFAULT NULL,
  `issue_id` bigint(20) unsigned DEFAULT NULL,
  `fecha_envio` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `autor_id` (`autor_id`),
  KEY `editor_id` (`editor_id`),
  KEY `issue_id` (`issue_id`),
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`autor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`editor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `submissions_issue_fk` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `article_metrics` (
  `submission_id` varchar(36) NOT NULL,
  `views` bigint(20) unsigned NOT NULL DEFAULT 0,
  `downloads` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`submission_id`),
  CONSTRAINT `article_metrics_submission_fk`
    FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) NOT NULL,
  `submission_id` varchar(36) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `notifications_user_created_idx` (`user_id`, `created_at`),
  KEY `notifications_submission_idx` (`submission_id`),
  CONSTRAINT `notifications_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` varchar(36) NOT NULL,
  `recipient_id` varchar(36) NOT NULL,
  `submission_id` varchar(36) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `body` longtext NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `sender_deleted_at` timestamp NULL DEFAULT NULL,
  `recipient_deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `messages_sender_created_idx` (`sender_id`, `created_at`),
  KEY `messages_recipient_created_idx` (`recipient_id`, `created_at`),
  KEY `messages_submission_created_idx` (`submission_id`, `created_at`),
  CONSTRAINT `messages_sender_fk` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_recipient_fk` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `target_model` varchar(100) NOT NULL,
  `target_id` varchar(100) DEFAULT NULL,
  `details` JSON NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_created_idx` (`user_id`, `created_at`),
  KEY `audit_logs_target_idx` (`target_model`, `target_id`),
  CONSTRAINT `audit_logs_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `email_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `template_key` varchar(100) NOT NULL,
  `name` varchar(150) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` longtext NOT NULL,
  `variables_disponibles` JSON NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_templates_key_unique` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `help_contents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(180) NOT NULL,
  `category` varchar(100) NOT NULL,
  `content_type` varchar(20) NOT NULL,
  `audience` varchar(20) NOT NULL DEFAULT 'general',
  `content` longtext NOT NULL,
  `display_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `help_contents_slug_unique` (`slug`),
  KEY `help_contents_public_list_idx` (`is_active`, `display_order`, `id`),
  KEY `help_contents_type_audience_idx` (`content_type`, `audience`),
  CONSTRAINT `help_contents_type_check` CHECK (`content_type` IN ('faq', 'guide', 'policy')),
  CONSTRAINT `help_contents_audience_check` CHECK (`audience` IN ('general', 'author', 'reviewer', 'editor')),
  CONSTRAINT `help_contents_order_check` CHECK (`display_order` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `authors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellidos` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `afiliacion` varchar(200) DEFAULT NULL,
  `pais` varchar(100) DEFAULT NULL,
  `orcid` varchar(255) DEFAULT NULL,
  `es_corresponsal` tinyint(1) DEFAULT 0,
  `orden` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `authors_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `ruta_almacenamiento` varchar(255) NOT NULL,
  `tamano` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL,
  `fecha_subida` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `submission_files_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_reviews` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` varchar(36) NOT NULL,
  `reviewer_id` varchar(36) NOT NULL,
  `fecha_limite` date NOT NULL,
  `estado` varchar(30) NOT NULL DEFAULT 'asignado',
  `recomendacion` varchar(40) DEFAULT NULL,
  `comentarios_autor` text DEFAULT NULL,
  `comentarios_editor` JSON DEFAULT NULL,
  `fecha_dictamen` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `submission_reviewer_unique` (`submission_id`, `reviewer_id`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `submission_reviews_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submission_reviews_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  CONSTRAINT `reviewer_review_history_submission_fk` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviewer_review_history_reviewer_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `submission_audit_logs` (
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

-- Cuenta local de prueba para relacionar los envíos del perfil de autor.
INSERT INTO `users` (`id`, `nombre`, `apellidos`, `email`, `password`, `role`) VALUES
('7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad', 'María', 'García Rodríguez', 'gexonrodriguez1822@gmail.com', '$2b$10$nRS5fvcJ3Wc0wO2bA8J1IOfLHenCBiW8IUq03zfcdeg1eBMYl/Uze', 'author');
