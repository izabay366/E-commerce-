/**
 * cartController.js
 * Handles HTTP request/response for all cart endpoints.
 * Delegates all database work to cartService.
 *
 * Security rules enforced here:
 *   - unit_price, subtotal, total are NEVER accepted from the client
 *   - product_name, variant_name are NEVER accepted from the client
 *   - Only variant_id (INTEGER) and quantity come from the client for item operations
 *
 * ID type mapping (verified from live PostgreSQL):
 *   carts.id          → UUID  (cartId param: UUID validation)
 *   cart_items.id     → INTEGER SERIAL  (itemId param: positive integer validation)
 *   cart_items.variant_id → INTEGER  (FK → product_variants.id INTEGER)
 *   product_variants.id   → INTEGER
 */

const jwt = require('jsonwebtoken');
const cartService = require('../services/cartService');

// ─── UUID VALIDATION HELPER ───────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the string is a well-formed UUID v4-style identifier.
 * Used ONLY for cartId (carts.id is UUID).
 * @param {string} str
 */
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

// ─── INTEGER VALIDATION HELPER ────────────────────────────────────────────────

/**
 * Returns true if the value is a positive integer (>= 1).
 * Used for:
 *   - variant_id (product_variants.id is INTEGER)
 *   - itemId     (cart_items.id is INTEGER SERIAL)
 * Accepts both number and numeric string (from URL params).
 *
 * @param {any} val
 */
function isPositiveInteger(val) {
  if (val === undefined || val === null) return false;
  const n = Number(val);
  return Number.isInteger(n) && n >= 1;
}

// ─── OPTIONAL AUTH HELPER ──────────────────────────────────────────────────────

/**
 * This endpoint is used by both guests and logged-in customers, so it can't
 * require a token the way admin routes do. If a valid Bearer token IS
 * present, its userId is used to attach/merge the cart to that account;
 * if it's missing or invalid, the request just proceeds as a guest — same
 * behavior as before this existed.
 *
 * @param {import('express').Request} req
 * @returns {string|null} userId, or null if not logged in / token invalid
 */
function extractUserIdIfPresent(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const decoded = jwt.verify(authHeader.slice(7).trim(), process.env.JWT_SECRET);
    return decoded.userId || null;
  } catch {
    return null;
  }
}

// ─── CONTROLLED ERROR HANDLER ─────────────────────────────────────────────────

/**
 * Sends a JSON error response. Uses statusCode from the error if set (by
 * cartService), otherwise defaults to 500 and hides the raw message.
 *
 * @param {object} res     - Express response
 * @param {Error}  err     - Thrown error
 * @param {string} context - Context string for server-side logging
 */
function handleError(res, err, context) {
  const code = err.statusCode;

  if (code && code >= 400 && code < 500) {
    // Controlled application error — safe to expose message
    return res.status(code).json({ message: err.message });
  }

  // Unexpected / database error — log full details, hide from client
  console.error(`[CartController] ${context}:`, err.message);
  return res.status(500).json({ message: 'An unexpected error occurred.' });
}

// ─── POST /api/cart ────────────────────────────────────────────────────────────

/**
 * POST /api/cart
 * Creates or retrieves a cart by session_token. If a valid Bearer token is
 * also sent, this resolves (and merges/attaches) the caller's account cart
 * instead of a bare guest cart — see cartService.findOrCreateCartForRequest.
 *
 * Body: { "session_token": "..." }
 *
 * 200 — existing cart returned
 * 201 — new cart created
 * 400 — session_token missing or invalid
 */
const createOrGetCart = async (req, res) => {
  const { session_token } = req.body;

  if (!session_token || typeof session_token !== 'string' || session_token.trim() === '') {
    return res.status(400).json({
      message: 'session_token is required and must be a non-empty string.',
    });
  }

  const userId = extractUserIdIfPresent(req);

  try {
    const { cart, created } = await cartService.findOrCreateCartForRequest({
      userId,
      sessionToken: session_token.trim(),
    });
    return res.status(created ? 201 : 200).json(cart);
  } catch (err) {
    return handleError(res, err, 'createOrGetCart');
  }
};

// ─── GET /api/cart/:cartId ────────────────────────────────────────────────────

/**
 * GET /api/cart/:cartId
 * Returns a cart with all items, product info, prices and subtotals.
 *
 * :cartId — UUID (carts.id is UUID)
 *
 * 200 — cart found
 * 400 — cartId is not a valid UUID
 * 404 — cart not found
 */
const getCart = async (req, res) => {
  const { cartId } = req.params;

  if (!isValidUUID(cartId)) {
    return res.status(400).json({ message: 'Invalid cart ID format. Cart ID must be a UUID.' });
  }

  try {
    const cart = await cartService.getCartById(cartId);

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    return res.status(200).json(cart);
  } catch (err) {
    return handleError(res, err, `getCart(${cartId})`);
  }
};

// ─── POST /api/cart/:cartId/items ─────────────────────────────────────────────

