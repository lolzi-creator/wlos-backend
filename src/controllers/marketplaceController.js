const { v4: uuidv4 } = require('uuid');
const supabase = require('../../supabase/supabaseClient');
const { createTransactionRecord } = require('./transactionController');

/**
 * Get all marketplace listings with filters
 */
exports.getAllListings = async (req, res) => {
  try {
    console.log('GET /marketplace/listings - Start');
    const { category, type, assetType, minPrice, maxPrice, page = 1, limit = 10 } = req.query;
    
    console.log('Building query with filters:', { category, type, assetType, minPrice, maxPrice, page, limit });
    let query = supabase
      .from('marketplace_listings')
      .select('*');
      
    // Add status filter
    query = query.eq('status', 'active');
    
    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    if (assetType) {
      query = query.eq('asset_type', assetType);
    }
    
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }
    
    console.log('Executing query');
    const { data: listings, error, count } = await query
      .order('listed_at', { ascending: false });
    
    if (error) {
      console.error('Error in query:', error);
      throw error;
    }
    
    console.log(`Found ${listings ? listings.length : 0} listings`);
    
    // Manual pagination since we're still having issues with range
    const paginatedListings = listings ? 
      listings.slice((page - 1) * limit, page * limit) : 
      [];
    
    const totalItems = listings ? listings.length : 0;
    
    res.status(200).json({
      success: true,
      listings: paginatedListings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / limit)
      }
    });
  } catch (error) {
    console.error('Error getting marketplace listings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch marketplace listings' });
  }
};

/**
 * Get listings for a specific wallet
 */
exports.getMyListings = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ success: false, message: 'Wallet address is required' });
    }
    
    const { data: userListings, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('seller', walletAddress)
      .eq('status', 'active')
      .order('listed_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      listings: userListings
    });
  } catch (error) {
    console.error('Error getting user listings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user listings' });
  }
};

/**
 * Create a new marketplace listing for any asset type
 */
exports.createListing = async (req, res) => {
  try {
    const { walletAddress, assetId, assetType, price, assetDetails } = req.body;
    
    if (!walletAddress || !assetId || !assetType || price === undefined || !assetDetails) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address, asset ID, asset type, price, and asset details are required' 
      });
    }
    
    // Validate asset ownership based on type
    let ownershipVerified = false;
    
    if (assetType === 'farmer') {
      // Check if the user owns this farmer
      const { data: farmer, error: farmerError } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (farmerError || !farmer) {
        return res.status(404).json({ success: false, message: 'Farmer not found or not owned by you' });
      }
      
      ownershipVerified = true;
      
      // Remove the farmer from the user's possession
      const { error: updateError } = await supabase
        .from('farmers')
        .update({ status: 'listed', listed_at: new Date() })
        .eq('id', assetId);
      
      if (updateError) throw updateError;
      
    } else if (assetType === 'hero') {
      // Check if the user owns this hero
      const { data: hero, error: heroError } = await supabase
        .from('heroes')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (heroError || !hero) {
        return res.status(404).json({ success: false, message: 'Hero not found or not owned by you' });
      }
      
      ownershipVerified = true;
      
      // Remove the hero from the user's possession
      const { error: updateError } = await supabase
        .from('heroes')
        .update({ status: 'listed', listed_at: new Date() })
        .eq('id', assetId);
      
      if (updateError) throw updateError;
      
    } else if (assetType === 'item') {
      // Check if the user owns this item
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (itemError || !item) {
        return res.status(404).json({ success: false, message: 'Item not found or not owned by you' });
      }
      
      ownershipVerified = true;
      
      // Remove the item from the user's possession
      const { error: updateError } = await supabase
        .from('items')
        .update({ status: 'listed', listed_at: new Date() })
        .eq('id', assetId);
      
      if (updateError) throw updateError;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid asset type' });
    }
    
    if (!ownershipVerified) {
      return res.status(403).json({ success: false, message: 'You do not own this asset' });
    }
    
    // Create new listing in database
    const { data: newListing, error } = await supabase
      .from('marketplace_listings')
      .insert({
        id: uuidv4(),
        item_id: assetId,
        asset_type: assetType,
        price: Number(price),
        seller: walletAddress,
        listed_at: new Date(),
        status: 'active',
        category: assetDetails.category || 'Other',
        type: assetDetails.type || 'Other',
        name: assetDetails.name || 'Unknown Asset',
        description: assetDetails.description || '',
        image: assetDetails.image || '',
        rarity: assetDetails.rarity || 'common',
        metadata: assetDetails.metadata || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create a transaction record for the listing
    await createTransactionRecord({
      walletAddress,
      type: 'List',
      item: newListing.name,
      token: 'WLOS',
      category: 'Marketplace',
      amount: 0,
      fee: 0.000005, // Small fee for listing
      status: 'Completed',
      description: `Listed ${assetType} ${newListing.name} for ${price} WLOS`,
      metadata: { 
        listingId: newListing.id,
        assetType: assetType,
        assetId: assetId
      }
    });
    
    res.status(201).json({
      success: true,
      listing: newListing,
      message: `${assetType} listed successfully`
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ success: false, message: 'Failed to create listing' });
  }
};

