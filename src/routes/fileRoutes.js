const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');

// router.use(authenticateToken);

router.post('/upload', authenticateToken, upload.single('archivo'), auditMiddleware({ targetModel: 'SubmissionFile' }), fileController.uploadFile);

router.get('/submission/:submissionId', authenticateToken, fileController.getFilesBySubmission);

router.get('/:fileId/preview-token', authenticateToken, fileController.createFilePreviewToken);

router.get('/:fileId/preview', fileController.getFilePreview);

router.get('/:fileId/content', authenticateToken, fileController.getFileContent);

router.delete('/:fileId', authenticateToken, auditMiddleware({ targetModel: 'SubmissionFile' }), fileController.deleteFile);

module.exports = router;