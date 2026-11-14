const db = require('../config/db');

exports.create = async ({
  user,
  action,
  targetModel,
  targetId = null,
  details = {},
  ipAddress = null,
}) => {
  const userId = typeof user === 'object' && user !== null ? user.id : user;
  const [result] = await db.query(
    `INSERT INTO audit_logs
      (user_id, action, target_model, target_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      action,
      targetModel,
      targetId === null || targetId === undefined ? null : String(targetId),
      JSON.stringify(details),
      ipAddress,
    ]
  );

  return {
    id: result.insertId,
    user: userId || null,
    action,
    targetModel,
    targetId: targetId === null || targetId === undefined ? null : String(targetId),
    details,
    ipAddress,
  };
};