/**
 * Update a marketplace listing
 */
exports.updateListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { walletAddress, price } = req.body;
    
    if (!listingId || !walletAddress || price === undefined) {
      return res.status(400).json({ success: false, message: 'Listing ID, wallet address, and price are required' });
    }
    
    // Check if listing exists and belongs to the user
    const { data: existingListing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listingId)
      .eq('status', 'active')
      .single();
    
    if (fetchError) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Check if user owns the listing
    if (existingListing.seller !== walletAddress) {
      return res.status(403).json({ success: false, message: 'You can only update your own listings' });
    }
    
    // Update listing
    const { data: updatedListing, error: updateError } = await supabase
      .from('marketplace_listings')
      .update({
        price: Number(price),
        updated_at: new Date()
      })
      .eq('id', listingId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.status(200).json({
      success: true,
      listing: updatedListing,
      message: 'Listing updated successfully'
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ success: false, message: 'Failed to update listing' });
  }
};

/**
 * Cancel a marketplace listing
 */
exports.cancelListing = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { walletAddress } = req.body;
    
    if (!listingId || !walletAddress) {
      return res.status(400).json({ success: false, message: 'Listing ID and wallet address are required' });
    }
    
    // Check if listing exists and belongs to the user
    const { data: existingListing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listingId)
      .eq('status', 'active')
      .single();
    
    if (fetchError) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    
    // Check if user owns the listing
    if (existingListing.seller !== walletAddress) {
      return res.status(403).json({ success: false, message: 'You can only cancel your own listings' });
    }
    
    // Update listing status to cancelled
    const { data: cancelledListing, error: updateError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'cancelled',
        updated_at: new Date()
      })
      .eq('id', listingId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Return the asset to the user's ownership
    if (existingListing.asset_type === 'farmer') {
      const { error: farmerUpdateError } = await supabase
        .from('farmers')
        .update({ status: 'active', listed_at: null })
        .eq('id', existingListing.item_id);
        
      if (farmerUpdateError) throw farmerUpdateError;
      
    } else if (existingListing.asset_type === 'hero') {
      const { error: heroUpdateError } = await supabase
        .from('heroes')
        .update({ status: 'active', listed_at: null })
        .eq('id', existingListing.item_id);
        
      if (heroUpdateError) throw heroUpdateError;
      
    } else if (existingListing.asset_type === 'item') {
      const { error: itemUpdateError } = await supabase
        .from('items')
        .update({ status: 'active', listed_at: null })
        .eq('id', existingListing.item_id);
        
      if (itemUpdateError) throw itemUpdateError;
    }
    
    // Create a transaction record for the cancellation
    await createTransactionRecord({
      walletAddress,
      type: 'Cancel',
      item: existingListing.name,
      token: 'WLOS',
      category: 'Marketplace',
      amount: 0,
      status: 'Completed',
      description: `Cancelled listing for ${existingListing.asset_type} ${existingListing.name}`,
      metadata: { 
        listingId: existingListing.id,
        assetType: existingListing.asset_type,
        assetId: existingListing.item_id
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Listing cancelled successfully',
      listing: cancelledListing
    });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel listing' });
  }
};

/**
 * Buy an asset from the marketplace
 */
