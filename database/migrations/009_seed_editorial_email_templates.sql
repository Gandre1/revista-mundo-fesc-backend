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
