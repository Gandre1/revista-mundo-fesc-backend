const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// router.use(authenticateToken);

router.post('/upload', upload.single('archivo'), fileController.uploadFile);

router.get('/submission/:submissionId', fileController.getFilesBySubmission);

router.delete('/:fileId', fileController.deleteFile);

module.exports = router;