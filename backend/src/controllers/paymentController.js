/**
 * paymentController.js
 * HTTP handlers for the Payment API.
 *
 * Routes handled:
 *   GET   /api/payments/:id            getPayment   — JWT required (ADMIN or payment owner)
 *   GET   /api/payments/order/:orderId getPaymentByOrder — JWT required (ADMIN or order owner)
 *   PATCH /api/payments/:id            updatePayment — JWT required + ADMIN role only
 *
 * Security model:
 *   - Only ADMIN users may change a payment status.
 *   - Customers may read their own payment (ownership verified via order.user_id).
 *   - Customers/guests MUST NOT mark their own payment as PAID.
 *   - Unauthenticated requests are rejected at the middleware layer (401).
 */

'use strict';

const paymentService = require('../services/paymentService');
const pool           = require('../config/database');

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────

function handleError(res, err, context) {
  const code = err.statusCode;
  if (code && code >= 400 && code < 500) {
    return res.status(code).json({ success: false, message: err.message });
  }
  console.error(`[paymentController] ${context}:`, err.message);
  return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
}

// ─── GET /api/payments (admin list) ───────────────────────────────────────────────

/**
 * Returns all payments for admin review.
 * Supports optional ?status= and ?method= query filters.
 * Both filters validate against known values — unknown values return HTTP 400.
 *
 * Response 200: { success: true, count: N, data: [ { id, order_id, method, amount,
 *   status, momo_reference, transaction_reference, order_status, customer: { name, phone, email },
 *   created_at, updated_at }, ... ] }
 */
const getAllPayments = async (req, res) => {
  // —— ADMIN-only guard ———————————————————————————————————
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
  }

  const { status, method } = req.query;

  // —— Validate status filter ——————————————————————————————
  if (status !== undefined) {
    const normalised = String(status).trim().toUpperCase();
    if (!paymentService.VALID_PAYMENT_STATUSES.includes(normalised)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status filter. Must be one of: ${paymentService.VALID_PAYMENT_STATUSES.join(', ')}`,
      });
    }
  }

  // —— Validate method filter ——————————————————————————————
  if (method !== undefined) {
    const normalised = String(method).trim().toUpperCase();
    if (!paymentService.VALID_PAYMENT_METHODS.includes(normalised)) {
      return res.status(400).json({
        success: false,
        message: `Invalid method filter. Must be one of: ${paymentService.VALID_PAYMENT_METHODS.join(', ')}`,
      });
    }
  }

  try {
    const payments = await paymentService.getAllPayments({
      status: status ? String(status).trim().toUpperCase() : null,
      method: method ? String(method).trim().toUpperCase() : null,
    });

    return res.status(200).json({
      success: true,
      count:   payments.length,
      data:    payments,
    });
  } catch (err) {
    return handleError(res, err, 'getAllPayments');
  }
};

// ─── GET /api/payments/:id ────────────────────────────────────────────────────

/**
 * Returns a single payment by UUID.
 * - ADMIN: may access any payment.
 * - Customer: may only access payment if the linked order belongs to them.
 *
 * Response 200: { success: true, payment: { ... } }
 */
const getPayment = async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: 'Invalid payment ID. Must be a valid UUID.' });
  }

  try {
    const payment = await paymentService.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }

    // Ownership check for non-admin users
    if (req.user.role !== 'ADMIN') {
      const orderRes = await pool.query(
        `SELECT user_id FROM orders WHERE id = $1`,
        [payment.order_id]
      );
      const order = orderRes.rows[0];
      if (!order || order.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied. You do not own this payment.' });
      }
    }

    return res.status(200).json({ success: true, payment });
  } catch (err) {
    return handleError(res, err, `getPayment(${id})`);
  }
};

// ─── GET /api/payments/order/:orderId ────────────────────────────────────────

/**
 * Returns the payment record for a given order UUID.
 * - ADMIN: may access any payment.
 * - Customer: may only access payment for their own order.
 *
 * Response 200: { success: true, payment: { ... } }
 */
const getPaymentByOrder = async (req, res) => {
  const { orderId } = req.params;

  if (!isValidUUID(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID. Must be a valid UUID.' });
  }

  try {
    // Verify order exists and check ownership for non-admins
    const orderRes = await pool.query(`SELECT id, user_id FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    if (req.user.role !== 'ADMIN' && order.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this order.' });
    }

    const payment = await paymentService.getPaymentByOrderId(orderId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'No payment found for this order.' });
    }

    return res.status(200).json({ success: true, payment });
  } catch (err) {
    return handleError(res, err, `getPaymentByOrder(${orderId})`);
  }
};

// ─── PATCH /api/payments/:id ──────────────────────────────────────────────────

/**
 * Updates a payment status. ADMIN role required.
 *
 * Body: {
 *   status:         'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'   (required)
 *   momo_reference: string                                           (optional, MOBILE_MONEY)
 *   order_status:   'CONFIRMED' | 'PROCESSING' | ... | 'CANCELLED'  (optional, transactional)
 * }
 *
 * Security:
 *   - Only ADMIN role may call this endpoint.
 *   - Customers/guests are rejected with 403.
 *   - Payments in CANCELLED or FAILED state cannot be updated (422).
 *
 * Response 200: { success: true, payment: { ... }, order: { ... } | null }
 */
const updatePayment = async (req, res) => {
  const { id } = req.params;
  const { status, momo_reference, order_status } = req.body || {};

  // ── UUID check ───────────────────────────────────────────────────────────
  if (!isValidUUID(id)) {
    return res.status(400).json({ success: false, message: 'Invalid payment ID. Must be a valid UUID.' });
  }

  // ── ADMIN-only guard ──────────────────────────────────────────────────────
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
  }

  // ── status is required ────────────────────────────────────────────────────
  if (!status || typeof status !== 'string' || !status.trim()) {
    return res.status(400).json({ success: false, message: 'status is required.' });
  }

  try {
    const result = await paymentService.updatePayment({
      paymentId:     id,
      status:        status.trim().toUpperCase(),
      momo_reference: momo_reference ? String(momo_reference).trim() : null,
      orderStatus:   order_status ? String(order_status).trim().toUpperCase() : null,
    });

    return res.status(200).json({
      success: true,
      payment: result.payment,
      order:   result.order || null,
    });

  } catch (err) {
    return handleError(res, err, `updatePayment(${id})`);
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllPayments,
  getPayment,
  getPaymentByOrder,
  updatePayment,
};
