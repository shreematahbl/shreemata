// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: [
        {
            id: String,
            title: String,
            author: String,
            price: Number,
            quantity: Number,
            coverImage: String
        }
    ],

    totalAmount: Number,

    // ORIGINAL STATUS (PAYMENT + ORDER)
    status: {
        type: String,
        enum: ["pending", "completed", "cancelled", "failed"],
        default: "pending"
    },

    razorpay_order_id: { type: String },
    razorpay_payment_id: { type: String },

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
