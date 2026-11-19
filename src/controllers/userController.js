const db = require('../config/db');
const bcrypt = require('bcryptjs');
const isValidPassword = require('../utils/passwordValidation');

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

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword ||
      typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ message: 'La contraseña actual y la nueva son obligatorias.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'La nueva contraseña debe ser diferente de la actual.' });
  }

  try {
    const [users] = await db.query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    if (!users[0].password || !(await bcrypt.compare(currentPassword, users[0].password))) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    return res.json({ message: 'Contraseña cambiada correctamente.' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ message: 'No fue posible cambiar la contraseña.' });
  }
};