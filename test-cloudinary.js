// Quick test to verify Cloudinary connection
require('dotenv').config();
const cloudinary = require('./config/cloudinary');

console.log('Testing Cloudinary connection...');
console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');

// Test the connection by fetching account info
cloudinary.api.ping()
  .then(result => {
    console.log('\n✅ Cloudinary connection successful!');
    console.log('Status:', result.status);
  })
  .catch(err => {
    console.error('\n❌ Cloudinary connection failed!');
    console.error('Error:', err.message);
    console.error('\nPlease check:');
    console.error('1. CLOUDINARY_CLOUD_NAME is correct');
    console.error('2. CLOUDINARY_API_KEY is correct');
    console.error('3. CLOUDINARY_API_SECRET is correct');
    console.error('4. Your internet connection is working');
  });
