const axios = require('axios');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
require('dotenv').config();

// Load wallet from file
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const keypair = Keypair.fromSecretKey(secretKey);
const walletAddress = keypair.publicKey.toString();

// API endpoint
const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}`;

async function checkAPIBalance() {
    try {
        console.log(`Checking balance from API for wallet: ${walletAddress}`);
        console.log(`Using API at: ${API_URL}`);
        console.log(`Using WLOS token mint: ${process.env.WLOS_TOKEN_MINT}`);

        const response = await axios.get(`${API_URL}/wallet/balance/${walletAddress}`);

        console.log('\n=== API Response ===');
        console.log(`SOL Balance: ${response.data.sol} SOL`);
        console.log(`WLOS Balance: ${response.data.wlos} WLOS`);

        if (response.data.wlos > 0) {
            console.log('\n✅ SUCCESS! Your wallet has WLOS tokens and they are showing correctly in the API.');
        } else {
            console.log('\n⚠️ Your wallet has 0 WLOS tokens. If you just minted tokens, make sure:');
            console.log('  1. Your server is using the correct WLOS_TOKEN_MINT in the .env file');
            console.log('  2. You restarted your server after updating the .env file');
        }

    } catch (error) {
        console.error('Error checking API balance:', error.response?.data || error.message);
        console.log('Make sure your server is running at http://localhost:3000');
    }
}

checkAPIBalance();