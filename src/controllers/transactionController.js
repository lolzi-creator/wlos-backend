// src/controllers/transactionController.js
const supabase = require('../../supabase/supabaseClient');
const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Get transactions for a wallet
exports.getTransactions = async (req, res) => {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startRow = (page - 1) * limit;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get transactions from our database
        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .or(`from_wallet.eq.${walletAddress},to_wallet.eq.${walletAddress}`)
            .order('timestamp', { ascending: false })
            .range(startRow, startRow + limit - 1);

        const { data, count, error } = await query;

        if (error) throw error;

        const transactions = data.map(tx => ({
            id: tx.id,
            type: tx.type,
            item: tx.item,
            amount: tx.from_wallet === walletAddress ? -tx.amount : tx.amount,
            token: tx.token,
            timestamp: tx.timestamp,
            status: tx.status,
            category: tx.category,
            hash: tx.hash,
            fee: tx.fee
        }));

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        res.json({
            transactions,
            pagination: {
                page,
                limit,
                totalItems: count,
                totalPages
            }
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// Filter transactions
exports.filterTransactions = async (req, res) => {
    const { walletAddress } = req.params;
    const { category, type, page = 1, limit = 10 } = req.body;
    const startRow = (page - 1) * limit;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Start with the base query
        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .or(`from_wallet.eq.${walletAddress},to_wallet.eq.${walletAddress}`);

        // Apply category filter if specified
        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        // Apply type filter if specified
        if (type && type !== 'all') {
            query = query.eq('type', type);
        }

        // Apply pagination and ordering
        query = query
            .order('timestamp', { ascending: false })
            .range(startRow, startRow + limit - 1);

        const { data, count, error } = await query;

        if (error) throw error;

        const transactions = data.map(tx => ({
            id: tx.id,
            type: tx.type,
            item: tx.item,
            amount: tx.from_wallet === walletAddress ? -tx.amount : tx.amount,
            token: tx.token,
            timestamp: tx.timestamp,
            status: tx.status,
            category: tx.category,
            hash: tx.hash,
            fee: tx.fee
        }));

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        res.json({
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalItems: count,
                totalPages
            },
            filters: {
                category,
                type
            }
        });

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
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_wallet.eq.${walletAddress},to_wallet.eq.${walletAddress}`)
            .eq('id', transactionId)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Format the transaction details
        const transaction = {
            id: data.id,
            type: data.type,
            item: data.item,
            amount: data.from_wallet === walletAddress ? -data.amount : data.amount,
            token: data.token,
            timestamp: data.timestamp,
            status: data.status,
            category: data.category,
            hash: data.hash,
            fee: data.fee,
            from: data.from_wallet,
            to: data.to_wallet,
            notes: data.notes,
            block: data.block,
            confirmations: data.confirmations,
            details: data.details || {}
        };

        res.json(transaction);

    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
};

// Create a transaction record
exports.createTransaction = async (req, res) => {
    const {
        type,
        item,
        amount,
        token,
        fromWallet,
        toWallet,
        status,
        category,
        hash,
        fee,
        notes,
        details
    } = req.body;

    if (!type || !amount || !token || (!fromWallet && !toWallet)) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: 'type, amount, token, and at least one of fromWallet or toWallet'
        });
    }

    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type,
                    item,
                    amount,
                    token,
                    from_wallet: fromWallet,
                    to_wallet: toWallet,
                    status: status || 'confirmed',
                    category: category || 'general',
                    hash,
                    fee: fee || 0,
                    timestamp: new Date(),
                    notes,
                    details
                }
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Transaction created successfully',
            transaction: data
        });

    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
};

// Generate a receipt for a transaction (placeholder for now)
exports.generateTransactionReceipt = async (req, res) => {
    const { walletAddress, transactionId } = req.params;

    if (!walletAddress || !transactionId) {
        return res.status(400).json({ error: 'Wallet address and transaction ID are required' });
    }

    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_wallet.eq.${walletAddress},to_wallet.eq.${walletAddress}`)
            .eq('id', transactionId)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // In a real implementation, you would generate a PDF receipt here
        // For now, we'll just return the transaction data as JSON
        res.json({
            receiptData: {
                id: data.id,
                type: data.type,
                item: data.item,
                amount: data.amount,
                token: data.token,
                timestamp: data.timestamp,
                status: data.status,
                category: data.category,
                hash: data.hash,
                from: data.from_wallet,
                to: data.to_wallet,
                fee: data.fee,
                notes: data.notes
            }
        });

    } catch (error) {
        console.error('Error generating transaction receipt:', error);
        res.status(500).json({ error: 'Failed to generate transaction receipt' });
    }
};

