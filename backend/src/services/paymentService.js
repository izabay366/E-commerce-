/**
 * paymentService.js
 * SQL operations for payments.
 *
 * LIVE SCHEMA (muhanga_market, PostgreSQL, port 5433):
 *
 * payments:
 *   id                    UUID    PK  DEFAULT gen_random_uuid()
 *   order_id              UUID    NOT NULL UNIQUE  FK → orders.id ON DELETE CASCADE
 *   method                VARCHAR NOT NULL  CHECK IN ('CASH_ON_DELIVERY','MOBILE_MONEY')
 *   amount                NUMERIC NOT NULL CHECK >= 0
 *   status                VARCHAR NOT NULL DEFAULT 'PENDING'
 *                         CHECK IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')
 *   transaction_reference VARCHAR nullable  (legacy — leave NULL)
 *   momo_reference        VARCHAR nullable  (use for MOBILE_MONEY)
 *   created_at, updated_at TIMESTAMP
 *
 * KEY BUSINESS RULES:
 *   - Only ADMIN users may update payment status (enforced at controller layer).
 *   - Customers/guests MUST NOT mark their own payment PAID.
 *   - CASH_ON_DELIVERY stays PENDING until staff/admin confirms.
 *   - MOBILE_MONEY: momo_reference should be stored when available but MoMo API is NOT called.
 *   - Status transitions are validated: PAID/CANCELLED/FAILED payments cannot be re-opened.
 *   - Payment update and optional order status update run in a single DB transaction.
 *   - All status/method values are UPPERCASE — lowercase causes DB CHECK constraint violation.
 */

'use strict';

const pool = require('../config/database');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const VALID_PAYMENT_METHODS = ['CASH_ON_DELIVERY', 'MOBILE_MONEY'];

const VALID_PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];

const VALID_ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

/**
 * Terminal statuses — payments in these states cannot be updated further.
 * REFUNDED can follow PAID but is treated as terminal here to require explicit
 * admin intent. Remove REFUNDED from this set when refund workflow is added.
 */
const TERMINAL_PAYMENT_STATUSES = ['CANCELLED', 'FAILED'];

// ─── FORMAT HELPER ────────────────────────────────────────────────────────────

/**
 * Formats a raw DB payments row into the standard API shape.
 * @param {object} row - Raw payments row from PostgreSQL
 * @returns {object}
 */
function formatPayment(row) {
  return {
    id:                    row.id,
    order_id:              row.order_id,
    method:                row.method,
    amount:                parseFloat(row.amount),
    status:                row.status,
    momo_reference:        row.momo_reference   || null,
    transaction_reference: row.transaction_reference || null,
    created_at:            row.created_at,
    updated_at:            row.updated_at,
  };
}

// ─── GET ALL PAYMENTS (ADMIN) ───────────────────────────────────────────────

/**
 * Fetches all payments for admin review, newest first.
 * Joins orders for customer_name, customer_phone, and order status.
 * Left-joins users for email (only when orders.user_id is not null — guest orders have no user row).
 *
 * @param {object}      [params]
 * @param {string|null} [params.status]  - Filter by payment status (UPPERCASE, pre-validated)
 * @param {string|null} [params.method]  - Filter by payment method (UPPERCASE, pre-validated)
 * @returns {object[]}
 */
