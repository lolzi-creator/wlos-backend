const supabase = require('../../supabase/supabaseClient');

// Get all assets for a wallet
exports.getAllAssets = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get heroes
        const { data: heroes, error: heroesError } = await supabase
            .from('heroes')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (heroesError) throw heroesError;

        // Get farmers
        const { data: farmers, error: farmersError } = await supabase
            .from('farmers')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (farmersError) throw farmersError;

        // Get items
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (itemsError) throw itemsError;

        res.json({
            wallet: walletAddress,
            heroes: heroes || [],
            farmers: farmers || [],
            items: items || []
        });

    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
};

// Get heroes for a wallet
exports.getHeroesByWallet = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        const { data, error } = await supabase
            .from('heroes')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (error) throw error;

        res.json({
            wallet: walletAddress,
            heroes: data || []
        });

    } catch (error) {
        console.error('Error fetching heroes:', error);
        res.status(500).json({ error: 'Failed to fetch heroes' });
    }
};

// Get farmers for a wallet
exports.getFarmersByWallet = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        const { data, error } = await supabase
            .from('farmers')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (error) throw error;

        res.json({
            wallet: walletAddress,
            farmers: data || []
        });

    } catch (error) {
        console.error('Error fetching farmers:', error);
        res.status(500).json({ error: 'Failed to fetch farmers' });
    }
};

// Get items for a wallet
exports.getItemsByWallet = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (error) throw error;

        res.json({
            wallet: walletAddress,
            items: data || []
        });

    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};