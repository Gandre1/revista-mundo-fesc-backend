const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authenticateToken = require('../middlewares/authMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const reviewAnnotationsDirectory = path.resolve(process.cwd(), 'private_uploads', 'review-annotations');
fs.mkdirSync(reviewAnnotationsDirectory, { recursive: true });
const reviewAnnotationUpload = upload.createUploadMiddleware(
  reviewAnnotationsDirectory,
  'review-annotation'
);

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

router.use(authenticateToken);

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar envíos.' });
  }
  next();
};

const requireSubmissionCreator = (req, res, next) => {
  if (!['admin', 'author'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Solo autores y administradores pueden crear envíos.' });
  }
  next();
};

const requireReviewerRole = (req, res, next) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'No tienes permisos para gestionar dictámenes.' });
  }
  next();
};

const requireReviewAttachmentRole = (req, res, next) => {
  if (!['reviewer', 'admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permisos para acceder a este archivo de revisión.' });
  }
  next();
};

router.post('/', requireSubmissionCreator, auditMiddleware({ targetModel: 'Submission' }), submissionController.createSubmission);
router.get('/', requireEditorialRole, submissionController.getAllSubmissions);
router.get('/stats', requireEditorialRole, submissionController.getSubmissionStats);
router.get('/my-submissions', submissionController.getMySubmissions);
router.get('/my-reviews', requireReviewerRole, submissionController.getMyReviews);
router.get('/review-history', requireReviewerRole, submissionController.getReviewerReviewHistory);
router.get('/editors', requireEditorialRole, submissionController.getEditors);
router.get('/reviewers', requireEditorialRole, submissionController.getReviewers);
router.get('/:id/review', requireReviewerRole, submissionController.getReviewerReview);
router.get('/:id/reviewers/:reviewerId/history/:historyId/attachment', requireReviewAttachmentRole, submissionController.getReviewerReviewAttachment);
router.put('/:id/review', requireReviewerRole, reviewAnnotationUpload.single('archivo_anotaciones'), auditMiddleware({ targetModel: 'Submission' }), submissionController.saveReviewerReview);
router.get('/:id/audit-logs', requireEditorialRole, submissionController.getSubmissionAuditLogs);
router.get('/:id', submissionController.getSubmissionById);
router.put('/:id', auditMiddleware({ targetModel: 'Submission' }), submissionController.updateSubmission);
router.delete('/:id', auditMiddleware({ targetModel: 'Submission' }), submissionController.deleteDraft);
router.patch('/:id/editorial', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updateEditorialFields);
router.patch('/:id/metadata', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updatePublicationMetadata);
router.patch('/:id/galleys', requireEditorialRole, galleyUpload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'html', maxCount: 1 },
]), auditMiddleware({ targetModel: 'Submission' }), submissionController.updatePublicationGalleys);
router.patch('/:id/status', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.updateSubmissionStatus);
router.patch('/:id/assign-editor', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionEditor);
router.patch('/:id/assign-reviewer', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionReviewer);
router.patch('/:id/assign-issue', requireEditorialRole, auditMiddleware({ targetModel: 'Submission' }), submissionController.assignSubmissionIssue);

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
router.patch('/:id/finalize', auditMiddleware({ targetModel: 'Submission' }), submissionController.finalizeSubmission);

module.exports = router;