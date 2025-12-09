# GridFS Migration - Cloudinary Removed

## What Changed?

We've completely removed Cloudinary and switched to **MongoDB GridFS** for storing book images and files. All images are now stored directly in your MongoDB database.

## Benefits

✅ **Simpler Setup** - No external service configuration needed
✅ **Single Database** - Everything in MongoDB (books, orders, images)
✅ **No Extra Costs** - No Cloudinary subscription required
✅ **Better Control** - Full control over your files

## How It Works

### Backend

1. **GridFS Configuration** (`config/gridfs.js`)
   - Initializes GridFS bucket on MongoDB connection
   - Uses `uploads` bucket name

2. **Upload Routes** (`routes/upload.js`)
   - `POST /api/upload/image` - Upload single image
   - `POST /api/upload/images` - Upload multiple images
   - `GET /api/files/:fileId` - Retrieve image by ID
   - `DELETE /api/files/:fileId` - Delete image (admin only)

3. **Books Routes** (`routes/books.js`)
   - Simplified to accept JSON with image URLs
   - No more multipart handling in books route

### Frontend

1. **Upload Script** (`public/js/cloudinaryUpload.js`)
   - Renamed functions but kept same interface for compatibility
   - Now uploads to `/api/upload/image` instead of Cloudinary
   - Returns GridFS file URLs like `/api/files/[fileId]`

2. **Admin Panel** (`public/js/admin.js`)
   - No changes needed - uses same upload interface
   - Automatically works with new GridFS backend

## Image URLs

**Old Format (Cloudinary):**
```
https://res.cloudinary.com/degwjha60/image/upload/v1234567890/bookstore/image.jpg
```

**New Format (GridFS):**
```
/api/files/507f1f77bcf86cd799439011
```

## File Size Limits

- Maximum file size: **10MB per image**
- Allowed formats: JPEG, JPG, PNG, WebP
- Multiple images: Up to 10 files at once

## Testing

1. Start the server: `npm start`
2. Login as admin
3. Try adding a new book with images
4. Images should upload successfully to MongoDB

## Removed Files

- ❌ `config/cloudinary.js`
- ❌ `test-cloudinary.js`
- ❌ Cloudinary environment variables from `.env`

## Removed Dependencies

- ❌ `cloudinary`
- ❌ `multer-storage-cloudinary`

## Migration Notes

- Existing books with Cloudinary URLs will still work (external URLs)
- New uploads will use GridFS
- You can manually update old book images if needed
