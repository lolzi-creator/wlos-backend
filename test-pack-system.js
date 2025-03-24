const axios = require('axios');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Load wallet from file
const walletSecretKey = Uint8Array.from(JSON.parse(fs.readFileSync('./wallet.json')));
const wallet = Keypair.fromSecretKey(walletSecretKey);
const walletAddress = wallet.publicKey.toString();

// API endpoint
const API_URL = 'http://localhost:3000';

async function testPackSystem() {
    try {
        console.log(`Testing pack system for wallet: ${walletAddress}`);

        // Step 1: Get pack types
        console.log('\n1. Getting available pack types...');
        const typesResponse = await axios.get(`${API_URL}/packs/types`);
        console.log('Available pack types:');
        typesResponse.data.packTypes.forEach(type => {
            console.log(`- ${type.name}: ${type.price} WLOS (${type.description})`);
        });

        // Step 2: Buy a basic pack
        console.log('\n2. Buying a basic pack...');
        const buyResponse = await axios.post(`${API_URL}/packs/buy`, {
            walletAddress,
            packType: 'basic'
        });
        console.log('Purchase response:', buyResponse.data);

        // Step 3: Check pack inventory
        console.log('\n3. Checking pack inventory...');
        const inventoryResponse = await axios.get(`${API_URL}/packs/inventory/${walletAddress}`);
        console.log('Pack inventory:');
        if (inventoryResponse.data.packs.length === 0) {
            console.log('No packs found in inventory.');
        } else {
            inventoryResponse.data.packs.forEach(pack => {
                console.log(`- Pack ID: ${pack.id}, Type: ${pack.type}, Purchased: ${new Date(pack.created_at).toLocaleString()}`);
            });

            // Step 4: Open the first pack
            const packToOpen = inventoryResponse.data.packs[0];
            console.log(`\n4. Opening pack ID ${packToOpen.id}...`);

            const openResponse = await axios.post(`${API_URL}/packs/open`, {
                packId: packToOpen.id,
                walletAddress
            });
            console.log('Pack contents:');

            if (openResponse.data.contents.heroes.length > 0) {
                console.log('\nHeroes:');
                openResponse.data.contents.heroes.forEach(hero => {
                    console.log(`- ${hero.name} (Level ${hero.level} ${hero.rarity} Hero, Power: ${hero.power})`);
                });
            }

            if (openResponse.data.contents.farmers.length > 0) {
                console.log('\nFarmers:');
                openResponse.data.contents.farmers.forEach(farmer => {
                    console.log(`- ${farmer.name} (Level ${farmer.level} ${farmer.type} Farmer, Efficiency: ${farmer.efficiency})`);
                });
            }

            if (openResponse.data.contents.items.length > 0) {
                console.log('\nItems:');
                openResponse.data.contents.items.forEach(item => {
                    console.log(`- ${item.name} (${item.rarity} ${item.type}, Bonus: ${item.bonus})`);
                });
            }

            // Step 5: Check assets to confirm they were added
            console.log('\n5. Checking assets to confirm pack contents were added...');
            const assetsResponse = await axios.get(`${API_URL}/assets/all/${walletAddress}`);
            console.log(`Total heroes: ${assetsResponse.data.heroes.length}`);
            console.log(`Total farmers: ${assetsResponse.data.farmers.length}`);
            console.log(`Total items: ${assetsResponse.data.items.length}`);
        }

        console.log('\nPack system test completed successfully!');

    } catch (error) {
        console.error('Error testing pack system:', error.response?.data || error.message);
    }
}

testPackSystem();