// routes/books.js
const express = require("express");

const Book = require("../models/Book");
const Purchase = require("../models/Purchase");
const { authenticateToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/* -------------------------------------------
   GET ALL BOOKS WITH FILTERS + PAGINATION
------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1"));
    const limit = Math.max(1, parseInt(req.query.limit || "12"));
    const skip = (page - 1) * limit;

    const { category, author, minPrice, maxPrice, search } = req.query;

    const query = {};

    if (category) query.category = category;
    if (author) query.author = new RegExp(author, "i");
    if (minPrice) query.price = { ...query.price, $gte: parseFloat(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };

    if (search) {
      const s = new RegExp(search, "i");
      query.$or = [
        { title: s },
        { author: s },
        { description: s }
      ];
    }

    const [totalCount, books] = await Promise.all([
      Book.countDocuments(query),
      Book.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      books,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      totalCount
    });

  } catch (err) {
    console.error("Error fetching books:", err);
    res.status(500).json({ error: "Error fetching books" });
  }
});

/* -------------------------------------------
   GET SINGLE BOOK
------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ error: "Book not found" });

    res.json({ book });
  } catch (err) {
    console.error("Error fetching book:", err);
    res.status(500).json({ error: "Error fetching book" });
  }
});

/* -------------------------------------------
   ADD NEW BOOK (ADMIN ONLY)
   Expects JSON with image URLs from GridFS upload
------------------------------------------- */
router.post("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, author, price, description, category, weight, rewardPoints, cover_image, preview_images } = req.body;
    console.log('📝 Book data:', { title, author, price, category });

    // Validate required fields
    if (!title || !author || !price) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: "Missing required fields", 
        details: "Title, author, and price are required" 
      });
    }

    // Validate cover image
    if (!cover_image) {
      console.log('❌ No cover image provided');
      return res.status(400).json({ 
        error: "Cover image is required",
        details: "Please upload a cover image for the book"
      });
    }

    console.log('🖼️ Images:', { cover_image, previewCount: (preview_images || []).length });

    const book = await Book.create({
      title,
      author,
      price,
      description: description || "",
      cover_image,
      preview_images: preview_images || [],
      category: category || "uncategorized",
      weight: weight || 0.5,
      rewardPoints: rewardPoints || 0
    });

    console.log('✅ Book created successfully:', book._id);
    res.status(201).json({ message: "Book added successfully", book });
  } catch (err) {
    console.error("❌ Error adding book:", err);
    res.status(500).json({ 
      error: "Error adding book", 
      details: err.message 
    });
  }
});

/* -------------------------------------------
   UPDATE BOOK (ADMIN ONLY)
   Expects JSON with image URLs from GridFS upload
------------------------------------------- */
router.put("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ error: "Book not found" });

    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;
    book.price = req.body.price || book.price;
    book.description = req.body.description || book.description;
    book.category = req.body.category || book.category;
    book.weight = req.body.weight !== undefined ? req.body.weight : book.weight;
    book.rewardPoints = req.body.rewardPoints !== undefined ? req.body.rewardPoints : book.rewardPoints;

    // Handle images from JSON body
    if (req.body.cover_image) {
      book.cover_image = req.body.cover_image;
    }
    if (req.body.preview_images) {
      book.preview_images = req.body.preview_images;
    }

    await book.save();
    res.json({ message: "Book updated successfully", book });

  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ 
      error: "Error updating book", 
      details: err.message 
    });
  }
});

/* -------------------------------------------
   DELETE BOOK (ADMIN ONLY)
------------------------------------------- */
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const deleted = await Book.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ error: "Book not found" });

    res.json({ message: "Book deleted" });
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).json({ error: "Error deleting book" });
  }
});

/* -------------------------------------------
   PURCHASE CHECK — each user can buy only once
------------------------------------------- */
router.post("/:id/purchase", authenticateToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ error: "Book not found" });

    const alreadyBought = await Purchase.findOne({
      user_id: req.user.id,
      book_id: book._id
    });

    if (alreadyBought) {
      return res.status(400).json({ error: "Book already purchased" });
    }

    const purchase = await Purchase.create({
      user_id: req.user.id,
      book_id: book._id,
      price_paid: book.price
    });

    res.json({ message: "Purchase successful", purchase });
  } catch (err) {
    console.error("Error processing purchase:", err);
    res.status(500).json({ error: "Error processing purchase" });
  }
});

module.exports = router;