exports.buyItem = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { buyerWalletAddress } = req.body;
    
    if (!listingId || !buyerWalletAddress) {
      return res.status(400).json({ success: false, message: 'Listing ID and buyer wallet address are required' });
    }
    
    // Get the listing details
    const { data: listing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', listingId)
      .eq('status', 'active')
      .single();
    
    if (fetchError) {
      return res.status(404).json({ success: false, message: 'Listing not found or already sold' });
    }
    
    // Prevent buying your own listing
    if (listing.seller === buyerWalletAddress) {
      return res.status(400).json({ success: false, message: 'You cannot buy your own listing' });
    }
    
    // Update listing as sold
    const { data: soldListing, error: updateError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'sold',
        buyer: buyerWalletAddress,
        sold_at: new Date(),
        updated_at: new Date()
      })
      .eq('id', listingId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Transfer the asset to the buyer
    if (listing.asset_type === 'farmer') {
      const { error: farmerUpdateError } = await supabase
        .from('farmers')
        .update({ 
          owner_wallet: buyerWalletAddress,
          status: 'active',
          listed_at: null,
          last_transferred: new Date()
        })
        .eq('id', listing.item_id);
        
      if (farmerUpdateError) throw farmerUpdateError;
      
    } else if (listing.asset_type === 'hero') {
      const { error: heroUpdateError } = await supabase
        .from('heroes')
        .update({ 
          owner_wallet: buyerWalletAddress,
          status: 'active',
          listed_at: null,
          last_transferred: new Date()
        })
        .eq('id', listing.item_id);
        
      if (heroUpdateError) throw heroUpdateError;
      
    } else if (listing.asset_type === 'item') {
      const { error: itemUpdateError } = await supabase
        .from('items')
        .update({ 
          owner_wallet: buyerWalletAddress,
          status: 'active',
          listed_at: null,
          last_transferred: new Date()
        })
        .eq('id', listing.item_id);
        
      if (itemUpdateError) throw itemUpdateError;
    }
    
    // Create purchase transaction for buyer
    await createTransactionRecord({
      walletAddress: buyerWalletAddress,
      type: 'Purchase',
      item: listing.name,
      token: 'WLOS',
      category: 'Marketplace',
      amount: -listing.price,
      status: 'Completed',
      description: `Purchased ${listing.asset_type} ${listing.name} for ${listing.price} WLOS`,
      metadata: { 
        listingId: listing.id,
        seller: listing.seller,
        assetType: listing.asset_type,
        assetId: listing.item_id
      }
    });
    
    // Create sale transaction for seller
    await createTransactionRecord({
      walletAddress: listing.seller,
      type: 'Sale',
      item: listing.name,
      token: 'WLOS',
      category: 'Marketplace',
      amount: listing.price * 0.95, // 5% marketplace fee
      status: 'Completed',
      description: `Sold ${listing.asset_type} ${listing.name} for ${listing.price} WLOS (5% fee)`,
      metadata: { 
        listingId: listing.id,
        buyer: buyerWalletAddress,
        assetType: listing.asset_type,
        assetId: listing.item_id
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Item purchased successfully',
      purchase: {
        item: soldListing,
        price: listing.price,
        seller: listing.seller,
        buyer: buyerWalletAddress,
        purchasedAt: new Date(),
        assetType: listing.asset_type
      }
    });
  } catch (error) {
    console.error('Error purchasing item:', error);
    res.status(500).json({ success: false, message: 'Failed to purchase item' });
  }
};

/**
 * Instant sell an asset (no listing needed)
 */
