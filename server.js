const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/mongo");
const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const categoryRoutes = require("./routes/categories");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");

const app = express();
const PORT = process.env.PORT || 3000;

// Connect DB
connectDB();

// CORS
app.use(cors());

// =====================================
// 1️⃣ RAW BODY FOR RAZORPAY WEBHOOK 
// must be BEFORE express.json()
// =====================================
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.isWebhook = true;
    next();
  }
);

// =====================================
// Normal body parser (after webhook)
// =====================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================
// Routes
// =====================================
app.use("/api/payments", paymentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/referral", require("./routes/referral"));
app.use("/api/referral", require("./routes/referralTree"));
app.use("/api/admin/withdrawals", require("./routes/adminWithdraw"));
app.use("/api/admin/fix-rewards", require("./routes/fixDuplicateRewards"));
app.use("/api/admin", require("./routes/adminTrustFunds"));
app.use("/api/admin", require("./routes/adminUsers"));
app.use("/api/admin", require("./routes/commissionSettings"));
app.use("/api/bundles", require("./routes/bundles"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/points", require("./routes/points"));




// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Static
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server start
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
