/**
 * Migration Script: Backfill Tree Structure for Existing Users
 * 
 * This script:
 * 1. Backfills treeParent, treeLevel, treePosition for existing users
 * 2. Builds tree structure based on existing referredBy relationships
 * 3. Initializes directCommissionEarned and treeCommissionEarned to 0
 * 4. Creates initial Trust Fund and Development Trust Fund documents
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const TrustFund = require('../models/TrustFund');
require('dotenv').config();

/**
 * Build tree structure from referral relationships
 * Uses breadth-first approach to maintain serial ordering
 */
async function buildTreeStructure() {
  console.log('Starting tree structure migration...');
  
  // Get all users sorted by creation time (oldest first)
  const allUsers = await User.find({}).sort({ createdAt: 1 });
  console.log(`Found ${allUsers.length} users to process`);
  
  // Track users by referral code for quick lookup
  const usersByReferralCode = {};
  allUsers.forEach(user => {
    if (user.referralCode) {
      usersByReferralCode[user.referralCode] = user;
    }
  });
  
  // Initialize commission tracking fields
  let updatedCount = 0;
  for (const user of allUsers) {
    let needsUpdate = false;
    
    // Initialize commission tracking if not set
    if (user.directCommissionEarned === undefined) {
      user.directCommissionEarned = 0;
      needsUpdate = true;
    }
    if (user.treeCommissionEarned === undefined) {
      user.treeCommissionEarned = 0;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await user.save();
      updatedCount++;
    }
  }
  console.log(`Initialized commission tracking for ${updatedCount} users`);
  
  // Build tree structure based on referredBy relationships
  // Process users level by level to maintain proper tree structure
  
  // First, identify root users (those without referredBy)
  const rootUsers = allUsers.filter(user => !user.referredBy);
  console.log(`Found ${rootUsers.length} root users (no referrer)`);
  
  // Set root users to level 1
  for (const user of rootUsers) {
    if (user.treeLevel === 0 || user.treeLevel === undefined) {
      user.treeLevel = 1;
      user.treeParent = null;
      user.treePosition = 0;
      user.treeChildren = [];
      await user.save();
    }
  }
  
  // Process users with referrals in chronological order
  const usersWithReferrals = allUsers.filter(user => user.referredBy);
  console.log(`Processing ${usersWithReferrals.length} users with referrals`);
  
  let placedCount = 0;
  let skippedCount = 0;
  
  for (const user of usersWithReferrals) {
    // Skip if already placed in tree
    if (user.treeParent && user.treeLevel > 0) {
      skippedCount++;
      continue;
    }
    
    // Find the direct referrer
    const directReferrer = usersByReferralCode[user.referredBy];
    
    if (!directReferrer) {
      console.warn(`Warning: Referrer not found for user ${user.email} (referral code: ${user.referredBy})`);
      // Place as root user if referrer not found
      user.treeLevel = 1;
      user.treeParent = null;
      user.treePosition = 0;
      user.treeChildren = user.treeChildren || [];
      await user.save();
      skippedCount++;
      continue;
    }
    
    // Find placement using the same logic as findTreePlacement
    const placement = await findTreePlacementForMigration(directReferrer._id, usersByReferralCode);
    
    // Update user with tree placement
    user.treeParent = placement.parentId;
    user.treeLevel = placement.level;
    user.treePosition = placement.position;
    user.treeChildren = user.treeChildren || [];
    await user.save();
    
    // Update parent's treeChildren array
    const parent = await User.findById(placement.parentId);
    if (parent && !parent.treeChildren.includes(user._id)) {
      parent.treeChildren.push(user._id);
      await parent.save();
    }
    
    placedCount++;
    
    if (placedCount % 100 === 0) {
      console.log(`Placed ${placedCount} users in tree...`);
    }
  }
  
  console.log(`Tree structure migration complete:`);
  console.log(`  - Placed: ${placedCount} users`);
  console.log(`  - Skipped (already placed): ${skippedCount} users`);
}

/**
 * Find tree placement for a user during migration
 * Similar to findTreePlacement but works with in-memory user map
 */
async function findTreePlacementForMigration(directReferrerId, usersByReferralCode) {
  const directReferrer = await User.findById(directReferrerId);
  
  if (!directReferrer) {
    throw new Error('Direct referrer not found');
  }
  
  // Ensure treeChildren is initialized
  if (!directReferrer.treeChildren) {
    directReferrer.treeChildren = [];
  }
  
  // If direct referrer has less than 5 children, place directly under them
  if (directReferrer.treeChildren.length < 5) {
    return {
      parentId: directReferrerId,
      level: directReferrer.treeLevel + 1,
      position: directReferrer.treeChildren.length
    };
  }
  
  // Otherwise, find placement using breadth-first search
  const childrenWithTimestamps = await User.find({
    _id: { $in: directReferrer.treeChildren }
  }).select('_id treeChildren treeLevel createdAt').sort({ createdAt: 1 });
  
  const queue = childrenWithTimestamps.map(child => child._id);
  
  while (queue.length > 0) {
    const candidateId = queue.shift();
    const candidate = await User.findById(candidateId)
      .select('_id treeChildren treeLevel createdAt');
    
    if (!candidate) {
      continue;
    }
    
    // Ensure treeChildren is initialized
    if (!candidate.treeChildren) {
      candidate.treeChildren = [];
    }
    
    // If this candidate has space, place here
    if (candidate.treeChildren.length < 5) {
      return {
        parentId: candidateId,
        level: candidate.treeLevel + 1,
        position: candidate.treeChildren.length
      };
    }
    
    // Otherwise, add their children to queue in chronological order
    if (candidate.treeChildren.length > 0) {
      const nextLevelChildren = await User.find({
        _id: { $in: candidate.treeChildren }
      }).select('_id createdAt').sort({ createdAt: 1 });
      
      queue.push(...nextLevelChildren.map(c => c._id));
    }
  }
  
  // Fallback: place directly under referrer even if they have 5+ children
  console.warn(`Warning: Could not find placement, placing directly under referrer`);
  return {
    parentId: directReferrerId,
    level: directReferrer.treeLevel + 1,
    position: directReferrer.treeChildren.length
  };
}

/**
 * Initialize Trust Fund documents
 */
async function initializeTrustFunds() {
  console.log('Initializing Trust Funds...');
  
  // Check if Trust Fund exists
  let trustFund = await TrustFund.findOne({ fundType: 'trust' });
  if (!trustFund) {
    trustFund = new TrustFund({
      fundType: 'trust',
      balance: 0,
      transactions: []
    });
    await trustFund.save();
    console.log('Created Trust Fund');
  } else {
    console.log('Trust Fund already exists');
  }
  
  // Check if Development Trust Fund exists
  let devTrustFund = await TrustFund.findOne({ fundType: 'development' });
  if (!devTrustFund) {
    devTrustFund = new TrustFund({
      fundType: 'development',
      balance: 0,
      transactions: []
    });
    await devTrustFund.save();
    console.log('Created Development Trust Fund');
  } else {
    console.log('Development Trust Fund already exists');
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    console.log('=== User Migration Script ===');
    console.log('Connecting to database...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');
    
    // Step 1: Initialize Trust Funds
    await initializeTrustFunds();
    
    // Step 2: Build tree structure
    await buildTreeStructure();
    
    console.log('\n=== Migration Complete ===');
    console.log('All users have been migrated successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration, buildTreeStructure, initializeTrustFunds };
