const HelpContent = require('../models/HelpContent');

const contentTypes = ['faq', 'guide', 'policy'];
const audiences = ['general', 'author', 'reviewer', 'editor'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const parseId = (value) => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const validateFilters = (query) => {
  const filters = {};
  if (query.type !== undefined) {
    if (!contentTypes.includes(query.type)) return { error: 'El tipo de contenido no es válido.' };
    filters.content_type = query.type;
  }
  if (query.audience !== undefined) {
    if (!audiences.includes(query.audience)) return { error: 'La audiencia no es válida.' };
    filters.audience = query.audience;
  }
  if (query.category !== undefined) {
    if (typeof query.category !== 'string' || !query.category.trim() || query.category.length > 100) {
      return { error: 'La categoría no es válida.' };
    }
    filters.category = query.category.trim();
  }
  return { filters };
};

const validateItem = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El cuerpo de la solicitud debe ser un objeto JSON.' };
  }
  const { title, slug, category, content_type: contentType, audience, content } = body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
    return { error: 'El título es obligatorio y debe tener máximo 255 caracteres.' };
  }
  if (typeof slug !== 'string' || slug.length > 180 || !slugPattern.test(slug)) {
    return { error: 'El slug solo puede contener letras minúsculas, números y guiones, con máximo 180 caracteres.' };
  }
  if (typeof category !== 'string' || !category.trim() || category.trim().length > 100) {
    return { error: 'La categoría es obligatoria y debe tener máximo 100 caracteres.' };
  }
  if (!contentTypes.includes(contentType)) {
    return { error: 'El tipo de contenido debe ser faq, guide o policy.' };
  }
  if (!audiences.includes(audience ?? 'general')) {
    return { error: 'La audiencia debe ser general, author, reviewer o editor.' };
  }
  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'El contenido es obligatorio y no puede estar vacío.' };
  }
  const displayOrder = body.display_order ?? 0;
  if (!Number.isSafeInteger(displayOrder) || displayOrder < 0) {
    return { error: 'display_order debe ser un entero no negativo.' };
  }
  const isActive = body.is_active ?? true;
  if (typeof isActive !== 'boolean') {
    return { error: 'is_active debe ser un valor booleano.' };
  }
  return {
    item: {
      title: title.trim(),
      slug,
      category: category.trim(),
      content_type: contentType,
      audience: audience ?? 'general',
      content,
      display_order: displayOrder,
      is_active: isActive,
    },
  };
};

const sendDatabaseError = (res, error, action) => {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Ya existe un contenido de ayuda con ese slug.' });
  }
  console.error(`Error al ${action} contenido de ayuda:`, error);
  return res.status(500).json({ message: `Error interno al ${action} contenido de ayuda.` });
};

exports.listActive = async (req, res) => {
  const validation = validateFilters(req.query);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const items = await HelpContent.listActive(validation.filters);
    return res.status(200).json({ items });
  } catch (error) {
    return sendDatabaseError(res, error, 'listar');
  }
};

exports.listAll = async (req, res) => {
  const validation = validateFilters(req.query);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const items = await HelpContent.listAll(validation.filters);
    return res.status(200).json({ items });
  } catch (error) {
    return sendDatabaseError(res, error, 'listar');
  }
};

exports.getActiveBySlug = async (req, res) => {
  if (!slugPattern.test(req.params.slug)) {
    return res.status(400).json({ message: 'El slug no es válido.' });
  }
  try {
    const item = await HelpContent.findActiveBySlug(req.params.slug);
    if (!item) return res.status(404).json({ message: 'Contenido de ayuda no encontrado.' });
    return res.status(200).json({ item });
  } catch (error) {
    return sendDatabaseError(res, error, 'consultar');
  }
};

exports.create = async (req, res) => {
  const validation = validateItem(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const id = await HelpContent.create(validation.item);
    const item = await HelpContent.findById(id);
    return res.status(201).json({ message: 'Contenido de ayuda creado correctamente.', item });
  } catch (error) {
    return sendDatabaseError(res, error, 'crear');
  }
};

exports.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El identificador no es válido.' });
  const validation = validateItem(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    await HelpContent.update(id, validation.item);
    const item = await HelpContent.findById(id);
    if (!item) return res.status(404).json({ message: 'Contenido de ayuda no encontrado.' });
    return res.status(200).json({ message: 'Contenido de ayuda actualizado correctamente.', item });
  } catch (error) {
    return sendDatabaseError(res, error, 'actualizar');
  }
};

exports.delete = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'El identificador no es válido.' });
  try {
    const affectedRows = await HelpContent.delete(id);
    if (!affectedRows) return res.status(404).json({ message: 'Contenido de ayuda no encontrado.' });
    return res.status(200).json({ message: 'Contenido de ayuda eliminado correctamente.' });
  } catch (error) {
    return sendDatabaseError(res, error, 'eliminar');
  }
};
