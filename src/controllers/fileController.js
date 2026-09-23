const db = require('../config/db');
const fs = require('fs');

// SUBIR Y REGISTRAR UN ARCHIVO ASOCIADO A UN ENVÍO
exports.uploadFile = async (req, res) => {
  const { submission_id, tipo } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'No se ha adjuntado ningún archivo.' });
  }

  if (!submission_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'El submission_id es obligatorio.' });
  }

  try {
    const [submissions] = await db.query(
      'SELECT id FROM submissions WHERE id = ? AND autor_id = ?',
      [submission_id, req.user.id]
    );

    if (submissions.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Envío no encontrado o no tienes permisos para modificarlo.' });
    }

    const fileId = globalThis.crypto ? globalThis.crypto.randomUUID() : Date.now().toString();

    // Insert con los nombres exactos de tu base de datos
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

// OBTENER LISTA DE ARCHIVOS DE UN ENVÍO
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