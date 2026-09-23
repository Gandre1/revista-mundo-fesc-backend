const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(authenticateToken);

// Endpoint para subir un archivo (usa upload.single('archivo'))
router.post('/upload', upload.single('archivo'), fileController.uploadFile);

// Endpoint para listar los archivos de un artículo
router.get('/submission/:submissionId', fileController.getFilesBySubmission);

module.exports = router;