const express = require('express');
const router = express.Router();
const {
    getHeroesByWallet,
    getFarmersByWallet,
    getItemsByWallet,
    getAllAssets
} = require('../controllers/assetController');

// Get all assets for a wallet (heroes, farmers, items)
router.get('/all/:walletAddress', getAllAssets);

// Get heroes for a wallet
router.get('/heroes/:walletAddress', getHeroesByWallet);

// Get farmers for a wallet
router.get('/farmers/:walletAddress', getFarmersByWallet);

// Get items for a wallet
router.get('/items/:walletAddress', getItemsByWallet);

module.exports = router;