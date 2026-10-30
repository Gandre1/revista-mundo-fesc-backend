const db = require('../config/db');

const notifyIssueManagers = async (title, message) => {
  try {
    const [managers] = await db.query(
      `SELECT id FROM users WHERE role IN ('admin', 'editor')`
    );
    for (const manager of managers) {
      await db.query(
        `INSERT INTO notifications (user_id, submission_id, title, message)
         VALUES (?, NULL, ?, ?)`,
        [manager.id, title, message]
      );
    }
  } catch (error) {
    console.error('Error al notificar cambios de números:', error);
  }
};

const parsePositiveInteger = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

exports.listIssues = async (req, res) => {
  try {
    const [issues] = await db.query(
      `SELECT id, volume, number, year, title, description, status, created_at
       FROM issues
       ORDER BY year DESC, volume DESC, number DESC, id DESC`
    );
    return res.status(200).json({ issues });
  } catch (error) {
    console.error('Error al listar volúmenes:', error);
    return res.status(500).json({ message: 'Error interno al listar los volúmenes.' });
  }
};

exports.createIssue = async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }

  const volume = parsePositiveInteger(req.body.volume);
  const number = parsePositiveInteger(req.body.number);
  const year = parsePositiveInteger(req.body.year);
  const title = typeof req.body.title === 'string' && req.body.title.trim()
    ? req.body.title.trim()
    : null;
  const description = typeof req.body.description === 'string'
    ? req.body.description.trim()
    : null;
  const status = typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase() : 'draft';

  if (!volume || !number || !year) {
    return res.status(400).json({ message: 'Volumen, número y año deben ser enteros positivos.' });
  }
  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ message: 'El estado indicado no es válido.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO issues (volume, number, year, title, description, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [volume, number, year, title, description, status]
    );
    const issue = {
      id: result.insertId,
      volume,
      number,
      year,
      title,
      description,
      status,
    };
    await notifyIssueManagers(
      status === 'published' ? 'Número publicado' : 'Número creado',
      `Se ${status === 'published' ? 'publicó' : 'creó'} el volumen ${volume}, número ${number} (${year}).`
    );
    return res.status(201).json({ message: 'Número o volumen creado correctamente.', issue });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un número para ese volumen, número y año.' });
    }
    console.error('Error al crear el volumen:', error);
    return res.status(500).json({ message: 'Error interno al crear el volumen.' });
  }
};

exports.updateIssue = async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'El identificador del volumen no es válido.' });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }

  const volume = parsePositiveInteger(req.body.volume);
  const number = parsePositiveInteger(req.body.number);
  const year = parsePositiveInteger(req.body.year);
  const title = typeof req.body.title === 'string' && req.body.title.trim()
    ? req.body.title.trim()
    : null;
  const description = typeof req.body.description === 'string'
    ? req.body.description.trim()
    : null;
  const status = typeof req.body.status === 'string' ? req.body.status.trim().toLowerCase() : null;

  if (!volume || !number || !year) {
    return res.status(400).json({ message: 'Volumen, número y año deben ser enteros positivos.' });
  }
  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ message: 'El estado indicado no es válido.' });
  }

  try {
    const [result] = await db.query(
      `UPDATE issues SET volume = ?, number = ?, year = ?, title = ?, description = ?, status = ?
       WHERE id = ?`,
      [volume, number, year, title, description, status, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Volumen no encontrado.' });
    const issue = { id, volume, number, year, title, description, status };
    await notifyIssueManagers(
      status === 'published' ? 'Número publicado' : 'Número actualizado',
      `Se actualizó el volumen ${volume}, número ${number} (${year}).`
    );
    return res.status(200).json({ message: 'Volumen actualizado correctamente.', issue });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ya existe un número para ese volumen, número y año.' });
    }
    console.error('Error al actualizar el volumen:', error);
    return res.status(500).json({ message: 'Error interno al actualizar el volumen.' });
  }
};

exports.deleteIssue = async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'El identificador del volumen no es válido.' });
  try {
    const [issues] = await db.query(
      `SELECT volume, number, year FROM issues WHERE id = ?`,
      [id]
    );
    if (!issues.length) return res.status(404).json({ message: 'Volumen no encontrado.' });
    const [result] = await db.query(`DELETE FROM issues WHERE id = ?`, [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Volumen no encontrado.' });
    const issue = issues[0];
    await notifyIssueManagers(
      'Número eliminado',
      `Se eliminó el volumen ${issue.volume}, número ${issue.number} (${issue.year}).`
    );
    return res.status(200).json({ message: 'Volumen eliminado correctamente.', id });
  } catch (error) {
    console.error('Error al eliminar el volumen:', error);
    return res.status(500).json({ message: 'Error interno al eliminar el volumen.' });
  }
};

exports.getIssues = exports.listIssues;
exports.getAllIssues = exports.listIssues;
