const db = require('../config/db');
const fs = require('fs');
const path = require('path');

const createNotification = async (userId, submissionId, title, message) => {
  if (!userId) return;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, submission_id, title, message)
       VALUES (?, ?, ?, ?)`,
      [userId, submissionId, title, message]
    );
  } catch (error) {
    console.error('Error al crear la notificación automática:', error);
  }
};

const notifyUsersByRole = async (role, submissionId, title, message) => {
  try {
    const [rows] = await db.query('SELECT id FROM users WHERE role = ?', [role]);
    for (const row of rows) {
      await createNotification(row.id, submissionId, title, message);
    }
  } catch (error) {
    console.error(`Error al notificar a usuarios con rol ${role}:`, error);
  }
};

const notifySubmissionParticipants = async (submissionId, title, message) => {
  try {
    const [rows] = await db.query(
      'SELECT autor_id, editor_id FROM submissions WHERE id = ?',
      [submissionId]
    );
    if (rows.length === 0) return;
    const userIds = [...new Set([rows[0].autor_id, rows[0].editor_id].filter(Boolean))];
    for (const userId of userIds) {
      await createNotification(userId, submissionId, title, message);
    }
  } catch (error) {
    console.error('Error al consultar participantes para notificación:', error);
  }
};

exports.createSubmission = async (req, res) => {
  const { titulo, resumen, palabras_clave, seccion, idioma } = req.body;
  
  const autor_id = req.user ? req.user.id : '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad'; 

  if (!titulo) {
    return res.status(400).json({ message: 'El título del artículo es obligatorio.' });
  }

  try {
    const submissionId = globalThis.crypto ? globalThis.crypto.randomUUID() : Date.now().toString();

    await db.query(
      `INSERT INTO submissions (id, titulo, resumen, palabras_clave, seccion, idioma, autor_id, estado, borrador) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Nuevo', TRUE)`,
      [submissionId, titulo, resumen || null, palabras_clave || null, seccion || null, idioma || 'es', autor_id]
    );

    res.status(201).json({
      message: 'Envío creado correctamente.',
      submissionId
    });
  } catch (error) {
    console.error('Error al crear envío:', error);
    res.status(500).json({ message: 'Error interno al registrar el envío.' });
  }
};

// Obtener todos los envíos del autor autenticado (o fallback de dev)
exports.getMySubmissions = async (req, res) => {
  const autor_id = req.user ? req.user.id : '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad';

  try {
    const [submissions] = await db.query(
      `SELECT 
        s.id, 
        s.titulo, 
        s.seccion, 
        s.estado, 
        s.borrador, 
        s.paso_wizard,
        s.fecha_envio, 
        s.created_at,
        (SELECT COUNT(*) FROM submission_files sf WHERE sf.submission_id = s.id) AS total_archivos,
        (SELECT COUNT(*) FROM authors a WHERE a.submission_id = s.id) AS total_autores
       FROM submissions s
       WHERE s.autor_id = ? 
       ORDER BY s.created_at DESC`,
      [autor_id]
    );

    res.json({ submissions });
  } catch (error) {
    console.error('Error al obtener envíos del autor:', error);
    res.status(500).json({ message: 'Error interno al consultar los envíos.', errorDetail: error.message });
  }
};

