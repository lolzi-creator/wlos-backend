const supabase = require('../../supabase/supabaseClient');
const { mintRewardsOnChain } = require('../utils/tokenTransfers');
require('dotenv').config();

// Get all farmers for a wallet
const getFarmers = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get all farmers owned by the wallet
        const { data: farmers, error: farmersError } = await supabase
            .from('farmers')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (farmersError) throw farmersError;

        // Calculate yield and pending rewards
        let totalYieldPerHour = 0;
        let totalPendingRewards = 0;

        const farmersWithRewards = farmers.map(farmer => {
            // Calculate yield based on level and base yield
            const effectiveYield = calculateEffectiveYield(farmer);
            totalYieldPerHour += effectiveYield;

            // Calculate pending rewards
            const pendingRewards = calculatePendingRewards(farmer);
            totalPendingRewards += pendingRewards;

            return {
                ...farmer,
                effectiveYield,
                pendingRewards
            };
        });

        res.json({
            wallet: walletAddress,
            farmersOwned: farmers.length,
            totalYieldPerHour,
            pendingRewards: totalPendingRewards,
            farmers: farmersWithRewards
        });

    } catch (error) {
        console.error('Error fetching farmers:', error);
        res.status(500).json({ error: 'Failed to fetch farmers' });
    }
};

// Harvest all pending rewards
const harvestAll = async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get all farmers owned by the wallet
        const { data: farmers, error: farmersError } = await supabase
            .from('farmers')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (farmersError) throw farmersError;

        let totalRewards = 0;
        const updatedFarmers = [];

        // Calculate total rewards and prepare updates
        for (const farmer of farmers) {
            const rewards = calculatePendingRewards(farmer);
            totalRewards += rewards;

            updatedFarmers.push({
                id: farmer.id,
                last_harvested: new Date().toISOString()
            });
        }

        if (totalRewards <= 0) {
            return res.status(400).json({ error: 'No rewards available to harvest' });
        }

        // Mint rewards to the user
        const mintResult = await mintRewardsOnChain(walletAddress, totalRewards);

        if (!mintResult.success) {
            return res.status(500).json({
                error: 'Failed to mint rewards',
                details: mintResult.error
            });
        }

        // Update all farmers' last_harvested timestamp
        const { error: updateError } = await supabase
            .from('farmers')
            .upsert(updatedFarmers);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: `Successfully harvested ${totalRewards.toFixed(2)} WLOS from ${farmers.length} farmers`,
            transaction: mintResult.signature,
            harvested: totalRewards,
            farmersCount: farmers.length
        });

    } catch (error) {
        console.error('Error harvesting rewards:', error);
        res.status(500).json({ error: 'Failed to harvest rewards' });
    }
};

// Level up a farmer
const levelUpFarmer = async (req, res) => {
    const { walletAddress, farmerId } = req.body;

    if (!walletAddress || !farmerId) {
        return res.status(400).json({ error: 'Wallet address and farmer ID are required' });
    }

    try {
        // Get the farmer
        const { data: farmer, error: farmerError } = await supabase
            .from('farmers')
            .select('*')
            .eq('id', farmerId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (farmerError) throw farmerError;

        if (!farmer) {
            return res.status(404).json({ error: 'Farmer not found' });
        }

        // Calculate level up cost - increases with each level
        const levelUpCost = calculateLevelUpCost(farmer.level);

        // In a real implementation, you would check if the user has enough WLOS
        // and transfer the tokens for the level up cost
        // For now, we'll just simulate this

        // Update the farmer's level
        const newLevel = farmer.level + 1;
        const { data: updatedFarmer, error: updateError } = await supabase
            .from('farmers')
            .update({ level: newLevel })
            .eq('id', farmerId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Calculate new yield with the increased level
        const newYield = calculateEffectiveYield(updatedFarmer);

        res.json({
            success: true,
            message: `Successfully leveled up ${farmer.name} to level ${newLevel}`,
            farmer: {
                ...updatedFarmer,
                effectiveYield: newYield
            },
            cost: levelUpCost,
            yieldIncrease: newYield - calculateEffectiveYield(farmer)
        });

    } catch (error) {
        console.error('Error leveling up farmer:', error);
        res.status(500).json({ error: 'Failed to level up farmer' });
    }
};

// Helper Functions

// Calculate effective yield based on farmer level and base yield
function calculateEffectiveYield(farmer) {
    // Apply a 10% increase per level
    return farmer.base_yield_per_hour * (1 + (farmer.level - 1) * 0.1);
}

// Calculate pending rewards since last harvest
function calculatePendingRewards(farmer) {
    const lastHarvested = new Date(farmer.last_harvested);
    const currentTime = new Date();

    // Time difference in hours
    const hoursDiff = (currentTime - lastHarvested) / (1000 * 60 * 60);

    // Calculate rewards: yield per hour * hours elapsed
    return calculateEffectiveYield(farmer) * hoursDiff;
}

// Calculate cost to level up a farmer
function calculateLevelUpCost(currentLevel) {
    // Base cost is 50 WLOS, doubles with each level
    return 50 * Math.pow(2, currentLevel - 1);
}

module.exports = {
    getFarmers,
    harvestAll,
    levelUpFarmer
};