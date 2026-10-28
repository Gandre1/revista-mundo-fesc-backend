const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/', authenticateToken, notificationController.listNotifications);
router.patch('/:id/read', authenticateToken, notificationController.markNotificationAsRead);

module.exports = router;
