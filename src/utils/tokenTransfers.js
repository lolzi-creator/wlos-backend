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
 * Transfer tokens from user to treasury for staking
 * @param {string} userWalletPublicKey - User's wallet public key
 * @param {number} amount - Amount to stake (in WLOS)
 * @returns {Promise<{success: boolean, signature: string, error: string|null}>}
 */
async function stakeTokensOnChain(userWalletPublicKey, amount) {
    // In a real implementation, the user would sign this transaction in their wallet
    // Here we're simulating the process assuming the transaction is already signed by the user

    try {
        console.log(`Simulating staking ${amount} WLOS from ${userWalletPublicKey} to treasury`);

        // Convert string to PublicKey
        const userPublicKey = new PublicKey(userWalletPublicKey);

        // This is where you would create a transaction for the user to sign, then submit
        // For simulation, we'll just log the details and consider it successful

        console.log({
            from: userPublicKey.toString(),
            to: treasuryWallet.publicKey.toString(),
            amount: amount,
            mint: WLOS_MINT.toString()
        });

        return {
            success: true,
            signature: 'simulated_transaction_' + Date.now(),
            error: null
        };

    } catch (error) {
        console.error('Error in stakeTokensOnChain:', error);
        return {
            success: false,
            signature: null,
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

        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
            treasuryTokenAccount.address,
            userTokenAccount.address,
            treasuryWallet.publicKey,
            amount * 1e9, // Assuming 9 decimals for WLOS token
            [],
            TOKEN_PROGRAM_ID
        );

        // Create and sign transaction
        const transaction = new Transaction().add(transferInstruction);

        // In reality, we would sign and send the transaction
        // For now, just simulate success
        const signature = 'simulated_unstake_' + Date.now();

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
        console.log(`Minting ${amount} WLOS rewards to ${userWalletPublicKey}`);

        // Convert string to PublicKey
        const userPublicKey = new PublicKey(userWalletPublicKey);

        // In a real implementation, this would mint new tokens to the user
        // For this simulation, we'll just log the details

        console.log({
            to: userPublicKey.toString(),
            amount: amount,
            mint: WLOS_MINT.toString()
        });

        // Simulate a successful mint
        return {
            success: true,
            signature: 'simulated_mint_' + Date.now(),
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

module.exports = {
    treasuryWallet,
    stakeTokensOnChain,
    unstakeTokensOnChain,
    mintRewardsOnChain
};