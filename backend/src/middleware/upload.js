/**
 * upload.js
 * ─────────────────────────────────────────────────────────────
 * Multer configuration for product image uploads.
 *
 * Usage:
 *   const upload = require('../middleware/upload');
 *   router.post('/:id/image', authenticate, upload.single('image'), controller);
 *
 * Files are saved to backend/uploads/ with a unique filename.
 * Served statically at http://localhost:5000/uploads/<filename>
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
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