// Add functions to record common transaction types
exports.recordPurchase = async (fromWallet, item, amount, details = {}) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type: 'Purchase',
                    item,
                    amount,
                    token: 'WLOS',
                    from_wallet: fromWallet,
                    to_wallet: null, // Marketplace
                    status: 'confirmed',
                    category: 'Marketplace',
                    timestamp: new Date(),
                    fee: 0,
                    details
                }
            ]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error recording purchase transaction:', error);
        return { success: false, error };
    }
};

exports.recordStaking = async (fromWallet, poolName, amount, details = {}) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type: 'Staking',
                    item: `${poolName} Stake`,
                    amount,
                    token: 'WLOS',
                    from_wallet: fromWallet,
                    to_wallet: null, // Staking pool
                    status: 'confirmed',
                    category: 'Staking',
                    timestamp: new Date(),
                    fee: 0,
                    details
                }
            ]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error recording staking transaction:', error);
        return { success: false, error };
    }
};

exports.recordUnstaking = async (toWallet, poolName, amount, fee = 0, details = {}) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type: 'Unstaking',
                    item: `${poolName} Unstake`,
                    amount,
                    token: 'WLOS',
                    from_wallet: null, // Staking pool
                    to_wallet: toWallet,
                    status: 'confirmed',
                    category: 'Staking',
                    timestamp: new Date(),
                    fee,
                    details
                }
            ]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error recording unstaking transaction:', error);
        return { success: false, error };
    }
};

exports.recordReward = async (toWallet, rewardType, amount, details = {}) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type: `${rewardType} Reward`,
                    item: rewardType,
                    amount,
                    token: 'WLOS',
                    from_wallet: null, // System
                    to_wallet: toWallet,
                    status: 'confirmed',
                    category: rewardType === 'Staking' ? 'Staking' : 'Battle',
                    timestamp: new Date(),
                    fee: 0,
                    details
                }
            ]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error recording reward transaction:', error);
        return { success: false, error };
    }
};

exports.recordPackPurchase = async (fromWallet, packName, cost, details = {}) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type: 'Purchase',
                    item: packName,
                    amount: cost,
                    token: 'WLOS',
                    from_wallet: fromWallet,
                    to_wallet: null, // System
                    status: 'confirmed',
                    category: 'Pack',
                    timestamp: new Date(),
                    fee: 0,
                    details
                }
            ]);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error recording pack purchase transaction:', error);
        return { success: false, error };
    }
};

// Create a transaction record (internal helper function for other controllers)
exports.createTransactionRecord = async (transactionData) => {
    try {
        const {
            walletAddress,
            type,
            item,
            amount,
            token,
            fromWallet = null,
            toWallet = null,
            status = 'Completed',
            category = 'Marketplace',
            hash = null,
            fee = 0,
            description = '',
            metadata = {}
        } = transactionData;

        // Determine from/to wallet based on walletAddress if not explicitly provided
        const actualFromWallet = fromWallet || walletAddress;
        const actualToWallet = toWallet;

        const { data, error } = await supabase
            .from('transactions')
            .insert([
                {
                    type,
                    item,
                    amount,
                    token,
                    from_wallet: actualFromWallet,
                    to_wallet: actualToWallet,
                    status,
                    category,
                    hash,
                    fee,
                    timestamp: new Date(),
                    notes: description,
                    details: metadata
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error creating transaction record:', error);
        return { success: false, error };
    }
};