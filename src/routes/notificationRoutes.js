const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/', authenticateToken, notificationController.listNotifications);
router.delete('/', authenticateToken, notificationController.clearNotifications);
router.delete('/:id', authenticateToken, notificationController.deleteNotification);
router.patch('/:id/read', authenticateToken, notificationController.markNotificationAsRead);

module.exports = router;
