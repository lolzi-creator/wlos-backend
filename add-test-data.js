const supabase = require('./supabase/supabaseClient');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load wallet from file
const walletSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const wallet = Keypair.fromSecretKey(walletSecretKey);
const walletAddress = wallet.publicKey.toString();

async function addTestData() {
    console.log(`Adding test data for wallet: ${walletAddress}`);

    try {
        // Add test heroes
        console.log('Adding heroes...');
        const { data: heroes, error: heroesError } = await supabase
            .from('heroes')
            .insert([
                {
                    name: 'Knight',
                    level: 5,
                    rarity: 'common',
                    power: 150,
                    owner_wallet: walletAddress
                },
                {
                    name: 'Wizard',
                    level: 8,
                    rarity: 'rare',
                    power: 220,
                    owner_wallet: walletAddress
                },
                {
                    name: 'Archer',
                    level: 3,
                    rarity: 'uncommon',
                    power: 130,
                    owner_wallet: walletAddress
                }
            ]);

        if (heroesError) {
            console.error('Error adding heroes:', heroesError);
        } else {
            console.log('Heroes added successfully!');
        }

        // Add test farmers
        console.log('Adding farmers...');
        const { data: farmers, error: farmersError } = await supabase
            .from('farmers')
            .insert([
                {
                    name: 'Bob',
                    level: 2,
                    type: 'wheat',
                    efficiency: 1.2,
                    owner_wallet: walletAddress
                },
                {
                    name: 'Alice',
                    level: 4,
                    type: 'corn',
                    efficiency: 1.5,
                    owner_wallet: walletAddress
                }
            ]);

        if (farmersError) {
            console.error('Error adding farmers:', farmersError);
        } else {
            console.log('Farmers added successfully!');
        }

        // Add test items
        console.log('Adding items...');
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .insert([
                {
                    name: 'Sword of Power',
                    type: 'weapon',
                    rarity: 'epic',
                    bonus: 25,
                    owner_wallet: walletAddress
                },
                {
                    name: 'Shield of Protection',
                    type: 'armor',
                    rarity: 'rare',
                    bonus: 15,
                    owner_wallet: walletAddress
                },
                {
                    name: 'Health Potion',
                    type: 'consumable',
                    rarity: 'common',
                    bonus: 10,
                    owner_wallet: walletAddress
                }
            ]);

        if (itemsError) {
            console.error('Error adding items:', itemsError);
        } else {
            console.log('Items added successfully!');
        }

        console.log('Test data added successfully!');
        console.log(`\nYou can now test the API endpoints with your wallet address: ${walletAddress}`);
        console.log('Try accessing:');
        console.log(`http://localhost:3000/assets/all/${walletAddress}`);
        console.log(`http://localhost:3000/assets/heroes/${walletAddress}`);
        console.log(`http://localhost:3000/assets/farmers/${walletAddress}`);
        console.log(`http://localhost:3000/assets/items/${walletAddress}`);

    } catch (error) {
        console.error('Error adding test data:', error);
    }
}

addTestData();