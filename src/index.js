require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// REGISTER ROUTES
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const assetRoutes = require('./routes/asset');
const packRoutes = require('./routes/pack');
const stakingRoutes = require('./routes/staking');
const farmerRoutes = require('./routes/farmer'); // Add this line

app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);
app.use('/assets', assetRoutes);
app.use('/packs', packRoutes);
app.use('/staking', stakingRoutes);
app.use('/farmers', farmerRoutes); // Add this line

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));