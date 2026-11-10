-- Registros locales para revisar los flujos editoriales.
-- Importar despues de schema.sql. Todas las cuentas tienen password NULL y no permiten login.

INSERT IGNORE INTO `email_templates`
  (`template_key`, `name`, `subject`, `body_html`, `variables_disponibles`)
VALUES
  (
    'submission_accepted',
    'Envío aceptado',
    'Artículo aceptado: {{titulo_articulo}}',
    '<p>Hola {{nombre_autor}},</p><p>Nos complace informarte que el artículo <strong>{{titulo_articulo}}</strong> fue aceptado.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    JSON_ARRAY('nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id')
  ),
  (
    'submission_rejected',
    'Envío rechazado',
    'Decisión editorial sobre {{titulo_articulo}}',
    '<p>Hola {{nombre_autor}},</p><p>El artículo <strong>{{titulo_articulo}}</strong> no fue aceptado para publicación.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    JSON_ARRAY('nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id')
  ),
  (
    'submission_changes_requested',
    'Cambios solicitados',
    'Cambios solicitados para {{titulo_articulo}}',
    '<p>Hola {{nombre_autor}},</p><p>Se solicitaron cambios para el artículo <strong>{{titulo_articulo}}</strong>.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    JSON_ARRAY('nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id')
  ),
  (
    'reviewer_assigned',
    'Asignación de evaluación',
    'Nueva evaluación asignada: {{titulo_articulo}}',
    '<p>Hola {{nombre_revisor}},</p><p>Has sido asignado para evaluar el artículo <strong>{{titulo_articulo}}</strong>, enviado por {{nombre_autor}}.</p><p>Fecha límite: {{fecha_limite}}</p><p>Rol: {{rol}}</p>',
    JSON_ARRAY('nombre_revisor', 'nombre_autor', 'titulo_articulo', 'fecha_limite', 'rol')
  );

INSERT INTO `users` (`id`, `nombre`, `apellidos`, `email`, `password`, `role`, `afiliacion`, `pais`)
VALUES
  ('7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad', 'María', 'García Rodríguez', 'maria.garcia@prueba.com', NULL, 'author', 'Universidad Nacional de Colombia', 'Colombia'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Laura', 'Jiménez Pérez', 'laura.jimenez@prueba.com', NULL, 'editor', 'Universidad FESC', 'Colombia'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Carlos', 'Martínez López', 'carlos.martinez@prueba.com', NULL, 'reviewer', 'Universidad de los Andes', 'Colombia'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Andrés', 'Ramírez Torres', 'andres.ramirez@prueba.com', NULL, 'admin', 'Universidad FESC', 'Colombia')
ON DUPLICATE KEY UPDATE
  `nombre` = VALUES(`nombre`),
  `apellidos` = VALUES(`apellidos`),
  `email` = VALUES(`email`),
  `password` = NULL,
  `role` = VALUES(`role`),
  `afiliacion` = VALUES(`afiliacion`),
  `pais` = VALUES(`pais`);

INSERT INTO `submissions` (`id`, `titulo`, `resumen`, `palabras_clave`, `seccion`, `idioma`, `estado`, `borrador`, `paso_wizard`, `autor_id`, `editor_id`, `fecha_envio`)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Impacto de la inteligencia artificial en la educación superior colombiana', 'Análisis de la integración de herramientas de inteligencia artificial en los procesos de enseñanza y aprendizaje de instituciones de educación superior en Colombia.', 'inteligencia artificial, educación superior, innovación pedagógica', 'Artículos de Investigación', 'es', 'enviado', 0, 5, '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP()),
  ('10000000-0000-4000-8000-000000000002', 'Uso de software libre para fortalecer la investigación universitaria', 'Estudio sobre la adopción de herramientas de código abierto y su contribución a la gestión de proyectos de investigación en universidades colombianas.', 'software libre, investigación, universidades', 'Artículos Originales', 'es', 'en_revision', 0, 5, '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CURRENT_TIMESTAMP()),
  ('10000000-0000-4000-8000-000000000003', 'Estrategias de innovación pedagógica en ambientes virtuales', 'Revisión de estrategias didácticas aplicadas en cursos universitarios virtuales y su relación con la participación estudiantil.', 'innovación pedagógica, educación virtual, aprendizaje', 'Investigación', 'es', 'Nuevo', 1, 2, '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad', NULL, NULL)
ON DUPLICATE KEY UPDATE
  `titulo` = VALUES(`titulo`),
  `resumen` = VALUES(`resumen`),
  `palabras_clave` = VALUES(`palabras_clave`),
  `seccion` = VALUES(`seccion`),
  `idioma` = VALUES(`idioma`),
  `estado` = VALUES(`estado`),
  `borrador` = VALUES(`borrador`),
  `paso_wizard` = VALUES(`paso_wizard`),
  `autor_id` = VALUES(`autor_id`),
  `editor_id` = VALUES(`editor_id`),
  `fecha_envio` = VALUES(`fecha_envio`);

INSERT INTO `authors` (`submission_id`, `nombre`, `apellidos`, `email`, `afiliacion`, `pais`, `es_corresponsal`, `orden`)
SELECT '10000000-0000-4000-8000-000000000001', 'Daniela', 'Pérez Gómez', 'daniela.perez@prueba.com', 'Universidad Nacional de Colombia', 'Colombia', 0, 2
WHERE NOT EXISTS (
  SELECT 1 FROM `authors`
  WHERE `submission_id` = '10000000-0000-4000-8000-000000000001'
    AND `email` = 'daniela.perez@prueba.com'
);

INSERT INTO `authors` (`submission_id`, `nombre`, `apellidos`, `email`, `afiliacion`, `pais`, `es_corresponsal`, `orden`)
SELECT '10000000-0000-4000-8000-000000000002', 'Santiago', 'Mendoza Ruiz', 'santiago.mendoza@prueba.com', 'Universidad de los Andes', 'Colombia', 1, 2
WHERE NOT EXISTS (
  SELECT 1 FROM `authors`
  WHERE `submission_id` = '10000000-0000-4000-8000-000000000002'
    AND `email` = 'santiago.mendoza@prueba.com'
);

INSERT INTO `submission_reviews` (`submission_id`, `reviewer_id`, `fecha_limite`, `estado`)
VALUES ('10000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', DATE_ADD(CURRENT_DATE(), INTERVAL 14 DAY), 'asignado')
ON DUPLICATE KEY UPDATE
  `fecha_limite` = VALUES(`fecha_limite`),
  `estado` = VALUES(`estado`);
