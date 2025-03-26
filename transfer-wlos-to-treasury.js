/**
 * Script to transfer WLOS tokens from wallet.json to treasury-wallet.json on Solana devnet
 * 
 * Usage: 
 * node scripts/transfer-wlos-to-treasury.js <amount>
 * 
 * Example:
 * node scripts/transfer-wlos-to-treasury.js 10000
 */

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getOrCreateAssociatedTokenAccount, getMint, getAccount, transfer } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Mint address for WLOS token on devnet
// Update this if your token has a different mint address
const WLOS_MINT_ADDRESS = '4pwwVo6H1j3b4TJaAEfi6oNfoDUpTDXMfWcvtp8TNHJN';

// Parse command line arguments
const amount = process.argv[2] ? parseFloat(process.argv[2]) : 10000;

if (isNaN(amount) || amount <= 0) {
  console.error('Please provide a valid positive amount to transfer');
  process.exit(1);
}

async function main() {
  try {
    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallets
    console.log('Loading wallet keypairs...');
    
    // Source wallet (regular wallet)
    let sourceWallet;
    try {
      const walletPath = path.resolve(process.cwd(), 'wallet.json');
      const walletKeyData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      sourceWallet = Keypair.fromSecretKey(new Uint8Array(walletKeyData));
      console.log(`Source wallet loaded: ${sourceWallet.publicKey.toString()}`);
    } catch (error) {
      console.error('Error loading source wallet.json:', error.message);
      process.exit(1);
    }
    
    // Treasury wallet
    let treasuryWallet;
    try {
      const treasuryPath = path.resolve(process.cwd(), 'treasury-wallet.json');
      const treasuryKeyData = JSON.parse(fs.readFileSync(treasuryPath, 'utf-8'));
      treasuryWallet = Keypair.fromSecretKey(new Uint8Array(treasuryKeyData));
      console.log(`Treasury wallet loaded: ${treasuryWallet.publicKey.toString()}`);
    } catch (error) {
      console.error('Error loading treasury-wallet.json:', error.message);
      process.exit(1);
    }
    
    // Check if source wallet has enough SOL
    const walletBalance = await connection.getBalance(sourceWallet.publicKey);
    console.log(`Source wallet SOL balance: ${walletBalance / 1000000000} SOL`);
    
    if (walletBalance < 10000000) {
      console.log('Source wallet has low SOL. Requesting airdrop...');
      
      try {
        const airdropSignature = await connection.requestAirdrop(
          sourceWallet.publicKey,
          1000000000 // 1 SOL
        );
        await connection.confirmTransaction(airdropSignature);
        console.log('Airdrop successful!');
      } catch (error) {
        console.warn('Airdrop failed, but continuing with transfer attempt:', error.message);
      }
    }
    
    // Get the token mint info
    const mintPublicKey = new PublicKey(WLOS_MINT_ADDRESS);
    const mintInfo = await getMint(connection, mintPublicKey);
    console.log(`Token decimals: ${mintInfo.decimals}`);
    
    // Get or create source token account
    let sourceTokenAccount;
    try {
      sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        sourceWallet,
        mintPublicKey,
        sourceWallet.publicKey
      );
      console.log(`Source token account: ${sourceTokenAccount.address.toString()}`);
    } catch (error) {
      console.error('Error getting source token account:', error.message);
      process.exit(1);
    }
    
    // Get or create treasury token account
    let treasuryTokenAccount;
    try {
      treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        sourceWallet, // Payer
        mintPublicKey,
        treasuryWallet.publicKey
      );
      console.log(`Treasury token account: ${treasuryTokenAccount.address.toString()}`);
    } catch (error) {
      console.error('Error getting treasury token account:', error.message);
      process.exit(1);
    }
    
    // Check token balance
    try {
      const tokenAccountInfo = await getAccount(connection, sourceTokenAccount.address);
      const currentBalance = Number(tokenAccountInfo.amount) / (10 ** mintInfo.decimals);
      console.log(`Source wallet WLOS balance: ${currentBalance} WLOS`);
      
      if (currentBalance < amount) {
        console.error(`Error: Source wallet only has ${currentBalance} WLOS, but attempting to transfer ${amount} WLOS`);
        console.log('You may need to mint tokens to this wallet first');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error checking token balance:', error.message);
      process.exit(1);
    }
    
    // Transfer tokens
    console.log(`Transferring ${amount} WLOS from wallet to treasury...`);
    
    try {
      // We need to convert the amount to token units based on decimals
      const adjustedAmount = BigInt(Math.floor(amount * (10 ** mintInfo.decimals)));
      
      const transferTx = await transfer(
        connection,
        sourceWallet, // Payer
        sourceTokenAccount.address,
        treasuryTokenAccount.address,
        sourceWallet.publicKey,
        adjustedAmount
      );
      
      console.log(`Transfer successful! Transaction signature: ${transferTx}`);
      console.log(`https://explorer.solana.com/tx/${transferTx}?cluster=devnet`);
      
      // Verify treasury balance
      const treasuryTokenAccountInfo = await getAccount(connection, treasuryTokenAccount.address);
      const treasuryBalance = Number(treasuryTokenAccountInfo.amount) / (10 ** mintInfo.decimals);
      console.log(`Treasury WLOS balance after transfer: ${treasuryBalance} WLOS`);
      
    } catch (error) {
      console.error('Error during transfer:', error.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

main(); 