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
  referralCode: { type: String, unique: true },    // Code generated for this user
  referredBy: { type: String, default: null },      // Referral code user applied
  wallet: { type: Number, default: 0 },             // Referral earnings
  referrals: { type: Number, default: 0 },          // Number of users referred
  firstPurchaseDone: { type: Boolean, default: false }, // Locks referral after 1st purchase

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

module.exports = mongoose.model("User", userSchema);
