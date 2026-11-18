const express = require('express');
const router = express.Router();
const authorController = require('../controllers/authorController');
const authenticateToken = require('../middlewares/authMiddleware');

router.use(authenticateToken);

router.post('/', authorController.addAuthor);
router.get('/submission/:submissionId', authorController.getAuthorsBySubmission);
router.delete('/:id', authorController.deleteAuthor);

module.exports = router;