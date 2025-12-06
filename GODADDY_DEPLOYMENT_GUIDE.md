# GoDaddy Deployment Guide

## Problem
Getting 400 Bad Request and HTML instead of JSON when calling API endpoints on production (shreemata.com).

## Root Cause
The Node.js backend server is either:
1. Not running on the production server
2. Not properly configured with reverse proxy
3. Running on wrong port

## Solution Steps

### Step 1: Check API Connection
Visit: `https://shreemata.com/api-test.html`

This will show you:
- Current API URL configuration
- Test results for API endpoints
- Actual server response

### Step 2: Verify Node.js Server is Running

SSH into your GoDaddy server and check:

```bash
# Check if Node.js process is running
ps aux | grep node

# Check if server is listening on port 3000
netstat -tulpn | grep 3000

# Or using lsof
lsof -i :3000
```

If not running, start it:

```bash
# Navigate to your app directory
cd /path/to/your/app

# Start the server
node server.js

# Or with PM2 (recommended)
pm2 start server.js --name bookstore
pm2 save
pm2 startup
```

### Step 3: Configure Reverse Proxy

#### For Apache (Most common on GoDaddy)

Create or edit `.htaccess` in your public_html root:

```apache
# Enable Rewrite Engine
RewriteEngine On

# Proxy API requests to Node.js backend
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]

# Proxy WebSocket connections (if needed)
RewriteCond %{HTTP:Upgrade} websocket [NC]
RewriteCond %{HTTP:Connection} upgrade [NC]
RewriteRule ^/?(.*) "ws://localhost:3000/$1" [P,L]

# Serve static files from public directory
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ $1 [L]

# Enable proxy modules (add to httpd.conf if not already enabled)
# LoadModule proxy_module modules/mod_proxy.so
# LoadModule proxy_http_module modules/mod_proxy_http.so
```

#### For Nginx (If using VPS)

Edit nginx configuration:

```nginx
server {
    listen 80;
    server_name shreemata.com www.shreemata.com;

    # Serve static files
    root /path/to/your/app/public;
    index index.html;

    # Proxy API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Step 4: Environment Variables

Make sure your `.env` file on the server has correct values:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
```

### Step 5: File Structure on Server

Your GoDaddy server should have this structure:

```
/home/username/
├── app/                          # Your Node.js app
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── public/                   # Static files
│       ├── index.html
│       ├── js/
│       └── css/
└── public_html/                  # Apache document root
    ├── .htaccess                 # Proxy configuration
    └── [symlink to app/public/*] # Or copy files here
```

### Step 6: Common GoDaddy-Specific Issues

#### Issue 1: Shared Hosting Limitations
GoDaddy shared hosting doesn't support Node.js. You need:
- **VPS Hosting** or
- **Dedicated Server** or
- **cPanel with Node.js support**

#### Issue 2: Port Restrictions
Some GoDaddy plans restrict which ports you can use. Try:
- Port 3000 (most common)
- Port 8080 (alternative)
- Port 3001 (alternative)

#### Issue 3: Module Installation
Make sure all dependencies are installed on the server:

```bash
cd /path/to/your/app
npm install --production
```

### Step 7: Testing

1. **Test Node.js directly:**
   ```bash
   curl http://localhost:3000/api/categories
   ```

2. **Test through domain:**
   ```bash
   curl https://shreemata.com/api/categories
   ```

3. **Check logs:**
   ```bash
   # If using PM2
   pm2 logs bookstore
   
   # Or check server logs
   tail -f /path/to/your/app/logs/error.log
   ```

## Alternative: Use Subdomain for API

If reverse proxy is too complex, use a subdomain:

1. Create subdomain: `api.shreemata.com`
2. Point it to your Node.js server
3. Update `config.js`:

```javascript
let API_URL = "";

const origin = window.location.origin;

// Production
if (origin.includes("shreemata.com")) {
    API_URL = "https://api.shreemata.com";
}
// Local development
else {
    API_URL = "http://localhost:3000/api";
}
```

4. Enable CORS on server:

```javascript
const cors = require('cors');
app.use(cors({
    origin: ['https://shreemata.com', 'https://www.shreemata.com'],
    credentials: true
}));
```

## Quick Fix: Check Current Setup

Run this command on your server to diagnose:

```bash
# Create diagnostic script
cat > check-setup.sh << 'EOF'
#!/bin/bash
echo "=== Node.js Check ==="
which node
node --version

echo -e "\n=== NPM Check ==="
which npm
npm --version

echo -e "\n=== Running Processes ==="
ps aux | grep node

echo -e "\n=== Port 3000 ==="
netstat -tulpn | grep 3000 || lsof -i :3000

echo -e "\n=== Environment ==="
cat .env | grep -v "SECRET\|PASSWORD\|KEY"

echo -e "\n=== API Test ==="
curl -I http://localhost:3000/api/categories
EOF

chmod +x check-setup.sh
./check-setup.sh
```

## Contact GoDaddy Support

If issues persist, contact GoDaddy support with these questions:

1. Does my hosting plan support Node.js applications?
2. How do I configure reverse proxy for Node.js?
3. Which ports can I use for Node.js server?
4. Do you have documentation for deploying Node.js apps?

## Recommended: Use Better Hosting

For Node.js apps, consider these alternatives:
- **Heroku** (Easy deployment)
- **DigitalOcean** (VPS with full control)
- **AWS EC2** (Scalable)
- **Vercel** (Frontend) + **Railway** (Backend)
- **Render** (All-in-one)

These platforms are designed for Node.js and make deployment much easier.
