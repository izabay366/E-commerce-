/**
 * favoriteController.js
 * Handles HTTP request/response for favorites endpoints.
 * All routes require a logged-in user — favorites don't exist for guests.
 */

'use strict';

const favoriteService = require('../services/favoriteService');

// ─── GET /api/favorites ──────────────────────────────────────────────────

/**
 * Returns all favorited products for the logged-in user.
 * Response 200: { success: true, count: N, data: [...] }
 */
const getFavorites = async (req, res) => {
  try {
    const favorites = await favoriteService.getFavoritesByUser(req.user.id);
    return res.status(200).json({
      success: true,
      count: favorites.length,
      data: favorites,
    });
  } catch (error) {
    console.error('Error fetching favorites:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve favorites.',
      error: error.message,
    });
  }
};

// ─── POST /api/favorites ─────────────────────────────────────────────────

/**
 * Adds a product to the logged-in user's favorites.
 * Body: { product_id }
 */
const addFavorite = async (req, res) => {
  const productId = parseInt(req.body.product_id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'product_id is required and must be a positive integer.',
    });
  }

  try {
    const favorite = await favoriteService.addFavorite(req.user.id, productId);
    return res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    // Foreign key violation means the product_id doesn't exist
    if (error.code === '23503') {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    console.error('Error adding favorite:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to add favorite.',
      error: error.message,
    });
  }
};

// ─── DELETE /api/favorites/:productId ────────────────────────────────────

/**
 * Removes a product from the logged-in user's favorites.
 */
const removeFavorite = async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  try {
    const removed = await favoriteService.removeFavorite(req.user.id, productId);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Favorite not found.' });
    }
    return res.status(200).json({ success: true, message: 'Removed from favorites.' });
  } catch (error) {
    console.error('Error removing favorite:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove favorite.',
      error: error.message,
    });
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
};