exports.getSubmissionStats = async (req, res) => {
  try {
    const [[result]] = await db.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('nuevo', 'enviado', 'submitted', 'recibido') THEN 1 END) AS nuevos,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('en_revision', 'under_review', 'evaluado', 'evaluated') THEN 1 END) AS en_revision,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('revisiones_requeridas', 'revisions_required', 'ajustes_solicitados') THEN 1 END) AS ajustes_solicitados,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('aceptado', 'accepted', 'aprobado') THEN 1 END) AS aceptados,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('rechazado', 'rejected') THEN 1 END) AS rechazados,
        COUNT(CASE WHEN LOWER(TRIM(estado)) IN ('publicado', 'published') THEN 1 END) AS publicados
       FROM submissions`
    );
    const total = Number(result.total);
    const statuses = {
      nuevos: Number(result.nuevos),
      en_revision: Number(result.en_revision),
      ajustes_solicitados: Number(result.ajustes_solicitados),
      aceptados: Number(result.aceptados),
      rechazados: Number(result.rechazados),
      publicados: Number(result.publicados),
    };
    const estados = Object.fromEntries(
      Object.entries(statuses).map(([estado, conteo]) => [
        estado,
        {
          conteo,
          porcentaje: total === 0 ? 0 : Number(((conteo / total) * 100).toFixed(2)),
        },
      ])
    );

    return res.json({ total, estados });
  } catch (error) {
    console.error('Error al obtener estadísticas de envíos:', error);
    return res.status(500).json({ message: 'Error interno al consultar las estadísticas de envíos.' });
  }
};

exports.getAllSubmissions = async (req, res) => {
  try {
    const query = req.query || {};
    const { page: pageParam, limit: limitParam, sortBy: sortByParam, order: orderParam } = query;
    const hasPagination = pageParam !== undefined || limitParam !== undefined;
    const parsePositiveInteger = (value, fallback) => {
      if (value === undefined) return fallback;
      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    const requestedPage = parsePositiveInteger(pageParam, 1);
    const requestedLimit = parsePositiveInteger(limitParam, 10);
    if (requestedPage === null || requestedLimit === null || (hasPagination && requestedLimit > 100)) {
      return res.status(400).json({ message: 'Los parámetros de paginación no son válidos.' });
    }

    const sortColumns = {
      titulo: 's.titulo',
      fecha_envio: 's.fecha_envio',
      created_at: 's.created_at',
      estado: 's.estado',
      autor_nombre: 'autor_nombre',
      editor_nombre: 'editor_nombre',
    };
    const sortBy = sortByParam === undefined ? 'created_at' : sortByParam;
    const order = orderParam === undefined
      ? 'desc'
      : typeof orderParam === 'string' ? orderParam.toLowerCase() : '';
    if (
      typeof sortBy !== 'string' ||
      !Object.prototype.hasOwnProperty.call(sortColumns, sortBy) ||
      !['asc', 'desc'].includes(order)
    ) {
      return res.status(400).json({ message: 'Los parámetros de ordenamiento no son válidos.' });
    }

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const status = typeof query.status === 'string' ? query.status.trim() : '';
    const whereClauses = [];
    const filterValues = [];
    if (search) {
      whereClauses.push("(s.titulo LIKE ? OR CONCAT_WS(' ', author.nombre, author.apellidos) LIKE ?)");
      filterValues.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      const statusAliases = {
        en_revision: ['en_revision', 'under_review'],
        evaluado: ['evaluado', 'evaluated'],
        enviado: ['enviado', 'submitted', 'recibido'],
        revisiones_requeridas: ['revisiones_requeridas', 'revisions_required', 'ajustes_solicitados'],
        aceptado: ['aceptado', 'accepted', 'aprobado'],
        rechazado: ['rechazado', 'rejected'],
        publicado: ['publicado', 'published'],
        nuevo: ['nuevo'],
      };
      const matchingStatuses = statusAliases[status.toLowerCase()] || [status.toLowerCase()];
      whereClauses.push(`LOWER(s.estado) IN (${matchingStatuses.map(() => '?').join(', ')})`);
      filterValues.push(...matchingStatuses);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const joinsSql = 'FROM submissions s LEFT JOIN users author ON author.id = s.autor_id LEFT JOIN users editor ON editor.id = s.editor_id';

    const [[countResult]] = await db.query(
      `SELECT COUNT(*) AS total ${joinsSql} ${whereSql}`,
      filterValues
    );
    const total = Number(countResult.total);
    const limit = hasPagination ? requestedLimit : total;
    const totalPages = hasPagination ? Math.max(1, Math.ceil(total / limit)) : 1;
    const page = hasPagination ? Math.min(requestedPage, totalPages) : requestedPage;
    const offset = hasPagination ? (page - 1) * limit : 0;
    const paginationSql = hasPagination ? 'LIMIT ? OFFSET ?' : '';
    const queryValues = hasPagination
      ? [...filterValues, limit, offset]
      : filterValues;

    const [submissions] = await db.query(
      `SELECT
        s.id,
        s.titulo,
        s.resumen,
        s.seccion,
        s.estado,
        s.borrador,
        s.paso_wizard,
        s.palabras_clave,
        s.idioma,
        s.fecha_envio,
        s.created_at,
        s.editor_id,
        CONCAT_WS(' ', author.nombre, author.apellidos) AS autor_nombre,
        author.email AS autor_email,
        CONCAT_WS(' ', editor.nombre, editor.apellidos) AS editor_nombre,
        editor.email AS editor_email,
        (SELECT COUNT(*) FROM submission_files sf WHERE sf.submission_id = s.id) AS total_archivos,
        (SELECT COUNT(*) FROM authors a WHERE a.submission_id = s.id) AS total_autores
       ${joinsSql}
       ${whereSql}
       ORDER BY ${sortColumns[sortBy]} ${order.toUpperCase()}
       ${paginationSql}`,
      queryValues
    );

    return res.json({
      submissions,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    console.error('Error al obtener todos los envíos:', error);
    return res.status(500).json({ message: 'Error interno al consultar los envíos.' });
  }
};

exports.getEditors = async (req, res) => {
  try {
    const [editors] = await db.query(
      `SELECT id, nombre, apellidos, email
       FROM users
       WHERE role = 'editor'
       ORDER BY apellidos ASC, nombre ASC`
    );

    return res.json({ editors });
  } catch (error) {
    console.error('Error al consultar editores:', error);
    return res.status(500).json({ message: 'Error interno al consultar los editores.' });
  }
};

exports.getReviewers = async (req, res) => {
  try {
    const [reviewers] = await db.query(
      `SELECT id, nombre, apellidos, email
       FROM users
       WHERE role = 'reviewer'
       ORDER BY apellidos ASC, nombre ASC`
    );

    return res.json({ reviewers });
  } catch (error) {
    console.error('Error al consultar revisores:', error);
    return res.status(500).json({ message: 'Error interno al consultar los revisores.' });
  }
};

exports.assignSubmissionReviewer = async (req, res) => {
  const { id } = req.params;
  const { reviewer_id, fecha_limite } = req.body || {};

  if (typeof reviewer_id !== 'string' || !reviewer_id.trim()) {
    return res.status(400).json({ message: 'El identificador del revisor es obligatorio.' });
  }

  if (typeof fecha_limite !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_limite)) {
    return res.status(400).json({ message: 'La fecha límite debe tener el formato AAAA-MM-DD.' });
  }
  const [year, month, day] = fecha_limite.split('-').map(Number);
  const parsedDeadline = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDeadline.getUTCFullYear() !== year ||
    parsedDeadline.getUTCMonth() !== month - 1 ||
    parsedDeadline.getUTCDate() !== day
  ) {
    return res.status(400).json({ message: 'La fecha límite no es válida.' });
  }

  try {
    const [submissions] = await db.query('SELECT id FROM submissions WHERE id = ?', [id]);
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    const [reviewers] = await db.query(
      `SELECT id, CONCAT_WS(' ', nombre, apellidos) AS reviewer_nombre
       FROM users WHERE id = ? AND role = 'reviewer'`,
      [reviewer_id]
    );
    if (reviewers.length === 0) {
      return res.status(400).json({ message: 'El usuario seleccionado no es un revisor válido.' });
    }

    await db.query(
      `INSERT INTO submission_reviews (submission_id, reviewer_id, fecha_limite)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE fecha_limite = ?, estado = 'asignado'`,
      [id, reviewer_id, fecha_limite, fecha_limite]
    );
    await db.query(
      `INSERT INTO submission_audit_logs (submission_id, user_id, action, description)
       VALUES (?, ?, ?, ?)`,
      [
        id,
        req.user?.id || null,
        'reviewer_assigned',
        `Revisor ${reviewers[0].reviewer_nombre || 'Usuario no disponible'} asignado con fecha límite ${fecha_limite}.`,
      ]
    );
    await createNotification(
      reviewer_id,
      id,
      'Asignación como revisor',
      `Has sido asignado al envío con fecha límite ${fecha_limite}.`
    );

    return res.status(200).json({
      message: 'Revisor asignado correctamente.',
      submissionId: id,
    });
  } catch (error) {
    console.error('Error al asignar revisor:', error);
    return res.status(500).json({ message: 'Error interno al asignar el revisor.' });
  }
};

const saveEditorialFields = async (req, res, fields = req.body) => {
  const { id } = req.params;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }

  const { estado, editor_id, comentarios_editor } = fields;
  const updates = [];
  const values = [];
  let updatedStatus;

  try {
    if (Object.prototype.hasOwnProperty.call(fields, 'estado')) {
      const statusMap = {
        nuevo: 'Nuevo',
        enviado: 'enviado',
        submitted: 'enviado',
        en_revision: 'en_revision',
        'en revisión': 'en_revision',
        under_review: 'en_revision',
        evaluado: 'evaluado',
        evaluated: 'evaluado',
        revisiones_requeridas: 'revisiones_requeridas',
        'revisiones requeridas': 'revisiones_requeridas',
        revisions_required: 'revisiones_requeridas',
        aceptado: 'aceptado',
        accepted: 'aceptado',
        rechazado: 'rechazado',
        rejected: 'rechazado',
        publicado: 'publicado',
        published: 'publicado',
      };
      const normalizedStatus = typeof estado === 'string' ? estado.trim().toLowerCase() : '';
      if (!Object.prototype.hasOwnProperty.call(statusMap, normalizedStatus)) {
        return res.status(400).json({ message: 'El estado indicado no es válido.' });
      }
      updates.push('estado = ?');
      updatedStatus = statusMap[normalizedStatus];
      values.push(updatedStatus);
    }

    if (Object.prototype.hasOwnProperty.call(fields, 'editor_id')) {
      if (editor_id !== null && (typeof editor_id !== 'string' || !editor_id.trim())) {
        return res.status(400).json({ message: 'El identificador del editor no es válido.' });
      }

      if (editor_id !== null) {
        const [editors] = await db.query(
          "SELECT id FROM users WHERE id = ? AND role = 'editor'",
          [editor_id]
        );
        if (editors.length === 0) {
          return res.status(400).json({ message: 'El usuario seleccionado no es un editor válido.' });
        }
      }

      updates.push('editor_id = ?');
      values.push(editor_id);
    }

    if (Object.prototype.hasOwnProperty.call(fields, 'comentarios_editor')) {
      if (comentarios_editor !== null && typeof comentarios_editor !== 'string') {
        return res.status(400).json({ message: 'Los comentarios editoriales deben ser texto.' });
      }

      updates.push('comentarios_editor = ?');
      values.push(comentarios_editor?.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se indicaron cambios editoriales.' });
    }

    const [submissions] = await db.query('SELECT id FROM submissions WHERE id = ?', [id]);
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    values.push(id);
    await db.query(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ?`, values);
    const [updatedSubmissions] = await db.query(
      `SELECT s.id, s.estado, s.editor_id,
              CONCAT_WS(' ', editor.nombre, editor.apellidos) AS editor_nombre
       FROM submissions s
       LEFT JOIN users editor ON editor.id = s.editor_id
       WHERE s.id = ?`,
      [id]
    );

    if (Object.prototype.hasOwnProperty.call(fields, 'estado')) {
      await db.query(
        `INSERT INTO submission_audit_logs (submission_id, user_id, action, description)
         VALUES (?, ?, ?, ?)`,
        [id, req.user?.id || null, 'status_updated', `Estado actualizado a ${updatedStatus}.`]
      );
      await notifySubmissionParticipants(
        id,
        'Estado del envío actualizado',
        `El estado del envío cambió a ${updatedStatus}.`
      );
    }
    if (Object.prototype.hasOwnProperty.call(fields, 'editor_id')) {
      const description = editor_id
        ? `Editor ${updatedSubmissions[0].editor_nombre || 'Usuario no disponible'} asignado.`
        : 'Editor desasignado.';
      await db.query(
        `INSERT INTO submission_audit_logs (submission_id, user_id, action, description)
         VALUES (?, ?, ?, ?)`,
        [id, req.user?.id || null, 'editor_assigned', description]
      );
      if (editor_id) {
        await createNotification(
          editor_id,
          id,
          'Asignación como editor',
          'Has sido asignado como editor de este envío.'
        );
      }
    }
    return res.status(200).json({
      message: 'Cambios editoriales guardados correctamente.',
      submissionId: id,
      submission: updatedSubmissions[0],
    });
  } catch (error) {
    console.error('Error al actualizar los datos editoriales:', error);
    return res.status(500).json({ message: 'Error interno al actualizar los datos editoriales.' });
  }
};

