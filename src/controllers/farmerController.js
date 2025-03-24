const supabase = require('../../supabase/supabaseClient');
const { mintRewardsOnChain } = require('../utils/tokenTransfers');
require('dotenv').config();
const transactionController = require('./transactionController');
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
                last_harvested: Date.now() // Store as Unix timestamp (milliseconds)
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

        // Record the farming reward transaction
        await transactionController.recordReward(
            walletAddress,
            'Farming',
            totalRewards,
            {
                farmersCount: farmers.length,
                farmerIds: farmers.map(farmer => farmer.id)
            }
        );

        // Update each farmer's last_harvested timestamp individually
        for (const farmer of updatedFarmers) {
            const { error: updateError } = await supabase
                .from('farmers')
                .update({ last_harvested: farmer.last_harvested })
                .eq('id', farmer.id);

            if (updateError) throw updateError;
        }

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

// Auto-merging level up function
const levelUpFarmer = async (req, res) => {
    const { walletAddress, farmerId } = req.body;

    if (!walletAddress || !farmerId) {
        return res.status(400).json({ error: 'Wallet address and farmer ID are required' });
    }

    try {
        // Get the selected farmer
        const { data: selectedFarmer, error: farmerError } = await supabase
            .from('farmers')
            .select('*')
            .eq('id', farmerId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (farmerError) throw farmerError;

        if (!selectedFarmer) {
            return res.status(404).json({ error: 'Farmer not found' });
        }

        // Check if the level is below 5 (max level)
        if (selectedFarmer.level >= 5) {
            return res.status(400).json({ error: 'Farmer is already at maximum level (5)' });
        }

        // Find other farmers of the same level
        const { data: sameLevelFarmers, error: farmersError } = await supabase
            .from('farmers')
            .select('*')
            .eq('level', selectedFarmer.level)
            .eq('owner_wallet', walletAddress)
            .neq('id', selectedFarmer.id); // Exclude the selected farmer

        if (farmersError) throw farmersError;

        // Check if we have enough farmers to merge (need at least 2 more)
        if (sameLevelFarmers.length >= 2) {
            // We have enough farmers to merge - take the first 2
            const farmersToMerge = sameLevelFarmers.slice(0, 2);
            const farmersToDeleteIds = farmersToMerge.map(farmer => farmer.id);

            const newLevel = selectedFarmer.level + 1;

            // Update the selected farmer's level
            const { data: updatedFarmer, error: updateError } = await supabase
                .from('farmers')
                .update({ level: newLevel })
                .eq('id', selectedFarmer.id)
                .select()
                .single();

            if (updateError) throw updateError;

            // Delete the other two farmers
            const { error: deleteError } = await supabase
                .from('farmers')
                .delete()
                .in('id', farmersToDeleteIds);

            if (deleteError) throw deleteError;

            // Calculate new yield with the increased level
            const newYield = calculateEffectiveYield(updatedFarmer);
            const oldYield = calculateEffectiveYield(selectedFarmer);

            return res.json({
                success: true,
                message: `Successfully merged 3 level ${selectedFarmer.level} farmers to create a level ${newLevel} farmer`,
                method: 'merge',
                farmer: {
                    ...updatedFarmer,
                    effectiveYield: newYield
                },
                yieldIncrease: newYield - oldYield,
                mergedFarmerIds: farmersToDeleteIds
            });
        }
        else {
            // Not enough farmers to merge
            const farmersNeeded = 2 - sameLevelFarmers.length;
            return res.status(400).json({
                error: `Not enough farmers to merge. You need ${farmersNeeded} more level ${selectedFarmer.level} farmer(s)`
            });
        }

    } catch (error) {
        console.error('Error with farmer level up:', error);
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