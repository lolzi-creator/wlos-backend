const { Connection, PublicKey } = require('@solana/web3.js');
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