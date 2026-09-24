/**
 * orderController.js
 * Handles HTTP request/response for all order endpoints.
 * Delegates all database work to orderService.
 *
 * Routes handled:
 *   POST   /api/orders                    createOrder     (optional JWT)
 *   GET    /api/orders                    getOrders       (JWT required — admin sees ALL orders, customer sees only their own)
 *   GET    /api/orders/:orderId           getOrder        (JWT required)
 *   PATCH  /api/orders/:orderId/status    updateStatus    (JWT required + ADMIN role)
 *   DELETE /api/orders/:orderId           deleteOrder     (JWT required + ADMIN role)
 *   DELETE /api/orders                    deleteAllOrders (JWT required + ADMIN role, explicit confirm required)
 *
 * Validation rules (from live DB CHECK constraints):
 *   - fulfillment_type: 'DELIVERY' or 'PICKUP' (UPPERCASE only)
 *   - payment_method:   'CASH_ON_DELIVERY' or 'MOBILE_MONEY' (UPPERCASE only)
 *   - status:           'PENDING','CONFIRMED','PROCESSING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'
 *   - customer_name + customer_phone: always required (NOT NULL in DB for all orders)
 *   - address: required when fulfillment_type = 'DELIVERY'; optional for PICKUP
 *   - cart_id: must be a valid UUID
 */

'use strict';

const orderService = require('../services/orderService');

// ─── VALIDATION HELPERS ─────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the string is a valid v4 UUID.
 * @param {string} str
 * @returns {boolean}
 */
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

const VALID_FULFILLMENT_TYPES = ['DELIVERY', 'PICKUP'];
const VALID_PAYMENT_METHODS   = ['CASH_ON_DELIVERY', 'MOBILE_MONEY'];
const VALID_STATUSES          = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

// ─── ERROR HANDLER ───────────────────────────────────────────────────────

/**
 * Central error handler for controller actions.
 * Service errors with .statusCode in the 4xx range are returned as-is.
 * Unknown errors are logged and returned as 500.
 *
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {string} context - For logging
 */
function handleError(res, err, context) {
  const code = err.statusCode;
  if (code && code >= 400 && code < 500) {
    return res.status(code).json({ success: false, message: err.message });
  }
  console.error(`[OrderController] ${context}:`, err.message);
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
  });
}

// ─── POST /api/orders ────────────────────────────────────────────────────

/**
 * Creates a new order from a cart (checkout).
 * Authentication is optional — both guests and authenticated users can checkout.
 *
 * Body: { cart_id, customer_name, customer_phone, fulfillment_type, payment_method,
 *          address, instructions }
 *
 * Response 201: { success: true, order: { ...order, items, payment, delivery } }
 */
