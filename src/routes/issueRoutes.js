const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const authenticateToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `cover-${suffix}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    cb(null, ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar volúmenes.' });
  }
  next();
};

router.get('/', issueController.listIssues);
router.post('/', authenticateToken, requireEditorialRole, issueController.createIssue);
router.patch('/:id', authenticateToken, requireEditorialRole, issueController.updateIssue);
router.patch('/:id/cover', authenticateToken, requireEditorialRole, coverUpload.single('cover'), issueController.uploadIssueCover);
router.put('/:id', authenticateToken, requireEditorialRole, issueController.updateIssue);
router.delete('/:id', authenticateToken, requireEditorialRole, issueController.deleteIssue);

module.exports = router;
