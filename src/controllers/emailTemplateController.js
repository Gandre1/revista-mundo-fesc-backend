const db = require('../config/db');

const templateKeyPattern = /^[a-z0-9][a-z0-9_-]*$/i;
const variablePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const extractVariables = (subject, bodyHtml) => {
  const variables = new Set();
  const pattern = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;
  for (const content of [subject, bodyHtml]) {
    for (const match of content.matchAll(pattern)) {
      variables.add(match[1]);
    }
  }
  return [...variables];
};

const parseTemplate = (template) => ({
  ...template,
  variables_disponibles: typeof template.variables_disponibles === 'string'
    ? JSON.parse(template.variables_disponibles)
    : template.variables_disponibles,
});

const validateTemplate = (body) => {
  const fields = ['name', 'subject', 'body_html'];
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return `El campo ${field} es obligatorio y debe ser un texto no vacío.`;
    }
  }

  if (body.variables_disponibles !== undefined &&
      (!Array.isArray(body.variables_disponibles) ||
       !body.variables_disponibles.every((variable) => (
         typeof variable === 'string' && variablePattern.test(variable)
       )))) {
    return 'variables_disponibles debe ser una lista de nombres de variables válidos.';
  }
  return null;
};

exports.listTemplates = async (req, res) => {
  try {
    const [templates] = await db.query(
      `SELECT id, template_key, name, subject, body_html, variables_disponibles, created_at, updated_at
       FROM email_templates
       ORDER BY name ASC, id ASC`
    );
    return res.status(200).json({ templates: templates.map(parseTemplate) });
  } catch (error) {
    console.error('Error al listar plantillas de correo:', error);
    return res.status(500).json({ message: 'Error interno al consultar las plantillas de correo.' });
  }
};

exports.getTemplateByKey = async (req, res) => {
  try {
    const [templates] = await db.query(
      `SELECT id, template_key, name, subject, body_html, variables_disponibles, created_at, updated_at
       FROM email_templates
       WHERE template_key = ?`,
      [req.params.templateKey]
    );
    if (templates.length === 0) {
      return res.status(404).json({ message: 'Plantilla de correo no encontrada.' });
    }
    return res.status(200).json({ template: parseTemplate(templates[0]) });
  } catch (error) {
    console.error('Error al consultar la plantilla de correo:', error);
    return res.status(500).json({ message: 'Error interno al consultar la plantilla de correo.' });
  }
};

exports.createTemplate = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }
  const { template_key: templateKey, name, subject, body_html: bodyHtml } = body;
  if (typeof templateKey !== 'string' || !templateKeyPattern.test(templateKey)) {
    return res.status(400).json({ message: 'template_key debe contener letras, números, guiones o guiones bajos.' });
  }

  const validationError = validateTemplate(body);
  if (validationError) return res.status(400).json({ message: validationError });

  const variables = body.variables_disponibles ?? extractVariables(subject, bodyHtml);
  try {
    await db.query(
      `INSERT INTO email_templates (template_key, name, subject, body_html, variables_disponibles)
       VALUES (?, ?, ?, ?, ?)`,
      [templateKey, name.trim(), subject.trim(), bodyHtml, JSON.stringify(variables)]
    );
    const [templates] = await db.query(
      `SELECT id, template_key, name, subject, body_html, variables_disponibles, created_at, updated_at
       FROM email_templates
       WHERE template_key = ?`,
      [templateKey]
    );
    return res.status(201).json({
      message: 'Plantilla de correo creada correctamente.',
      template: parseTemplate(templates[0]),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe una plantilla con esa clave.' });
    }
    console.error('Error al crear la plantilla de correo:', error);
    return res.status(500).json({ message: 'Error interno al crear la plantilla de correo.' });
  }
};

exports.updateTemplate = async (req, res) => {
  const { templateKey } = req.params;
  if (!templateKeyPattern.test(templateKey)) {
    return res.status(400).json({ message: 'La clave de plantilla no es válida.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }

  const validationError = validateTemplate(body);
  if (validationError) return res.status(400).json({ message: validationError });

  const { name, subject, body_html: bodyHtml } = body;
  const variables = body.variables_disponibles ?? extractVariables(subject, bodyHtml);
  try {
    await db.query(
      `UPDATE email_templates
       SET name = ?, subject = ?, body_html = ?, variables_disponibles = ?
       WHERE template_key = ?`,
      [name.trim(), subject.trim(), bodyHtml, JSON.stringify(variables), templateKey]
    );
    const [templates] = await db.query(
      `SELECT id, template_key, name, subject, body_html, variables_disponibles, created_at, updated_at
       FROM email_templates
       WHERE template_key = ?`,
      [templateKey]
    );
    if (templates.length === 0) {
      return res.status(404).json({ message: 'Plantilla de correo no encontrada.' });
    }
    return res.status(200).json({
      message: 'Plantilla de correo actualizada correctamente.',
      template: parseTemplate(templates[0]),
    });
  } catch (error) {
    console.error('Error al actualizar la plantilla de correo:', error);
    return res.status(500).json({ message: 'Error interno al actualizar la plantilla de correo.' });
  }
};
