// routes/bundles.js
const express = require("express");
const Bundle = require("../models/Bundle");
const Book = require("../models/Book");
const { authenticateToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

// =====================================================
// PUBLIC ROUTES
// =====================================================

/**
 * GET ALL ACTIVE BUNDLES (for users)
 */
router.get("/", async (req, res) => {
    try {
        const bundles = await Bundle.find({ 
            isActive: true,
            $or: [
                { validUntil: { $gte: new Date() } },
                { validUntil: null }
            ]
        })
        .populate("books", "title author cover_image price")
        .sort({ createdAt: -1 });

        res.json({ bundles });
    } catch (err) {
        console.error("Fetch bundles error:", err);
        res.status(500).json({ error: "Error fetching bundles" });
    }
});

/**
 * GET SINGLE BUNDLE BY ID
 */
router.get("/:id", async (req, res) => {
    try {
        const bundle = await Bundle.findById(req.params.id)
            .populate("books", "title author cover_image price description");

        if (!bundle) {
            return res.status(404).json({ error: "Bundle not found" });
        }

        res.json({ bundle });
    } catch (err) {
        console.error("Fetch bundle error:", err);
        res.status(500).json({ error: "Error fetching bundle" });
    }
});

// =====================================================
// ADMIN ROUTES
// =====================================================

/**
 * CREATE NEW BUNDLE (Admin only)
 */
router.post("/admin/create", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, description, bookIds, bundlePrice, image, validUntil } = req.body;

        if (!name || !bookIds || bookIds.length < 1) {
            return res.status(400).json({ 
                error: "Bundle must have a name and at least 1 book" 
            });
        }

        // Fetch books to calculate original price
        const books = await Book.find({ _id: { $in: bookIds } });
        
        if (books.length !== bookIds.length) {
            return res.status(400).json({ error: "Some books not found" });
        }

        const originalPrice = books.reduce((sum, book) => sum + book.price, 0);

        if (bundlePrice >= originalPrice) {
            return res.status(400).json({ 
                error: "Bundle price must be less than original price" 
            });
        }

        const bundle = await Bundle.create({
            name,
            description,
            books: bookIds,
            originalPrice,
            bundlePrice,
            image,
            validUntil: validUntil || null
        });

        const populatedBundle = await Bundle.findById(bundle._id)
            .populate("books", "title author cover_image price");

        res.json({ 
            message: "Bundle created successfully", 
            bundle: populatedBundle 
        });

    } catch (err) {
        console.error("Create bundle error:", err);
        res.status(500).json({ error: "Error creating bundle" });
    }
});

/**
 * GET ALL BUNDLES (Admin - including inactive)
 */
router.get("/admin/all", authenticateToken, isAdmin, async (req, res) => {
    try {
        const bundles = await Bundle.find()
            .populate("books", "title author cover_image price")
            .sort({ createdAt: -1 });

        res.json({ bundles });
    } catch (err) {
        console.error("Fetch all bundles error:", err);
        res.status(500).json({ error: "Error fetching bundles" });
    }
});

/**
 * UPDATE BUNDLE (Admin only)
 */
router.put("/admin/update/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { name, description, bookIds, bundlePrice, image, validUntil, isActive } = req.body;

        const bundle = await Bundle.findById(req.params.id);
        if (!bundle) {
            return res.status(404).json({ error: "Bundle not found" });
        }

        // Update fields
        if (name) bundle.name = name;
        if (description !== undefined) bundle.description = description;
        if (image) bundle.image = image;
        if (validUntil !== undefined) bundle.validUntil = validUntil;
        if (isActive !== undefined) bundle.isActive = isActive;

        // If books changed, recalculate original price
        if (bookIds && bookIds.length >= 1) {
            const books = await Book.find({ _id: { $in: bookIds } });
            if (books.length !== bookIds.length) {
                return res.status(400).json({ error: "Some books not found" });
            }
            bundle.books = bookIds;
            bundle.originalPrice = books.reduce((sum, book) => sum + book.price, 0);
        }

        // Update bundle price
        if (bundlePrice) {
            if (bundlePrice >= bundle.originalPrice) {
                return res.status(400).json({ 
                    error: "Bundle price must be less than original price" 
                });
            }
            bundle.bundlePrice = bundlePrice;
        }

        await bundle.save();

        const updatedBundle = await Bundle.findById(bundle._id)
            .populate("books", "title author cover_image price");

        res.json({ 
            message: "Bundle updated successfully", 
            bundle: updatedBundle 
        });

    } catch (err) {
        console.error("Update bundle error:", err);
        res.status(500).json({ error: "Error updating bundle" });
    }
});

/**
 * DELETE BUNDLE (Admin only)
 */
router.delete("/admin/delete/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        const bundle = await Bundle.findByIdAndDelete(req.params.id);

        if (!bundle) {
            return res.status(404).json({ error: "Bundle not found" });
        }

        res.json({ message: "Bundle deleted successfully" });

    } catch (err) {
        console.error("Delete bundle error:", err);
        res.status(500).json({ error: "Error deleting bundle" });
    }
});

/**
 * TOGGLE BUNDLE ACTIVE STATUS (Admin only)
 */
router.patch("/admin/toggle/:id", authenticateToken, isAdmin, async (req, res) => {
    try {
        const bundle = await Bundle.findById(req.params.id);

        if (!bundle) {
            return res.status(404).json({ error: "Bundle not found" });
        }

        bundle.isActive = !bundle.isActive;
        await bundle.save();

        res.json({ 
            message: `Bundle ${bundle.isActive ? 'activated' : 'deactivated'}`,
            bundle 
        });

    } catch (err) {
        console.error("Toggle bundle error:", err);
        res.status(500).json({ error: "Error toggling bundle status" });
    }
});

module.exports = router;
