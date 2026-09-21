const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const authenticateToken = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.post('/', submissionController.createSubmission);
router.get('/my-submissions', submissionController.getMySubmissions);

module.exports = router;