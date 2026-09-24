/**
 * productRoutes.js
 * Express router for all /api/products endpoints.
 *
 * IMPORTANT: /schema must be defined BEFORE /:id
 * Otherwise Express will treat "schema" as a product ID.
 *
 * Routes:
 *   GET    /api/products          → getProducts       (all available products)
 *   GET    /api/products/schema   → getProductSchema   (diagnostic, dev only)
 *   GET    /api/products/:id      → getProductById     (single product + variants)
 *   POST   /api/products          → createProduct      (admin only)
 *   PUT    /api/products/:id      → updateProduct      (admin only)
 *   DELETE /api/products/:id      → deleteProduct      (admin only)
 *   POST   /api/products/:id/image → uploadProductImage (admin only)
 */
const express = require('express');
const router  = express.Router();
const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');
const {
  getProducts,
  getProductById,
  getProductSchema,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} = require('../controllers/productController');

// GET /api/products — all available products (flat list with variants)
router.get('/', getProducts);

// GET /api/products/schema — diagnostic: real DB column names (dev only)
// Must come BEFORE /:id to avoid "schema" being treated as an ID
router.get('/schema', getProductSchema);

// POST /api/products — create a product (admin only)
router.post('/', authenticate, createProduct);

// GET /api/products/:id — single product with nested category + variants
router.get('/:id', getProductById);

// PUT /api/products/:id — update a product / its variant (admin only)
router.put('/:id', authenticate, updateProduct);

// DELETE /api/products/:id — soft-delete a product (admin only)
router.delete('/:id', authenticate, deleteProduct);

// POST /api/products/:id/image — upload a product photo (admin only)
router.post('/:id/image', authenticate, upload.single('image'), uploadProductImage);

module.exports = router;
