# Testing GridFS Upload

## Quick Test Steps

1. **Start the server** (already running)
   ```bash
   npm start
   ```

2. **Login as admin**
   - Go to http://localhost:3000/login.html
   - Use your admin credentials

3. **Add a new book**
   - Go to http://localhost:3000/admin.html
   - Click "Add New Book"
   - Fill in the details:
     - Title: Test Book
     - Author: Test Author
     - Price: 100
     - Category: Select any
     - Weight: 0.5
     - Reward Points: 10
   - Upload a cover image (JPEG/PNG/WebP, max 10MB)
   - Optionally upload preview images
   - Click "Add Book"

4. **Verify the upload**
   - Book should be created successfully
   - Images should be stored in MongoDB GridFS
   - View the book on the homepage to see the images

## How to Check GridFS Files

You can check the files in MongoDB using MongoDB Compass or the mongo shell:

```javascript
// Connect to your database
use bookstore

// List all files in GridFS
db.uploads.files.find()

// Count files
db.uploads.files.count()
```

## Image URL Format

New images will have URLs like:
```
/api/files/507f1f77bcf86cd799439011
```

These are served directly from MongoDB GridFS.

## Troubleshooting

### Upload fails with "Authentication required"
- Make sure you're logged in as admin
- Check localStorage for token

### Upload fails with "File too large"
- Maximum file size is 10MB
- Try compressing the image

### Images don't display
- Check browser console for errors
- Verify the file ID in the URL is correct
- Make sure the server is running

## API Endpoints

- `POST /api/upload/image` - Upload single image
- `POST /api/upload/images` - Upload multiple images
- `GET /api/files/:fileId` - Get image by ID
- `DELETE /api/files/:fileId` - Delete image (admin only)
