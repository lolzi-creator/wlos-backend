require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// REGISTER ROUTES
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));