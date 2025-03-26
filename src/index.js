// src/index.js
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
const farmerRoutes = require('./routes/farmer');
const heroRoutes = require('./routes/hero'); // Add hero routes
const transactionRoutes = require('./routes/transaction');
const marketplaceRoutes = require('./routes/marketplace'); // Add marketplace routes

app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);
app.use('/assets', assetRoutes);
app.use('/packs', packRoutes);
app.use('/staking', stakingRoutes);
app.use('/farmers', farmerRoutes);
app.use('/heroes', heroRoutes); // Register hero routes
app.use('/transactions', transactionRoutes);
app.use('/marketplace', marketplaceRoutes); // Register marketplace routes

// Add a debug endpoint
app.get('/debug/routes', (req, res) => {
  const routes = [];

  // Function to print routes
  function print(path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, path.concat(layer.route.path)));
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(print.bind(null, path.concat(layer.regexp)));
    } else if (layer.method) {
      routes.push(`${layer.method.toUpperCase()} ${path.join('')}`);
    }
  }

  app._router.stack.forEach(print.bind(null, []));
  
  res.json(routes);
});

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Log all registered routes
console.log('Registered routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Routes registered directly on the app
    console.log(`Route: ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Router middleware
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        const baseRoute = handler.route;
        console.log(`Route: ${Object.keys(baseRoute.methods)}: ${baseRoute.path}`);
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));