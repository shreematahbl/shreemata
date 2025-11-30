const express = require("express");
const User = require("../models/User");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const sendMail = require("../utils/sendMail");


const router = express.Router();

/* -------------------------------------------
   1️⃣ Admin — Get all withdrawal requests
--------------------------------------------*/
router.get("/", authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find({
            "withdrawals.0": { $exists: true }
        }).select("name email withdrawals");

        let list = [];

        users.forEach(user => {
            user.withdrawals.forEach(w => {
                list.push({
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    amount: w.amount,
                    date: w.date || w.requestedAt || null,
                    status: w.status,
                    withdrawId: w._id,
                    upi: w.upi || null,
                    bank: w.bank || null,
                    ifsc: w.ifsc || null
                });
            });
        });

        res.json(list);

    } catch (err) {
        console.error("Admin withdraw fetch error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* -------------------------------------------
   2️⃣ Admin — Approve withdrawal
--------------------------------------------*/
router.post("/approve", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, withdrawId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const withdrawal = user.withdrawals.id(withdrawId);
        if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });

        withdrawal.status = "approved";
        await user.save();

        await sendMail(
    user.email,
    "Withdrawal Approved",
    `
    <h2>Hello ${user.name},</h2>
    <p>Your withdrawal of <b>₹${withdrawal.amount}</b> has been approved.</p>
    <p>The money will be transferred shortly.</p>
    <br>
    <p>BookStore Team</p>
    `
);

        res.json({ message: "Withdrawal approved" });

    } catch (err) {
        console.error("Approve error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* -------------------------------------------
   3️⃣ Admin — Reject withdrawal
--------------------------------------------*/
router.post("/reject", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId, withdrawId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const withdrawal = user.withdrawals.id(withdrawId);
        if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });

        // refund amount
        user.wallet += withdrawal.amount;

        withdrawal.status = "rejected";
        await user.save();

        await sendMail(
    user.email,
    "Withdrawal Rejected",
    `
    <h2>Hello ${user.name},</h2>
    <p>Your withdrawal request of <b>₹${withdrawal.amount}</b> was rejected.</p>
    <p>The amount has been refunded to your wallet.</p>
    <br>
    <p>BookStore Team</p>
    `
);


        res.json({ message: "Withdrawal rejected & refunded" });

    } catch (err) {
        console.error("Reject error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