exports.updateEditorialFields = (req, res) => saveEditorialFields(req, res);

exports.updateSubmissionStatus = (req, res) => {
  const fields = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? {
        estado: req.body.estado,
        ...(Object.prototype.hasOwnProperty.call(req.body, 'comentarios_editor')
          ? { comentarios_editor: req.body.comentarios_editor }
          : {}),
      }
    : req.body;
  return saveEditorialFields(req, res, fields);
};

exports.assignSubmissionEditor = (req, res) => {
  const fields = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? { editor_id: req.body.editor_id }
    : req.body;
  return saveEditorialFields(req, res, fields);
};

exports.getSubmissionAuditLogs = async (req, res) => {
  const { id } = req.params;

  try {
    const [submissions] = await db.query('SELECT id FROM submissions WHERE id = ?', [id]);
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    const [auditLogs] = await db.query(
      `SELECT audit.id, audit.submission_id, audit.user_id,
              NULLIF(CONCAT_WS(' ', actor.nombre, actor.apellidos), '') AS user_nombre,
              audit.action,
              CASE
                WHEN target.id IS NOT NULL THEN REPLACE(
                  audit.description,
                  target.id,
                  COALESCE(NULLIF(CONCAT_WS(' ', target.nombre, target.apellidos), ''), 'Usuario no disponible')
                )
                ELSE audit.description
              END AS description,
              audit.created_at
       FROM submission_audit_logs audit
       LEFT JOIN users actor ON actor.id = audit.user_id
       LEFT JOIN users target
         ON audit.action IN ('editor_assigned', 'reviewer_assigned')
        AND LOCATE(target.id, audit.description) > 0
       WHERE audit.submission_id = ?
       ORDER BY audit.created_at ASC, audit.id ASC`,
      [id]
    );

    return res.status(200).json({ auditLogs });
  } catch (error) {
    console.error('Error al consultar la bitácora de auditoría:', error);
    return res.status(500).json({ message: 'Error interno al consultar la bitácora de auditoría.' });
  }
};

