const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// router.use(authenticateToken);

router.post('/upload', authenticateToken, upload.single('archivo'), fileController.uploadFile);

router.get('/submission/:submissionId', authenticateToken, fileController.getFilesBySubmission);

router.get('/:fileId/content', authenticateToken, fileController.getFileContent);

router.delete('/:fileId', authenticateToken, fileController.deleteFile);

module.exports = router;