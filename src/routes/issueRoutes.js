const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const authenticateToken = require('../middlewares/authMiddleware');

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar volúmenes.' });
  }
  next();
};

router.get('/', issueController.listIssues);
router.post('/', authenticateToken, requireEditorialRole, issueController.createIssue);
router.patch('/:id', authenticateToken, requireEditorialRole, issueController.updateIssue);
router.delete('/:id', authenticateToken, requireEditorialRole, issueController.deleteIssue);

module.exports = router;
