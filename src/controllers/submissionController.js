const db = require('../config/db');

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

// Obtener el detalle completo de un envío específico por ID
exports.getSubmissionById = async (req, res) => {
  const { id } = req.params;
  const autor_id = req.user ? req.user.id : '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad';

  try {
    // 1. Obtener datos principales de la postulación
    const [submissions] = await db.query(
      `SELECT id, titulo, resumen, palabras_clave, seccion, idioma, 
              comentarios_editor, referencias, estado, borrador, paso_wizard, fecha_envio, created_at 
       FROM submissions 
       WHERE id = ? AND autor_id = ?`,
      [id, autor_id]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permiso para acceder.' });
    }

    const submission = submissions[0];

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