const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { findTreePlacement } = require("../services/treePlacement");

const router = express.Router();

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    // Validate required fields
    if (!name || !email || !password)
      return res.status(400).json({ 
        error: "All fields are required",
        code: "MISSING_FIELDS" 
      });

    if (password.length < 6)
      return res.status(400).json({ 
        error: "Password must be at least 6 characters",
        code: "INVALID_PASSWORD_LENGTH" 
      });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: "Invalid email format",
        code: "INVALID_EMAIL_FORMAT" 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ 
        error: "Email already registered",
        code: "EMAIL_EXISTS" 
      });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code with retry logic
    async function generateUniqueReferralCode(maxRetries = 5) {
      for (let i = 0; i < maxRetries; i++) {
        const code = "REF" + Math.floor(100000 + Math.random() * 900000);
        const existingCode = await User.findOne({ referralCode: code });
        if (!existingCode) {
          return code;
        }
      }
      throw new Error("Unable to generate unique referral code");
    }

    // Handle tree placement if user was referred
    let treePlacementData = {
      treeParent: null,
      treeLevel: 1, // Root level for users without referrer
      treePosition: 0
    };

    let directReferrer = null;

    if (referredBy) {
      // Validate referral code format
      if (!/^REF\d{6}$/.test(referredBy)) {
        return res.status(400).json({ 
          error: "Invalid referral code format",
          code: "INVALID_REFERRAL_FORMAT" 
        });
      }

      // Find the direct referrer
      directReferrer = await User.findOne({ referralCode: referredBy });
      
      if (!directReferrer) {
        return res.status(400).json({ 
          error: "Referral code does not exist",
          code: "REFERRAL_CODE_NOT_FOUND" 
        });
      }

      // Find tree placement for the new user
      try {
        const placement = await findTreePlacement(directReferrer._id);
        treePlacementData = {
          treeParent: placement.parentId,
          treeLevel: placement.level,
          treePosition: placement.position
        };
      } catch (error) {
        console.error("Tree placement error:", error);
        return res.status(500).json({ 
          error: "Error determining tree placement",
          code: "TREE_PLACEMENT_ERROR",
          details: error.message 
        });
      }
    }

    // Generate unique referral code
    let newReferralCode;
    try {
      newReferralCode = await generateUniqueReferralCode();
    } catch (error) {
      console.error("Referral code generation error:", error);
      return res.status(500).json({ 
        error: "Error generating referral code",
        code: "REFERRAL_CODE_GENERATION_ERROR" 
      });
    }

    // Create user with referral system fields and tree placement
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      referralCode: newReferralCode,
      referredBy: referredBy || null,
      wallet: 0,
      referrals: 0,
      firstPurchaseDone: false,
      treeParent: treePlacementData.treeParent,
      treeLevel: treePlacementData.treeLevel,
      treePosition: treePlacementData.treePosition,
      referralJoinedAt: referredBy ? new Date() : null
    });

    // Prevent self-referral check (after user creation to get their code)
    if (referredBy && referredBy === newUser.referralCode) {
      // This should never happen due to timing, but adding as safety check
      await User.findByIdAndDelete(newUser._id);
      return res.status(400).json({ 
        error: "Cannot refer yourself",
        code: "SELF_REFERRAL_NOT_ALLOWED" 
      });
    }

    // Update tree parent's children array and increment referrer's referral count
    if (referredBy && directReferrer) {
      // Increment direct referrer's referral count
      directReferrer.referrals += 1;
      await directReferrer.save();
      console.log(`Referral count incremented for ${directReferrer.email}: ${directReferrer.referrals}`);

      // Add new user to tree parent's children array
      const treeParent = await User.findById(treePlacementData.treeParent);
      if (treeParent) {
        treeParent.treeChildren.push(newUser._id);
        await treeParent.save();
        console.log(`Added ${newUser.email} to tree parent ${treeParent.email}'s children`);
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
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        return res.status(400).json({ 
          error: "Email already registered",
          code: "EMAIL_EXISTS" 
        });
      }
      if (err.keyPattern?.referralCode) {
        return res.status(500).json({ 
          error: "Error generating unique referral code",
          code: "REFERRAL_CODE_DUPLICATE" 
        });
      }
    }
    
    res.status(500).json({ 
      error: "Error creating user",
      code: "SIGNUP_ERROR" 
    });
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

// VALIDATE REFERRAL CODE
router.post("/validate-referral-code", async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ 
        error: "Referral code is required",
        code: "MISSING_REFERRAL_CODE",
        valid: false 
      });
    }

    // Validate referral code format
    if (!/^REF\d{6}$/.test(referralCode)) {
      return res.status(400).json({ 
        error: "Invalid referral code format",
        code: "INVALID_REFERRAL_FORMAT",
        valid: false 
      });
    }

    // Check if referral code exists
    const referrer = await User.findOne({ referralCode }).select('name email referralCode');
    
    if (!referrer) {
      return res.status(404).json({ 
        error: "Referral code does not exist",
        code: "REFERRAL_CODE_NOT_FOUND",
        valid: false 
      });
    }

    res.json({ 
      valid: true,
      message: "Valid referral code",
      referrer: {
        name: referrer.name,
        referralCode: referrer.referralCode
      }
    });

  } catch (err) {
    console.error("Referral code validation error:", err);
    res.status(500).json({ 
      error: "Error validating referral code",
      code: "VALIDATION_ERROR",
      valid: false 
    });
  }
});

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
