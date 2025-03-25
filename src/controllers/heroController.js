const supabase = require('../../supabase/supabaseClient');
const { mintRewardsOnChain } = require('../utils/tokenTransfers');
require('dotenv').config();
const transactionController = require('./transactionController');

// Get all heroes for a wallet
const getHeroes = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get all heroes owned by the wallet
        const { data: heroes, error: heroesError } = await supabase
            .from('heroes')
            .select('*')
            .eq('owner_wallet', walletAddress);

        if (heroesError) throw heroesError;

        res.json({
            wallet: walletAddress,
            heroes: heroes || []
        });

    } catch (error) {
        console.error('Error fetching heroes:', error);
        res.status(500).json({ error: 'Failed to fetch heroes' });
    }
};

// Level up a hero
const levelUpHero = async (req, res) => {
    const { walletAddress, heroId } = req.body;

    if (!walletAddress || !heroId) {
        return res.status(400).json({ error: 'Wallet address and hero ID are required' });
    }

    try {
        // Get the selected hero
        const { data: selectedHero, error: heroError } = await supabase
            .from('heroes')
            .select('*')
            .eq('id', heroId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (heroError) throw heroError;

        if (!selectedHero) {
            return res.status(404).json({ error: 'Hero not found' });
        }

        // Check if the level is below 5 (max level)
        if (selectedHero.level >= 5) {
            return res.status(400).json({ error: 'Hero is already at maximum level (5)' });
        }

        // Calculate the cost to level up (similar to farmer level-up cost structure)
        const levelUpCost = 50 * Math.pow(2, selectedHero.level - 1);

        // Check if user has enough balance
        // This would be where you check their wallet balance
        // For now, just assume they have enough

        // Update the hero's level
        const newLevel = selectedHero.level + 1;

        // Calculate new power with 10% increase per level
        const newPower = selectedHero.power * (1 + 0.1); // 10% increase

        const { data: updatedHero, error: updateError } = await supabase
            .from('heroes')
            .update({
                level: newLevel,
                power: newPower
            })
            .eq('id', heroId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Record the transaction
        await transactionController.recordPurchase(
            walletAddress,
            `Level Up ${selectedHero.name}`,
            levelUpCost,
            {
                heroId: heroId,
                previousLevel: selectedHero.level,
                newLevel: newLevel
            }
        );

        res.json({
            success: true,
            message: `Successfully leveled up ${selectedHero.name} to level ${newLevel}`,
            hero: updatedHero,
            cost: levelUpCost
        });

    } catch (error) {
        console.error('Error with hero level up:', error);
        res.status(500).json({ error: 'Failed to level up hero' });
    }
};

// Equipment functionality

// Equip an item to a hero
const equipItem = async (req, res) => {
    const { walletAddress, heroId, itemId } = req.body;

    if (!walletAddress || !heroId || !itemId) {
        return res.status(400).json({ error: 'Wallet address, hero ID, and item ID are required' });
    }

    try {
        // Get the hero and item data
        const { data: hero, error: heroError } = await supabase
            .from('heroes')
            .select('*')
            .eq('id', heroId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (heroError) throw heroError;

        const { data: item, error: itemError } = await supabase
            .from('items')
            .select('*')
            .eq('id', itemId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (itemError) throw itemError;

        if (!hero || !item) {
            return res.status(404).json({ error: 'Hero or item not found' });
        }

        // Check if the item is already equipped to this hero
        const equippedItems = hero.equipped_items || [];
        if (equippedItems.includes(itemId)) {
            return res.status(400).json({ error: 'Item is already equipped to this hero' });
        }

        // Add the item to the hero's equipped items
        const updatedEquippedItems = [...equippedItems, itemId];

        // Calculate new power after equipping item
        // Assume the item gives a bonus based on its rarity and the hero's level
        const itemBonus = calculateItemBonus(item, hero.level);
        const newPower = hero.power + itemBonus;

        // Update the hero with the new equipped item and power
        const { data: updatedHero, error: updateError } = await supabase
            .from('heroes')
            .update({
                equipped_items: updatedEquippedItems,
                power: newPower
            })
            .eq('id', heroId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Update the item to mark it as equipped
        const { error: updateItemError } = await supabase
            .from('items')
            .update({
                equipped_to: heroId
            })
            .eq('id', itemId);

        if (updateItemError) throw updateItemError;

        res.json({
            success: true,
            message: `Successfully equipped ${item.name} to ${hero.name}`,
            hero: updatedHero,
            powerBonus: itemBonus
        });

    } catch (error) {
        console.error('Error equipping item:', error);
        res.status(500).json({ error: 'Failed to equip item' });
    }
};

// Unequip an item from a hero
const unequipItem = async (req, res) => {
    const { walletAddress, heroId, itemId } = req.body;

    if (!walletAddress || !heroId || !itemId) {
        return res.status(400).json({ error: 'Wallet address, hero ID, and item ID are required' });
    }

    try {
        // Get the hero and item data
        const { data: hero, error: heroError } = await supabase
            .from('heroes')
            .select('*')
            .eq('id', heroId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (heroError) throw heroError;

        const { data: item, error: itemError } = await supabase
            .from('items')
            .select('*')
            .eq('id', itemId)
            .eq('owner_wallet', walletAddress)
            .single();

        if (itemError) throw itemError;

        if (!hero || !item) {
            return res.status(404).json({ error: 'Hero or item not found' });
        }

        // Check if the item is equipped to this hero
        const equippedItems = hero.equipped_items || [];
        if (!equippedItems.includes(itemId)) {
            return res.status(400).json({ error: 'Item is not equipped to this hero' });
        }

        // Remove the item from the hero's equipped items
        const updatedEquippedItems = equippedItems.filter(id => id !== itemId);

        // Calculate new power after unequipping item
        const itemBonus = calculateItemBonus(item, hero.level);
        const newPower = hero.power - itemBonus;

        // Update the hero with the new equipped items and power
        const { data: updatedHero, error: updateError } = await supabase
            .from('heroes')
            .update({
                equipped_items: updatedEquippedItems,
                power: newPower
            })
            .eq('id', heroId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Update the item to mark it as not equipped
        const { error: updateItemError } = await supabase
            .from('items')
            .update({
                equipped_to: null
            })
            .eq('id', itemId);

        if (updateItemError) throw updateItemError;

        res.json({
            success: true,
            message: `Successfully unequipped ${item.name} from ${hero.name}`,
            hero: updatedHero
        });

    } catch (error) {
        console.error('Error unequipping item:', error);
        res.status(500).json({ error: 'Failed to unequip item' });
    }
};

// Helper function to calculate item bonus based on rarity and hero level
function calculateItemBonus(item, heroLevel) {
    // Base bonus based on rarity
    const rarityMultiplier = {
        'common': 1,
        'uncommon': 1.5,
        'rare': 2,
        'epic': 3,
        'legendary': 5
    };

    // Scale with hero level
    const levelMultiplier = 1 + (heroLevel - 1) * 0.2; // 20% increase per level

    // Use the item's bonus value, or a default based on rarity
    const baseBonus = item.bonus || (item.rarity === 'legendary' ? 25 :
        item.rarity === 'epic' ? 15 :
            item.rarity === 'rare' ? 10 :
                item.rarity === 'uncommon' ? 5 : 2);

    return baseBonus * (rarityMultiplier[item.rarity] || 1) * levelMultiplier;
}

module.exports = {
    getHeroes,
    levelUpHero,
    equipItem,
    unequipItem
};