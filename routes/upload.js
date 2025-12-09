// routes/upload.js - GridFS file upload
const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const { getGridFSBucket } = require('../config/gridfs');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer memory storage (we'll stream to GridFS)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

/* -------------------------------------------
   UPLOAD SINGLE IMAGE
------------------------------------------- */
router.post('/image', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const bucket = getGridFSBucket();
    const filename = `${Date.now()}-${req.file.originalname}`;

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      }
    });

    const readableStream = Readable.from(req.file.buffer);
    readableStream.pipe(uploadStream);

    uploadStream.on('finish', () => {
      const fileUrl = `/api/files/${uploadStream.id}`;
      res.json({
        message: 'Image uploaded successfully',
        url: fileUrl,
        fileId: uploadStream.id
      });
    });

    uploadStream.on('error', (err) => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error uploading image' });
  }
});

/* -------------------------------------------
   UPLOAD MULTIPLE IMAGES
------------------------------------------- */
router.post('/images', authenticateToken, isAdmin, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const bucket = getGridFSBucket();
    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        const filename = `${Date.now()}-${file.originalname}`;
        const uploadStream = bucket.openUploadStream(filename, {
          contentType: file.mimetype,
          metadata: {
            uploadedBy: req.user.id,
            uploadedAt: new Date()
          }
        });

        const readableStream = Readable.from(file.buffer);
        readableStream.pipe(uploadStream);

        uploadStream.on('finish', () => {
          resolve({
            url: `/api/files/${uploadStream.id}`,
            fileId: uploadStream.id
          });
        });

        uploadStream.on('error', reject);
      });
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      message: 'Images uploaded successfully',
      files: results
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error uploading images' });
  }
});

/* -------------------------------------------
   GET FILE BY ID
------------------------------------------- */
router.get('/:fileId', async (req, res) => {
  try {
    const bucket = getGridFSBucket();
    const fileId = new require('mongodb').ObjectId(req.params.fileId);

    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });

  } catch (err) {
    console.error('File retrieval error:', err);
    res.status(500).json({ error: 'Error retrieving file' });
  }
});

/* -------------------------------------------
   DELETE FILE BY ID (ADMIN ONLY)
------------------------------------------- */
router.delete('/:fileId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const bucket = getGridFSBucket();
    const fileId = new require('mongodb').ObjectId(req.params.fileId);

    await bucket.delete(fileId);

    res.json({ message: 'File deleted successfully' });

  } catch (err) {
    console.error('File deletion error:', err);
    res.status(500).json({ error: 'Error deleting file' });
  }
});

module.exports = router;
