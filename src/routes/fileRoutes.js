const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const authenticateToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');

router.get('/:fileId/preview', fileController.getFilePreview);

router.use(authenticateToken);

router.post('/upload', upload.single('archivo'), auditMiddleware({ targetModel: 'SubmissionFile' }), fileController.uploadFile);

router.get('/submission/:submissionId', fileController.getFilesBySubmission);

router.get('/:fileId/preview-token', fileController.createFilePreviewToken);

router.get('/:fileId/content', fileController.getFileContent);

router.delete('/:fileId', auditMiddleware({ targetModel: 'SubmissionFile' }), fileController.deleteFile);

module.exports = router;