const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middlewares/authMiddleware');
const auditMiddleware = require('../middlewares/auditMiddleware');

router.use(authenticateToken);

router.get('/profile', userController.getProfile);
router.put('/profile', auditMiddleware({ targetModel: 'User' }), userController.updateProfile);

module.exports = router;