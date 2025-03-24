const nacl = require('tweetnacl');
const bs58 = require('bs58');
const fs = require('fs');

// Load private key from file
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./mykey.json')));
const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);

// Message from backend
const message = 'Sign this message to confirm your identity: e5eddca4f937faaaae312a04fe40fe0c'; // replace with real one
const encodedMessage = new TextEncoder().encode(message);

// Sign it
const signature = nacl.sign.detached(encodedMessage, keypair.secretKey);

// ✅ Encode signature and public key to base58
const signatureBase58 = bs58.encode(Buffer.from(signature));
const publicKeyBase58 = bs58.encode(Buffer.from(keypair.publicKey));

console.log('Signature:', signatureBase58);
console.log('Wallet (pubkey):', publicKeyBase58);