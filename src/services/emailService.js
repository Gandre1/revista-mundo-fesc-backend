const nodemailer = require('nodemailer');
const db = require('../config/db');

const defaultTemplates = [
  {
    templateKey: 'submission_accepted',
    name: 'Envío aceptado',
    subject: 'Artículo aceptado: {{titulo_articulo}}',
    bodyHtml: '<p>Hola {{nombre_autor}},</p><p>Nos complace informarte que el artículo <strong>{{titulo_articulo}}</strong> fue aceptado.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    variables: ['nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id'],
  },
  {
    templateKey: 'submission_rejected',
    name: 'Envío rechazado',
    subject: 'Decisión editorial sobre {{titulo_articulo}}',
    bodyHtml: '<p>Hola {{nombre_autor}},</p><p>El artículo <strong>{{titulo_articulo}}</strong> no fue aceptado para publicación.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    variables: ['nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id'],
  },
  {
    templateKey: 'submission_changes_requested',
    name: 'Cambios solicitados',
    subject: 'Cambios solicitados para {{titulo_articulo}}',
    bodyHtml: '<p>Hola {{nombre_autor}},</p><p>Se solicitaron cambios para el artículo <strong>{{titulo_articulo}}</strong>.</p><p>Estado: {{estado}}</p><p>{{comentarios_editor}}</p>',
    variables: ['nombre_autor', 'titulo_articulo', 'estado', 'comentarios_editor', 'rol', 'submission_id'],
  },
  {
    templateKey: 'reviewer_assigned',
    name: 'Asignación de evaluación',
    subject: 'Nueva evaluación asignada: {{titulo_articulo}}',
    bodyHtml: '<p>Hola {{nombre_revisor}},</p><p>Has sido asignado para evaluar el artículo <strong>{{titulo_articulo}}</strong>, enviado por {{nombre_autor}}.</p><p>Fecha límite: {{fecha_limite}}</p><p>Rol: {{rol}}</p>',
    variables: ['nombre_revisor', 'nombre_autor', 'titulo_articulo', 'fecha_limite', 'rol'],
  },
];

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderTemplate = (content, variables, escapeValues = false) => content.replace(
  /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g,
  (placeholder, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      throw new Error(`La plantilla de correo requiere la variable "${key}" y no fue proporcionada.`);
    }
    const value = variables[key] ?? '';
    return escapeValues ? escapeHtml(value) : String(value);
  }
);

const createTransport = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_FROM) {
    throw new Error('El correo requiere configurar SMTP_HOST y SMTP_FROM.');
  }
  if (Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) {
    throw new Error('SMTP_USER y SMTP_PASS deben configurarse juntos.');
  }

  const port = SMTP_PORT ? Number(SMTP_PORT) : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT debe ser un puerto válido entre 1 y 65535.');
  }

  return {
    from: SMTP_FROM,
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: SMTP_SECURE === 'true',
      ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
    }),
  };
};

exports.renderTemplate = renderTemplate;

exports.ensureDefaultTemplates = async () => {
  const placeholders = defaultTemplates.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = defaultTemplates.flatMap((template) => [
    template.templateKey,
    template.name,
    template.subject,
    template.bodyHtml,
    JSON.stringify(template.variables),
  ]);
  await db.query(
    `INSERT IGNORE INTO email_templates
       (template_key, name, subject, body_html, variables_disponibles)
     VALUES ${placeholders}`,
    values
  );
};

exports.sendTemplateEmail = async (templateKey, recipient, variables = {}) => {
  if (typeof recipient !== 'string' || !recipient.trim()) {
    throw new Error(`No se puede enviar la plantilla "${templateKey}" sin un destinatario válido.`);
  }

  const [templates] = await db.query(
    `SELECT subject, body_html
     FROM email_templates
     WHERE template_key = ?`,
    [templateKey]
  );
  if (templates.length === 0) {
    throw new Error(`No existe la plantilla de correo "${templateKey}".`);
  }

  const template = templates[0];
  const subject = renderTemplate(template.subject, variables);
  const html = renderTemplate(template.body_html, variables, true);
  const { from, transport } = createTransport();
  return transport.sendMail({ from, to: recipient, subject, html });
};
