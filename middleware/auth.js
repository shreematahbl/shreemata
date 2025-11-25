const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ----------------------------------------------
// AUTHENTICATE USER (Verify Token)
// ----------------------------------------------
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader)
      return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1]; // Extract token

    if (!token)
      return res.status(401).json({ error: "Invalid token format" });

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB
    const user = await User.findById(decoded.id);

    if (!user)
      return res.status(401).json({ error: "User not found" });

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// ----------------------------------------------
// CHECK ADMIN ACCESS
// ----------------------------------------------
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
};

module.exports = { authenticateToken, isAdmin };