// Obtener el detalle completo de un envío específico por ID
exports.getSubmissionById = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener datos principales de la postulación
    const [submissions] = await db.query(
      `SELECT s.id, s.autor_id, s.titulo, s.resumen, s.palabras_clave, s.seccion, s.idioma,
              s.comentarios_editor, s.referencias, s.estado, s.borrador, s.paso_wizard,
              s.fecha_envio, s.created_at, s.editor_id,
              CONCAT_WS(' ', author.nombre, author.apellidos) AS autor_nombre,
              author.email AS autor_email,
              CONCAT_WS(' ', editor.nombre, editor.apellidos) AS editor_nombre
       FROM submissions s
       JOIN users author ON author.id = s.autor_id
       LEFT JOIN users editor ON editor.id = s.editor_id
       WHERE s.id = ?`,
      [id]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    const submission = submissions[0];
    const isEditorialUser = ['admin', 'editor'].includes(req.user.role);
    if (!isEditorialUser && submission.autor_id !== req.user.id) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    // 2. Obtener archivos adjuntos (usando ruta_almacenamiento y fecha_subida)
    const [files] = await db.query(
      `SELECT id, nombre_original, tamano, tipo, ruta_almacenamiento, fecha_subida 
       FROM submission_files 
       WHERE submission_id = ? 
       ORDER BY fecha_subida ASC`,
      [id]
    );

    // 3. Obtener colaboradores/autores
    const [authors] = await db.query(
      `SELECT id, nombre, apellidos, email, afiliacion, pais, orcid, es_corresponsal, orden 
       FROM authors 
       WHERE submission_id = ? 
       ORDER BY orden ASC`,
      [id]
    );

    const [reviews] = isEditorialUser
      ? await db.query(
          `SELECT sr.id, sr.reviewer_id,
                  CONCAT_WS(' ', reviewer.nombre, reviewer.apellidos) AS reviewer_nombre,
                  sr.fecha_limite, sr.estado
           FROM submission_reviews sr
           JOIN users reviewer ON reviewer.id = sr.reviewer_id
           WHERE sr.submission_id = ?
           ORDER BY sr.fecha_limite ASC`,
          [id]
        )
      : [[]];

    // Respuesta consolidada
    res.json({
      submission: {
        ...submission,
        archivos: files,
        autores: authors,
        revisores: reviews,
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle del envío:', error);
    res.status(500).json({ message: 'Error interno al consultar el detalle del envío.', errorDetail: error.message });
  }
};

exports.updateSubmission = async (req, res) => {
  const { id } = req.params;
  const { titulo, resumen, palabras_clave, seccion, idioma, comentarios_editor, referencias } = req.body;

  // Tomamos el autor_id del usuario autenticado o del valor fallback de desarrollo
  const autor_id = req.user ? req.user.id : '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad';

  try {
    const keywordsFormatted = Array.isArray(palabras_clave) 
      ? palabras_clave.join(', ') 
      : (palabras_clave || null);

    const [result] = await db.query(
      `UPDATE submissions 
       SET titulo = ?, 
           resumen = ?, 
           palabras_clave = ?, 
           seccion = ?, 
           idioma = ?, 
           comentarios_editor = ?, 
           referencias = ?
       WHERE id = ? AND autor_id = ?`,
      [
        titulo || 'Borrador sin título', 
        resumen || null, 
        keywordsFormatted, 
        seccion || null, 
        idioma || 'es', 
        comentarios_editor || null, 
        referencias || null, 
        id, 
        autor_id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permiso para actualizarlo.' });
    }

    return res.json({ 
      message: 'Envío actualizado correctamente.',
      submissionId: id 
    });
  } catch (error) {
    console.error('Error exacto en la consulta UPDATE MySQL:', error);
    return res.status(500).json({ 
      message: 'Error al actualizar el envío en la base de datos.', 
      sqlError: error.message 
    });
  }
};

exports.deleteDraft = async (req, res) => {
  const { id } = req.params;
  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [submissions] = await connection.query(
      'SELECT id, autor_id, borrador FROM submissions WHERE id = ? FOR UPDATE',
      [id]
    );

    if (submissions.length === 0 || submissions[0].autor_id !== req.user.id) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Borrador no encontrado.' });
    }

    if (!submissions[0].borrador) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'Solo se pueden eliminar artículos que aún están en borrador.' });
    }

    const [files] = await connection.query(
      'SELECT ruta_almacenamiento FROM submission_files WHERE submission_id = ?',
      [id]
    );

    const [result] = await connection.query(
      'DELETE FROM submissions WHERE id = ? AND autor_id = ? AND borrador = TRUE',
      [id, req.user.id]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'El borrador cambió de estado y no pudo eliminarse.' });
    }

    await connection.commit();
    transactionStarted = false;

    const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
    for (const file of files) {
      const storedPath = file.ruta_almacenamiento.replace(/[\\/]+/g, path.sep);
      const filePath = path.resolve(process.cwd(), storedPath);
      const relativePath = path.relative(uploadsDirectory, filePath);

      if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.error(`Se omitió la limpieza de una ruta inválida del borrador ${id}.`);
        continue;
      }

      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`No fue posible limpiar un archivo del borrador ${id}:`, error);
      }
    }

    return res.json({ message: 'Borrador eliminado correctamente.' });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    console.error('Error al eliminar borrador:', error);
    return res.status(500).json({ message: 'Error interno al eliminar el borrador.' });
  } finally {
    connection?.release();
  }
};

