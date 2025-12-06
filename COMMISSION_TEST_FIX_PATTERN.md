# Fix Pattern for Commission Distribution Tests

## Problem
The commission distribution tests fail with "Connection operation buffering timed out" because they try to use MongoDB transactions (`mongoose.startSession()`) but the test environment uses mocks instead of a real database connection.

## Solution
Add mongoose session mocking to the test file.

## Step-by-Step Fix

### 1. Add mongoose import and session mock at the top of the file

After the existing imports and mocks, add:

```javascript
const mongoose = require('mongoose');

// Mock mongoose session for transaction support
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(true),
  abortTransaction: jest.fn().mockResolvedValue(true),
  endSession: jest.fn()
};

jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
```

### 2. Update beforeEach to clear session mocks

In the `beforeEach` block, add:

```javascript
beforeEach(() => {
  jest.clearAllMocks();
  mockSession.startTransaction.mockClear();
  mockSession.commitTransaction.mockClear();
  mockSession.abortTransaction.mockClear();
  mockSession.endSession.mockClear();
});
```

### 3. Add helper function for session-aware queries

After the `beforeEach` block, add:

```javascript
// Helper to create mock query with session support
const mockQueryWithSession = (returnValue) => ({
  session: jest.fn().mockResolvedValue(returnValue)
});
```

### 4. Update all User.findById mocks

Replace patterns like:
```javascript
User.findById.mockResolvedValue(purchaser);
```

With:
```javascript
User.findById.mockReturnValue(mockQueryWithSession(purchaser));
```

### 5. Update all User.findOne mocks

Replace patterns like:
```javascript
User.findOne.mockResolvedValue(directReferrer);
```

With:
```javascript
User.findOne.mockReturnValue(mockQueryWithSession(directReferrer));
```

### 6. Update User.findById with implementation callbacks

Replace patterns like:
```javascript
User.findById.mockImplementation((id) => {
  if (id === purchaserId) {
    return Promise.resolve(purchaser);
  }
  // ... more conditions
  return Promise.resolve(null);
});
```

With:
```javascript
User.findById.mockImplementation((id) => {
  let result = null;
  if (id === purchaserId) {
    result = purchaser;
  }
  // ... more conditions
  return mockQueryWithSession(result);
});
```

### 7. Update TrustFund.findOne mocks

Replace patterns like:
```javascript
TrustFund.findOne.mockImplementation(({ fundType }) => {
  if (fundType === 'trust') {
    return Promise.resolve(mockTrustFund);
  } else if (fundType === 'development') {
    return Promise.resolve(mockDevTrustFund);
  }
  return Promise.resolve(null);
});
```

With:
```javascript
TrustFund.findOne.mockImplementation(({ fundType }) => {
  const fund = fundType === 'trust' ? mockTrustFund : 
               (fundType === 'development' ? mockDevTrustFund : null);
  return mockQueryWithSession(fund);
});
```

### 8. Add CommissionTransaction.findOne mock

In each test, after creating the CommissionTransaction mock, add:

```javascript
CommissionTransaction.findOne = jest.fn().mockResolvedValue(null);
```

This ensures the duplicate check passes.

## Example: Complete Test Structure

```javascript
it('Property 6: Direct commission calculation', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.float({ min: 100, max: 100000, noNaN: true }),
      async (orderAmount) => {
        const orderId = 'order123';
        const purchaserId = 'purchaser123';
        
        const purchaser = {
          _id: purchaserId,
          referredBy: 'REF123',
          treeParent: null
        };
        
        const directReferrer = {
          _id: 'referrer123',
          referralCode: 'REF123',
          wallet: 0,
          directCommissionEarned: 0,
          save: jest.fn().mockResolvedValue(true)
        };
        
        // WITH SESSION SUPPORT
        User.findById.mockReturnValue(mockQueryWithSession(purchaser));
        User.findOne.mockReturnValue(mockQueryWithSession(directReferrer));
        
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
        
        // WITH SESSION SUPPORT
        TrustFund.findOne.mockImplementation(({ fundType }) => {
          const fund = fundType === 'trust' ? mockTrustFund : 
                       (fundType === 'development' ? mockDevTrustFund : null);
          return mockQueryWithSession(fund);
        });
        
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
        
        await distributeCommissions(orderId, purchaserId, orderAmount);
        
        const expectedDirectCommission = orderAmount * 0.03;
        const tolerance = 0.01;
        expect(Math.abs(directReferrer.wallet - expectedDirectCommission)).toBeLessThan(tolerance);
        
        jest.clearAllMocks();
      }
    ),
    { numRuns: 100 }
  );
});
```

## Tests That Need This Fix

1. Property 5: Commission allocation totals 10%
2. Property 6: Direct commission calculation
3. Property 7: Direct commission crediting
4. Property 8: Tree commission halving
5. Property 9: Tree commission upper bound
6. Property 10: Remainder allocation

## Notes

- Property 11 and 12 don't need the full fix as they don't call `distributeCommissions`
- The pattern is consistent across all tests - just apply the same transformations
- Make sure to add `CommissionTransaction.findOne = jest.fn().mockResolvedValue(null);` in each test
- The `mockQueryWithSession` helper makes the code cleaner and easier to maintain
