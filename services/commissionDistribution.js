const User = require('../models/User');
const CommissionTransaction = require('../models/CommissionTransaction');
const TrustFund = require('../models/TrustFund');
const mongoose = require('mongoose');

/**
 * Add funds to a trust fund (Trust Fund or Development Trust Fund)
 * 
 * @param {String} fundType - 'trust' or 'development'
 * @param {Number} amount - Amount to add
 * @param {String} orderId - Source order ID
 * @param {String} type - Transaction type ('order_allocation', 'remainder', 'withdrawal')
 * @param {String} description - Optional description
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Promise<TrustFund>} Updated trust fund document
 */
async function addToTrustFund(fundType, amount, orderId, type = 'order_allocation', description = '', session = null) {
  // Validate fund type
  if (!['trust', 'development'].includes(fundType)) {
    throw new Error(`Invalid fund type: ${fundType}. Must be 'trust' or 'development'`);
  }

  // Validate amount is non-negative
  if (typeof amount !== 'number' || amount < 0) {
    throw new Error(`Invalid amount: ${amount}. Amount must be a non-negative number`);
  }

  // Skip if amount is zero
  if (amount === 0) {
    console.log(`Skipping zero amount allocation to ${fundType} fund`);
    return null;
  }

  const query = session ? TrustFund.findOne({ fundType }).session(session) : TrustFund.findOne({ fundType });
  let trustFund = await query;
  
  // Initialize trust fund if it doesn't exist
  if (!trustFund) {
    trustFund = new TrustFund({ fundType, balance: 0, transactions: [] });
  }
  
  // Add transaction and update balance
  await trustFund.addTransaction(amount, type, orderId, description, session);
  
  return trustFund;
}

/**
 * Distribute commissions for a completed order
 * Implements the 10% allocation strategy:
 * - 6% direct commission to referrer
 * - 3% for tree commissions (with halving pattern: 1.5%, 0.75%, 0.375%, etc.)
 * - 1% to Development Trust Fund
 * - Remainder to Development Trust Fund
 * 
 * @param {String} orderId - The order ID
 * @param {String} purchaserId - The user who made the purchase
 * @param {Number} orderAmount - The total order amount
 * @returns {Promise<CommissionTransaction>} The created commission transaction
 */