exports.finalizeSubmission = async (req, res) => {
  const { id } = req.params;

  const autor_id = req.user ? req.user.id : '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad';

  try {
    const [submissions] = await db.query(
      'SELECT id, borrador FROM submissions WHERE id = ? AND autor_id = ?',
      [id, autor_id]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permiso para modificarlo.' });
    }

    const submission = submissions[0];

    if (submission.borrador === 0 || submission.borrador === false) {
      return res.status(400).json({ message: 'Este envío ya fue finalizado previamente.' });
    }

    const [files] = await db.query(
      'SELECT id FROM submission_files WHERE submission_id = ?',
      [id]
    );

    if (files.length === 0) {
      return res.status(400).json({ 
        message: 'No se puede finalizar el envío: debe adjuntar al menos un archivo (manuscrito).' 
      });
    }

    const fechaActual = new Date();
    await db.query(
      `UPDATE submissions 
       SET borrador = 0, estado = 'enviado', fecha_envio = ? 
       WHERE id = ?`,
      [fechaActual, id]
    );

    await notifyUsersByRole(
      'admin',
      id,
      'Nuevo artículo recibido',
      'Se ha recibido un nuevo artículo y está listo para revisión editorial.'
    );

    return res.json({
      message: '¡Envío finalizado exitosamente! El artículo ha sido recibido para evaluación.',
      submission_id: id,
      fecha_envio: fechaActual
    });
  } catch (error) {
    console.error('Error al finalizar envío:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor al finalizar el envío.',
      errorDetail: error.message 
    });
  }
};