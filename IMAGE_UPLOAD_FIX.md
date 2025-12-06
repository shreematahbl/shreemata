# Image Upload Error Fix

## Problem
Admin gets 400 Bad Request error when adding books **with images** (cover image and preview images). Books add successfully **without images**.

Error in console:
```
POST https://shreemata.com/api/books 400 (Bad Request)
Uncaught (in promise) SyntaxError: Unexpected token '<', "<html><h"... is not valid JSON
```

## Root Cause
The server was returning HTML error page instead of JSON when:
1. File upload exceeded size limits
2. Multer errors weren't being caught properly
3. Body parser had default limits (100kb) which is too small for images

## Fixes Applied

### 1. Increased Body Parser Limits
**File:** `server.js`

```javascript
// Before
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// After
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
```

### 2. Added Multer File Size Limits
**File:** `routes/books.js`

```javascript
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file
  }
});
```

### 3. Added Proper Error Handling for Uploads
**File:** `routes/books.js`

Added middleware to catch multer errors before they reach the route handler:

```javascript
router.post("/", authenticateToken, isAdmin, (req, res, next) => {
  uploadImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: "File too large. Maximum size is 10MB per file." 
        });
      }
      return res.status(400).json({ 
        error: `Upload error: ${err.message}` 
      });
    } else if (err) {
      return res.status(500).json({ 
        error: `Upload failed: ${err.message}` 
      });
    }
    next();
  });
}, async (req, res) => {
  // ... book creation logic
});
```

### 4. Improved Frontend Error Handling
**File:** `public/js/admin.js`

Added check for non-JSON responses:

```javascript
// Check if response is JSON
const contentType = res.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
    const text = await res.text();
    console.error('Non-JSON response:', text.substring(0, 200));
    alert('Server error: Received invalid response. Please check:\n' +
          '- File sizes (max 10MB per file)\n' +
          '- Image formats (JPG, PNG, WEBP only)\n' +
          '- Server is running properly');
    return;
}

const data = await res.json();

if (!res.ok) {
    alert(`Error: ${data.error || 'Failed to save book'}\n${data.details || ''}`);
}
```

## File Size Limits

### Current Limits
- **Per file:** 10MB maximum
- **Total request:** 50MB maximum
- **Allowed formats:** JPG, JPEG, PNG, WEBP

### Recommended Image Sizes
- **Cover Image:** 800x1200px, < 2MB
- **Preview Images:** 1200x1600px, < 3MB each
- **Maximum:** 4 preview images

## Testing

### Test 1: Small Images (Should Work)
1. Cover image: < 2MB
2. Preview images: 2-3 images, each < 3MB
3. Expected: Book added successfully

### Test 2: Large Images (Should Show Error)
1. Cover image: > 10MB
2. Expected: "File too large. Maximum size is 10MB per file."

### Test 3: No Images (Should Work)
1. Don't upload any images
2. Expected: Book added successfully (already working)

## Image Optimization Tips

### For Admins
Before uploading, optimize images:

1. **Use online tools:**
   - TinyPNG (https://tinypng.com)
   - Squoosh (https://squoosh.app)
   - Compressor.io (https://compressor.io)

2. **Recommended settings:**
   - Format: JPEG for photos, PNG for graphics
   - Quality: 80-85%
   - Max dimensions: 1200x1600px

3. **Batch optimization:**
   - Use tools like ImageOptim (Mac)
   - Or Caesium (Windows)

## Server Configuration

### If Still Getting Errors

Check your hosting provider's limits:

1. **GoDaddy/cPanel:**
   - PHP upload_max_filesize: 64M
   - PHP post_max_size: 64M
   - PHP max_execution_time: 300

2. **Nginx:**
   ```nginx
   client_max_body_size 50M;
   ```

3. **Apache (.htaccess):**
   ```apache
   php_value upload_max_filesize 64M
   php_value post_max_size 64M
   php_value max_execution_time 300
   ```

## Cloudinary Limits

Free tier limits:
- **Storage:** 25GB
- **Bandwidth:** 25GB/month
- **Transformations:** 25,000/month

If exceeded, upgrade plan or optimize images before upload.

## Error Messages

### User-Friendly Messages
- ✅ "File too large. Maximum size is 10MB per file."
- ✅ "Upload error: Invalid file format"
- ✅ "Upload failed: Network error"

### Technical Logs
Server logs will show:
- Multer errors
- File sizes
- Upload failures
- Cloudinary errors

## Prevention

### Future Improvements
1. Add client-side file size validation
2. Show upload progress bar
3. Compress images before upload
4. Add image preview before upload
5. Validate image dimensions

## Notes

- Images are uploaded to Cloudinary, not local server
- Cloudinary handles image optimization automatically
- Original images are preserved in Cloudinary
- Multiple formats are generated for responsive images
