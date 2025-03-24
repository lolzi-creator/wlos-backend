const supabase = require('../../supabase/supabaseClient');
const { Connection, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com');

// WLOS token mint
const WLOS_MINT = process.env.WLOS_TOKEN_MINT;

// Get available pack types
const getPackTypes = async (req, res) => {
    const { assetType } = req.query; // 'hero' or 'farmer'

    try {
        let query = supabase.from('pack_types').select('*');

        // Filter by asset type if provided
        if (assetType) {
            query = query.eq('asset_type', assetType);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Format the data to match frontend expectations
        const formattedPacks = data.map(pack => ({
            id: pack.pack_id,
            name: pack.name,
            description: pack.description,
            cost: pack.price,
            imageSrc: pack.image_src,
            assetType: pack.asset_type,
            rarityChances: {
                common: pack.common_chance,
                rare: pack.rare_chance,
                epic: pack.epic_chance,
                legendary: pack.legendary_chance
            }
        }));

        res.json({
            packTypes: formattedPacks
        });
    } catch (error) {
        console.error('Error fetching pack types:', error);
        res.status(500).json({ error: 'Failed to fetch pack types' });
    }
};

// Buy a pack
const buyPack = async (req, res) => {
    const { walletAddress, packId, assetType } = req.body;

    if (!walletAddress || !packId) {
        return res.status(400).json({ error: 'Wallet address and pack ID are required' });
    }

    try {
        // Get pack details from pack_types table
        const { data: packTypeData, error: packTypeError } = await supabase
            .from('pack_types')
            .select('*')
            .eq('pack_id', packId)
            .eq('asset_type', assetType || 'hero') // Default to hero if not specified
            .single();

        if (packTypeError) throw packTypeError;
        if (!packTypeData) {
            return res.status(404).json({ error: 'Pack type not found' });
        }

        const packPrice = packTypeData.price;

        // If pack is free, skip balance check
        if (packPrice > 0) {
            // Check if user has enough WLOS tokens
            try {
                const publicKey = new PublicKey(walletAddress);
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    mint: new PublicKey(WLOS_MINT),
                });

                let wlosBalance = 0;

                if (tokenAccounts?.value?.length > 0) {
                    wlosBalance = parseFloat(
                        tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
                    );
                }

                if (wlosBalance < packPrice) {
                    return res.status(400).json({
                        error: 'Not enough WLOS tokens to buy this pack',
                        required: packPrice,
                        balance: wlosBalance
                    });
                }
            } catch (err) {
                console.error('Error checking token balance:', err);
                res.status(500).json({ error: 'Failed to check token balance' });
                return;
            }
        }

        // Insert the purchased pack into the packs table
        const { data: packData, error: packError } = await supabase
            .from('packs')
            .insert([
                {
                    pack_type_id: packTypeData.id,
                    pack_id: packId,
                    owner_wallet: walletAddress,
                    opened: false
                }
            ])
            .select()
            .single();

        if (packError) throw packError;

        // Format the response to match frontend expectations
        const purchasedPack = {
            id: packData.id,
            packId: packData.pack_id,
            packTypeId: packData.pack_type_id,
            assetType: packTypeData.asset_type,
            name: packTypeData.name,
            description: packTypeData.description,
            cost: packTypeData.price,
            imageSrc: packTypeData.image_src,
            purchased: packData.created_at,
            opened: packData.opened
        };

        res.json({
            success: true,
            message: `Successfully purchased ${packTypeData.name}`,
            pack: purchasedPack
        });

    } catch (error) {
        console.error('Error buying pack:', error);
        res.status(500).json({ error: 'Failed to buy pack' });
    }
};

// Get unopened packs for a wallet
const getPackInventory = async (req, res) => {
    const { walletAddress } = req.params;
    const { assetType } = req.query; // Optional filter by 'hero' or 'farmer'

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get all unopened packs with their pack types
        let query = supabase
            .from('packs')
            .select(`
                *,
                pack_types (*)
            `)
            .eq('owner_wallet', walletAddress)
            .eq('opened', false);

        const { data, error } = await query;

        if (error) throw error;

        // Filter by asset type if provided
        let filteredPacks = data;
        if (assetType) {
            filteredPacks = data.filter(pack => pack.pack_types.asset_type === assetType);
        }

        // Format the response to match frontend expectations
        const formattedPacks = filteredPacks.map(pack => ({
            id: pack.id,
            packId: pack.pack_id,
            assetType: pack.pack_types.asset_type,
            name: pack.pack_types.name,
            description: pack.pack_types.description,
            cost: pack.pack_types.price,
            imageSrc: pack.pack_types.image_src,
            purchased: pack.created_at,
            opened: pack.opened,
            rarityChances: {
                common: pack.pack_types.common_chance,
                rare: pack.pack_types.rare_chance,
                epic: pack.pack_types.epic_chance,
                legendary: pack.pack_types.legendary_chance
            }
        }));

        res.json({
            wallet: walletAddress,
            packs: formattedPacks
        });

    } catch (error) {
        console.error('Error fetching packs:', error);
        res.status(500).json({ error: 'Failed to fetch packs' });
    }
};

