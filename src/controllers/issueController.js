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

const parsePublishedAt = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

exports.listIssues = async (req, res) => {
  try {
    const [issues] = await db.query(
      `SELECT id, volume, number, year, title, description, cover_url, status, published_at, created_at
       FROM issues
       ORDER BY year DESC, volume DESC, number DESC, id DESC`
    );
    return res.status(200).json({ issues });
  } catch (error) {
    console.error('Error al listar volúmenes:', error);
    return res.status(500).json({ message: 'Error interno al listar los volúmenes.' });
  }
};

exports.listPublicIssues = async (req, res) => {
  try {
    const [issues] = await db.query(
      `SELECT id, volume, number, year, title, description, cover_url, status, published_at, created_at
       FROM issues
       WHERE status = 'published'
          OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= NOW())
       ORDER BY published_at DESC, year DESC, volume DESC, number DESC, id DESC`
    );
    return res.status(200).json({ issues });
  } catch (error) {
    console.error('Error al listar volúmenes públicos:', error);
    return res.status(500).json({ message: 'Error interno al listar los volúmenes públicos.' });
  }
};

exports.getPublicIssue = async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'El identificador del volumen no es válido.' });

  try {
    const [issues] = await db.query(
      `SELECT id, volume, number, year, title, description, cover_url, status, published_at, created_at
       FROM issues
       WHERE id = ?
         AND (status = 'published'
           OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= NOW()))`,
      [id]
    );
    if (!issues.length) {
      return res.status(404).json({ message: 'Volumen público no encontrado.' });
    }

    const [articles] = await db.query(
      `SELECT s.id, s.titulo, s.resumen, s.palabras_clave, s.seccion, s.idioma,
              s.estado, s.doi, s.pdf_galley_url, s.html_galley_url,
              s.fecha_envio, s.created_at, s.updated_at
       FROM submissions s
       WHERE s.issue_id = ?
         AND LOWER(TRIM(s.estado)) IN ('aceptado', 'accepted', 'aprobado', 'publicado', 'published')
       ORDER BY s.created_at ASC, s.id ASC`,
      [id]
    );

    const articleIds = articles.map((article) => article.id);
    let authorsByArticle = {};
    if (articleIds.length) {
      const placeholders = articleIds.map(() => '?').join(', ');
      const [authors] = await db.query(
        `SELECT submission_id, nombre, apellidos, email, afiliacion, pais, orcid, es_corresponsal, orden
         FROM authors
         WHERE submission_id IN (${placeholders})
         ORDER BY submission_id ASC, orden ASC, id ASC`,
        articleIds
      );
      authorsByArticle = authors.reduce((result, author) => {
        if (!result[author.submission_id]) result[author.submission_id] = [];
        result[author.submission_id].push({
          nombre: author.nombre,
          apellidos: author.apellidos,
          email: author.email,
          afiliacion: author.afiliacion,
          pais: author.pais,
          orcid: author.orcid,
          es_corresponsal: Boolean(author.es_corresponsal),
          orden: author.orden,
        });
        return result;
      }, {});
    }

    const publications = articles.map((article) => ({
      ...article,
      doi: article.doi || null,
      pdf_galley_url: article.pdf_galley_url || null,
      html_galley_url: article.html_galley_url || null,
      authors: authorsByArticle[article.id] || [],
    }));

    return res.status(200).json({ issue: issues[0], articles: publications });
  } catch (error) {
    console.error('Error al obtener el volumen público:', error);
    return res.status(500).json({ message: 'Error interno al obtener el volumen público.' });
  }
};

