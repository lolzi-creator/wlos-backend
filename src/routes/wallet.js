const express = require('express');
const router = express.Router();
const { getWalletBalance } = require('../controllers/walletController');

router.get('/balance/:walletAddress', getWalletBalance);

module.exports = router;