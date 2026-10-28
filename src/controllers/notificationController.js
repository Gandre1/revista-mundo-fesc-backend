const db = require('../config/db');

exports.createNotification = async ({ userId, submissionId = null, title, message }) => {
  if (!userId || typeof title !== 'string' || typeof message !== 'string') {
    return null;
  }

  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, submission_id, title, message)
       VALUES (?, ?, ?, ?)`,
      [userId, submissionId, title, message]
    );
    return result.insertId || null;
  } catch (error) {
    console.error('Error al crear la notificación:', error);
    return null;
  }
};

exports.listNotifications = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Usuario autenticado no válido.' });
  }

  try {
    const [notifications] = await db.query(
      `SELECT id, user_id, submission_id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );
    return res.status(200).json({ notifications });
  } catch (error) {
    console.error('Error al consultar notificaciones:', error);
    return res.status(500).json({ message: 'Error interno al consultar las notificaciones.' });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    return res.status(401).json({ message: 'Usuario autenticado no válido.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Notificación no encontrada.' });
    }

    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return res.status(200).json({ message: 'Notificación marcada como leída.', id: Number(id) || id });
  } catch (error) {
    console.error('Error al marcar la notificación como leída:', error);
    return res.status(500).json({ message: 'Error interno al actualizar la notificación.' });
  }
};