exports.getPublicSubmissionDetail = async (req, res) => {
  const submissionId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!submissionId) {
    return res.status(400).json({ message: 'El identificador del artículo no es válido.' });
  }

  try {
    const [submissions] = await db.query(
      `SELECT s.id, s.titulo, s.resumen, s.palabras_clave, s.seccion, s.idioma,
              s.estado, s.doi, s.pdf_galley_url, s.html_galley_url,
              s.fecha_envio, s.created_at, s.updated_at,
              i.id AS issue_id, i.volume, i.number, i.year, i.title AS issue_title,
              i.description AS issue_description, i.cover_url, i.status AS issue_status, i.published_at
       FROM submissions s
       JOIN issues i ON i.id = s.issue_id
       WHERE s.id = ?
         AND LOWER(TRIM(s.estado)) IN ('aceptado', 'accepted', 'aprobado', 'publicado', 'published')
         AND (
           i.status = 'published'
           OR (i.status = 'scheduled' AND i.published_at IS NOT NULL AND i.published_at <= NOW())
         )`,
      [submissionId]
    );
    if (!submissions.length) {
      return res.status(404).json({
        message: 'Artículo no encontrado o no disponible para lectores públicos.',
      });
    }

    const [authors] = await db.query(
      `SELECT nombre, apellidos, email, afiliacion, pais, orcid, es_corresponsal, orden
       FROM authors
       WHERE submission_id = ?
       ORDER BY orden ASC, id ASC`,
      [submissionId]
    );
    const article = submissions[0];
    return res.status(200).json({
      article: {
        id: article.id,
        titulo: article.titulo,
        resumen: article.resumen,
        palabras_clave: article.palabras_clave,
        seccion: article.seccion,
        idioma: article.idioma,
        estado: article.estado,
        doi: article.doi || null,
        pdf_galley_url: article.pdf_galley_url || null,
        html_galley_url: article.html_galley_url || null,
        fecha_envio: article.fecha_envio,
        created_at: article.created_at,
        updated_at: article.updated_at,
        authors: authors.map((author) => ({
          nombre: author.nombre,
          apellidos: author.apellidos,
          email: author.email,
          afiliacion: author.afiliacion,
          pais: author.pais,
          orcid: author.orcid,
          es_corresponsal: Boolean(author.es_corresponsal),
          orden: author.orden,
        })),
      },
      issue: {
        id: article.issue_id,
        volume: article.volume,
        number: article.number,
        year: article.year,
        title: article.issue_title,
        description: article.issue_description,
        cover_url: article.cover_url || null,
        status: article.issue_status,
        published_at: article.published_at,
      },
    });
  } catch (error) {
    console.error('Error al obtener el artículo público:', error);
    return res.status(500).json({ message: 'Error interno al obtener el artículo público.' });
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
  const publishedAt = parsePublishedAt(req.body.published_at);

  if (!volume || !number || !year) {
    return res.status(400).json({ message: 'Volumen, número y año deben ser enteros positivos.' });
  }
  if (!['draft', 'scheduled', 'published'].includes(status)) {
    return res.status(400).json({ message: 'El estado indicado no es válido.' });
  }
  if (status === 'scheduled' && !publishedAt) {
    return res.status(400).json({ message: 'Un volumen programado debe incluir una fecha de publicación válida.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO issues (volume, number, year, title, description, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [volume, number, year, title, description, status, status === 'draft' ? null : publishedAt]
    );
    const issue = {
      id: result.insertId,
      volume,
      number,
      year,
      title,
      description,
      status,
      published_at: status === 'draft' ? null : publishedAt,
    };
    await notifyIssueManagers(
      status === 'published'
        ? 'Número publicado'
        : status === 'scheduled'
          ? 'Número programado'
          : 'Número creado',
      `Se ${status === 'published' ? 'publicó' : status === 'scheduled' ? 'programó la publicación de' : 'creó'} el volumen ${volume}, número ${number} (${year}).`
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
  const publishedAt = parsePublishedAt(req.body.published_at);

  if (!volume || !number || !year) {
    return res.status(400).json({ message: 'Volumen, número y año deben ser enteros positivos.' });
  }
  if (!['draft', 'scheduled', 'published'].includes(status)) {
    return res.status(400).json({ message: 'El estado indicado no es válido.' });
  }
  if (status === 'scheduled' && !publishedAt) {
    return res.status(400).json({ message: 'Un volumen programado debe incluir una fecha de publicación válida.' });
  }

  try {
    const [result] = await db.query(
      `UPDATE issues SET volume = ?, number = ?, year = ?, title = ?, description = ?, status = ?, published_at = ?
       WHERE id = ?`,
      [volume, number, year, title, description, status, status === 'draft' ? null : publishedAt, id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Volumen no encontrado.' });
    const issue = {
      id,
      volume,
      number,
      year,
      title,
      description,
      cover_url: null,
      status,
      published_at: status === 'draft' ? null : publishedAt,
    };
    await notifyIssueManagers(
      status === 'published'
        ? 'Número publicado'
        : status === 'scheduled'
          ? 'Número programado'
          : 'Número actualizado',
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

exports.uploadIssueCover = async (req, res) => {
  const id = parsePositiveInteger(req.params.id);
  if (!id) {
    if (req.file) require('fs').unlinkSync(req.file.path);
    return res.status(400).json({ message: 'El identificador del volumen no es válido.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Debes seleccionar una imagen para la portada.' });
  }

  try {
    const [issues] = await db.query(
      'SELECT id, cover_url FROM issues WHERE id = ?',
      [id]
    );
    if (!issues.length) {
      require('fs').unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Volumen no encontrado.' });
    }

    const coverUrl = `/uploads/${req.file.filename}`;
    await db.query(
      'UPDATE issues SET cover_url = ? WHERE id = ?',
      [coverUrl, id]
    );
    return res.status(200).json({ message: 'Portada cargada correctamente.', cover_url: coverUrl });
  } catch (error) {
    require('fs').unlinkSync(req.file.path);
    console.error('Error al cargar la portada del volumen:', error);
    return res.status(500).json({ message: 'Error interno al cargar la portada.' });
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
