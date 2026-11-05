const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/oai', exportController.oai);

module.exports = router;
