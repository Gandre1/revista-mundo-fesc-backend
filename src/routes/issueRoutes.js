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
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const extension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(extension) && allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    const error = new Error('Formato de portada no soportado. Solo se permiten archivos JPG, PNG o WEBP.');
    error.code = 'INVALID_COVER_FORMAT';
    cb(error);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const handleCoverUpload = (req, res, next) => {
  coverUpload.single('cover')(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) {
      require('fs').unlink(req.file.path, () => {});
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'La portada supera el limite permitido de 10 MB.' });
    }
    if (error.code === 'INVALID_COVER_FORMAT') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error al procesar la portada del volumen:', error);
    return res.status(500).json({ message: 'Error interno al procesar la portada.' });
  });
};

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar volúmenes.' });
  }
  next();
};

router.get('/', issueController.listIssues);
router.post('/', authenticateToken, requireEditorialRole, issueController.createIssue);
router.patch('/:id', authenticateToken, requireEditorialRole, issueController.updateIssue);
router.patch('/:id/cover', authenticateToken, requireEditorialRole, handleCoverUpload, issueController.uploadIssueCover);
router.put('/:id', authenticateToken, requireEditorialRole, issueController.updateIssue);
router.delete('/:id', authenticateToken, requireEditorialRole, issueController.deleteIssue);

module.exports = router;
