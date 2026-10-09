const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

//router.use(authenticateToken);

const requireEditorialRole = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'No tienes permisos para gestionar envíos.' });
  }
  next();
};

router.post('/', authenticateToken, submissionController.createSubmission);
router.get('/', authenticateToken, requireEditorialRole, submissionController.getAllSubmissions);
router.get('/my-submissions', authenticateToken, submissionController.getMySubmissions);
router.get('/editors', authenticateToken, requireEditorialRole, submissionController.getEditors);
router.get('/:id', authenticateToken, submissionController.getSubmissionById);
router.put('/:id', authenticateToken, submissionController.updateSubmission);
router.delete('/:id', authenticateToken, submissionController.deleteDraft);
router.patch('/:id/editorial', authenticateToken, requireEditorialRole, submissionController.updateEditorialFields);

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
router.patch('/:id/finalize', authenticateToken, submissionController.finalizeSubmission);

module.exports = router;