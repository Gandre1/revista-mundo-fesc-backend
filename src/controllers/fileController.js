const db = require('../config/db');
const fs = require('fs');
const path = require('path');

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

    const [result] = await db.query(
      `INSERT INTO submission_files (submission_id, nombre_original, ruta_almacenamiento, tamano, tipo)
       VALUES (?, ?, ?, ?, ?)`,
      [
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
        id: result.insertId,
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
    const [submissions] = await db.query(
      'SELECT autor_id FROM submissions WHERE id = ?',
      [submissionId]
    );
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

    const isEditorialUser = ['admin', 'editor'].includes(req.user.role);
    if (submissions[0].autor_id !== req.user.id && !isEditorialUser) {
      return res.status(404).json({ message: 'Envío no encontrado.' });
    }

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

exports.getFileContent = async (req, res) => {
  const { fileId } = req.params;

  try {
    const [files] = await db.query(
      `SELECT sf.nombre_original, sf.ruta_almacenamiento, s.autor_id
       FROM submission_files sf
       JOIN submissions s ON s.id = sf.submission_id
       WHERE sf.id = ?`,
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const file = files[0];
    const editorialRoles = ['admin', 'editor', 'reviewer'];
    if (file.autor_id !== req.user.id && !editorialRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a este archivo.' });
    }

    const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(process.cwd(), file.ruta_almacenamiento);
    const relativePath = path.relative(uploadsDirectory, filePath);

    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      console.error(`Ruta de archivo inválida en la base de datos para el archivo ${fileId}.`);
      return res.status(500).json({ message: 'La ubicación del archivo no es válida.' });
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).json({ message: 'El archivo no está disponible en el servidor.' });
    }

    const safeName = path.basename(file.nombre_original).replace(/[\r\n"]/g, '_');
    if (req.query.download === '1') {
      return res.download(filePath, safeName);
    }

    if (path.extname(safeName).toLowerCase() !== '.pdf') {
      return res.status(415).json({ message: 'Solo se pueden visualizar archivos PDF en el navegador.' });
    }

    res.type('application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error al consultar el contenido del archivo:', error);
    return res.status(500).json({ message: 'Error interno al consultar el archivo.' });
  }
};

exports.deleteFile = async (req, res) => {
  const { fileId } = req.params;

  try {
    const [files] = await db.query(
      `SELECT sf.*, s.autor_id
       FROM submission_files sf
       JOIN submissions s ON s.id = sf.submission_id
       WHERE sf.id = ?`,
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const fileToDelete = files[0];
    const isEditorialUser = ['admin', 'editor'].includes(req.user.role);
    if (fileToDelete.autor_id !== req.user.id && !isEditorialUser) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

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