// src/routes/wallet.js
const express = require('express');
const router = express.Router();
const {
    getWalletBalance,
    getTransactions,
    filterTransactions,
    getTransactionDetails,
    generateTransactionReceipt
} = require('../controllers/walletController');

// Get wallet balance
router.get('/balance/:walletAddress', getWalletBalance);

// Get transaction history
router.get('/transactions/:walletAddress', getTransactions);

// Filter transactions
router.post('/transactions/:walletAddress/filter', filterTransactions);

// Get transaction details
router.get('/transactions/:walletAddress/:transactionId', getTransactionDetails);

// Generate transaction receipt
router.get('/transactions/:walletAddress/:transactionId/receipt', generateTransactionReceipt);

module.exports = router;