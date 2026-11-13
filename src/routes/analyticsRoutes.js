const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const analyticsController = require('../controllers/analyticsController');

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para consultar las analíticas editoriales.' });
  }
  return next();
};

router.use(authenticateToken, requireEditorialRole);
router.get('/export/csv', analyticsController.exportCsv);
router.get('/overview', analyticsController.getOverview);
router.get('/editorial-times', analyticsController.getEditorialTimes);
router.get('/issues-summary', analyticsController.getIssuesSummary);
router.get('/reviewers', analyticsController.getReviewers);

module.exports = router;
