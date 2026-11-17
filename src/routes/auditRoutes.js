const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const auditController = require('../controllers/auditController');

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Solo un administrador puede consultar los logs de auditoría.' });
  }
  return next();
};

router.use(authenticateToken, requireAdmin);
router.get('/summary', auditController.getSummary);
router.get('/', auditController.listLogs);

module.exports = router;
