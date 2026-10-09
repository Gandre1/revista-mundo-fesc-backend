const db = require('../config/db');
const fs = require('fs');
const path = require('path');

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

exports.getAllSubmissions = async (req, res) => {
  try {
    const [submissions] = await db.query(
      `SELECT
        s.id,
        s.titulo,
        s.resumen,
        s.seccion,
        s.estado,
        s.borrador,
        s.paso_wizard,
        s.fecha_envio,
        s.created_at,
        s.editor_id,
        CONCAT_WS(' ', author.nombre, author.apellidos) AS autor_nombre,
        author.email AS autor_email,
        CONCAT_WS(' ', editor.nombre, editor.apellidos) AS editor_nombre,
        (SELECT COUNT(*) FROM submission_files sf WHERE sf.submission_id = s.id) AS total_archivos,
        (SELECT COUNT(*) FROM authors a WHERE a.submission_id = s.id) AS total_autores
       FROM submissions s
       JOIN users author ON author.id = s.autor_id
       LEFT JOIN users editor ON editor.id = s.editor_id
       ORDER BY s.created_at DESC`
    );

    return res.json({ submissions });
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

exports.updateEditorialFields = async (req, res) => {
  const { id } = req.params;
  const { estado, editor_id } = req.body;
  const updates = [];
  const values = [];

  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'estado')) {
      const statusMap = {
        nuevo: 'Nuevo',
        enviado: 'enviado',
        submitted: 'enviado',
        en_revision: 'en_revision',
        'en revisión': 'en_revision',
        under_review: 'en_revision',
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
      const normalizedStatus = typeof estado === 'string' ? estado.toLowerCase() : '';
      if (!Object.prototype.hasOwnProperty.call(statusMap, normalizedStatus)) {
        return res.status(400).json({ message: 'El estado indicado no es válido.' });
      }
      updates.push('estado = ?');
      values.push(statusMap[normalizedStatus]);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'editor_id')) {
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

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se indicaron cambios editoriales.' });
    }

    const [submissions] = await db.query('SELECT id FROM submissions WHERE id = ?', [id]);
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    values.push(id);
    await db.query(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ?`, values);
    return res.json({ message: 'Cambios editoriales guardados correctamente.', submissionId: id });
  } catch (error) {
    console.error('Error al actualizar los datos editoriales:', error);
    return res.status(500).json({ message: 'Error interno al actualizar los datos editoriales.' });
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

    // Respuesta consolidada
    res.json({
      submission: {
        ...submission,
        archivos: files,
        autores: authors
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