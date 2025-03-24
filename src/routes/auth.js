const express = require('express');
const router = express.Router();
const {
    connectWallet,
    getNonceMessage,
    verifySignature,
} = require('../controllers/authController');

// Routes
router.post('/connect', connectWallet);
router.get('/message/:walletAddress', getNonceMessage);
router.post('/sign', verifySignature);

module.exports = router;