// Open a pack
const openPack = async (req, res) => {
    const { packId, walletAddress } = req.body;

    if (!packId || !walletAddress) {
        return res.status(400).json({ error: 'Pack ID and wallet address are required' });
    }

    try {
        // Get the pack with its pack type
        const { data: pack, error: packError } = await supabase
            .from('packs')
            .select(`
                *,
                pack_types (*)
            `)
            .eq('id', packId)
            .eq('owner_wallet', walletAddress)
            .eq('opened', false)
            .single();

        if (packError) throw packError;
        if (!pack) {
            return res.status(404).json({ error: 'Pack not found or already opened' });
        }

        // Get the pack type
        const packType = pack.pack_types;

        // Generate random contents based on probabilities
        const contents = await generatePackContents(packType, walletAddress);

        // Mark the pack as opened
        const { error: updateError } = await supabase
            .from('packs')
            .update({ opened: true })
            .eq('id', packId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: `Successfully opened ${packType.name}`,
            packType: {
                id: packType.pack_id,
                name: packType.name,
                assetType: packType.asset_type
            },
            contents
        });

    } catch (error) {
        console.error('Error opening pack:', error);
        res.status(500).json({ error: 'Failed to open pack' });
    }
};

// Generate random pack contents based on probabilities
async function generatePackContents(packType, walletAddress) {
    // Determine how many items to give (1-3 items per pack)
    const itemCount = Math.floor(Math.random() * 3) + 1;

    // Contents will hold our final items
    const contents = {
        heroes: [],
        farmers: [],
        items: []
    };

    // For each item, determine its rarity
    for (let i = 0; i < itemCount; i++) {
        // Determine rarity based on pack chances
        const rarityRoll = Math.random();
        let rarity;

        if (rarityRoll < packType.legendary_chance) {
            rarity = 'legendary';
        } else if (rarityRoll < packType.legendary_chance + packType.epic_chance) {
            rarity = 'epic';
        } else if (rarityRoll < packType.legendary_chance + packType.epic_chance + packType.rare_chance) {
            rarity = 'rare';
        } else {
            rarity = 'common';
        }

        // Generate appropriate asset based on pack type and rarity
        if (packType.asset_type === 'hero') {
            const hero = await generateHero(rarity, walletAddress);
            contents.heroes.push(hero);
        } else if (packType.asset_type === 'farmer') {
            const farmer = await generateFarmer(rarity, walletAddress);
            contents.farmers.push(farmer);
        }
    }

    return contents;
}

