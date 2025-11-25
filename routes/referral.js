const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.get("/details", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Find all people referred by this user
        const history = await User.find({ referredBy: user.referralCode })
            .select("name email firstPurchaseDone");

        // Create readable history list
        const formatted = history.map(h => ({
            name: h.name,
            email: h.email,
            reward: h.firstPurchaseDone ? "Reward Added" : "Pending"
        }));

        res.json({
            referralCode: user.referralCode,
            wallet: user.wallet,
            history: formatted
        });

    } catch (err) {
        console.error("Referral fetch error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
