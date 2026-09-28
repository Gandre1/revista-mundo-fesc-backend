const db = require('../config/db');

// OBTENER PERFIL DEL USUARIO LOGUEADO
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await db.query(
      `SELECT id, nombre, apellidos, email, afiliacion, pais, orcid, notificaciones, created_at 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// ACTUALIZAR DATOS DEL PERFIL
exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { nombre, apellidos, afiliacion, pais, orcid, notificaciones } = req.body;

  try {
    // Validar que al menos envíe campos básicos obligatorios
    if (!nombre || !apellidos) {
      return res.status(400).json({ message: 'El nombre y los apellidos son obligatorios.' });
    }

    await db.query(
      `UPDATE users 
       SET nombre = ?, apellidos = ?, afiliacion = ?, pais = ?, orcid = ?, notificaciones = ? 
       WHERE id = ?`,
      [
        nombre,
        apellidos,
        afiliacion || null,
        pais || null,
        orcid || null,
        notificaciones !== undefined ? notificaciones : true,
        userId
      ]
    );

    res.json({
      message: 'Perfil actualizado correctamente.',
      user: {
        id: userId,
        nombre,
        apellidos,
        afiliacion,
        pais,
        orcid,
        notificaciones
      }
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor al actualizar perfil.' });
  }
};

// OBTENER DETALLE DE UN ARTÍCULO DEL HISTORIAL DEL AUTOR
exports.getSubmissionById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Obtener la información general del envío
    const [submissions] = await db.query(
      'SELECT * FROM submissions WHERE id = ? AND autor_id = ?',
      [id, userId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado o no tienes acceso a él.' });
    }

    const submission = submissions[0];

    // 2. Obtener coautores
    const [authors] = await db.query(
      'SELECT id, nombre, apellidos, email, afiliacion, pais, es_corresponsal, orden FROM authors WHERE submission_id = ? ORDER BY orden ASC',
      [id]
    );

    // 3. Obtener archivos
    const [files] = await db.query(
      'SELECT id, nombre_original, tipo, tamano, fecha_subida FROM submission_files WHERE submission_id = ?',
      [id]
    );

    res.json({
      submission,
      authors,
      files
    });
  } catch (error) {
    console.error('Error al consultar detalle del envío:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};