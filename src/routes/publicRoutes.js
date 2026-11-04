const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');

router.get('/issues', issueController.listPublicIssues);
router.get('/issues/:id', issueController.getPublicIssue);
router.get('/submissions/:id', issueController.getPublicSubmissionDetail);

module.exports = router;
