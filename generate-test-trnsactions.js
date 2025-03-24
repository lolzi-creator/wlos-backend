// generate-test-transactions.js
const supabase = require('./supabase/supabaseClient');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const bs58 = require('bs58');
require('dotenv').config();

// Load wallet from file
const walletSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const wallet = Keypair.fromSecretKey(walletSecretKey);
const walletAddress = wallet.publicKey.toString();

async function createRandomTransactionHash() {
    // Generate a random transaction hash
    const randomBytes = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256)));
    return bs58.encode(randomBytes);
}

async function generateTestTransactions() {
    console.log(`Generating test transactions for wallet: ${walletAddress}`);

    try {
        // Check if transactions table exists
        const { data: tableExists, error: tableCheckError } = await supabase
            .from('transactions')
            .select('id')
            .limit(1);

        // If we get an error like "relation does not exist", create the table
        if (tableCheckError) {
            console.log('Transactions table does not exist. Creating it...');

            // Create the transactions table
            const { error: createTableError } = await supabase.rpc('create_transactions_table');

            if (createTableError) {
                // If the RPC function doesn't exist, we'll provide SQL to create the table
                console.error('Failed to create table via RPC. Please create the table manually:');
                console.log(`
                CREATE TABLE transactions (
                    id SERIAL PRIMARY KEY,
                    type TEXT NOT NULL,
                    item TEXT,
                    amount NUMERIC NOT NULL,
                    token TEXT NOT NULL,
                    from_wallet TEXT,
                    to_wallet TEXT,
                    status TEXT NOT NULL,
                    category TEXT NOT NULL,
                    hash TEXT,
                    fee NUMERIC,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    notes TEXT,
                    details JSONB,
                    block INTEGER,
                    confirmations INTEGER
                );
                
                CREATE INDEX transactions_from_wallet_idx ON transactions(from_wallet);
                CREATE INDEX transactions_to_wallet_idx ON transactions(to_wallet);
                CREATE INDEX transactions_timestamp_idx ON transactions(timestamp);
                `);
                return;
            }

            console.log('Transactions table created successfully!');
        }

        // Sample transaction types for diversity
        const transactionTypes = [
            { type: 'Purchase', category: 'Marketplace', fee: 0.000005 },
            { type: 'Staking', category: 'Staking', fee: 0.000005 },
            { type: 'Unstaking', category: 'Staking', fee: 0.000005 },
            { type: 'Staking Reward', category: 'Staking', fee: 0 },
            { type: 'Battle Reward', category: 'Battle', fee: 0 },
            { type: 'Swap', category: 'Wallet', fee: 0.000008 }
        ];

        // Sample items
        const items = [
            { name: 'Quantum Shield', amount: 240, token: 'WLOS' },
            { name: 'Neural Amplifier', amount: 185, token: 'WLOS' },
            { name: 'Void Disruptor', amount: 320, token: 'WLOS' },
            { name: 'Energy Matrix', amount: 95, token: 'WLOS' },
            { name: 'Victory Bonus', amount: 35, token: 'WLOS' },
            { name: 'Knight Pool', amount: 500, token: 'WLOS' },
            { name: 'Warrior Pool', amount: 100, token: 'WLOS' },
            { name: 'Premium Pack', amount: 300, token: 'WLOS' },
            { name: 'SOL to WLOS', amount: 1240, token: 'WLOS' }
        ];

        // Generate 20 random transactions
        const transactions = [];

        for (let i = 0; i < 20; i++) {
            const txType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
            const item = items[Math.floor(Math.random() * items.length)];
            const timestamp = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000); // Random date within last 30 days
            const hash = await createRandomTransactionHash();

            // Determine from_wallet and to_wallet based on transaction type
            let fromWallet = null;
            let toWallet = null;
            let amount = item.amount;

            if (txType.type === 'Purchase' || txType.type === 'Staking') {
                fromWallet = walletAddress;
            } else if (txType.type === 'Unstaking' || txType.type === 'Staking Reward' || txType.type === 'Battle Reward') {
                toWallet = walletAddress;
            } else if (txType.type === 'Swap') {
                if (Math.random() > 0.5) {
                    fromWallet = walletAddress;
                } else {
                    toWallet = walletAddress;
                    amount = -amount; // Negative for outgoing
                }
            }

            transactions.push({
                type: txType.type,
                item: item.name,
                amount: amount,
                token: item.token,
                from_wallet: fromWallet,
                to_wallet: toWallet,
                status: Math.random() > 0.1 ? 'confirmed' : (Math.random() > 0.5 ? 'pending' : 'failed'),
                category: txType.category,
                hash: hash,
                fee: txType.fee,
                timestamp: timestamp,
                notes: `Sample ${txType.type.toLowerCase()} transaction`,
                details: {},
                block: Math.floor(Math.random() * 1000000) + 100000000,
                confirmations: Math.floor(Math.random() * 1000) + 1
            });
        }

        // Insert transactions
        const { data, error } = await supabase
            .from('transactions')
            .insert(transactions);

        if (error) {
            console.error('Error inserting transactions:', error);
            return;
        }

        console.log(`Successfully generated ${transactions.length} sample transactions!`);
        console.log('\nYou can now test the transaction endpoints:');
        console.log(`http://localhost:3000/wallet/transactions/${walletAddress}`);
        console.log(`http://localhost:3000/transactions/${walletAddress}`);

    } catch (error) {
        console.error('Error generating test transactions:', error);
    }
}

generateTestTransactions();