exports.instantSell = async (req, res) => {
  try {
    const { walletAddress, assetId, assetType } = req.body;
    
    if (!walletAddress || !assetId || !assetType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address, asset ID, and asset type are required' 
      });
    }
    
    // Validate asset exists and is owned by the user
    let assetDetails = null;
    let baseValue = 0;
    
    if (assetType === 'farmer') {
      // Get farmer details
      const { data: farmer, error: farmerError } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (farmerError || !farmer) {
        return res.status(404).json({ success: false, message: 'Farmer not found or not owned by you' });
      }
      
      assetDetails = farmer;
      // Calculate base value based on farmer level and type
      baseValue = 50 * (1 + (farmer.level - 1) * 0.5); // 50 WLOS base, 50% increase per level
      
    } else if (assetType === 'hero') {
      // Get hero details
      const { data: hero, error: heroError } = await supabase
        .from('heroes')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (heroError || !hero) {
        return res.status(404).json({ success: false, message: 'Hero not found or not owned by you' });
      }
      
      assetDetails = hero;
      // Calculate base value based on hero level and rarity
      const rarityMultiplier = {
        'common': 1,
        'uncommon': 1.5,
        'rare': 2.5,
        'epic': 4,
        'legendary': 8
      };
      
      baseValue = 100 * (1 + (hero.level - 1) * 0.7) * (rarityMultiplier[hero.rarity] || 1);
      
    } else if (assetType === 'item') {
      // Get item details  
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', assetId)
        .eq('owner_wallet', walletAddress)
        .single();
      
      if (itemError || !item) {
        return res.status(404).json({ success: false, message: 'Item not found or not owned by you' });
      }
      
      assetDetails = item;
      // Use base value from item properties
      baseValue = item.base_value || 20;
      
    } else {
      return res.status(400).json({ success: false, message: 'Invalid asset type' });
    }
    
    // Calculate sell value (50% of base value)
    const sellValue = Math.floor(baseValue * 0.5);
    
    // Remove the asset from the user
    if (assetType === 'farmer') {
      const { error: deleteError } = await supabase
        .from('farmers')
        .delete()
        .eq('id', assetId);
        
      if (deleteError) throw deleteError;
      
    } else if (assetType === 'hero') {
      const { error: deleteError } = await supabase
        .from('heroes')
        .delete()
        .eq('id', assetId);
        
      if (deleteError) throw deleteError;
      
    } else if (assetType === 'item') {
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('id', assetId);
        
      if (deleteError) throw deleteError;
    }
    
    // Create a transaction record for the instant sell
    await createTransactionRecord({
      walletAddress,
      type: 'InstantSell',
      item: assetDetails.name || `${assetType} #${assetId}`,
      token: 'WLOS',
      category: 'Marketplace',
      amount: sellValue,
      status: 'Completed',
      description: `Instant sold ${assetType} ${assetDetails.name || `#${assetId}`} for ${sellValue} WLOS`,
      metadata: { 
        assetType: assetType,
        assetId: assetId,
        baseValue: baseValue
      }
    });
    
    res.status(200).json({
      success: true,
      message: `${assetType} sold successfully`,
      sale: {
        assetId: assetId,
        assetType: assetType,
        name: assetDetails.name || `${assetType} #${assetId}`,
        value: sellValue,
        soldAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error instant selling asset:', error);
    res.status(500).json({ success: false, message: 'Failed to instant sell asset' });
  }
};

/**
 * Get marketplace statistics
 */
exports.getMarketplaceStats = async (req, res) => {
  try {
    // Get active listings count
    const { count: activeListings, error: countError } = await supabase
      .from('marketplace_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (countError) throw countError;
    
    // Get completed sales in the last 7 days
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { count: recentSales, error: salesCountError } = await supabase
      .from('marketplace_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sold')
      .gte('sold_at', last7Days);
    
    if (salesCountError) throw salesCountError;
    
    // Get total volume of completed sales
    const { data: salesData, error: volumeError } = await supabase
      .from('marketplace_listings')
      .select('price')
      .eq('status', 'sold');
    
    if (volumeError) throw volumeError;
    
    const totalVolume = salesData.reduce((sum, item) => sum + item.price, 0);
    
    // Get listings by asset type
    const { data: assetTypeCounts, error: assetTypeError } = await supabase
      .from('marketplace_listings')
      .select('asset_type, count')
      .eq('status', 'active')
      .group('asset_type');
    
    if (assetTypeError) throw assetTypeError;
    
    const assetTypes = assetTypeCounts.map(item => ({
      name: item.asset_type,
      count: item.count
    }));
    
    // Get category distribution
    const { data: categoryCounts, error: categoryError } = await supabase
      .from('marketplace_listings')
      .select('category, count')
      .eq('status', 'active')
      .group('category');
    
    if (categoryError) throw categoryError;
    
    const categories = categoryCounts.map(item => ({
      name: item.category,
      count: item.count
    }));
    
    // Calculate average price
    const averagePrice = salesData.length > 0 
      ? totalVolume / salesData.length 
      : 0;
    
    res.status(200).json({
      success: true,
      stats: {
        activeListings,
        recentSales,
        totalVolume,
        averagePrice,
        assetTypes,
        categories
      }
    });
  } catch (error) {
    console.error('Error getting marketplace stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch marketplace statistics' });
  }
}; 