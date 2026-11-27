const db = require('../config/db');

const messageFields = `
  m.id,
  m.subject AS asunto,
  m.body AS contenido,
  m.sender_id AS remitenteId,
  CONCAT_WS(' ', sender.nombre, sender.apellidos) AS remitenteNombre,
  m.recipient_id AS destinatarioId,
  CONCAT_WS(' ', recipient.nombre, recipient.apellidos) AS destinatarioNombre,
  m.created_at AS fecha,
  m.is_read AS leido,
  m.submission_id AS submissionId`;

function submissionAccessSql(submissionAlias) {
  return `EXISTS (
    SELECT 1
    FROM submissions s
    WHERE s.id = ${submissionAlias}.submission_id
      AND (
        ? IN ('admin', 'editor')
        OR (? = 'author' AND s.autor_id = ?)
        OR (
          ? = 'reviewer'
          AND EXISTS (
            SELECT 1 FROM submission_reviews sr
            WHERE sr.submission_id = s.id AND sr.reviewer_id = ?
          )
        )
      )
  )`;
}

function submissionAccessValues(user) {
  return [user.role, user.role, user.id, user.role, user.id];
}

async function canAccessSubmission(user, submissionId) {
  const [submissions] = await db.query(
    `SELECT s.id
     FROM submissions s
     WHERE s.id = ?
       AND (
         ? IN ('admin', 'editor')
         OR (? = 'author' AND s.autor_id = ?)
         OR (
           ? = 'reviewer'
           AND EXISTS (
             SELECT 1 FROM submission_reviews sr
             WHERE sr.submission_id = s.id AND sr.reviewer_id = ?
           )
         )
       )`,
    [submissionId, ...submissionAccessValues(user)]
  );
  return submissions.length > 0;
}

function messageQuery() {
  return `SELECT ${messageFields}
          FROM messages m
          JOIN users sender ON sender.id = m.sender_id
          JOIN users recipient ON recipient.id = m.recipient_id`;
}

exports.listRecipients = async (req, res) => {
  try {
    const [recipients] = await db.query(
      `SELECT id, nombre, apellidos, role
       FROM users
       WHERE id <> ?
       ORDER BY nombre, apellidos, id`,
      [req.user.id]
    );
    return res.status(200).json({ recipients });
  } catch (error) {
    console.error('Error al consultar destinatarios de mensajes:', error);
    return res.status(500).json({ message: 'Error interno al consultar los destinatarios.' });
  }
};

exports.listMessages = async (req, res) => {
  const user = req.user;
  try {
    const accessSql = submissionAccessSql('m');
    const [messages] = await db.query(
      `${messageQuery()}
       WHERE (
         (m.sender_id = ? AND m.sender_deleted_at IS NULL)
         OR (m.recipient_id = ? AND m.recipient_deleted_at IS NULL)
         OR (
           m.sender_id <> ? AND m.recipient_id <> ?
           AND ${accessSql}
         )
       )
       ORDER BY m.created_at DESC, m.id DESC`,
      [user.id, user.id, user.id, user.id, ...submissionAccessValues(user)]
    );
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Error al consultar mensajes:', error);
    return res.status(500).json({ message: 'Error interno al consultar los mensajes.' });
  }
};

exports.getConversation = async (req, res) => {
  const userId = req.user.id;
  const otherUserId = req.params.userId;
  if (otherUserId === userId) {
    return res.status(400).json({ message: 'La conversación debe incluir a otro usuario.' });
  }

  try {
    const [messages] = await db.query(
      `${messageQuery()}
       WHERE (
         (m.sender_id = ? AND m.recipient_id = ?)
         OR (m.sender_id = ? AND m.recipient_id = ?)
       )
       AND ((m.sender_id = ? AND m.sender_deleted_at IS NULL)
         OR (m.recipient_id = ? AND m.recipient_deleted_at IS NULL))
       ORDER BY m.created_at ASC, m.id ASC`,
      [
        userId, otherUserId, otherUserId, userId,
        userId, userId,
      ]
    );
    return res.status(200).json({ messages });
  } catch (error) {
    console.error('Error al consultar la conversación:', error);
    return res.status(500).json({ message: 'Error interno al consultar la conversación.' });
  }
};

