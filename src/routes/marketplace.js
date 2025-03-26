const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');

// Get all marketplace listings with optional filters
router.get('/listings', marketplaceController.getAllListings);

// Get marketplace statistics
router.get('/stats', marketplaceController.getMarketplaceStats);

// Get listings for a specific wallet
router.get('/listings/:walletAddress', marketplaceController.getMyListings);

// Create a new listing
router.post('/list', marketplaceController.createListing);

// Buy an item
router.post('/buy/:listingId', marketplaceController.buyItem);

// Instant sell an asset (no listing needed)
router.post('/instant-sell', marketplaceController.instantSell);

// Update a listing (e.g., change price)
router.put('/listings/:listingId', marketplaceController.updateListing);

// Cancel a listing
router.delete('/listings/:listingId', marketplaceController.cancelListing);

module.exports = router; 