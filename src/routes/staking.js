const express = require('express');
const router = express.Router();
const {
    getStakingPools,
    stakeTokens,
    confirmStakeTokens,
    getStakingInfo,
    unstakeTokens,
    claimRewards
} = require('../controllers/stakingController');

// Get available staking pools
router.get('/pools', getStakingPools);

// Stake tokens - step 1: create transaction
router.post('/stake', stakeTokens);

// Stake tokens - step 2: process signed transaction
router.post('/confirm-stake', confirmStakeTokens);

// Get staking info
router.get('/info/:walletAddress', getStakingInfo);

// Unstake tokens
router.post('/unstake', unstakeTokens);

// Claim rewards
router.post('/claim', claimRewards);

module.exports = router;