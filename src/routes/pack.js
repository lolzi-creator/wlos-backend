const express = require('express');
const router = express.Router();
const {
    getPackTypes,
    buyPack,
    getPackInventory,
    openPack
} = require('../controllers/packController');

// Get available pack types (optional query param: ?assetType=hero or ?assetType=farmer)
router.get('/types', getPackTypes);

// Buy a pack
router.post('/buy', buyPack);

// Get pack inventory for a wallet (optional query param: ?assetType=hero or ?assetType=farmer)
router.get('/inventory/:walletAddress', getPackInventory);

// Open a pack
router.post('/open', openPack);

module.exports = router;