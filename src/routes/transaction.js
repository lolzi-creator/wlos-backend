// src/routes/transaction.js
const express = require('express');
const router = express.Router();
const {
    getTransactions,
    filterTransactions,
    getTransactionDetails,
    createTransaction,
    generateTransactionReceipt
} = require('../controllers/transactionController');

// Get transactions for a wallet with pagination
router.get('/:walletAddress', getTransactions);

// Filter transactions
router.post('/:walletAddress/filter', filterTransactions);

// Get transaction details
router.get('/:walletAddress/:transactionId', getTransactionDetails);

// Create a transaction (generally used by other controllers)
router.post('/', createTransaction);

// Generate transaction receipt
router.get('/:walletAddress/:transactionId/receipt', generateTransactionReceipt);

module.exports = router;