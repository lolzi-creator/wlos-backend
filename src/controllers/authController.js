const supabase = require('../../supabase/supabaseClient');
const { randomBytes } = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// Connect wallet - create user if not exists
exports.connectWallet = async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet', walletAddress)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        return res.status(500).json({ error: 'Error checking wallet' });
    }

    if (!existingUser) {
        const { error: insertError } = await supabase
            .from('users')
            .insert([{ wallet: walletAddress }]);

        if (insertError) {
            return res.status(500).json({ error: 'Error creating user' });
        }

        return res.json({ message: 'Wallet connected & user created', wallet: walletAddress });
    }

    res.json({ message: 'Wallet connected', wallet: walletAddress });
};

// Generate message for signature (with nonce)
exports.getNonceMessage = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Missing wallet address' });
    }

    const nonce = randomBytes(16).toString('hex');
    const message = `Sign this message to confirm your identity: ${nonce}`;

    const { error } = await supabase
        .from('users')
        .update({ nonce })
        .eq('wallet', walletAddress);

    if (error) {
        return res.status(500).json({ error: 'Could not save nonce' });
    }

    res.json({ message });
};

// Verify signed message
exports.verifySignature = async (req, res) => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
        return res.status(400).json({ error: 'Missing data' });
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('nonce')
        .eq('wallet', walletAddress)
        .single();

    if (error || !user?.nonce) {
        return res.status(400).json({ error: 'User or nonce not found' });
    }

    const message = `Sign this message to confirm your identity: ${user.nonce}`;

    const isValid = nacl.sign.detached.verify(
        new TextEncoder().encode(message),
        bs58.decode(signature),
        bs58.decode(walletAddress)
    );

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    await supabase.from('users').update({ nonce: null }).eq('wallet', walletAddress);

    res.json({ message: 'Signature verified', wallet: walletAddress });
};