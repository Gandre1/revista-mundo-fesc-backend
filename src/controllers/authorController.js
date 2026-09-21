const db = require('../config/db');

// AÑADIR UN COAUTOR A UN ENVÍO
exports.addAuthor = async (req, res) => {
  const { submission_id, nombre, apellidos, email, afiliacion, pais, es_corresponsal, orden } = req.body;

  if (!submission_id || !nombre || !apellidos || !email) {
    return res.status(400).json({ message: 'submission_id, nombre, apellidos y email son requeridos.' });
  }

  try {
    // Verificar que el envío exista y pertenezca al usuario logueado
    const [submissions] = await db.query(
      'SELECT id FROM submissions WHERE id = ? AND autor_id = ?',
      [submission_id, req.user.id]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permiso para modificarlo.' });
    }

    await db.query(
      `INSERT INTO authors (submission_id, nombre, apellidos, email, afiliacion, pais, es_corresponsal, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submission_id,
        nombre,
        apellidos,
        email,
        afiliacion || null,
        pais || null,
        es_corresponsal ? 1 : 0,
        orden || 1
      ]
    );

    res.status(201).json({ message: 'Coautor agregado exitosamente.' });
  } catch (error) {
    console.error('Error al agregar coautor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// OBTENER COAUTORES DE UN ENVÍO
exports.getAuthorsBySubmission = async (req, res) => {
  const { submissionId } = req.params;

  try {
    const [authors] = await db.query(
      'SELECT * FROM authors WHERE submission_id = ? ORDER BY orden ASC',
      [submissionId]
    );

    res.json({ authors });
  } catch (error) {
    console.error('Error al obtener coautores:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// ELIMINAR UN COAUTOR
exports.deleteAuthor = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM authors WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Coautor no encontrado.' });
    }

    res.json({ message: 'Coautor eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar coautor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};