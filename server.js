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

// CORS - Allow requests from main domain and API subdomain
app.use(cors({
  origin: [
    'https://shreemata.com',
    'https://www.shreemata.com',
    'https://api.shreemata.com',
    'http://localhost:3000'
  ],
  credentials: true
}));

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
// Increased limits for image uploads
// =====================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Cloudinary config endpoint (for direct uploads from browser)
app.get('/api/cloudinary-config', (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'bookstore_preset'
  });
});

// Static
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Global error handler for API routes
app.use((err, req, res, next) => {
  // Only handle API routes with JSON errors
  if (req.path.startsWith('/api/')) {
    console.error('API Error:', err);
    return res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  next(err);
});

// SPA fallback (only for non-API routes)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server start
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
