const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,

  // User role (user/admin)
  role: { type: String, default: "user" },

  // Delivery Address
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" }
  },

  // Referral System
  referralCode: { type: String, unique: true, sparse: true, index: true },    // Code generated for this user
  referredBy: { type: String, default: null, index: true },      // Referral code user applied
  wallet: { type: Number, default: 0 },             // Referral earnings
  referrals: { type: Number, default: 0 },          // Number of users referred
  firstPurchaseDone: { type: Boolean, default: false }, // Locks referral after 1st purchase

  // Tree Placement System
  treeParent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null,
    index: true
  },
  treeChildren: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  treeLevel: { 
    type: Number, 
    default: 0 
  },
  treePosition: { 
    type: Number, 
    default: 0 
  },

  // Commission Tracking
  directCommissionEarned: { 
    type: Number, 
    default: 0 
  },
  treeCommissionEarned: { 
    type: Number, 
    default: 0 
  },

  // Metadata
  referralJoinedAt: Date,

  // Suspension System
  suspended: { 
    type: Boolean, 
    default: false,
    index: true
  },
  suspendedAt: Date,
  suspendedReason: String,
  suspendedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },

  // Withdrawal Requests
  withdrawals: [
    {
      amount: Number,
      upi: String,
      bank: String,
      ifsc: String,
      status: { type: String, default: "pending" },
      requestedAt: { type: Date, default: Date.now },
      approvedAt: Date
    }
  ]
}, { timestamps: true });

// Compound index for efficient tree traversal and position queries
userSchema.index({ treeParent: 1, treePosition: 1 });

module.exports = mongoose.model("User", userSchema);
