# Implementation Plan

- [x] 1. Create new database models and schemas





  - [x] 1.1 Create CommissionTransaction model


    - Define schema with orderId, purchaser, commission breakdowns, and status
    - Add indexes on orderId and purchaser fields
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 1.2 Create TrustFund model


    - Define schema with fundType, balance, and transactions array
    - Implement unique constraint on fundType
    - Add methods for adding transactions and updating balance
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [x] 1.3 Update User model with tree placement fields


    - Add treeParent, treeChildren, treeLevel, treePosition fields
    - Add directCommissionEarned and treeCommissionEarned tracking fields
    - Add indexes on treeParent and referralCode fields
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Implement tree placement algorithm




  - [x] 2.1 Create tree placement service module


    - Implement findTreePlacement function using breadth-first search
    - Handle direct placement (first 5 referrals)
    - Handle spillover placement (6th+ referrals)
    - Use timestamps for serial ordering
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.2_
  
  - [x] 2.2 Write property test for initial placement


    - **Property 3: Initial placement correctness**
    - **Validates: Requirements 2.1, 2.2**
  
  - [x] 2.3 Write property test for serial spillover


    - **Property 4: Serial spillover placement**
    - **Validates: Requirements 2.4**
  
  - [x] 2.4 Write property test for timestamp ordering

    - **Property 16: Timestamp-based ordering**
    - **Validates: Requirements 10.2**

- [x] 3. Update user registration to use tree placement




  - [x] 3.1 Modify signup endpoint to call tree placement service


    - When user signs up with referral code, find direct referrer
    - Call findTreePlacement to determine tree parent
    - Update new user with both referredBy and treeParent
    - Increment referrer's referrals count
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 10.3_
  
  - [x] 3.2 Write property test for dual relationship tracking


    - **Property 15: Dual relationship tracking**
    - **Validates: Requirements 10.3**
  
  - [x] 3.3 Write property test for referral relationship completeness


    - **Property 2: Referral relationship completeness**
    - **Validates: Requirements 1.4**

- [x] 4. Implement commission distribution engine





  - [x] 4.1 Create commission calculation service


    - Implement distributeCommissions function
    - Calculate 10% total allocation from order amount
    - Allocate 3% to Trust Fund
    - Calculate and credit 3% direct commission to referrer
    - Allocate 1% to Development Trust Fund
    - Calculate tree commissions with halving pattern (1.5%, 0.75%, etc.)
    - Stop when sum reaches 3% or no more parents exist
    - Allocate remainder to Development Trust Fund
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [x] 4.2 Write property test for commission allocation totals


    - **Property 5: Commission allocation totals 10%**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
  
  - [x] 4.3 Write property test for direct commission calculation


    - **Property 6: Direct commission calculation**
    - **Validates: Requirements 4.2**
  
  - [x] 4.4 Write property test for tree commission halving


    - **Property 8: Tree commission halving**
    - **Validates: Requirements 5.5**
  
  - [x] 4.5 Write property test for tree commission upper bound


    - **Property 9: Tree commission upper bound**
    - **Validates: Requirements 5.6**
  
  - [x] 4.6 Write property test for remainder allocation


    - **Property 10: Remainder allocation**
    - **Validates: Requirements 5.7**

- [x] 5. Implement trust fund management





  - [x] 5.1 Create trust fund service module

    - Implement addToTrustFund function
    - Update fund balance atomically
    - Record transaction with timestamp, amount, and source order
    - Initialize Trust Fund and Development Trust Fund documents if not exist
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [x] 5.2 Write property test for trust fund balance consistency


    - **Property 11: Trust fund balance consistency**
    - **Validates: Requirements 6.1, 6.2**
  
  - [x] 5.3 Write property test for transaction completeness


    - **Property 12: Trust fund transaction completeness**
    - **Validates: Requirements 6.5**

- [x] 6. Integrate commission distribution with order completion




  - [x] 6.1 Update order completion webhook/endpoint


    - After order status changes to "completed", call distributeCommissions
    - Pass orderId, purchaserId, and orderAmount
    - Create CommissionTransaction record
    - Update user wallet balances
    - Handle errors and implement retry logic
    - _Requirements: 3.1, 4.1, 5.1_
  
  - [x] 6.2 Write property test for direct commission crediting


    - **Property 7: Direct commission crediting**
    - **Validates: Requirements 4.3**

