/**
 * cloudinary.js
 * Configures the Cloudinary SDK using credentials from environment variables.
 * Used by upload.js (multer storage engine) to upload product images
 * directly to Cloudinary instead of local disk.
 */

'use strict';

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
