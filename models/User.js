const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" },

  // 🔥 Referral System Fields
  referralCode: { type: String, unique: true },     // Code user shares
  referredBy: { type: String, default: null },       // Code used during signup
  wallet: { type: Number, default: 0 },              // Reward balance
  referrals: { type: Number, default: 0 },           // Total successful referrals
  firstPurchaseDone: { type: Boolean, default: false } // True after 1st order

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
