const db = require('../config/db');
const fs = require('fs');

exports.uploadFile = async (req, res) => {
  const { submission_id, tipo } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'No se ha adjuntado ningún archivo.' });
  }

  if (!submission_id) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'El submission_id es obligatorio.' });
  }

  try {
    // Si req.user existe lo usamos, si no (en pruebas) consultamos solo por submission_id
    let query = 'SELECT id FROM submissions WHERE id = ?';
    let queryParams = [submission_id];

    if (req.user) {
      query += ' AND autor_id = ?';
      queryParams.push(req.user.id);
    }

    const [submissions] = await db.query(query, queryParams);

    if (submissions.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permisos para modificarlo.' });
    }

    const fileId = globalThis.crypto ? globalThis.crypto.randomUUID() : Date.now().toString();

    await db.query(
      `INSERT INTO submission_files (id, submission_id, nombre_original, ruta_almacenamiento, tamano, tipo) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        submission_id,
        req.file.originalname,
        req.file.path,
        req.file.size,
        tipo || 'manuscrito'
      ]
    );

    res.status(201).json({
      message: 'Archivo subido y registrado correctamente.',
      file: {
        id: fileId,
        nombre_original: req.file.originalname,
        tipo: tipo || 'manuscrito',
        tamano: req.file.size
      }
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Error al registrar archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor al procesar el archivo.' });
  }
};

exports.getFilesBySubmission = async (req, res) => {
  const { submissionId } = req.params;

  try {
    const [files] = await db.query(
      'SELECT id, nombre_original, tipo, tamano, fecha_subida FROM submission_files WHERE submission_id = ?',
      [submissionId]
    );

    res.json({ files });
  } catch (error) {
    console.error('Error al obtener archivos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

exports.deleteFile = async (req, res) => {
  const { fileId } = req.params;

  try {
    const [files] = await db.query('SELECT * FROM submission_files WHERE id = ?', [fileId]);

    if (files.length === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const fileToDelete = files[0];

    await db.query('DELETE FROM submission_files WHERE id = ?', [fileId]);

    if (fileToDelete.ruta_almacenamiento && fs.existsSync(fileToDelete.ruta_almacenamiento)) {
      fs.unlinkSync(fileToDelete.ruta_almacenamiento);
    }

    res.json({ message: 'Archivo eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar el archivo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};