const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const sendMail = require("../utils/sendMail");

const router = express.Router();

router.get("/details", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const Order = require("../models/Order");

        // Find all people referred by this user (Level 1)
        const referredUsers = await User.find({ referredBy: user.referralCode })
            .select("name email firstPurchaseDone createdAt referralCode");

        // Calculate commission for each referred user from ALL their orders
        const formatted = await Promise.all(referredUsers.map(async (h) => {
            let commission = 0;
            
            if (h.firstPurchaseDone) {
                // Find ALL completed orders by this user
                const allOrders = await Order.find({ 
                    user_id: h._id, 
                    status: "completed",
                    rewardApplied: true
                });
                
                // Sum up 3% commission from all orders
                allOrders.forEach(order => {
                    commission += (order.totalAmount * 3) / 100;
                });
            }
            
            return {
                name: h.name,
                email: h.email,
                reward: h.firstPurchaseDone ? "Reward Added" : "Pending",
                commission: commission,
                joinedDate: h.createdAt,
                level: 1
            };
        }));

        // Get multi-level commissions (Level 2, 3, 4, etc.)
        const allCommissions = [];
        
        // Function to get all descendants and their commissions from ALL orders
        async function getDescendantCommissions(parentCode, level, percentage) {
            const descendants = await User.find({ referredBy: parentCode })
                .select("name email firstPurchaseDone createdAt referralCode");
            
            for (const desc of descendants) {
                if (desc.firstPurchaseDone) {
                    // Find ALL completed orders by this user
                    const allOrders = await Order.find({ 
                        user_id: desc._id, 
                        status: "completed",
                        rewardApplied: true
                    });
                    
                    // Sum up commission from all orders
                    let totalCommission = 0;
                    allOrders.forEach(order => {
                        totalCommission += (order.totalAmount * percentage) / 100;
                    });
                    
                    if (totalCommission > 0) {
                        allCommissions.push({
                            name: desc.name,
                            email: desc.email,
                            reward: "Reward Added",
                            commission: totalCommission,
                            joinedDate: desc.createdAt,
                            level: level
                        });
                    }
                }
                
                // Recursively get next level (each level gets half the percentage)
                if (level < 10) {
                    await getDescendantCommissions(desc.referralCode, level + 1, percentage / 2);
                }
            }
        }

        // Get Level 2+ commissions (starting with 1.5% for level 2)
        for (const ref of referredUsers) {
            await getDescendantCommissions(ref.referralCode, 2, 1.5);
        }

        // Combine direct referrals and multi-level commissions
        const allHistory = [...formatted, ...allCommissions].sort((a, b) => 
            new Date(b.joinedDate) - new Date(a.joinedDate)
        );

        res.json({
            referralCode: user.referralCode,
            wallet: user.wallet,
            referrals: user.referrals || 0,
            history: allHistory
        });

    } catch (err) {
        console.error("Referral fetch error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/withdraw", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const amount = Number(req.body.amount);

        if (!amount || amount < 50) {
            return res.status(400).json({ error: "Minimum withdrawal is ₹50" });
        }

        if (user.wallet < amount) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        // Deduct from wallet immediately
        user.wallet -= amount;

        // Log withdrawal entry
        user.withdrawals.push({
            amount,
            date: new Date(),
            status: "pending"
        });

        await user.save();

        await sendMail(
    user.email,
    "Withdrawal Request Submitted",
    `
    <h2>Hello ${user.name},</h2>
    <p>Your withdrawal request of <b>₹${amount}</b> has been submitted.</p>
    <p>Status: <b>Pending Admin Approval</b></p>
    <br>
    <p>BookStore Team</p>
    `
);


        return res.json({ message: "Withdrawal request submitted!" });

    } catch (err) {
        console.error("Withdraw error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Get referral history with commission details
router.get("/history", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Find all people referred by this user
        const referredUsers = await User.find({ referredBy: user.referralCode })
            .select("name email firstPurchaseDone createdAt")
            .sort({ createdAt: -1 });

        // Calculate commission for each referral (3% of their first purchase)
        // For now, we'll show estimated commission
        const referrals = referredUsers.map(ref => ({
            name: ref.name,
            email: ref.email,
            firstPurchaseDone: ref.firstPurchaseDone,
            createdAt: ref.createdAt,
            commission: ref.firstPurchaseDone ? 0 : 0 // Will be calculated from actual purchases
        }));

        res.json({
            referrals
        });

    } catch (err) {
        console.error("Referral history error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