const createOrder = async (req, res) => {
  const {
    cart_id,
    customer_name,
    customer_phone,
    fulfillment_type,
    payment_method,
    address,
    instructions,
  } = req.body;

  // ── Validate cart_id ────────────────────────────────────────────
  if (!cart_id || !isValidUUID(cart_id)) {
    return res.status(400).json({
      success: false,
      message: 'cart_id is required and must be a valid UUID.',
    });
  }

  // ── Validate customer_name ───────────────────────────────────────
  if (
    !customer_name ||
    typeof customer_name !== 'string' ||
    !customer_name.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'customer_name is required.',
    });
  }

  // ── Validate customer_phone ──────────────────────────────────────
  if (
    !customer_phone ||
    typeof customer_phone !== 'string' ||
    !customer_phone.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'customer_phone is required.',
    });
  }

  // ── Validate fulfillment_type (UPPERCASE only) ───────────────────
  if (!fulfillment_type || !VALID_FULFILLMENT_TYPES.includes(fulfillment_type)) {
    return res.status(400).json({
      success: false,
      message: `fulfillment_type must be one of: ${VALID_FULFILLMENT_TYPES.join(', ')}`,
    });
  }

  // ── Validate payment_method (UPPERCASE only) ─────────────────────
  if (!payment_method || !VALID_PAYMENT_METHODS.includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`,
    });
  }

  // ── Validate address for DELIVERY orders ─────────────────────────
  //    DB has no conditional NOT NULL — must enforce at app layer
  if (
    fulfillment_type === 'DELIVERY' &&
    (!address || typeof address !== 'string' || !address.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: 'address is required for DELIVERY orders.',
    });
  }

  // ── userId from JWT (null for guests) ────────────────────────────
  const userId = req.user ? req.user.id : null;

  try {
    const order = await orderService.checkout({
      cartId:          cart_id,
      userId,
      customerName:    customer_name.trim(),
      customerPhone:   customer_phone.trim(),
      fulfillmentType: fulfillment_type,
      paymentMethod:   payment_method,
      address:         address ? address.trim() : null,
      instructions:    instructions ? String(instructions).trim() : null,
    });

    return res.status(201).json({ success: true, order });
  } catch (err) {
    return handleError(res, err, `createOrder(cart_id=${cart_id})`);
  }
};

// ─── GET /api/orders ──────────────────────────────────────────────────────

/**
 * Returns orders scoped by role:
 *   - ADMIN:    ALL orders in the system (every customer + every guest), newest first.
 *   - Customer: only their own orders.
 * Both support an optional ?status=<STATUS> filter.
 * JWT required either way.
 *
 * Response 200: { success: true, count: N, data: [...orders] }
 */
const getOrders = async (req, res) => {
  const { status } = req.query;

  // Validate status filter if provided, for both roles
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const isAdmin = req.user.role === 'ADMIN';

  try {
    let orders;
    if (isAdmin) {
      // Admins see every order in the system — not scoped to their own user_id.
      orders = await orderService.getAllOrders({ status });
    } else {
      // Customers only ever see their own orders.
      orders = await orderService.getOrdersByUser(req.user.id);
      if (status) {
        orders = orders.filter((o) => o.status === status);
      }
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    return handleError(res, err, 'getOrders');
  }
};

// ─── GET /api/orders/:orderId ─────────────────────────────────────────────

/**
 * Returns a single order by UUID.
 * JWT required. Non-admins can only access their own orders.
 * Admins can access any order.
 *
 * Response 200: { success: true, order: { ...order, items, payment, delivery } }
 */
const getOrder = async (req, res) => {
  const { orderId } = req.params;

  if (!isValidUUID(orderId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid order ID. Must be a valid UUID.',
    });
  }

  const isAdmin = req.user.role === 'ADMIN';

  try {
    const order = await orderService.getOrderById(orderId, req.user.id, isAdmin);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    return res.status(200).json({ success: true, order });
  } catch (err) {
    return handleError(res, err, `getOrder(${orderId})`);
  }
};

// ─── PATCH /api/orders/:orderId/status ────────────────────────────────────

/**
 * Updates the status of an order. ADMIN role required.
 * Status must be one of the valid uppercase values.
 *
 * Body: { status: 'CONFIRMED' }
 * Response 200: { success: true, order: { ...updatedOrder } }
 */
const updateStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status }  = req.body;

  if (!isValidUUID(orderId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid order ID. Must be a valid UUID.',
    });
  }

  // Admin check — users.role is UPPERCASE in the live DB
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.',
    });
  }

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const order = await orderService.updateOrderStatus(orderId, status);
    return res.status(200).json({ success: true, order });
  } catch (err) {
    return handleError(res, err, `updateStatus(${orderId})`);
  }
};

// ─── DELETE /api/orders/:orderId ───────────────────────────────────────────

/**
 * Permanently deletes an order. ADMIN role required.
 * Cascades to order_items, payments, and deliveries automatically.
 */
const deleteOrder = async (req, res) => {
  const { orderId } = req.params;

  if (!isValidUUID(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID. Must be a valid UUID.",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }

  try {
    const deleted = await orderService.deleteOrder(orderId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    return res.status(200).json({ success: true, message: "Order deleted." });
  } catch (err) {
    return handleError(res, err, `deleteOrder(${orderId})`);
  }
};

// ─── DELETE /api/orders (ALL) ───────────────────────────────────────────────

/**
 * Permanently deletes EVERY order in the system. ADMIN role required.
 * Irreversible, so this requires an explicit confirmation field in the
 * body — a bare DELETE request is rejected, to prevent this from ever
 * being triggered by accident (e.g. a stray script, a misclicked retry).
 *
 * Body: { confirm: "DELETE_ALL_ORDERS" }
 */
const deleteAllOrders = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }

  if (req.body?.confirm !== "DELETE_ALL_ORDERS") {
    return res.status(400).json({
      success: false,
      message: 'This is irreversible. Send { "confirm": "DELETE_ALL_ORDERS" } in the request body to proceed.',
    });
  }

  try {
    const count = await orderService.deleteAllOrders();
    return res.status(200).json({ success: true, message: `Deleted ${count} order(s).`, count });
  } catch (err) {
    return handleError(res, err, "deleteAllOrders");
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateStatus,
  deleteOrder,
  deleteAllOrders,
};
