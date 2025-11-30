// routes/books.js
const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const Book = require("../models/Book");
const Purchase = require("../models/Purchase");
const { authenticateToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

/* -------------------------------------------
   CLOUDINARY STORAGE SETUP
------------------------------------------- */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "bookstore",
    allowed_formats: ["jpg", "jpeg", "png", "webp"]
  })
});

const upload = multer({ storage });

const uploadImages = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "previewImages", maxCount: 4 }
]);

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
------------------------------------------- */
router.post("/", authenticateToken, isAdmin, uploadImages, async (req, res) => {
  try {
    const { title, author, price, description, category } = req.body;

    if (!title || !author || !price) {
      return res.status(400).json({ error: "Title, author, and price are required" });
    }

    const coverImage = req.files["coverImage"]
      ? req.files["coverImage"][0].path
      : "";

    const previewImages = req.files["previewImages"]
      ? req.files["previewImages"].map(f => f.path)
      : [];

    const book = await Book.create({
      title,
      author,
      price,
      description: description || "",
      cover_image: coverImage,
      preview_images: previewImages,
      category: category || "uncategorized"
    });

    res.status(201).json({ message: "Book added", book });
  } catch (err) {
    console.error("Error adding book:", err);
    res.status(500).json({ error: "Error adding book" });
  }
});

/* -------------------------------------------
   UPDATE BOOK (ADMIN ONLY)
------------------------------------------- */
router.put("/:id", authenticateToken, isAdmin, uploadImages, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) return res.status(404).json({ error: "Book not found" });

    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;
    book.price = req.body.price || book.price;
    book.description = req.body.description || book.description;
    book.category = req.body.category || book.category;

    if (req.files["coverImage"]) {
      book.cover_image = req.files["coverImage"][0].path;
    }

    if (req.files["previewImages"]) {
      book.preview_images = req.files["previewImages"].map(f => f.path);
    }

    await book.save();
    res.json({ message: "Book updated", book });

  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ error: "Error updating book" });
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

/* -------------------------------------------
   UPLOAD SINGLE IMAGE (for bundles, etc.)
------------------------------------------- */
const singleUpload = upload.single("image");

router.post("/upload-image", authenticateToken, isAdmin, singleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    res.json({ 
      message: "Image uploaded successfully",
      url: req.file.path 
    });
  } catch (err) {
    console.error("Error uploading image:", err);
    res.status(500).json({ error: "Error uploading image" });
  }
});

module.exports = router;
