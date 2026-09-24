/**
 * categoryController.js
 * Handles HTTP request/response for all category endpoints.
 * Delegates all database work to categoryService.
 */

const categoryService = require('../services/categoryService');

// ─── GET ALL CATEGORIES ───────────────────────────────────────────────────────

/**
 * GET /api/categories
 * Returns all active categories with product counts.
 */
const getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();

    return res.status(200).json({
      success: true,
      count:   categories.length,
      data:    categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories.',
      error:   error.message,
    });
  }
};

// ─── GET SINGLE CATEGORY ──────────────────────────────────────────────────────

/**
 * GET /api/categories/:id
 * Returns one category with its products and variants.
 * Returns 404 if the category does not exist.
 */
const getCategoryById = async (req, res) => {
  const { id } = req.params;

  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category ID. Must be a positive integer.',
    });
  }

  try {
    const category = await categoryService.getCategoryById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Category not found with ID: ${categoryId}`,
      });
    }

    return res.status(200).json({
      success: true,
      data:    category,
    });
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve category.',
      error:   error.message,
    });
  }
};

// ─── CREATE CATEGORY ──────────────────────────────────────────────────────────

/**
 * POST /api/categories
 * Admin only. Creates a new category.
 * Body: { name, description?, image_url? }
 */
const createCategory = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { name, description, image_url } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'name is required.',
    });
  }

  try {
    const category = await categoryService.createCategory({
      name: name.trim(),
      description,
      image_url,
    });

    return res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error creating category:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create category.',
      error: error.message,
    });
  }
};

// ─── UPDATE CATEGORY ──────────────────────────────────────────────────────────

/**
 * PUT /api/categories/:id
 * Admin only. Updates a category's name/description/image.
 * Body: { name, description?, image_url? }
 */
const updateCategory = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const categoryId = parseInt(req.params.id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid category ID.' });
  }

  const { name, description, image_url } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'name is required.',
    });
  }

  try {
    const category = await categoryService.updateCategory(categoryId, {
      name: name.trim(),
      description,
      image_url,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: `Category not found with ID: ${categoryId}` });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(`Error updating category ${categoryId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category.',
      error: error.message,
    });
  }
};

// ─── DELETE CATEGORY ──────────────────────────────────────────────────────────

/**
 * DELETE /api/categories/:id
 * Admin only. Soft-deletes the category (is_active = FALSE).
 * Products already assigned to it keep their category_id — they just stop
 * being counted/shown for this category once it's inactive.
 */
const deleteCategory = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const categoryId = parseInt(req.params.id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid category ID.' });
  }

  try {
    const deleted = await categoryService.softDeleteCategory(categoryId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `Category not found with ID: ${categoryId}` });
    }
    return res.status(200).json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    console.error(`Error deleting category ${categoryId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category.',
      error: error.message,
    });
  }
};

// ─── UPLOAD CATEGORY IMAGE ─────────────────────────────────────────────────────

/**
 * POST /api/categories/:id/image
 * Admin only. Accepts a single file field named "image", saves it,
 * and stores its URL on the category.
 */
const uploadCategoryImage = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const categoryId = parseInt(req.params.id, 10);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid category ID.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }

  try {
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const category = await categoryService.updateCategoryImage(categoryId, imageUrl);

    if (!category) {
      return res.status(404).json({ success: false, message: `Category not found with ID: ${categoryId}` });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error(`Error uploading image for category ${categoryId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image.',
      error: error.message,
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
};
