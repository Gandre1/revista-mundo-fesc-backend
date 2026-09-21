const db = require('../config/db');

exports.createSubmission = async (req, res) => {
  const { titulo, resumen, palabras_clave, seccion, idioma } = req.body;
  const autor_id = req.user.id;

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

exports.getMySubmissions = async (req, res) => {
  const autor_id = req.user.id;

  try {
    const [submissions] = await db.query(
      'SELECT id, titulo, seccion, estado, borrador, fecha_envio, created_at FROM submissions WHERE autor_id = ? ORDER BY created_at DESC',
      [autor_id]
    );

    res.json({ submissions });
  } catch (error) {
    console.error('Error al obtener envíos:', error);
    res.status(500).json({ message: 'Error interno al consultar los envíos.' });
  }
};