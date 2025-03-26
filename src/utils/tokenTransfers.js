const {
    Connection,
    PublicKey,
    Transaction,
    Keypair,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
    createTransferInstruction,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const bs58 = require('bs58');
const fs = require('fs');
require('dotenv').config();

// Initialize connection to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// WLOS token mint from .env
const WLOS_MINT = new PublicKey(process.env.WLOS_TOKEN_MINT);

// Load treasury wallet (for staking)
// This will be a wallet controlled by your backend that holds staked tokens
let treasuryWallet;
try {
    // If you have a JSON key file
    if (fs.existsSync('./treasury-wallet.json')) {
        const treasurySecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./treasury-wallet.json')));
        treasuryWallet = Keypair.fromSecretKey(treasurySecretKey);
    }
    // If you have a base58 encoded private key in .env
    else if (process.env.TREASURY_PRIVATE_KEY) {
        const treasurySecretKey = bs58.decode(process.env.TREASURY_PRIVATE_KEY);
        treasuryWallet = Keypair.fromSecretKey(treasurySecretKey);
    }
    else {
        console.warn('No treasury wallet found. Creating a new one for testing purposes.');
        treasuryWallet = Keypair.generate();

        // Save the wallet for future use
        fs.writeFileSync('./treasury-wallet.json', JSON.stringify(Array.from(treasuryWallet.secretKey)));

        console.log('Treasury wallet created: ', treasuryWallet.publicKey.toString());
        console.log('IMPORTANT: This is a testing wallet. In production, you should use a secure wallet.');
    }
} catch (err) {
    console.error('Error loading treasury wallet:', err);
    // Fallback to a new wallet for testing
    treasuryWallet = Keypair.generate();
}

/**
 * Create a transaction for the user to stake tokens
 * @param {string} userWalletPublicKey - User's wallet public key
 * @param {number} amount - Amount to stake (in WLOS)
 * @returns {Promise<{success: boolean, transaction: string, error: string|null}>}
 */
async function stakeTokensOnChain(userWalletPublicKey, amount) {
    try {
        console.log(`Creating staking transaction for ${amount} WLOS from ${userWalletPublicKey} to treasury`);

        // Convert string to PublicKey
        const userPublicKey = new PublicKey(userWalletPublicKey);

        // Get or create associated token accounts for user and treasury
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet, // Payer for account creation if needed
            WLOS_MINT,
            userPublicKey
        );

        const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet,
            WLOS_MINT,
            treasuryWallet.publicKey
        );

        // Convert amount to the right decimal precision (assuming 9 decimals)
        const transferAmount = Math.floor(amount * 1e9);

        // Create transfer instruction
        // Note: This requires the USER's signature, not the treasury
        const transferInstruction = createTransferInstruction(
            userTokenAccount.address,
            treasuryTokenAccount.address,
            userPublicKey, // The user must sign this
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        // Create transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Set the recent blockhash and fee payer
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = userPublicKey;
        
        // Serialize the transaction to a Buffer
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false, // We don't have all signatures yet
            verifySignatures: false
        });
        
        // Convert to base64 for easy transport to frontend
        const base64Transaction = serializedTransaction.toString('base64');

        console.log({
            from: userPublicKey.toString(),
            to: treasuryWallet.publicKey.toString(),
            amount: amount,
            transaction: base64Transaction.slice(0, 20) + '...' // Truncated for logging
        });

        return {
            success: true,
            transaction: base64Transaction,
            error: null
        };

    } catch (error) {
        console.error('Error in stakeTokensOnChain:', error);
        return {
            success: false,
            transaction: null,
            error: error.message
        };
    }
}

/**
 * Transfer tokens from treasury to user when unstaking
 * @param {string} userWalletPublicKey - User's wallet public key
 * @param {number} amount - Amount to unstake (in WLOS)
 * @returns {Promise<{success: boolean, signature: string, error: string|null}>}
 */
async function unstakeTokensOnChain(userWalletPublicKey, amount) {
    try {
        console.log(`Transferring ${amount} WLOS from treasury to ${userWalletPublicKey}`);

        // Convert string to PublicKey
        const userPublicKey = new PublicKey(userWalletPublicKey);

        // Get or create associated token accounts for treasury and user
        const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet,
            WLOS_MINT,
            treasuryWallet.publicKey
        );

        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet, // Payer for creating the account if needed
            WLOS_MINT,
            userPublicKey
        );

        // Convert amount to the right decimal precision (assuming 9 decimals)
        const transferAmount = Math.floor(amount * 1e9);

        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
            treasuryTokenAccount.address,
            userTokenAccount.address,
            treasuryWallet.publicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        // Create and sign transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Send and confirm the transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [treasuryWallet]
        );

        console.log({
            from: treasuryWallet.publicKey.toString(),
            to: userPublicKey.toString(),
            amount: amount,
            signature: signature
        });

        return {
            success: true,
            signature: signature,
            error: null
        };

    } catch (error) {
        console.error('Error in unstakeTokensOnChain:', error);
        return {
            success: false,
            signature: null,
            error: error.message
        };
    }
}

/**
 * Mint reward tokens to the user
 * @param {string} userWalletPublicKey - User's wallet public key
 * @param {number} amount - Amount of rewards to mint (in WLOS)
 * @returns {Promise<{success: boolean, signature: string, error: string|null}>}
 */
async function mintRewardsOnChain(userWalletPublicKey, amount) {
    try {
        console.log(`Transferring ${amount} WLOS rewards to ${userWalletPublicKey} from treasury`);

        // Convert string to PublicKey
        const userPublicKey = new PublicKey(userWalletPublicKey);
        
        // Get or create associated token accounts for treasury and user
        const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet,
            WLOS_MINT,
            treasuryWallet.publicKey
        );

        const userTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryWallet, // Payer for creating the account if needed
            WLOS_MINT,
            userPublicKey
        );
        
        // Convert amount to the right decimal precision (assuming 9 decimals)
        const transferAmount = Math.floor(amount * 1e9);
        
        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
            treasuryTokenAccount.address,
            userTokenAccount.address,
            treasuryWallet.publicKey,
            transferAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        // Create and sign transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Actually send the transaction
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [treasuryWallet]
        );

        console.log({
            from: treasuryWallet.publicKey.toString(),
            to: userPublicKey.toString(),
            amount: amount,
            signature: signature
        });

        return {
            success: true,
            signature: signature,
            error: null
        };

    } catch (error) {
        console.error('Error in mintRewardsOnChain:', error);
        return {
            success: false,
            signature: null,
            error: error.message
        };
    }
}

/**
 * Process a signed staking transaction from the user
 * @param {string} signedTransaction - Base64 encoded signed transaction
 * @returns {Promise<{success: boolean, signature: string, error: string|null}>}
 */
async function processSignedStakingTransaction(signedTransaction) {
    try {
        console.log('Processing signed staking transaction');

        // Convert base64 string back to Buffer and deserialize
        const transactionBuffer = Buffer.from(signedTransaction, 'base64');
        const transaction = Transaction.from(transactionBuffer);
        
        // Send the signed transaction to the Solana network
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [] // No additional signers needed, user already signed
        );
        
        console.log('Staking transaction confirmed with signature:', signature);
        
        return {
            success: true,
            signature: signature,
            error: null
        };
    } catch (error) {
        console.error('Error processing signed staking transaction:', error);
        return {
            success: false,
            signature: null,
            error: error.message
        };
    }
}

module.exports = {
    treasuryWallet,
    stakeTokensOnChain,
    unstakeTokensOnChain,
    mintRewardsOnChain,
    processSignedStakingTransaction
};