const supabase = require('../../supabase/supabaseClient');
const { Connection, PublicKey } = require('@solana/web3.js');
const {
    stakeTokensOnChain,
    unstakeTokensOnChain,
    mintRewardsOnChain
} = require('../utils/tokenTransfers');
require('dotenv').config();

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com');

const transactionController = require('./transactionController');

// WLOS token mint
const WLOS_MINT = process.env.WLOS_TOKEN_MINT;

// Get available staking pools
const getStakingPools = async (req, res) => {
    try {
        const { data: poolsData, error: poolsError } = await supabase
            .from('staking_pools')
            .select('*')
            .order('lock_period_days', { ascending: true });

        if (poolsError) throw poolsError;

        // For each pool, get the total staked amount
        for (let pool of poolsData) {
            const { data: stakingData, error: stakingError } = await supabase
                .from('staking')
                .select('amount')
                .eq('pool_id', pool.id)
                .eq('is_active', true);

            if (stakingError) throw stakingError;

            pool.total_staked = stakingData.reduce((sum, stake) => sum + parseFloat(stake.amount), 0);
        }

        // Format the response for the frontend
        const formattedPools = poolsData.map(pool => ({
            id: pool.id,
            name: pool.name,
            description: pool.description,
            lockPeriod: pool.lock_period_days,
            apy: pool.apy,
            minStake: pool.min_stake,
            battlePowerBoost: pool.battle_power_boost,
            earlyUnstakeFee: pool.early_unstake_fee,
            totalStaked: pool.total_staked || 0
        }));

        res.json({
            pools: formattedPools
        });
    } catch (error) {
        console.error('Error fetching staking pools:', error);
        res.status(500).json({ error: 'Failed to fetch staking pools' });
    }
};

// Stake tokens
const stakeTokens = async (req, res) => {
    const { walletAddress, amount, poolId } = req.body;

    if (!walletAddress || !amount || !poolId) {
        return res.status(400).json({ error: 'Wallet address, amount, and pool ID are required' });
    }

    if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    try {
        // Get the pool details
        const { data: poolData, error: poolError } = await supabase
            .from('staking_pools')
            .select('*')
            .eq('id', poolId)
            .single();

        if (poolError) throw poolError;
        if (!poolData) {
            return res.status(404).json({ error: 'Staking pool not found' });
        }

        // Check minimum stake amount
        if (amount < poolData.min_stake) {
            return res.status(400).json({
                error: `Minimum stake for ${poolData.name} is ${poolData.min_stake} WLOS`,
                minStake: poolData.min_stake
            });
        }

        // Check if user has enough tokens
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

        if (wlosBalance < amount) {
            return res.status(400).json({
                error: 'Not enough WLOS tokens for staking',
                required: amount,
                balance: wlosBalance
            });
        }

        // Transfer tokens from user to treasury (staking)
        const transferResult = await stakeTokensOnChain(walletAddress, amount);

        if (!transferResult.success) {
            return res.status(500).json({
                error: 'Failed to process token transfer for staking',
                details: transferResult.error
            });
        }

        // Calculate end time based on lock period
        const startTime = new Date();
        const endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + poolData.lock_period_days);

        // Add new staking record
        const { data: stakingData, error: stakingError } = await supabase
            .from('staking')
            .insert([
                {
                    wallet_address: walletAddress,
                    pool_id: poolId,
                    amount: amount,
                    start_time: startTime,
                    end_time: endTime,
                    last_claim_time: startTime,
                    is_active: true
                }
            ])
            .select()
            .single();

        if (stakingError) throw stakingError;

        // Record the transaction
        await transactionController.recordStaking(
            walletAddress,
            poolData.name,
            amount,
            {
                poolId: poolId,
                stakingId: stakingData.id,
                startTime: startTime,
                endTime: endTime,
                lockPeriod: poolData.lock_period_days,
                apy: poolData.apy
            }
        );

        // Calculate the expected rewards at the end of the lock period
        const lockPeriodYears = poolData.lock_period_days / 365;
        const expectedRewards = amount * (poolData.apy / 100) * lockPeriodYears;

        res.json({
            success: true,
            message: `Successfully staked ${amount} WLOS tokens in ${poolData.name}`,
            transaction: transferResult.signature,
            staking: {
                id: stakingData.id,
                poolId: stakingData.pool_id,
                poolName: poolData.name,
                amount: parseFloat(stakingData.amount),
                lockPeriod: poolData.lock_period_days,
                apy: poolData.apy,
                startTime: stakingData.start_time,
                endTime: stakingData.end_time,
                battlePowerBoost: poolData.battle_power_boost,
                expectedRewards: parseFloat(expectedRewards.toFixed(4))
            }
        });

    } catch (error) {
        console.error('Error staking tokens:', error);
        res.status(500).json({ error: 'Failed to stake tokens' });
    }
};