/**
 * POST /api/cart/:cartId/items
 * Adds a variant to the cart, or increments quantity if already present.
 *
 * :cartId — UUID (carts.id is UUID)
 * Body: { "variant_id": <integer>, "quantity": <positive integer> }
 *
 * SECURITY:
 *   - variant_id is validated as a positive INTEGER (product_variants.id is INTEGER).
 *   - unit_price is ALWAYS read from the database — never from the request body.
 *   - Any client-supplied unit_price field is silently ignored.
 *
 * 200 — item added / quantity updated, full cart returned
 * 400 — missing/invalid fields
 * 404 — cart or variant not found
 * 409 — variant unavailable or insufficient stock
 */
const addItem = async (req, res) => {
  const { cartId } = req.params;

  if (!isValidUUID(cartId)) {
    return res.status(400).json({ message: 'Invalid cart ID format. Cart ID must be a UUID.' });
  }

  const { variant_id, quantity } = req.body;

  // variant_id must be a positive integer (product_variants.id is INTEGER)
  if (!isPositiveInteger(variant_id)) {
    return res.status(400).json({
      message: 'variant_id is required and must be a positive integer.',
    });
  }

  // quantity must be a positive integer
  if (
    quantity === undefined ||
    quantity === null ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      message: 'quantity is required and must be a positive integer.',
    });
  }

  // Coerce variant_id to integer (in case it arrived as a numeric string)
  const variantIdInt = parseInt(variant_id, 10);

  try {
    const cart = await cartService.addItemToCart(cartId, variantIdInt, quantity);
    return res.status(200).json(cart);
  } catch (err) {
    return handleError(res, err, `addItem(${cartId}, ${variantIdInt})`);
  }
};

// ─── PUT /api/cart/:cartId/items/:itemId ──────────────────────────────────────

/**
 * PUT /api/cart/:cartId/items/:itemId
 * Updates the quantity of an existing cart item.
 *
 * :cartId  — UUID   (carts.id is UUID)
 * :itemId  — INTEGER (cart_items.id is INTEGER SERIAL)
 * Body: { "quantity": <positive integer> }
 *
 * SECURITY: unit_price is refreshed from the database — not from the client.
 *
 * 200 — updated, full cart returned
 * 400 — missing/invalid fields
 * 404 — cart item not found or belongs to another cart
 * 409 — variant unavailable or insufficient stock
 */
const updateItem = async (req, res) => {
  const { cartId, itemId } = req.params;

  if (!isValidUUID(cartId)) {
    return res.status(400).json({ message: 'Invalid cart ID format. Cart ID must be a UUID.' });
  }

  // itemId is an INTEGER (cart_items.id is INTEGER SERIAL)
  if (!isPositiveInteger(itemId)) {
    return res.status(400).json({ message: 'Invalid item ID format. Item ID must be a positive integer.' });
  }

  const { quantity } = req.body;

  if (
    quantity === undefined ||
    quantity === null ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      message: 'quantity is required and must be a positive integer.',
    });
  }

  const itemIdInt = parseInt(itemId, 10);

  try {
    const cart = await cartService.updateCartItem(cartId, itemIdInt, quantity);
    return res.status(200).json(cart);
  } catch (err) {
    return handleError(res, err, `updateItem(${cartId}, ${itemIdInt})`);
  }
};

// ─── DELETE /api/cart/:cartId/items/:itemId ───────────────────────────────────

/**
 * DELETE /api/cart/:cartId/items/:itemId
 * Removes a single item from the cart (ownership-verified).
 *
 * :cartId  — UUID   (carts.id is UUID)
 * :itemId  — INTEGER (cart_items.id is INTEGER SERIAL)
 *
 * 200 — item removed
 * 400 — invalid ID format
 * 404 — cart item not found or belongs to another cart
 */
const removeItem = async (req, res) => {
  const { cartId, itemId } = req.params;

  if (!isValidUUID(cartId)) {
    return res.status(400).json({ message: 'Invalid cart ID format. Cart ID must be a UUID.' });
  }

  // itemId is an INTEGER (cart_items.id is INTEGER SERIAL)
  if (!isPositiveInteger(itemId)) {
    return res.status(400).json({ message: 'Invalid item ID format. Item ID must be a positive integer.' });
  }

  const itemIdInt = parseInt(itemId, 10);

  try {
    await cartService.removeCartItem(cartId, itemIdInt);
    return res.status(200).json({ message: 'Cart item removed successfully' });
  } catch (err) {
    return handleError(res, err, `removeItem(${cartId}, ${itemIdInt})`);
  }
};

// ─── DELETE /api/cart/:cartId ─────────────────────────────────────────────────

/**
 * DELETE /api/cart/:cartId
 * Removes ALL items from the cart (the cart record itself is preserved).
 *
 * :cartId — UUID (carts.id is UUID)
 *
 * 200 — cleared
 * 400 — invalid UUID format
 * 404 — cart not found
 */
const clearCart = async (req, res) => {
  const { cartId } = req.params;

  if (!isValidUUID(cartId)) {
    return res.status(400).json({ message: 'Invalid cart ID format. Cart ID must be a UUID.' });
  }

  try {
    const found = await cartService.clearCart(cartId);

    if (!found) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    return res.status(200).json({ message: 'Cart cleared successfully' });
  } catch (err) {
    return handleError(res, err, `clearCart(${cartId})`);
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  createOrGetCart,
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
