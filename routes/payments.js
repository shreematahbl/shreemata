// routes/payments.js
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Reward sequence (0-based index = current referrer.referrals count)
const rewardSequence = [10, 8, 6, 4, 3, 1, 0.5, 0.5, 0.5];

// Helper to apply referral reward safely (idempotent)
async function applyReferralRewardForOrder(order) {
    if (!order) return { applied: false, reason: "no-order" };

    // Avoid double applying
    if (order.rewardApplied) {
        return { applied: false, reason: "already-rewarded" };
    }

    // The buyer
    const buyer = await User.findById(order.user_id);
    if (!buyer) return { applied: false, reason: "buyer-not-found" };

    // Only first purchase reward
    if (!buyer.referredBy || buyer.firstPurchaseDone) {
        return { applied: false, reason: "not-eligible" };
    }

    // Reward table (level 1 → highest reward)
    const rewardSequence = [10, 8, 6, 4, 3, 1, 0.5, 0.5, 0.5];

    // Start with LEVEL 1
    let currentReferralCode = buyer.referredBy;
    let level = 0;
    let results = [];

    while (currentReferralCode) {
        // Find the referrer of this level
        const referrer = await User.findOne({ referralCode: currentReferralCode });
        if (!referrer) break;

        // Determine reward
        const reward = rewardSequence[level] ?? 0.5;

        // Add reward to this referrer's wallet
        referrer.wallet = Number(referrer.wallet || 0) + reward;
        referrer.referrals = Number(referrer.referrals || 0) + 1;
        await referrer.save();

        // Push to result log
        results.push({
            level: level + 1,
            reward,
            referrerId: referrer._id
        });

        // Next level → referrer of current referrer
        currentReferralCode = referrer.referredBy;
        level++;

        // Safety break to avoid infinite loops
        if (level > 50) break;
    }

    // Mark buyer as first purchase complete
    buyer.firstPurchaseDone = true;
    await buyer.save();

    // Mark order reward applied
    order.rewardApplied = true;
    await order.save();

    return { applied: true, chain: results };
}

// ===============================================
// 1️⃣ CREATE RAZORPAY ORDER
// ===============================================
router.post("/create-order", authenticateToken, async (req, res) => {
  try {
    const { amount, items } = req.body;
    if (!amount) return res.status(400).json({ error: "Amount missing" });

    const options = {
      amount: Math.round(amount * 100), // convert to paise
      currency: "INR",
      receipt: "order_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    const dbOrder = await Order.create({
      user_id: req.user.id,
      items: items || [],
      totalAmount: amount,
      status: "pending",
      rewardApplied: false,
      razorpay_order_id: order.id
    });

    res.json({ order, dbOrder });

  } catch (err) {
    console.error("Create-order error:", err);
    res.status(500).json({ error: "Error creating order" });
  }
});

// ===============================================
// 2️⃣ VERIFY PAYMENT (Called by frontend after success)
//    This route verifies signature, updates order, and applies referral reward.
// ===============================================
router.post("/verify", authenticateToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      totalAmount
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ error: "Missing payment fields" });

    // Signature check
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.warn("Verify: invalid signature", { razorpay_order_id, razorpay_payment_id });
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Update order to completed
    const updatedOrder = await Order.findOneAndUpdate(
      { razorpay_order_id },
      {
        status: "completed",
        razorpay_payment_id,
        items,
        totalAmount
      },
      { new: true }
    );

    if (!updatedOrder) {
      console.warn("Verify: order not found for razorpay_order_id", razorpay_order_id);
      return res.status(404).json({ error: "Order not found" });
    }

    // Attempt to apply referral reward (idempotent)
    try {
      const result = await applyReferralRewardForOrder(updatedOrder);
      if (result.applied) {
        console.log("Verify: referral reward applied:", result);
      } else {
        console.log("Verify: referral not applied:", result);
      }
    } catch (e) {
      console.error("Verify: error applying referral reward", e);
      // don't block success response; reward can be applied by webhook if needed
    }

    res.json({
      message: "Payment verified & order updated",
      order: updatedOrder
    });

  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Server error verifying payment" });
  }
});

// ===============================================
// 3️⃣ WEBHOOK (Razorpay server -> your /api/payments/webhook endpoint)
//    NOTE: server.js routes raw body to POST /api/payments/webhook
//    Here we handle signature and ensure referral reward (also idempotent).
// ===============================================
router.post("/webhook", async (req, res) => {
  try {
    // IMPORTANT: server.js should mount the raw body for /api/payments/webhook BEFORE express.json()
    // and forward the raw body here as req.body (Buffer/string). If you used the pattern that sets req.isWebhook,
    // you can access raw body via req.body (string/Buffer). Adjust if needed.
    const rawBody = req.body; // this should be raw string/body
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Compute signature using raw body string
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const signature = req.headers["x-razorpay-signature"];

    if (expected !== signature) {
      console.warn("Webhook: invalid signature");
      return res.status(400).send("Invalid signature");
    }

    // Parse payload (rawBody is a Buffer or string)
    const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString());
    const event = payload.event;
    const payment = payload.payload?.payment?.entity;

    console.log("Webhook event:", event);

    if (!payment) {
      return res.send("OK");
    }

    // If payment captured, mark order completed and attempt reward
    if (event === "payment.captured" || event === "payment.authorized") {
      const razorpayOrderId = payment.order_id;

      const updatedOrder = await Order.findOneAndUpdate(
        { razorpay_order_id: razorpayOrderId },
        {
          status: "completed",
          razorpay_payment_id: payment.id
        },
        { new: true }
      );

      if (updatedOrder) {
        try {
          const result = await applyReferralRewardForOrder(updatedOrder);
          if (result.applied) {
            console.log("Webhook: referral reward applied:", result);
          } else {
            console.log("Webhook: referral not applied:", result);
          }
        } catch (e) {
          console.error("Webhook: error applying referral reward", e);
        }
      } else {
        console.warn("Webhook: order not found for razorpay_order_id", razorpayOrderId);
      }
    }

    if (event === "payment.failed") {
      await Order.findOneAndUpdate(
        { razorpay_order_id: payment.order_id },
        { status: "failed" }
      );
    }

    res.send("OK");

  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook error");
  }
});

module.exports = router;
