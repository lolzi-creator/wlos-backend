const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
    createMintToInstruction,
    getOrCreateAssociatedTokenAccount,
    getMint,
    TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');
require('dotenv').config();

// Load wallet from file
const walletSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const wallet = Keypair.fromSecretKey(walletSecretKey);
const walletAddress = wallet.publicKey.toString();

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Check if WLOS_TOKEN_MINT is properly loaded
const WLOS_MINT = process.env.WLOS_TOKEN_MINT;
console.log('Loaded environment variables:');
console.log('- WLOS_TOKEN_MINT:', WLOS_MINT || 'Not set');

if (!WLOS_MINT) {
    console.error('\nERROR: WLOS_TOKEN_MINT is not set in your .env file');
    console.log('Please create a token first using create-wlos-token.js');
    process.exit(1);
}

// Validate that it's a proper public key
try {
    const tokenMint = new PublicKey(WLOS_MINT);
    console.log('Valid token mint address:', tokenMint.toString());

    // Amount of WLOS to mint
    const amount = 50000; // Minting 100 WLOS tokens

    async function mintTokens() {
        try {
            console.log(`\nMinting ${amount} WLOS tokens to ${walletAddress}`);

            // Check if the wallet has enough SOL
            const solBalance = await connection.getBalance(wallet.publicKey);
            console.log(`Wallet SOL balance: ${solBalance / 1000000000} SOL`);

            if (solBalance < 10000000) {
                console.error('Not enough SOL to pay for transactions. Need at least 0.01 SOL');
                return;
            }

            // Get mint info to check if we have mint authority
            console.log('Checking mint authority...');
            const mintInfo = await getMint(connection, tokenMint);

            console.log(`Mint authority: ${mintInfo.mintAuthority?.toString()}`);
            console.log(`Your wallet: ${wallet.publicKey.toString()}`);

            if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(wallet.publicKey)) {
                console.error('This wallet does not have mint authority for the WLOS token');
                console.log('To mint tokens, you need to be the mint authority or use a token that you created');
                return;
            }

            // Get or create associated token account for the wallet
            console.log('Creating/finding token account...');
            const tokenAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                wallet,
                tokenMint,
                wallet.publicKey
            );

            console.log(`Token account: ${tokenAccount.address.toString()}`);

            // Create mint instruction
            const mintInstruction = createMintToInstruction(
                tokenMint,
                tokenAccount.address,
                wallet.publicKey,
                amount * (10 ** mintInfo.decimals)
            );

            // Create and send transaction
            const transaction = new Transaction().add(mintInstruction);

            console.log('Sending mint transaction...');
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [wallet]
            );

            console.log('Mint transaction successful!');
            console.log(`Transaction signature: ${signature}`);
            console.log(`${amount} WLOS tokens minted to ${walletAddress}`);

            // Check the new balance
            const tokenInfo = await connection.getParsedAccountInfo(tokenAccount.address);
            const tokenAmount = tokenInfo.value.data.parsed.info.tokenAmount.uiAmount;
            console.log(`New WLOS balance: ${tokenAmount}`);

        } catch (error) {
            console.error('Error minting tokens:', error);
            console.log('\nIf you see "This wallet does not have mint authority" error:');
            console.log('You need to create your own token first with this wallet as the mint authority.');
            console.log('Or you need to use a wallet that has mint authority for the WLOS token.');
        }
    }

    mintTokens();

} catch (error) {
    console.error('\nERROR: Invalid token mint address in your .env file');
    console.error('The value is not a valid Solana public key.');
    console.log('\nPlease create a new token first using create-wlos-token.js');
}