- [x] 7. Create referral tree visualization API




  - [x] 7.1 Implement GET /api/referral/tree endpoint


    - Build tree structure recursively from user's treeChildren
    - Include user details (name, referralCode, wallet, level)
    - Distinguish between direct referrals and tree placements
    - Implement depth limiting to prevent performance issues
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 7.2 Write property test for tree query completeness


    - **Property 13: Tree query completeness**
    - **Validates: Requirements 7.1**
  
  - [x] 7.3 Write property test for tree level accuracy


    - **Property 14: Tree level accuracy**
    - **Validates: Requirements 7.3**

- [x] 8. Create commission history API




  - [x] 8.1 Implement GET /api/referral/commissions endpoint


    - Query CommissionTransaction for user's direct commissions
    - Query CommissionTransaction for user's tree commissions
    - Include date, amount, commission type, and source order
    - Calculate total commission earned
    - Implement filtering by date range and commission type
    - Implement pagination for large result sets
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Create admin trust fund management endpoints




  - [x] 9.1 Implement GET /api/admin/trust-funds endpoint


    - Return both Trust Fund and Development Trust Fund balances
    - Include transaction history for each fund
    - Require admin authentication
    - _Requirements: 6.3, 6.4_
  
  - [x] 9.2 Implement GET /api/admin/referral-analytics endpoint


    - Calculate total number of referral relationships
    - Calculate total commissions paid out
    - Display trust fund balances
    - Calculate deepest tree level
    - Calculate average commissions per user
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. Update existing referral endpoints




  - [x] 10.1 Update GET /api/referral/details endpoint

    - Include tree placement information
    - Show both direct referrals and tree structure
    - Display commission breakdown (direct vs tree)
    - _Requirements: 1.3, 7.1, 7.2, 7.3, 7.4_

- [x] 11. Implement error handling and validation





  - [x] 11.1 Add validation for referral code operations


    - Validate referral code exists during signup
    - Prevent self-referral
    - Handle duplicate code generation
    - Return appropriate error responses
  
  - [x] 11.2 Add error handling for commission distribution


    - Validate order data before processing
    - Ensure all amounts are non-negative
    - Use database transactions for atomicity
    - Implement rollback on failures
    - Log all errors for debugging
  
  - [x] 11.3 Add error handling for trust fund operations


    - Validate withdrawal amounts
    - Prevent negative balances
    - Implement transaction retry logic
    - Add reconciliation checks

- [x] 12. Add database indexes for performance






  - [x] 12.1 Create indexes on User model

    - Index on referralCode (unique)
    - Index on referredBy
    - Index on treeParent
    - Compound index on (treeParent, treePosition)
  


  - [x] 12.2 Create indexes on CommissionTransaction model




    - Index on orderId
    - Index on purchaser
    - Index on directReferrer
    - Index on treeCommissions.recipient
    - Compound index on (purchaser, processedAt)

- [x] 13. Update frontend referral dashboard





  - [x] 13.1 Update referral details page


    - Display tree structure visualization
    - Show commission breakdown (direct vs tree)
    - Highlight direct referrals vs spillover placements
    - Show user's position in tree (level, parent)
  
  - [x] 13.2 Update commission history page


    - Display separate tabs for direct and tree commissions
    - Add filtering by date range and commission type
    - Show source order details for each commission
    - Display total earnings summary

- [x] 14. Create data migration script





  - [x] 14.1 Write migration for existing users


    - Backfill treeParent, treeLevel, treePosition for existing users
    - Build tree structure based on existing referredBy relationships
    - Initialize directCommissionEarned and treeCommissionEarned to 0
    - Create initial Trust Fund and Development Trust Fund documents
  
  - [x] 14.2 Write migration for existing orders


    - Process completed orders to create CommissionTransaction records
    - Recalculate commissions using new algorithm
    - Update user wallet balances if needed
    - Update trust fund balances

- [x] 15. Checkpoint - Ensure all tests pass






















  - Ensure all tests pass, ask the user if questions arise.