const getAllPayments = async ({ status = null, method = null } = {}) => {
  const conditions = [];
  const values     = [];

  if (status) {
    values.push(status);
    conditions.push(`p.status = $${values.length}`);
  }
  if (method) {
    values.push(method);
    conditions.push(`p.method = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
       p.id,
       p.order_id,
       p.method,
       p.amount,
       p.status,
       p.momo_reference,
       p.transaction_reference,
       p.created_at,
       p.updated_at,
       o.status          AS order_status,
       o.customer_name,
       o.customer_phone,
       o.fulfillment_type,
       u.email           AS customer_email
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY p.created_at DESC`,
    values
  );

  return result.rows.map((row) => ({
    id:                    row.id,
    order_id:              row.order_id,
    method:                row.method,
    amount:                parseFloat(row.amount),
    status:                row.status,
    momo_reference:        row.momo_reference        || null,
    transaction_reference: row.transaction_reference || null,
    order_status:          row.order_status,
    fulfillment_type:      row.fulfillment_type,
    customer: {
      name:  row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email || null,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

// ─── GET PAYMENT BY ID ────────────────────────────────────────────────────────

/**
 * Fetches a single payment by its UUID.
 * Returns null if not found.
 *
 * @param {string} paymentId - UUID
 * @returns {object|null}
 */
const getPaymentById = async (paymentId) => {
  const result = await pool.query(
    `SELECT id, order_id, method, amount, status,
            momo_reference, transaction_reference, created_at, updated_at
     FROM payments
     WHERE id = $1`,
    [paymentId]
  );
  if (result.rows.length === 0) return null;
  return formatPayment(result.rows[0]);
};

// ─── GET PAYMENT BY ORDER ID ──────────────────────────────────────────────────

/**
 * Fetches the payment record for a given order UUID.
 * Returns null if no payment exists for that order.
 *
 * @param {string} orderId - UUID of the order
 * @returns {object|null}
 */
const getPaymentByOrderId = async (orderId) => {
  const result = await pool.query(
    `SELECT id, order_id, method, amount, status,
            momo_reference, transaction_reference, created_at, updated_at
     FROM payments
     WHERE order_id = $1`,
    [orderId]
  );
  if (result.rows.length === 0) return null;
  return formatPayment(result.rows[0]);
};

// ─── UPDATE PAYMENT ───────────────────────────────────────────────────────────

/**
 * Updates payment status (and optionally momo_reference).
 * Optionally updates the related order status in the same DB transaction.
 *
 * Business rules enforced:
 *   - status must be a known VALID_PAYMENT_STATUSES value.
 *   - Payments in TERMINAL_PAYMENT_STATUSES (CANCELLED, FAILED) cannot be updated.
 *   - If orderStatus is provided, it must be a known VALID_ORDER_STATUSES value.
 *   - Both payment and order updates run inside a single PostgreSQL transaction.
 *   - momo_reference is stored only when provided; existing value is preserved via COALESCE.
 *
 * @param {object} params
 * @param {string}      params.paymentId    - UUID of the payment to update
 * @param {string}      params.status       - New payment status (UPPERCASE)
 * @param {string|null} params.momo_reference - MoMo reference (optional, MOBILE_MONEY only)
 * @param {string|null} params.orderStatus  - Optional new order status (UPPERCASE)
 * @returns {{ payment: object, order: object|null }}
 * @throws {Error} With .statusCode for 4xx controlled responses
 */
const updatePayment = async ({
  paymentId,
  status,
  momo_reference = null,
  orderStatus = null,
}) => {
  // ── Validate payment status value ─────────────────────────────────────────
  if (!VALID_PAYMENT_STATUSES.includes(status)) {
    const err = new Error(
      `Invalid payment status. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  // ── Validate order status value if provided ───────────────────────────────
  if (orderStatus !== null && orderStatus !== undefined) {
    if (!VALID_ORDER_STATUSES.includes(orderStatus)) {
      const err = new Error(
        `Invalid order status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Lock and fetch the payment row ────────────────────────────────────────
    const pRes = await client.query(
      `SELECT id, order_id, method, status AS current_status
       FROM payments
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    );

    if (pRes.rows.length === 0) {
      const err = new Error('Payment not found.');
      err.statusCode = 404;
      throw err;
    }

    const paymentRow = pRes.rows[0];

    // ── Terminal status guard ─────────────────────────────────────────────────
    // CANCELLED and FAILED payments cannot be re-opened or further changed.
    if (TERMINAL_PAYMENT_STATUSES.includes(paymentRow.current_status)) {
      const err = new Error(
        `Payment is already ${paymentRow.current_status} and cannot be updated further.`
      );
      err.statusCode = 422;
      throw err;
    }

    // ── Update the payment row ────────────────────────────────────────────────
    // momo_reference: update only when a new value is provided; otherwise keep existing.
    await client.query(
      `UPDATE payments
       SET status         = $1,
           momo_reference = COALESCE($2, momo_reference),
           updated_at     = NOW()
       WHERE id = $3`,
      [status, momo_reference, paymentId]
    );

    // ── Optionally update the associated order status ─────────────────────────
    let updatedOrder = null;
    if (orderStatus !== null && orderStatus !== undefined) {
      const oRes = await client.query(
        `UPDATE orders
         SET status     = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [orderStatus, paymentRow.order_id]
      );

      if (oRes.rows.length === 0) {
        const err = new Error('Associated order not found.');
        err.statusCode = 404;
        throw err;
      }

      updatedOrder = oRes.rows[0];
    }

    await client.query('COMMIT');

    // Return fresh payment row (after commit, outside transaction)
    const updatedPayment = await getPaymentById(paymentId);
    client.release();

    return { payment: updatedPayment, order: updatedOrder };

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    client.release();
    throw err;
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllPayments,
  getPaymentById,
  getPaymentByOrderId,
  updatePayment,
  VALID_PAYMENT_METHODS,
  VALID_PAYMENT_STATUSES,
  VALID_ORDER_STATUSES,
};
