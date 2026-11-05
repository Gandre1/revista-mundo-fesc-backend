const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const exportController = require('../controllers/exportController');

router.get('/issues', issueController.listPublicIssues);
router.get('/issues/:id', issueController.getPublicIssue);
router.get('/submissions/:id/export/scielo-xml', exportController.exportScieloXml);
router.get('/submissions/:id', issueController.getPublicSubmissionDetail);

module.exports = router;
