const db = require('../config/db');

exports.addAuthor = async (req, res) => {
  const { submission_id, nombre, apellidos, email, afiliacion, pais, orcid, es_corresponsal, orden } = req.body;

  if (!submission_id || !nombre || !apellidos || !email) {
    return res.status(400).json({ message: 'Campos requeridos faltantes.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO authors (submission_id, nombre, apellidos, email, afiliacion, pais, orcid, es_corresponsal, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submission_id,
        nombre,
        apellidos,
        email,
        afiliacion || null,
        pais || null,
        orcid || null,
        es_corresponsal ? 1 : 0,
        orden || 1
      ]
    );

    res.status(201).json({
      message: 'Autor agregado exitosamente.',
      author: {
        id: result.insertId,
        submission_id,
        nombre,
        apellidos,
        email,
        afiliacion: afiliacion || null,
        pais: pais || null,
        orcid: orcid || null,
        es_corresponsal: es_corresponsal ? 1 : 0,
        orden: orden || 1
      }
    });
  } catch (error) {
    console.error('Error MySQL al agregar autor:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor.', 
      sqlError: error.message 
    });
  }
};

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

exports.deleteAuthor = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM authors WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se encontró el colaborador en la base de datos.' });
    }

    return res.status(200).json({ message: 'Coautor eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar coautor:', error);
    return res.status(500).json({ message: 'Error interno al eliminar.' });
  }
};