// routes/orders.js
const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User"); // <-- IMPORTANT
const { authenticateToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * REWARD SEQUENCE:
 * 1 → ₹10
 * 2 → ₹8
 * 3 → ₹6
 * 4 → ₹4
 * 5 → ₹3
 * 6 → ₹1
 * 7+ → ₹0.5
 */
const rewardSequence = [10, 8, 6, 4, 3, 1, 0.5, 0.5, 0.5];

/**
 * CREATE ORDER (with REFERRAL REWARD)
 */
router.post("/", authenticateToken, async (req, res) => {
    try {
        const { items, totalAmount } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "No items in order" });
        }

        // -------------------------
        // 1. Create Order
        // -------------------------
        const order = await Order.create({
            user_id: req.user.id,
            items,
            totalAmount,
            status: "pending"
        });

        // -------------------------
        // 2. Apply Referral Reward
        // -------------------------
        const user = await User.findById(req.user.id);

        // Only reward if:
        // - user was referred
        // - user has NOT used first purchase reward before
        if (user && user.referredBy && !user.firstPurchaseDone) {

            const referrer = await User.findOne({ referralCode: user.referredBy });

            if (referrer) {
                const referralCount = referrer.referrals;

                // get reward based on index, fallback to 0.5
                const reward = rewardSequence[referralCount] ?? 0.5;

                referrer.wallet += reward;
                referrer.referrals += 1;

                await referrer.save();

                // mark user so reward is not repeated
                user.firstPurchaseDone = true;
                await user.save();
            }
        }

        return res.json({ message: "Order created", order });

    } catch (err) {
        console.error("Order create error:", err);
        res.status(500).json({ error: "Error creating order" });
    }
});

/**
 * USER ORDER HISTORY
 */
router.get("/", authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ user_id: req.user.id })
            .sort({ createdAt: -1 });

        res.json({ orders });
    } catch (err) {
        console.error("Order fetch error:", err);
        res.status(500).json({ error: "Error fetching orders" });
    }
});

/**
 * ADMIN — GET ALL ORDERS
 */
router.get("/admin/all", authenticateToken, isAdmin, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user_id", "name email")
            .sort({ createdAt: -1 });

        res.json({ orders });
    } catch (err) {
        console.error("Admin order fetch error:", err);
        res.status(500).json({ error: "Error fetching all orders" });
    }
});

/**
 * UPDATE PAYMENT STATUS (Admin)
 */
router.put("/admin/update-status/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        const allowed = ["pending", "completed", "cancelled", "failed"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!updatedOrder)
            return res.status(404).json({ error: "Order not found" });

        res.json({ message: "Order status updated", order: updatedOrder });

    } catch (err) {
        console.error("Update status error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
