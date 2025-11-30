const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// SIGNUP
// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required" });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate referral code
    function generateReferralCode() {
      return "REF" + Math.floor(100000 + Math.random() * 900000);
    }

    // Create user with referral system fields
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      referralCode: generateReferralCode(),
      referredBy: referredBy || null,
      wallet: 0,
      referrals: 0,
      firstPurchaseDone: false
    });

    // Increment referrer's referral count
    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referrals += 1;
        await referrer.save();
        console.log(`Referral count incremented for ${referrer.email}: ${referrer.referrals}`);
      }
    }

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        referralCode: newUser.referralCode
      }
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Error creating user" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "Invalid email or password" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error logging in" });
  }
});

module.exports = router;

const { authenticateToken } = require("../middleware/auth");

// UPDATE PROFILE
router.put("/users/update", authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email)
      return res.status(400).json({ error: "Name and email required" });

    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ error: "User not found" });

    user.name = name;
    user.email = email;

    await user.save();

    res.json({ message: "Profile updated successfully", user });

  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ error: "Server error updating profile" });
  }
});

// GET USER PROFILE
router.get("/users/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user)
      return res.status(404).json({ error: "User not found" });

    res.json({ user });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
    res.status(500).json({ error: "Server error fetching profile" });
  }
});

// UPDATE DELIVERY ADDRESS
router.put("/users/update-address", authenticateToken, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.street || !address.city || !address.state || !address.pincode || !address.phone)
      return res.status(400).json({ error: "All address fields are required" });

    // Validate pincode (6 digits)
    if (!/^\d{6}$/.test(address.pincode))
      return res.status(400).json({ error: "Invalid pincode format" });

    // Validate phone (10 digits)
    if (!/^\d{10}$/.test(address.phone))
      return res.status(400).json({ error: "Invalid phone number format" });

    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ error: "User not found" });

    user.address = {
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      phone: address.phone
    };

    await user.save();

    res.json({ message: "Address updated successfully", user });

  } catch (err) {
    console.error("ADDRESS UPDATE ERROR:", err);
    res.status(500).json({ error: "Server error updating address" });
  }
});