// Get staking info
const getStakingInfo = async (req, res) => {
    const { walletAddress } = req.params;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get active staking records with pool information
        const { data: stakingData, error: stakingError } = await supabase
            .from('staking')
            .select(`
                *,
                staking_pools (*)
            `)
            .eq('wallet_address', walletAddress)
            .eq('is_active', true);

        if (stakingError) throw stakingError;

        // Calculate current rewards and format the response
        let totalStaked = 0;
        let totalRewards = 0;
        let totalBattlePower = 0;
        const positions = [];

        for (const position of stakingData || []) {
            const pool = position.staking_pools;
            totalStaked += parseFloat(position.amount);

            // Calculate rewards since last claim
            const lastClaimTime = new Date(position.last_claim_time);
            const currentTime = new Date();
            const endTime = new Date(position.end_time);

            // Time difference in milliseconds
            const timeDiffMs = currentTime - lastClaimTime;

            // Convert to days
            const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

            // Calculate rewards: amount * annual rate * (days / 365)
            const pendingRewards = position.amount * (pool.apy / 100) * (timeDiffDays / 365);
            totalRewards += pendingRewards;

            // Calculate battle power boost
            const battlePowerBoost = position.amount * (pool.battle_power_boost / 100);
            totalBattlePower += battlePowerBoost;

            // Calculate if unstaking is possible and any applicable fees
            const isLocked = currentTime < endTime;
            const earlyUnstakeFee = isLocked ? pool.early_unstake_fee : 0;
            const earlyUnstakeAmount = earlyUnstakeFee > 0 ? (parseFloat(position.amount) * (earlyUnstakeFee / 100)) : 0;

            positions.push({
                id: position.id,
                poolId: pool.id,
                poolName: pool.name,
                amount: parseFloat(position.amount),
                stakedAt: position.start_time,
                endTime: position.end_time,
                lastClaim: position.last_claim_time,
                pendingRewards: parseFloat(pendingRewards.toFixed(8)),
                apy: pool.apy,
                battlePowerBoost: {
                    percentage: pool.battle_power_boost,
                    value: parseFloat(battlePowerBoost.toFixed(2))
                },
                lockStatus: {
                    isLocked,
                    remainingDays: isLocked ? Math.ceil((endTime - currentTime) / (1000 * 60 * 60 * 24)) : 0,
                    earlyUnstakeFee,
                    earlyUnstakeAmount: parseFloat(earlyUnstakeAmount.toFixed(4))
                }
            });
        }

        res.json({
            wallet: walletAddress,
            totalStaked,
            totalRewards: parseFloat(totalRewards.toFixed(8)),
            totalBattlePower: parseFloat(totalBattlePower.toFixed(2)),
            positions: positions
        });

    } catch (error) {
        console.error('Error fetching staking info:', error);
        res.status(500).json({ error: 'Failed to fetch staking info' });
    }
};