async function distributeCommissions(orderId, purchaserId, orderAmount) {
  // Validate input parameters
  if (!orderId) {
    throw new Error('Order ID is required');
  }

  if (!purchaserId) {
    throw new Error('Purchaser ID is required');
  }

  if (typeof orderAmount !== 'number' || orderAmount <= 0) {
    throw new Error(`Invalid order amount: ${orderAmount}. Must be a positive number`);
  }

  // Check if commission has already been processed for this order
  const existingTransaction = await CommissionTransaction.findOne({ orderId });
  if (existingTransaction && existingTransaction.status === 'completed') {
    console.log(`Commission already processed for order ${orderId}`);
    return existingTransaction;
  }

  // Start a database session for transaction atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchaser = await User.findById(purchaserId).session(session);
    
    if (!purchaser) {
      throw new Error(`Purchaser not found: ${purchaserId}`);
    }
    
    // Create commission transaction record
    const transaction = new CommissionTransaction({
      orderId,
      purchaser: purchaserId,
      orderAmount,
      status: 'pending'
    });
    
    // 1. Allocate 3% to Trust Fund
    const trustFundAmount = orderAmount * 0.03;
    if (trustFundAmount < 0) {
      throw new Error('Trust fund amount cannot be negative');
    }
    await addToTrustFund('trust', trustFundAmount, orderId, 'order_allocation', 'Order commission allocation', session);
    transaction.trustFundAmount = trustFundAmount;
    
    // 2. Calculate and credit Direct Commission (3%)
    const directCommission = orderAmount * 0.03;
    if (directCommission < 0) {
      throw new Error('Direct commission amount cannot be negative');
    }

    if (purchaser.referredBy) {
      const directReferrer = await User.findOne({ referralCode: purchaser.referredBy }).session(session);
      
      if (directReferrer) {
        // Check if user is suspended
        if (directReferrer.suspended) {
          console.log(`Direct referrer ${directReferrer.email} is suspended, allocating commission to Trust Fund`);
          await addToTrustFund('trust', directCommission, orderId, 'order_allocation', `Direct commission - user suspended (${directReferrer.email})`, session);
          transaction.trustFundAmount += directCommission;
          transaction.directReferrer = directReferrer._id;
          transaction.directCommissionAmount = directCommission;
        } else {
          // Validate wallet update won't result in negative balance
          if (directReferrer.wallet + directCommission < 0) {
            throw new Error('Wallet update would result in negative balance');
          }

          directReferrer.wallet += directCommission;
          directReferrer.directCommissionEarned += directCommission;
          await directReferrer.save({ session });
          
          transaction.directReferrer = directReferrer._id;
          transaction.directCommissionAmount = directCommission;
          
          console.log(`Direct commission of ${directCommission} credited to ${directReferrer.email}`);
        }
      } else {
        // No direct referrer found, allocate to Trust Fund
        console.log(`Direct referrer not found for code ${purchaser.referredBy}, allocating to Trust Fund`);
        await addToTrustFund('trust', directCommission, orderId, 'order_allocation', 'Direct commission - no referrer', session);
        transaction.trustFundAmount += directCommission;
      }
    } else {
      // No referral code used, allocate to Trust Fund
      console.log('No referral code used, allocating direct commission to Trust Fund');
      await addToTrustFund('trust', directCommission, orderId, 'order_allocation', 'Direct commission - no referrer', session);
      transaction.trustFundAmount += directCommission;
    }
    
    // 3. Calculate 1% for Development Trust Fund (will be added later with remainder)
    const devTrustBaseAmount = orderAmount * 0.01;
    if (devTrustBaseAmount < 0) {
      throw new Error('Development trust fund amount cannot be negative');
    }
    transaction.devTrustFundAmount = devTrustBaseAmount;
    
    // 4. Distribute Tree Commissions (3% total)
    const treeCommissionPool = orderAmount * 0.03;
    let remainingPool = treeCommissionPool;
    let currentParent = purchaser.treeParent;
    let level = 1;
    let percentage = 1.5; // Start with 1.5% for first level
    const maxLevels = 20; // Safety limit to prevent infinite loops
    
    while (currentParent && remainingPool > 0.01 && level <= maxLevels) {
      const parent = await User.findById(currentParent).session(session);
      
      if (!parent) {
        console.log(`Tree parent not found at level ${level}, stopping tree commission distribution`);
        break;
      }
      
      // Skip tree commission if this parent is also the direct referrer
      // (They already got direct commission, so no tree commission for their own direct referral)
      const isDirectReferrer = purchaser.referredBy && parent.referralCode === purchaser.referredBy;
      
      if (isDirectReferrer) {
        console.log(`Skipping tree commission for ${parent.email} - they are the direct referrer`);
        currentParent = parent.treeParent;
        level++;
        percentage = percentage / 2;
        continue;
      }
      
      const commissionAmount = orderAmount * (percentage / 100);
      
      // Validate commission amount
      if (commissionAmount < 0) {
        throw new Error('Tree commission amount cannot be negative');
      }
      
      // Only distribute if we have enough in the pool
      if (commissionAmount <= remainingPool) {
        // Check if user is suspended
        if (parent.suspended) {
          console.log(`Tree parent ${parent.email} is suspended, allocating commission to Trust Fund`);
          await addToTrustFund('trust', commissionAmount, orderId, 'order_allocation', `Tree commission - user suspended (${parent.email})`, session);
          transaction.trustFundAmount += commissionAmount;
          
          transaction.treeCommissions.push({
            recipient: parent._id,
            level,
            percentage,
            amount: commissionAmount
          });
        } else {
          // Validate wallet update
          if (parent.wallet + commissionAmount < 0) {
            throw new Error('Wallet update would result in negative balance');
          }

          parent.wallet += commissionAmount;
          parent.treeCommissionEarned += commissionAmount;
          await parent.save({ session });
          
          transaction.treeCommissions.push({
            recipient: parent._id,
            level,
            percentage,
            amount: commissionAmount
          });
          
          console.log(`Tree commission of ${commissionAmount} (${percentage}%) credited to ${parent.email} at level ${level - 1}`);
        }
        
        remainingPool -= commissionAmount;
        currentParent = parent.treeParent;
        level++;
        percentage = percentage / 2; // Halve for next level
      } else {
        console.log(`Insufficient pool remaining (${remainingPool}) for commission amount ${commissionAmount}`);
        break;
      }
    }

    if (level > maxLevels) {
      console.warn(`Reached maximum tree level limit (${maxLevels}), stopping distribution`);
    }
    
    // 5. Add Development Trust Fund (1% + any remainder from tree commission)
    transaction.remainderToDevFund = remainingPool;
    const totalDevFundAmount = devTrustBaseAmount + remainingPool;
    
    if (totalDevFundAmount < 0) {
      throw new Error('Development trust fund amount cannot be negative');
    }
    
    if (totalDevFundAmount > 0) {
      await addToTrustFund(
        'development', 
        totalDevFundAmount, 
        orderId, 
        'order_allocation', 
        `Order commission: 1% (₹${devTrustBaseAmount.toFixed(2)}) + Tree remainder (₹${remainingPool.toFixed(2)})`, 
        session
      );
      console.log(`Development Trust Fund: ₹${totalDevFundAmount.toFixed(2)} (1% + remainder)`);
    }
    
    // Verify total allocation equals 10%
    const totalAllocated = transaction.trustFundAmount + 
                          transaction.directCommissionAmount + 
                          transaction.devTrustFundAmount + 
                          transaction.treeCommissions.reduce((sum, tc) => sum + tc.amount, 0) +
                          (transaction.remainderToDevFund || 0);
    
    const expectedTotal = orderAmount * 0.10;
    const tolerance = 0.01; // Allow 1 cent tolerance for rounding
    
    if (Math.abs(totalAllocated - expectedTotal) > tolerance) {
      throw new Error(
        `Commission allocation mismatch: allocated ${totalAllocated}, expected ${expectedTotal}`
      );
    }
    
    transaction.status = 'completed';
    await transaction.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    console.log(`Commission distribution completed successfully for order ${orderId}`);
    
    return transaction;

  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    console.error('Commission distribution error, transaction rolled back:', error);
    
    // Update transaction status to failed if it was created
    try {
      await CommissionTransaction.findOneAndUpdate(
        { orderId },
        { status: 'failed' }
      );
    } catch (updateError) {
      console.error('Error updating transaction status:', updateError);
    }
    
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  distributeCommissions,
  addToTrustFund
};
