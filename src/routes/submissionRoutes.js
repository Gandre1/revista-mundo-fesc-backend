const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(authenticateToken);

router.post('/', submissionController.createSubmission);
router.get('/my-submissions', submissionController.getMySubmissions);

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

module.exports = router;