/**
 * orderRoutes.js
 * Route definitions for the Order API.
 *
 * Routes:
 *   POST   /api/orders                 createOrder     — optional JWT (guests + auth users)
 *   GET    /api/orders                 getOrders       — JWT required
 *   GET    /api/orders/:orderId        getOrder        — JWT required
 *   PATCH  /api/orders/:orderId/status updateStatus    — JWT required + ADMIN role
 *   DELETE /api/orders/:orderId        deleteOrder     — JWT required + ADMIN role
 *   DELETE /api/orders                 deleteAllOrders — JWT required + ADMIN role, explicit confirm required
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const authenticate = require('../middleware/authenticate');

const {
  createOrder,
  getOrders,
  getOrder,
  updateStatus,
  deleteOrder,
  deleteAllOrders,
} = require('../controllers/orderController');

// ─── OPTIONAL AUTH MIDDLEWARE ─────────────────────────────────────────────────

/**
 * optionalAuth — runs authenticate only when a Bearer token is present.
 * If no Authorization header is provided, req.user is set to null and
 * the request continues as a guest.
 *
 * This allows POST /api/orders to serve both guest and authenticated checkouts
 * without requiring a token.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token present — guest request
    req.user = null;
    return next();
  }
  // Token present — run full authentication
  return authenticate(req, res, next);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// POST /api/orders — checkout from cart (guest or authenticated)
router.post('/', optionalAuth, createOrder);

// GET  /api/orders — list current user's orders
router.get('/', authenticate, getOrders);

// GET  /api/orders/:orderId — get a single order
router.get('/:orderId', authenticate, getOrder);

// PATCH /api/orders/:orderId/status — update order status (ADMIN only)
router.patch('/:orderId/status', authenticate, updateStatus);

// DELETE /api/orders/:orderId — permanently delete a single order (ADMIN only)
router.delete('/:orderId', authenticate, deleteOrder);

// DELETE /api/orders — permanently delete EVERY order (ADMIN only, requires confirm in body)
router.delete('/', authenticate, deleteAllOrders);

module.exports = router;
