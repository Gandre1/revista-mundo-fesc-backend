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