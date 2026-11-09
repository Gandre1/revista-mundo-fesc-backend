const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const emailTemplateController = require('../controllers/emailTemplateController');

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar plantillas de correo.' });
  }
  return next();
};

router.use(authenticateToken, requireEditorialRole);
router.get('/', emailTemplateController.listTemplates);
router.get('/:templateKey', emailTemplateController.getTemplateByKey);
router.post('/', emailTemplateController.createTemplate);
router.put('/:templateKey', emailTemplateController.updateTemplate);

module.exports = router;
