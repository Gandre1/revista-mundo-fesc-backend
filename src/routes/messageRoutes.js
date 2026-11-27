const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const messageController = require('../controllers/messageController');

router.use(authenticateToken);

router.get('/recipients', messageController.listRecipients);
router.get('/conversation/:userId', messageController.getConversation);
router.get('/', messageController.listMessages);
router.post('/', messageController.sendMessage);
router.get('/:id', messageController.getMessage);
router.patch('/:id/read', messageController.markMessageAsRead);
router.delete('/:id', messageController.deleteMessage);

module.exports = router;
