const AuditLog = require('../models/AuditLog');

const actionByMethod = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

const getDefaultTargetId = (req, res) => {
  const { id, fileId, templateKey, submissionId } = req.params || {};
  const responseBody = res.locals.auditResponseBody || {};
  const targetId = id
    || fileId
    || templateKey
    || submissionId
    || req.body?.id
    || req.body?.targetId
    || responseBody.id
    || responseBody.targetId
    || responseBody.submissionId
    || responseBody.file?.id
    || responseBody.issue?.id
    || responseBody.template?.template_key;

  return targetId === undefined || targetId === null ? null : String(targetId);
};

module.exports = ({ targetModel, action, getTargetId, getDetails } = {}) => (req, res, next) => {
  const auditAction = action || actionByMethod[req.method];
  if (!targetModel || !auditAction || !req.user?.id) return next();

  const originalJson = res.json;
  res.json = function (body) {
    res.locals.auditResponseBody = body;
    return originalJson.call(this, body);
  };

  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const auditEntry = {
      user: req.user.id,
      action: auditAction,
      targetModel,
      targetId: getTargetId ? getTargetId(req, res) : getDefaultTargetId(req, res),
      details: getDetails
        ? getDetails(req, res)
        : { method: req.method, path: req.originalUrl, statusCode: res.statusCode },
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    };

    AuditLog.create(auditEntry).catch((error) => {
      console.error('Error al registrar la acción de auditoría:', error);
    });
  });

  next();
};
