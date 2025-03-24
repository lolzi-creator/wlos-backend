const express = require('express');
const router = express.Router();
const {
    getFarmers,
    harvestAll,
    levelUpFarmer
} = require('../controllers/farmerController');

// Get all farmers for a wallet
router.get('/:walletAddress', getFarmers);

// Harvest all rewards
router.post('/harvest', harvestAll);

// Level up a farmer (with auto-merging)
router.post('/levelup', levelUpFarmer);

module.exports = router;