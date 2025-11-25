const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * Build unlimited-level referral tree (downline)
 */
async function buildTree(referralCode) {
    const children = await User.find({ referredBy: referralCode })
        .select("name referralCode wallet referrals");

    const result = [];

    for (const child of children) {
        const subtree = await buildTree(child.referralCode);

        result.push({
            id: child._id,
            name: child.name,
            referralCode: child.referralCode,
            wallet: child.wallet || 0,
            referrals: child.referrals || 0,
            children: subtree
        });
    }

    return result;
}

/**
 * GET /api/referral/tree
 * Returns referral tree of the logged-in user
 */
router.get("/tree", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("name referralCode wallet referrals");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const tree = await buildTree(user.referralCode);

        res.json({
            root: {
                id: user._id,
                name: user.name,
                referralCode: user.referralCode,
                wallet: user.wallet || 0,
                referrals: user.referrals || 0
            },
            children: tree
        });

    } catch (e) {
        console.error("TREE ERROR", e);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
