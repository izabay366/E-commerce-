/**
 * cartRoutes.js
 * Express router for all /api/cart endpoints.
 *
 * Routes:
 *   POST   /api/cart                        → createOrGetCart  (find or create guest cart)
 *   GET    /api/cart/:cartId                → getCart          (retrieve cart with items)
 *   POST   /api/cart/:cartId/items          → addItem          (add variant to cart)
 *   PUT    /api/cart/:cartId/items/:itemId  → updateItem       (update item quantity)
 *   DELETE /api/cart/:cartId/items/:itemId  → removeItem       (remove single item)
 *   DELETE /api/cart/:cartId                → clearCart        (remove all items)
 *
 * IMPORTANT: DELETE /api/cart/:cartId/items/:itemId must be defined BEFORE
 * DELETE /api/cart/:cartId so Express matches the more-specific route first.
 */

const express = require('express');
const router  = express.Router();

const {
  createOrGetCart,
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} = require('../controllers/cartController');

// POST /api/cart — find or create guest cart by session_token
router.post('/', createOrGetCart);

// GET /api/cart/:cartId — retrieve full cart with items, prices, subtotals
router.get('/:cartId', getCart);

// POST /api/cart/:cartId/items — add item (or accumulate quantity) to cart
router.post('/:cartId/items', addItem);

// PUT /api/cart/:cartId/items/:itemId — update item quantity
router.put('/:cartId/items/:itemId', updateItem);

// DELETE /api/cart/:cartId/items/:itemId — remove a single item (must be before /:cartId)
router.delete('/:cartId/items/:itemId', removeItem);

// DELETE /api/cart/:cartId — clear all items from cart (cart record preserved)
router.delete('/:cartId', clearCart);

module.exports = router;
