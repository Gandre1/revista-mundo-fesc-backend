const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (!token) {
    const devRole = req.headers['x-dev-role'];
    const mockAuthEnabled =
      process.env.NODE_ENV !== 'production' &&
      process.env.DEV_AUTH_BYPASS === 'true';
    const allowedRoles = ['admin', 'editor', 'reviewer', 'author'];

    if (mockAuthEnabled && allowedRoles.includes(devRole)) {
      req.user = {
        id: process.env.DEV_AUTH_USER_ID || '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad',
        role: devRole,
        email: `mock-${devRole}@localhost`,
      };
      return next();
    }

    return res.status(401).json({ message: 'Acceso denegado. No se proporcionó un token de autenticación.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guarda los datos del usuario logueado en la petición
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado.' });
  }
};