exports.getMessage = async (req, res) => {
  try {
    const [messages] = await db.query(
      `${messageQuery()}
       WHERE m.id = ?
         AND (
           m.sender_id = ?
           OR m.recipient_id = ?
           OR ${submissionAccessSql('m')}
         )`,
      [
        req.params.id,
        req.user.id,
        req.user.id,
        ...submissionAccessValues(req.user),
      ]
    );

    if (messages.length === 0) {
      const [existing] = await db.query('SELECT id FROM messages WHERE id = ?', [req.params.id]);
      if (existing.length > 0) {
        return res.status(403).json({ message: 'No tienes permiso para consultar este mensaje.' });
      }
      return res.status(404).json({ message: 'Mensaje no encontrado.' });
    }

    const [messageState] = await db.query(
      `SELECT sender_id, recipient_id, sender_deleted_at, recipient_deleted_at
       FROM messages WHERE id = ?`,
      [req.params.id]
    );
    const message = messageState[0];
    if (
      (message.sender_id === req.user.id && message.sender_deleted_at) ||
      (message.recipient_id === req.user.id && message.recipient_deleted_at)
    ) {
      return res.status(404).json({ message: 'Mensaje no encontrado.' });
    }
    return res.status(200).json({ message: messages[0] });
  } catch (error) {
    console.error('Error al consultar el mensaje:', error);
    return res.status(500).json({ message: 'Error interno al consultar el mensaje.' });
  }
};

exports.sendMessage = async (req, res) => {
  const { recipientId, subject, body } = req.body || {};
  const submissionId = req.body?.submissionId === undefined ||
    req.body?.submissionId === null ||
    req.body?.submissionId === ''
    ? null
    : req.body.submissionId;

  if (
    typeof recipientId !== 'string' || !recipientId.trim() ||
    typeof subject !== 'string' || !subject.trim() || subject.trim().length > 255 ||
    typeof body !== 'string' || !body.trim() || body.trim().length > 20000 ||
    (submissionId !== null && (typeof submissionId !== 'string' || !submissionId.trim()))
  ) {
    return res.status(400).json({ message: 'El destinatario, asunto y contenido del mensaje son obligatorios y válidos.' });
  }
  if (recipientId === req.user.id) {
    return res.status(400).json({ message: 'No puedes enviarte un mensaje a ti mismo.' });
  }

  try {
    const [recipients] = await db.query(
      'SELECT id FROM users WHERE id = ?',
      [recipientId]
    );
    if (recipients.length === 0) {
      return res.status(400).json({ message: 'El destinatario seleccionado no existe.' });
    }

    if (submissionId && !(await canAccessSubmission(req.user, submissionId))) {
      return res.status(403).json({ message: 'No tienes permiso para enviar mensajes sobre este envío.' });
    }

    const [result] = await db.query(
      `INSERT INTO messages (sender_id, recipient_id, submission_id, subject, body)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, recipientId, submissionId, subject.trim(), body.trim()]
    );
    const [messages] = await db.query(
      `${messageQuery()} WHERE m.id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ message: messages[0] });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return res.status(500).json({ message: 'Error interno al enviar el mensaje.' });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const [messages] = await db.query(
      'SELECT id, recipient_id, recipient_deleted_at FROM messages WHERE id = ?',
      [req.params.id]
    );
    if (messages.length === 0) {
      return res.status(404).json({ message: 'Mensaje no encontrado.' });
    }
    if (messages[0].recipient_deleted_at) {
      return res.status(404).json({ message: 'Mensaje no encontrado.' });
    }
    if (messages[0].recipient_id !== req.user.id) {
      return res.status(403).json({ message: 'Solo el destinatario puede marcar este mensaje como leído.' });
    }

    await db.query(
      'UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_id = ?',
      [req.params.id, req.user.id]
    );
    return res.status(200).json({ message: 'Mensaje marcado como leído.', id: req.params.id });
  } catch (error) {
    console.error('Error al marcar el mensaje como leído:', error);
    return res.status(500).json({ message: 'Error interno al actualizar el mensaje.' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const [messages] = await db.query(
      'SELECT id, sender_id, recipient_id FROM messages WHERE id = ?',
      [req.params.id]
    );
    if (messages.length === 0) {
      return res.status(404).json({ message: 'Mensaje no encontrado.' });
    }

    const message = messages[0];
    const isSender = message.sender_id === req.user.id;
    const isRecipient = message.recipient_id === req.user.id;
    if (!isSender && !isRecipient) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este mensaje.' });
    }

    const column = isSender ? 'sender_deleted_at' : 'recipient_deleted_at';
    await db.query(
      `UPDATE messages SET ${column} = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    return res.status(200).json({ message: 'Mensaje eliminado.' });
  } catch (error) {
    console.error('Error al eliminar el mensaje:', error);
    return res.status(500).json({ message: 'Error interno al eliminar el mensaje.' });
  }
};
