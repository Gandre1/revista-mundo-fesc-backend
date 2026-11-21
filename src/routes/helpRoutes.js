const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');
const helpController = require('../controllers/helpController');

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar el centro de ayuda.' });
  }
  return next();
};

const requireEditorialUser = [authenticateToken, requireEditorialRole];

router.get('/', helpController.listActive);
router.get('/manage', ...requireEditorialUser, helpController.listAll);
router.get('/:slug', helpController.getActiveBySlug);
router.post(
  '/',
  ...requireEditorialUser,
  auditMiddleware({ targetModel: 'HelpContent', getTargetId: (req, res) => res.locals.auditResponseBody?.item?.id }),
  helpController.create
);
router.put(
  '/:id',
  ...requireEditorialUser,
  auditMiddleware({ targetModel: 'HelpContent' }),
  helpController.update
);
router.delete(
  '/:id',
  ...requireEditorialUser,
  auditMiddleware({ targetModel: 'HelpContent' }),
  helpController.delete
);

module.exports = router;
