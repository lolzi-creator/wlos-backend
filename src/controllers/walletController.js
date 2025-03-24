// src/controllers/walletController.js
const { Connection, PublicKey } = require('@solana/web3.js');
const supabase = require('../../supabase/supabaseClient');
const transactionController = require('./transactionController');
require('dotenv').config();

const connection = new Connection('https://api.devnet.solana.com');

const WLOS_MINT = process.env.WLOS_TOKEN_MINT;

exports.getWalletBalance = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Missing wallet address' });
    }

    try {
        const publicKey = new PublicKey(walletAddress);

        // ✅ Get SOL balance
        const solBalanceLamports = await connection.getBalance(publicKey);
        const solBalance = solBalanceLamports / 1e9;

        // ✅ Get SPL (WLOS) token balance
        let wlosBalance = 0;

        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: new PublicKey(WLOS_MINT),
            });

            if (tokenAccounts?.value?.length > 0) {
                wlosBalance = parseFloat(
                    tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
                );
            }
        } catch (tokenErr) {
            console.warn(`Could not fetch WLOS balance (fallback to 0):`, tokenErr.message);
        }

        res.json({
            walletAddress,
            sol: solBalance,
            wlos: wlosBalance,
        });

    } catch (err) {
        console.error('Balance fetch error:', err); // ← Add this
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
};

// Get transaction history
exports.getTransactions = async (req, res) => {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Forward to the transaction controller
        return transactionController.getTransactions(req, res);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// Filter transactions
exports.filterTransactions = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Forward to the transaction controller
        return transactionController.filterTransactions(req, res);
    } catch (error) {
        console.error('Error filtering transactions:', error);
        res.status(500).json({ error: 'Failed to filter transactions' });
    }
};

// Get transaction details
exports.getTransactionDetails = async (req, res) => {
    const { walletAddress, transactionId } = req.params;

    if (!walletAddress || !transactionId) {
        return res.status(400).json({ error: 'Wallet address and transaction ID are required' });
    }

    try {
        // Forward to the transaction controller
        return transactionController.getTransactionDetails(req, res);
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
};

// Generate transaction receipt
exports.generateTransactionReceipt = async (req, res) => {
    const { walletAddress, transactionId } = req.params;

    if (!walletAddress || !transactionId) {
        return res.status(400).json({ error: 'Wallet address and transaction ID are required' });
    }

    try {
        // Forward to the transaction controller
        return transactionController.generateTransactionReceipt(req, res);
    } catch (error) {
        console.error('Error generating transaction receipt:', error);
        res.status(500).json({ error: 'Failed to generate transaction receipt' });
    }
};