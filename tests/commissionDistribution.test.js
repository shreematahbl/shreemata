const fc = require('fast-check');
const { distributeCommissions, addToTrustFund } = require('../services/commissionDistribution');
const User = require('../models/User');
const CommissionTransaction = require('../models/CommissionTransaction');
const TrustFund = require('../models/TrustFund');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../models/User');
jest.mock('../models/CommissionTransaction');
jest.mock('../models/TrustFund');

// Mock mongoose session for transaction support
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(true),
  abortTransaction: jest.fn().mockResolvedValue(true),
  endSession: jest.fn()
};

jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

describe('Commission Distribution Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.startTransaction.mockClear();
    mockSession.commitTransaction.mockClear();
    mockSession.abortTransaction.mockClear();
    mockSession.endSession.mockClear();
  });

  // Helper to create mock query with session support
  const mockQueryWithSession = (returnValue) => ({
    session: jest.fn().mockResolvedValue(returnValue)
  });

  /**
   * Feature: multi-level-referral-system, Property 6: Direct commission calculation
   * Validates: Requirements 4.2
   * 
   * For any order where the purchaser has a direct referrer, the direct commission 
   * should equal exactly 3% of the order amount.
   */
  it('Property 6: Direct commission calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 100, max: 100000, noNaN: true }), // Order amount
        async (orderAmount) => {
          const orderId = 'order123';
          const purchaserId = 'purchaser123';
          
          // Mock purchaser with direct referrer
          const purchaser = {
            _id: purchaserId,
            referredBy: 'REF123',
            treeParent: null
          };
          
          // Mock direct referrer
          const directReferrer = {
            _id: 'referrer123',
            referralCode: 'REF123',
            wallet: 0,
            directCommissionEarned: 0,
            save: jest.fn().mockResolvedValue(true)
          };
          
          // Setup User.findById mock with session support
          User.findById.mockReturnValue(mockQueryWithSession(purchaser));
          
          // Setup User.findOne mock for direct referrer with session support
          User.findOne.mockReturnValue(mockQueryWithSession(directReferrer));
          
          // Mock TrustFund with session support
          const mockTrustFund = {
            fundType: 'trust',
            balance: 0,
            transactions: [],
            addTransaction: jest.fn().mockResolvedValue(true)
          };
          
          const mockDevTrustFund = {
            fundType: 'development',
            balance: 0,
            transactions: [],
            addTransaction: jest.fn().mockResolvedValue(true)
          };
          
          TrustFund.findOne.mockImplementation(({ fundType }) => {
            const fund = fundType === 'trust' ? mockTrustFund : (fundType === 'development' ? mockDevTrustFund : null);
            return mockQueryWithSession(fund);
          });
          
          // Mock CommissionTransaction
          const savedTransaction = {
            orderId,
            purchaser: purchaserId,
            orderAmount,
            trustFundAmount: 0,
            directCommissionAmount: 0,
            devTrustFundAmount: 0,
            treeCommissions: [],
            remainderToDevFund: 0,
            status: 'pending',
            save: jest.fn().mockResolvedValue(true)
          };
          
          CommissionTransaction.mockImplementation(() => savedTransaction);
          CommissionTransaction.findOne = jest.fn().mockResolvedValue(null);
          
          // Execute commission distribution
          await distributeCommissions(orderId, purchaserId, orderAmount);
          
          // Verify direct commission is exactly 3% of order amount
          const expectedDirectCommission = orderAmount * 0.03;
          const tolerance = 0.01; // 1 cent tolerance
          expect(Math.abs(directReferrer.wallet - expectedDirectCommission)).toBeLessThan(tolerance);
          
          // Reset for next iteration
          jest.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});
