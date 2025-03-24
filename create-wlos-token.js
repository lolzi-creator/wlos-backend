const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo
} = require('@solana/spl-token');
const fs = require('fs');
require('dotenv').config();

// Load wallet from file
const walletSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const wallet = Keypair.fromSecretKey(walletSecretKey);
const walletAddress = wallet.publicKey.toString();

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Token decimals - 9 is standard for most tokens
const TOKEN_DECIMALS = 9;

async function createToken() {
    try {
        console.log(`Creating new WLOS token with ${walletAddress} as mint authority`);

        // Check if the wallet has enough SOL
        const solBalance = await connection.getBalance(wallet.publicKey);
        console.log(`Wallet SOL balance: ${solBalance / 1000000000} SOL`);

        if (solBalance < 10000000) {
            console.error('Not enough SOL to pay for transactions. Need at least 0.01 SOL');
            return;
        }

        // Create new token mint
        console.log('Creating token mint...');
        const tokenMint = await createMint(
            connection,
            wallet,                // Payer
            wallet.publicKey,      // Mint authority
            wallet.publicKey,      // Freeze authority (you can set to null if not needed)
            TOKEN_DECIMALS
        );

        console.log(`Token created successfully!`);
        console.log(`Token mint address: ${tokenMint.toString()}`);

        // Create associated token account for the owner
        console.log('Creating token account...');
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet,
            tokenMint,
            wallet.publicKey
        );

        console.log(`Token account: ${tokenAccount.address.toString()}`);

        // Mint some tokens to the owner
        const mintAmount = 1000; // Initial supply of 1000 tokens
        console.log(`Minting ${mintAmount} tokens to your wallet...`);

        const mintSignature = await mintTo(
            connection,
            wallet,
            tokenMint,
            tokenAccount.address,
            wallet.publicKey,
            mintAmount * (10 ** TOKEN_DECIMALS)
        );

        console.log(`Mint successful! Transaction signature: ${mintSignature}`);

        // Save the new token mint address to .env
        const envPath = './.env';
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Replace the existing WLOS_TOKEN_MINT or add a new one
        if (envContent.includes('WLOS_TOKEN_MINT=')) {
            envContent = envContent.replace(
                /WLOS_TOKEN_MINT=.*/,
                `WLOS_TOKEN_MINT=${tokenMint.toString()}`
            );
        } else {
            envContent += `\nWLOS_TOKEN_MINT=${tokenMint.toString()}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`Updated .env file with new token mint address`);

        console.log('\n=== SUMMARY ===');
        console.log(`New WLOS token created: ${tokenMint.toString()}`);
        console.log(`Token decimals: ${TOKEN_DECIMALS}`);
        console.log(`Initial supply: ${mintAmount} WLOS`);
        console.log(`Mint authority: ${walletAddress}`);
        console.log(`Your token account: ${tokenAccount.address.toString()}`);
        console.log('');
        console.log('IMPORTANT: Your .env file has been updated with the new token mint address.');
        console.log('You need to restart your server for the changes to take effect.');
        console.log('');
        console.log(`After restarting, check your balance with: node check-api-balance.js`);

    } catch (error) {
        console.error('Error creating token:', error);
    }
}

createToken();