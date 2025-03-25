const express = require('express');
const router = express.Router();
const {
    getHeroes,
    levelUpHero,
    equipItem,
    unequipItem
} = require('../controllers/heroController');

// Get all heroes for a wallet
router.get('/:walletAddress', getHeroes);

// Level up a hero
router.post('/levelup', levelUpHero);

// Equip an item to a hero
router.post('/equip', equipItem);

// Unequip an item from a hero
router.post('/unequip', unequipItem);

module.exports = router;