const express = require('express');
const router = express.Router();
const {
    getStakingPools,
    stakeTokens,
    getStakingInfo,
    unstakeTokens,
    claimRewards
} = require('../controllers/stakingController');

// Get available staking pools
router.get('/pools', getStakingPools);

// Stake tokens
router.post('/stake', stakeTokens);

// Get staking info
router.get('/info/:walletAddress', getStakingInfo);

// Unstake tokens
router.post('/unstake', unstakeTokens);

// Claim rewards
router.post('/claim', claimRewards);

module.exports = router;