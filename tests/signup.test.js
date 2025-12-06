const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const { findTreePlacement } = require('../services/treePlacement');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('User Registration with Tree Placement', () => {
  /**
   * Feature: multi-level-referral-system, Property 2: Referral relationship completeness
   * Validates: Requirements 1.4
   * 
   * For any created referral relationship, the record must contain both user identifiers
   * (referrer and referee) and a timestamp.
   */
  it('Property 2: Referral relationship completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 3, maxLength: 20 }), // User name
        fc.emailAddress(), // User email
        async (userName, userEmail) => {
          // Create a referrer
          const referrer = await User.create({
            name: 'Referrer',
            email: `referrer-${Date.now()}-${Math.random()}@test.com`,
            password: 'hashedpassword',
            referralCode: `REF${Date.now()}${Math.random()}`,
            treeLevel: 1,
            treeChildren: []
          });

          // Simulate new user signup with referral code
          const placement = await findTreePlacement(referrer._id);
          
          const newUser = await User.create({
            name: userName,
            email: `${userEmail}-${Date.now()}-${Math.random()}`,
            password: 'hashedpassword',
            referralCode: `REF${Date.now()}${Math.random()}`,
            referredBy: referrer.referralCode,
            treeParent: placement.parentId,
            treeLevel: placement.level,
            treePosition: placement.position,
            referralJoinedAt: new Date()
          });

          // Verify referral relationship completeness
          // Must contain both user identifiers
          expect(newUser._id).toBeDefined();
          expect(newUser.referredBy).toBe(referrer.referralCode);
          
          // Must contain timestamp
          expect(newUser.referralJoinedAt).toBeDefined();
          expect(newUser.referralJoinedAt).toBeInstanceOf(Date);
          expect(newUser.referralJoinedAt.getTime()).toBeLessThanOrEqual(Date.now());
          
          // Verify we can identify the referrer from the referredBy code
          const foundReferrer = await User.findOne({ referralCode: newUser.referredBy });
          expect(foundReferrer).toBeDefined();
          expect(foundReferrer._id.toString()).toBe(referrer._id.toString());

          // Clean up for next iteration
          await User.deleteMany({});
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-level-referral-system, Property 15: Dual relationship tracking
   * Validates: Requirements 10.3
   * 
   * For any referee placed in the tree, both their direct referrer (referredBy)
   * and tree parent (treeParent) relationships must be recorded.
   */
  it('Property 15: Dual relationship tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }), // Number of existing referrals (0-5)
        fc.string({ minLength: 3, maxLength: 20 }), // User name
        fc.emailAddress(), // User email
        async (numExistingReferrals, userName, userEmail) => {
          // Create a root referrer
          const referrer = await User.create({
            name: 'Referrer',
            email: `referrer-${Date.now()}-${Math.random()}@test.com`,
            password: 'hashedpassword',
            referralCode: `REF${Date.now()}${Math.random()}`,
            treeLevel: 1,
            treeChildren: []
          });

          // Create existing referrals under the referrer
          const existingReferrals = [];
          for (let i = 0; i < numExistingReferrals; i++) {
            const existingUser = await User.create({
              name: `Existing${i}`,
              email: `existing${i}-${Date.now()}-${Math.random()}@test.com`,
              password: 'hashedpassword',
              referralCode: `REF${Date.now()}${i}${Math.random()}`,
              referredBy: referrer.referralCode,
              treeParent: referrer._id,
              treeLevel: 2,
              treePosition: i,
              treeChildren: []
            });
            existingReferrals.push(existingUser);
            referrer.treeChildren.push(existingUser._id);
          }
          await referrer.save();

          // Simulate new user signup with referral code
          const placement = await findTreePlacement(referrer._id);
          
          const newUser = await User.create({
            name: userName,
            email: `${userEmail}-${Date.now()}-${Math.random()}`,
            password: 'hashedpassword',
            referralCode: `REF${Date.now()}${Math.random()}`,
            referredBy: referrer.referralCode, // Direct referrer
            treeParent: placement.parentId, // Tree parent (may differ from direct referrer)
            treeLevel: placement.level,
            treePosition: placement.position,
            referralJoinedAt: new Date()
          });

          // Verify dual relationship tracking
          expect(newUser.referredBy).toBe(referrer.referralCode);
          expect(newUser.treeParent).toBeDefined();
          expect(newUser.treeParent).not.toBeNull();
          
          // Both relationships must be recorded
          expect(newUser.referredBy).toBeTruthy();
          expect(newUser.treeParent).toBeTruthy();

          // If less than 5 existing referrals, tree parent should be the direct referrer
          if (numExistingReferrals < 5) {
            expect(newUser.treeParent.toString()).toBe(referrer._id.toString());
          } else {
            // If 5 or more, tree parent should be one of the existing referrals (spillover)
            const treeParentIds = existingReferrals.map(u => u._id.toString());
            expect(treeParentIds).toContain(newUser.treeParent.toString());
          }

          // Clean up for next iteration
          await User.deleteMany({});
        }
      ),
      { numRuns: 100 }
    );
  });
});
