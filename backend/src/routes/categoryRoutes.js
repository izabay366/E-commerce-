/**
 * categoryRoutes.js
 * Express router for all /api/categories endpoints.
 *
 * Routes:
 *   GET    /api/categories      → getCategories    (all active categories)
 *   GET    /api/categories/:id  → getCategoryById  (single category + products)
 *   POST   /api/categories      → createCategory   (admin only)
 *   PUT    /api/categories/:id  → updateCategory   (admin only)
 *   DELETE /api/categories/:id  → deleteCategory   (admin only)
 */

const express  = require('express');
const router   = express.Router();
const authenticate = require('../middleware/authenticate');
const upload = require('../middleware/upload');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
} = require('../controllers/categoryController');

// GET /api/categories — all active categories with product counts
router.get('/', getCategories);

// POST /api/categories — create a category (admin only)
router.post('/', authenticate, createCategory);

// GET /api/categories/:id — single category with products + variants
router.get('/:id', getCategoryById);

// PUT /api/categories/:id — update a category (admin only)
router.put('/:id', authenticate, updateCategory);

// DELETE /api/categories/:id — soft-delete a category (admin only)
router.delete('/:id', authenticate, deleteCategory);

// POST /api/categories/:id/image — upload a category photo (admin only)
router.post('/:id/image', authenticate, upload.single('image'), uploadCategoryImage);

module.exports = router;
