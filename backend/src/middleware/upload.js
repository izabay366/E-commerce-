/**
 * upload.js
 * ─────────────────────────────────────────────────────────────
 * Multer configuration for product image uploads.
 *
 * Usage:
 *   const upload = require('../middleware/upload');
 *   router.post('/:id/image', authenticate, upload.single('image'), controller);
 *
 * Images are uploaded directly to Cloudinary (not local disk), since
 * Render's filesystem is ephemeral and does not persist uploaded files
 * across restarts/redeploys.
 *
 * On success, req.file.path is the full Cloudinary URL — save that
 * directly to the database as the product's image URL.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'muhanga-marketplace/products', // organizes uploads in your Cloudinary account
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }], // caps oversized uploads
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WEBP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

module.exports = upload;