// Unstake tokens
const unstakeTokens = async (req, res) => {
    const { walletAddress, stakingId } = req.body;

    if (!walletAddress || !stakingId) {
        return res.status(400).json({ error: 'Wallet address and staking ID are required' });
    }

    try {
        // Get the staking record with pool information
        const { data: stakingData, error: stakingError } = await supabase
            .from('staking')
            .select(`
                *,
                staking_pools (*)
            `)
            .eq('id', stakingId)
            .eq('wallet_address', walletAddress)
            .eq('is_active', true)
            .single();

        if (stakingError) throw stakingError;

        if (!stakingData) {
            return res.status(404).json({ error: 'Staking position not found' });
        }

        const pool = stakingData.staking_pools;

        // Calculate rewards before unstaking
        const lastClaimTime = new Date(stakingData.last_claim_time);
        const currentTime = new Date();
        const endTime = new Date(stakingData.end_time);

        // Time difference in milliseconds
        const timeDiffMs = currentTime - lastClaimTime;

        // Convert to days
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

        // Calculate rewards: amount * annual rate * (days / 365)
        const pendingRewards = stakingData.amount * (pool.apy / 100) * (timeDiffDays / 365);

        // Check if early unstaking fee applies
        const isEarlyUnstake = currentTime < endTime;
        let unstakeAmount = parseFloat(stakingData.amount);
        let feeAmount = 0;

        if (isEarlyUnstake) {
            feeAmount = unstakeAmount * (pool.early_unstake_fee / 100);
            unstakeAmount -= feeAmount;
        }

        // First, transfer the unstaked amount back to the user
        const unstakeResult = await unstakeTokensOnChain(walletAddress, unstakeAmount);

        if (!unstakeResult.success) {
            return res.status(500).json({
                error: 'Failed to process token transfer for unstaking',
                details: unstakeResult.error
            });
        }

        // Record the unstaking transaction
        await transactionController.recordUnstaking(
            walletAddress,
            pool.name,
            unstakeAmount,
            feeAmount,
            {
                poolId: pool.id,
                stakingId: stakingId,
                isEarlyUnstake: isEarlyUnstake,
                originalAmount: parseFloat(stakingData.amount),
                feePercentage: isEarlyUnstake ? pool.early_unstake_fee : 0
            }
        );

        // Then, mint the rewards to the user
        let rewardsMintResult = null;
        if (pendingRewards > 0) {
            rewardsMintResult = await mintRewardsOnChain(walletAddress, pendingRewards);

            if (!rewardsMintResult.success) {
                console.error('Failed to mint rewards:', rewardsMintResult.error);
                // We'll continue anyway since the unstake was successful
            } else {
                // Record the rewards transaction
                await transactionController.recordReward(
                    walletAddress,
                    'Staking',
                    pendingRewards,
                    {
                        poolId: pool.id,
                        stakingId: stakingId,
                        poolName: pool.name
                    }
                );
            }
        }

        // Update staking record
        const { error: updateError } = await supabase
            .from('staking')
            .update({
                is_active: false,
                is_early_unstake: isEarlyUnstake,
                end_time: currentTime
            })
            .eq('id', stakingId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: `Successfully unstaked ${stakingData.amount} WLOS tokens from ${pool.name}`,
            transactions: {
                unstake: unstakeResult.signature,
                rewards: rewardsMintResult?.signature || null
            },
            unstake: {
                originalAmount: parseFloat(stakingData.amount),
                fee: parseFloat(feeAmount.toFixed(4)),
                feePercentage: isEarlyUnstake ? pool.early_unstake_fee : 0,
                receivedAmount: parseFloat(unstakeAmount.toFixed(4)),
                rewards: parseFloat(pendingRewards.toFixed(8)),
                isEarlyUnstake
            }
        });

    } catch (error) {
        console.error('Error unstaking tokens:', error);
        res.status(500).json({ error: 'Failed to unstake tokens' });
    }
};


// Claim rewards
const claimRewards = async (req, res) => {
    const { walletAddress, stakingId } = req.body;

    if (!walletAddress || !stakingId) {
        return res.status(400).json({ error: 'Wallet address and staking ID are required' });
    }

    try {
        // Get the staking record with pool information
        const { data: stakingData, error: stakingError } = await supabase
            .from('staking')
            .select(`
                *,
                staking_pools (*)
            `)
            .eq('id', stakingId)
            .eq('wallet_address', walletAddress)
            .eq('is_active', true)
            .single();

        if (stakingError) throw stakingError;

        if (!stakingData) {
            return res.status(404).json({ error: 'Staking position not found' });
        }

        const pool = stakingData.staking_pools;

        // Calculate rewards
        const lastClaimTime = new Date(stakingData.last_claim_time);
        const currentTime = new Date();

        // Time difference in milliseconds
        const timeDiffMs = currentTime - lastClaimTime;

        // Convert to days
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

        // Calculate rewards: amount * annual rate * (days / 365)
        const pendingRewards = stakingData.amount * (pool.apy / 100) * (timeDiffDays / 365);

        if (pendingRewards <= 0) {
            return res.status(400).json({ error: 'No rewards available to claim' });
        }

        // Mint rewards to the user
        const rewardsMintResult = await mintRewardsOnChain(walletAddress, pendingRewards);

        if (!rewardsMintResult.success) {
            return res.status(500).json({
                error: 'Failed to mint rewards',
                details: rewardsMintResult.error
            });
        }

        // Record the rewards transaction
        await transactionController.recordReward(
            walletAddress,
            'Staking',
            pendingRewards,
            {
                poolId: pool.id,
                stakingId: stakingId,
                poolName: pool.name
            }
        );

        // Update staking record
        const { error: updateError } = await supabase
            .from('staking')
            .update({
                last_claim_time: currentTime
            })
            .eq('id', stakingId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: `Successfully claimed ${pendingRewards.toFixed(8)} WLOS rewards from ${pool.name}`,
            transaction: rewardsMintResult.signature,
            rewards: parseFloat(pendingRewards.toFixed(8)),
            pool: {
                id: pool.id,
                name: pool.name
            }
        });

    } catch (error) {
        console.error('Error claiming rewards:', error);
        res.status(500).json({ error: 'Failed to claim rewards' });
    }
};

module.exports = {
    getStakingPools,
    stakeTokens,
    getStakingInfo,
    unstakeTokens,
    claimRewards
};