// Generate a random hero based on the frontend catalog
async function generateHero(rarity, walletAddress) {
    // Load hero catalog from your frontend
    const HEROES = {
        common: [
            { id: 'hunter-ranger', name: 'Hunter Ranger', type: 'attack', power: 850, imageSrc: '/assets/heroes/hunter-ranger.jpg' },
            { id: 'forest-druid', name: 'Forest Druid', type: 'magic', power: 820, imageSrc: '/assets/heroes/forest-druid.jpg' }
        ],
        rare: [
            { id: 'knight-champion', name: 'Knight Champion', type: 'defense', power: 1100, imageSrc: '/assets/heroes/knight-champion.jpg' },
            { id: 'royal-knight', name: 'Royal Knight', type: 'balanced', power: 1150, imageSrc: '/assets/heroes/royal-knight.jpg' }
        ],
        epic: [
            { id: 'shadow-assassin', name: 'Shadow Assassin', type: 'speed', power: 1450, imageSrc: '/assets/heroes/shadow-assassin.jpg' },
            { id: 'dragon-knight', name: 'Dragon Knight', type: 'attack', power: 1480, imageSrc: '/assets/heroes/dragon-knight.jpg' },
            { id: 'arcane-mage', name: 'Arcane Mage', type: 'magic', power: 1425, imageSrc: '/assets/heroes/arcane-mage.jpg' }
        ],
        legendary: [
            { id: 'mountain-king', name: 'Mountain King', type: 'defense', power: 1850, imageSrc: '/assets/heroes/mountain-king.jpg' },
            { id: 'thunder-lord', name: 'Thunder Lord', type: 'attack', power: 1900, imageSrc: '/assets/heroes/thunder-lord.jpg' },
            { id: 'guardian-paladin', name: 'Guardian Paladin', type: 'balanced', power: 1880, imageSrc: '/assets/heroes/guardian-paladin.jpg' }
        ]
    };

    // Pick a random hero from the selected rarity
    const heroPool = HEROES[rarity];
    if (!heroPool || heroPool.length === 0) {
        // Fallback if no heroes of this rarity exist
        return generateHero('common', walletAddress);
    }

    const heroTemplate = heroPool[Math.floor(Math.random() * heroPool.length)];

    // Standard descriptions
    const descriptions = {
        'hunter-ranger': 'A skilled archer with exceptional range who excels at picking off targets from a distance.',
        'forest-druid': 'A nature-attuned magic user who can heal allies and manipulate the battlefield.',
        'knight-champion': 'A stalwart defender trained in the arts of sword and shield combat.',
        'royal-knight': 'A well-trained knight of the royal guard with balanced offensive and defensive capabilities.',
        'shadow-assassin': 'A deadly assassin who moves through shadows, dealing lethal damage to unsuspecting foes.',
        'dragon-knight': 'A fearsome warrior who has bonded with dragon essence, gaining incredible offensive power.',
        'arcane-mage': 'A master of arcane magic who can unleash devastating spells against multiple enemies.',
        'mountain-king': 'A legendary dwarven king with unmatched resilience and the strength to cleave through armies.',
        'thunder-lord': 'A legendary warrior blessed by thunder gods, wielding devastating lightning attacks.',
        'guardian-paladin': 'A divine champion chosen to protect the realm, wielding both holy magic and martial prowess.'
    };

    // Default stats based on hero type
    const baseStats = {
        'attack': { attack: 85, defense: 50, speed: 70, energy: 65 },
        'defense': { attack: 60, defense: 90, speed: 50, energy: 70 },
        'speed': { attack: 75, defense: 45, speed: 95, energy: 65 },
        'balanced': { attack: 70, defense: 70, speed: 70, energy: 70 },
        'magic': { attack: 85, defense: 40, speed: 60, energy: 95 }
    };

    // Abilities based on hero type
    const abilities = {
        'attack': [
            { name: 'Power Strike', type: 'Attack', cooldown: '3 turns', description: 'Deals 50% increased damage to a single target' },
            { name: 'Battle Cry', type: 'Buff', cooldown: '4 turns', description: 'Increases attack by 30% for 2 turns' }
        ],
        'defense': [
            { name: 'Shield Wall', type: 'Defense', cooldown: '3 turns', description: 'Reduces damage taken by 50% for 2 turns' },
            { name: 'Taunt', type: 'Control', cooldown: '4 turns', description: 'Forces enemies to attack this hero for 1 turn' }
        ],
        'speed': [
            { name: 'Quick Strike', type: 'Attack', cooldown: '2 turns', description: 'Attacks with a 30% chance for an extra turn' },
            { name: 'Evasion', type: 'Defense', cooldown: '4 turns', description: '50% chance to dodge attacks for 2 turns' }
        ],
        'balanced': [
            { name: 'Balanced Attack', type: 'Attack', cooldown: '3 turns', description: 'Deals damage and heals self for 20% of damage dealt' },
            { name: 'Versatility', type: 'Buff', cooldown: '5 turns', description: 'Increases all stats by 20% for 2 turns' }
        ],
        'magic': [
            { name: 'Arcane Blast', type: 'Attack', cooldown: '3 turns', description: 'Deals magic damage that ignores 30% of defense' },
            { name: 'Mana Shield', type: 'Defense', cooldown: '4 turns', description: 'Creates a shield that absorbs damage based on energy' }
        ]
    };

    // Base level based on rarity
    const level = 1;
    const experience = 0;
    const purchasedAt = Date.now();

    // Unique ID for this hero instance
    const uniqueId = `${heroTemplate.id}-${Math.floor(Math.random() * 10000)}`;

    // Create the hero in the database
    const { data: hero, error } = await supabase
        .from('heroes')
        .insert([
            {
                hero_id: heroTemplate.id,
                name: heroTemplate.name,
                rarity: rarity,
                type: heroTemplate.type,
                power: heroTemplate.power,
                image_src: heroTemplate.imageSrc,
                level: level,
                owner_wallet: walletAddress,
                description: descriptions[heroTemplate.id] || `A ${rarity} ${heroTemplate.type} hero.`,
                purchased_at: purchasedAt,
                experience: experience,
                equipped_items: [],
                stats: baseStats[heroTemplate.type] || baseStats.balanced,
                abilities: abilities[heroTemplate.type] || []
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error creating hero:', error);
        return {
            id: uniqueId,
            heroId: heroTemplate.id,
            name: heroTemplate.name,
            rarity: rarity,
            type: heroTemplate.type,
            power: heroTemplate.power,
            imageSrc: heroTemplate.imageSrc,
            level: level,
            owner_wallet: walletAddress,
            error: 'Failed to save to database'
        };
    }

    // Format the hero to match frontend expectations
    return {
        id: hero.id.toString(),
        heroId: hero.hero_id,
        name: hero.name,
        rarity: hero.rarity,
        type: hero.type,
        power: hero.power,
        imageSrc: hero.image_src,
        level: hero.level,
        purchasedAt: hero.purchased_at,
        experience: hero.experience,
        equippedItems: hero.equipped_items,
        stats: hero.stats,
        abilities: hero.abilities,
        description: hero.description
    };
}

// Generate a random farmer based on the frontend catalog
async function generateFarmer(rarity, walletAddress) {
    // Load farmer catalog from your frontend
    const FARMERS = {
        common: [
            { id: 'agribot-3000', name: 'Agribot 3000', baseYieldPerHour: 1.2, imageSrc: '/assets/farmers/green-mech.jpeg' },
            { id: 'cyber-harvester', name: 'Cyber Harvester', baseYieldPerHour: 1.5, imageSrc: '/assets/farmers/farmer-joe.jpeg' }
        ],
        rare: [
            { id: 'quantum-collector', name: 'Quantum Collector', baseYieldPerHour: 3.2, imageSrc: '/assets/farmers/blue-bot.jpeg' }
        ],
        epic: [
            { id: 'eco-reaper', name: 'Eco Reaper', baseYieldPerHour: 3.8, imageSrc: '/assets/farmers/green-reaper.jpeg' },
            { id: 'neuro-cultivator', name: 'Neuro Cultivator', baseYieldPerHour: 7.5, imageSrc: '/assets/farmers/purple-bot.jpeg' }
        ],
        legendary: [
            { id: 'omega-harvester', name: 'Omega Harvester', baseYieldPerHour: 15.0, imageSrc: '/assets/farmers/legendary-mech.jpeg' }
        ]
    };

    // Pick a random farmer from the selected rarity
    const farmerPool = FARMERS[rarity];
    if (!farmerPool || farmerPool.length === 0) {
        // Fallback if no farmers of this rarity exist
        return generateFarmer('common', walletAddress);
    }

    const farmerTemplate = farmerPool[Math.floor(Math.random() * farmerPool.length)];

    // Standard descriptions
    const descriptions = {
        'agribot-3000': 'Basic farming mech designed for efficient crystal harvesting. Standard yield but reliable and affordable.',
        'cyber-harvester': 'Traditional farmer augmented with cybernetic enhancements. Slightly better yield than standard models.',
        'quantum-collector': 'Advanced harvesting robot with quantum stabilizers for improved efficiency. Significant yield boost over common models.',
        'eco-reaper': 'Specialized harvester with advanced rake technology. Optimized for maximum resource collection with minimal waste.',
        'neuro-cultivator': 'AI-powered farming unit with neural networking capabilities. Can predict optimal harvest patterns for extraordinary yields.',
        'omega-harvester': 'Ultimate harvesting technology with quantum field manipulation. Unparalleled efficiency makes this the apex of farming units.'
    };

    // Base level and timestamps
    const level = 1;
    const purchasedAt = Date.now();
    const lastHarvested = Date.now();

    // Unique ID for this farmer instance
    const uniqueId = `${farmerTemplate.id}-${Math.floor(Math.random() * 10000)}`;

    // Create the farmer in the database
    const { data: farmer, error } = await supabase
        .from('farmers')
        .insert([
            {
                farmer_id: farmerTemplate.id,
                name: farmerTemplate.name,
                rarity: rarity,
                base_yield_per_hour: farmerTemplate.baseYieldPerHour,
                image_src: farmerTemplate.imageSrc,
                level: level,
                owner_wallet: walletAddress,
                description: descriptions[farmerTemplate.id] || `A ${rarity} farmer.`,
                purchased_at: purchasedAt,
                last_harvested: lastHarvested,
                equipped_items: []
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error creating farmer:', error);
        return {
            id: uniqueId,
            farmerId: farmerTemplate.id,
            name: farmerTemplate.name,
            rarity: rarity,
            baseYieldPerHour: farmerTemplate.baseYieldPerHour,
            imageSrc: farmerTemplate.imageSrc,
            level: level,
            owner_wallet: walletAddress,
            error: 'Failed to save to database'
        };
    }

    // Format the farmer to match frontend expectations
    return {
        id: farmer.id.toString(),
        farmerId: farmer.farmer_id,
        name: farmer.name,
        rarity: farmer.rarity,
        baseYieldPerHour: farmer.base_yield_per_hour,
        imageSrc: farmer.image_src,
        level: farmer.level,
        purchasedAt: farmer.purchased_at,
        lastHarvested: farmer.last_harvested,
        equippedItems: farmer.equipped_items,
        description: farmer.description
    };
}

module.exports = {
    getPackTypes,
    buyPack,
    getPackInventory,
    openPack
};