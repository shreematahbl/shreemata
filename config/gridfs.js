// config/gridfs.js
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let bucket;

function initGridFS() {
  const db = mongoose.connection.db;
  bucket = new GridFSBucket(db, {
    bucketName: 'uploads'
  });
  console.log('✅ GridFS initialized');
  return bucket;
}

function getGridFSBucket() {
  if (!bucket) {
    throw new Error('GridFS not initialized. Call initGridFS() first.');
  }
  return bucket;
}

module.exports = { initGridFS, getGridFSBucket };
