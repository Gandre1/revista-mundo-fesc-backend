const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authenticateToken = require('../middlewares/authMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const multer = require('multer');
const path = require('path');

const galleyUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `galley-${suffix}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = file.fieldname === 'pdf'
      ? ['.pdf']
      : file.fieldname === 'html'
        ? ['.html', '.htm']
        : [];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

//router.use(authenticateToken);

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar envíos.' });
  }
  next();
};

router.post('/', authenticateToken, auditMiddleware({ targetModel: 'Submission' }), submissionController.createSubmission);
router.get('/', authenticateToken, requireEditorialRole, submissionController.getAllSubmissions);
router.get('/stats', authenticateToken, requireEditorialRole, submissionController.getSubmissionStats);
router.get('/my-submissions', authenticateToken, submissionController.getMySubmissions);
router.get('/editors', authenticateToken, requireEditorialRole, submissionController.getEditors);
router.get('/reviewers', authenticateToken, requireEditorialRole, submissionController.getReviewers);
router.get('/:id/audit-logs', authenticateToken, requireEditorialRole, submissionController.getSubmissionAuditLogs);
router.get('/:id', authenticateToken, submissionController.getSubmissionById);
router.put('/:id', authenticateToken, auditMiddleware({ targetModel: 'Submission' }), submissionController.updateSubmission);
router.delete('/:id', authenticateToken, auditMiddleware({ targetModel: 'Submission' }), submissionController.deleteDraft);
router.patch('/:id/editorial', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updateEditorialFields);
router.patch('/:id/metadata', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updatePublicationMetadata);
router.patch('/:id/galleys', authenticateToken, requireEditorialRole, galleyUpload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'html', maxCount: 1 },
]), auditMiddleware({ targetModel: 'Submission' }), submissionController.updatePublicationGalleys);
router.patch('/:id/status', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updateSubmissionStatus);
router.patch('/:id/assign-editor', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionEditor);
router.patch('/:id/assign-reviewer', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionReviewer);
router.patch('/:id/assign-issue', authenticateToken, requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionIssue);

// Endpoint temporal de prueba de upload
router.post('/test-upload', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se subió ningún archivo.' });
  }

  res.json({
    message: 'Archivo subido con éxito.',
    file: {
      nombre_original: req.file.originalname,
      nombre_guardado: req.file.filename,
      ruta: req.file.path,
      tamano: req.file.size
    }
  });
});

// Ruta para finalizar el envío de un artículo
router.patch('/:id/finalize', authenticateToken, auditMiddleware({ targetModel: 'Submission' }), submissionController.finalizeSubmission);

module.exports = router;