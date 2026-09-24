/**
 * orderService.js
 * All SQL queries related to orders, payments, and deliveries.
 *
 * LIVE SCHEMA (muhanga_market, PostgreSQL, port 5433):
 *
 * orders:
 *   id               UUID   PK  DEFAULT gen_random_uuid()
 *   user_id          UUID   nullable  FK -> users.id ON DELETE SET NULL
 *   customer_name    VARCHAR NOT NULL
 *   customer_phone   VARCHAR NOT NULL
 *   total_amount     NUMERIC NOT NULL CHECK >= 0
 *   status           VARCHAR NOT NULL DEFAULT 'PENDING'
 *                    CHECK IN ('PENDING','CONFIRMED','PROCESSING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')
 *   fulfillment_type VARCHAR NOT NULL DEFAULT 'DELIVERY'
 *                    CHECK IN ('DELIVERY','PICKUP')
 *   created_at, updated_at TIMESTAMP NOT NULL
 *
 * order_items:
 *   id           INTEGER  SERIAL PK
 *   order_id     UUID     NOT NULL  FK -> orders.id ON DELETE CASCADE
 *   product_id   INTEGER  NOT NULL  FK -> products.id ON DELETE RESTRICT
 *   variant_id   INTEGER  NOT NULL  FK -> product_variants.id ON DELETE RESTRICT
 *   product_name VARCHAR  NOT NULL  SNAPSHOT taken at checkout time
 *   variant_name VARCHAR  nullable  SNAPSHOT taken at checkout time
 *   quantity     NUMERIC  NOT NULL CHECK > 0   pg returns as JS string; parseInt()
 *   unit_price   NUMERIC  NOT NULL CHECK >= 0  from product_variants.price, not cart
 *   subtotal     NUMERIC  NOT NULL CHECK >= 0  STORED: quantity x unit_price
 *   created_at   TIMESTAMP NOT NULL
 *
 * payments:
 *   id                    UUID    PK  DEFAULT gen_random_uuid()
 *   order_id              UUID    NOT NULL UNIQUE  FK -> orders.id ON DELETE CASCADE
 *   method                VARCHAR NOT NULL  CHECK IN ('CASH_ON_DELIVERY','MOBILE_MONEY')
 *   amount                NUMERIC NOT NULL CHECK >= 0
 *   status                VARCHAR NOT NULL DEFAULT 'PENDING'
 *                         CHECK IN ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')
 *   transaction_reference VARCHAR nullable  legacy column, leave NULL
 *   momo_reference        VARCHAR nullable  use for MOBILE_MONEY
 *   created_at, updated_at
 *
 * deliveries:
 *   id           UUID    PK  DEFAULT gen_random_uuid()
 *   order_id     UUID    NOT NULL UNIQUE  FK -> orders.id ON DELETE CASCADE
 *   type         VARCHAR NOT NULL DEFAULT 'DELIVERY'  CHECK IN ('DELIVERY','PICKUP')
 *   address      TEXT    nullable  validated NOT NULL for DELIVERY at app layer
 *   instructions TEXT    nullable
 *   status       VARCHAR NOT NULL DEFAULT 'PENDING'
 *                CHECK IN ('PENDING','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY',
 *                          'DELIVERED','PICKED_UP','CANCELLED')
 *   created_at, updated_at
 *
 * KEY DESIGN DECISIONS:
 *   - Prices are re-read from product_variants.price at checkout, NOT from cart_items.unit_price.
 *   - order_items.product_name + variant_name are stored as snapshots at checkout time.
 *   - order_items.subtotal is a STORED computed column (quantity x unit_price).
 *   - A deliveries row is created for EVERY order (including PICKUP); type column distinguishes them.
 *   - The entire checkout runs inside a single PostgreSQL transaction.
 *   - Cart is cleared only after COMMIT (Step 10 of 11).
 *   - All status/type/method values are UPPERCASE — lowercase causes DB CHECK constraint violation.
 *   - order_items, payments, deliveries all have ON DELETE CASCADE on order_id,
 *     so deleting a row from `orders` automatically removes its related rows —
 *     deleteOrder/deleteAllOrders below don't need to touch those tables manually.
 */

'use strict';

const pool = require('../config/database');

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const VALID_ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

// ─── FORMAT HELPERS ────────────────────────────────────────────────────

/**
 * Formats order item rows from the DB into the API response shape.
 * Parses NUMERIC strings from pg into proper JS numbers.
 *
 * @param {object} item - Raw order_items row from PostgreSQL
 */
function formatOrderItem(item) {
  return {
    id:           item.id,
    product_id:   item.product_id,
    product_name: item.product_name,
    variant_id:   item.variant_id,
    variant_name: item.variant_name,
    // quantity is NUMERIC — pg driver returns JS string; must parseInt
    quantity:     parseInt(item.quantity, 10),
    unit_price:   parseFloat(item.unit_price),
    subtotal:     parseFloat(item.subtotal),
  };
}

/**
 * Formats a payments row into the API response shape.
 * @param {object|null} payment - Raw payments row or null
 */
function formatPayment(payment) {
  if (!payment) return null;
  return {
    id:                    payment.id,
    method:                payment.method,
    amount:                parseFloat(payment.amount),
    status:                payment.status,
    momo_reference:        payment.momo_reference || null,
    transaction_reference: payment.transaction_reference || null,
    created_at:            payment.created_at,
    updated_at:            payment.updated_at,
  };
}

/**
 * Formats a deliveries row into the API response shape.
 * @param {object|null} delivery - Raw deliveries row or null
 */
function formatDelivery(delivery) {
  if (!delivery) return null;
  return {
    id:           delivery.id,
    type:         delivery.type,
    address:      delivery.address,
    instructions: delivery.instructions,
    status:       delivery.status,
    created_at:   delivery.created_at,
    updated_at:   delivery.updated_at,
  };
}

/**
 * Assembles a complete order response from raw DB rows.
 *
 * @param {object}   order    - Raw orders row
 * @param {object[]} items    - Raw order_items rows
 * @param {object}   payment  - Raw payments row or null
 * @param {object}   delivery - Raw deliveries row or null
 */
function formatOrderResponse(order, items, payment, delivery) {
  return {
    id:               order.id,
    user_id:          order.user_id,
    customer_name:    order.customer_name,
    customer_phone:   order.customer_phone,
    fulfillment_type: order.fulfillment_type,
    status:           order.status,
    total_amount:     parseFloat(order.total_amount),
    items:            items.map(formatOrderItem),
    payment:          formatPayment(payment),
    delivery:         formatDelivery(delivery),
    created_at:       order.created_at,
    updated_at:       order.updated_at,
  };
}

// ─── PRIVATE QUERY HELPERS ─────────────────────────────────────────────

/**
 * Fetches all order_items for a given order_id.
 * Works with both a pg Pool and a pg Client (supports use inside transactions).
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} orderId - UUID
 */
async function fetchOrderItems(db, orderId) {
  const result = await db.query(
    `SELECT id, product_id, variant_id, product_name, variant_name,
            quantity, unit_price, subtotal, created_at
     FROM order_items
     WHERE order_id = $1
     ORDER BY id ASC`,
    [orderId]
  );
  return result.rows;
}

/**
 * Fetches the payment record for a given order_id.
 * Returns null if no payment exists.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} orderId - UUID
 */
async function fetchOrderPayment(db, orderId) {
  const result = await db.query(
    `SELECT id, order_id, method, amount, status,
            momo_reference, transaction_reference,
            created_at, updated_at
     FROM payments
     WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

/**
 * Fetches the delivery record for a given order_id.
 * Returns null if no delivery exists.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} orderId - UUID
 */
async function fetchOrderDelivery(db, orderId) {
  const result = await db.query(
    `SELECT id, order_id, type, address, instructions, status,
            created_at, updated_at
     FROM deliveries
     WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

// ─── CHECKOUT (ATOMIC TRANSACTION) ─────────────────────────────────────

/**
 * Executes the complete checkout flow inside a single PostgreSQL transaction.
 *
 * Transaction steps:
 *   1.  Lock the cart row (FOR UPDATE) - prevents concurrent checkout of same cart
 *   2.  Lock product_variant rows (FOR UPDATE OF pv) - prevents concurrent price/stock changes
 *   3.  Validate cart is not empty
 *   4.  Validate each variant: is_available, product is_available, stock
 *   5.  Calculate subtotals from product_variants.price (NOT cart_items.unit_price)
 *   6.  INSERT orders
 *   7.  INSERT order_items (one per cart item, with product_name + variant_name snapshots)
 *   8.  INSERT payments
 *   9.  INSERT deliveries (for BOTH DELIVERY and PICKUP - type column distinguishes them)
 *  10.  DELETE cart_items (only after all inserts succeed)
 *  11.  COMMIT
 *  On any error: ROLLBACK - no partial data
 *
 * @param {object} params
 * @param {string}      params.cartId          - UUID (carts.id)
 * @param {string|null} params.userId          - UUID (users.id) or null for guests
 * @param {string}      params.customerName    - NOT NULL in DB; required for all orders
 * @param {string}      params.customerPhone   - NOT NULL in DB; required for all orders
 * @param {string}      params.fulfillmentType - 'DELIVERY' or 'PICKUP' (UPPERCASE)
 * @param {string}      params.paymentMethod   - 'CASH_ON_DELIVERY' or 'MOBILE_MONEY' (UPPERCASE)
 * @param {string|null} params.address         - Required for DELIVERY; null for PICKUP
 * @param {string|null} params.instructions    - Optional for both types
 *
 * @returns {object} Formatted order response with items, payment, and delivery
 * @throws  {Error}  With .statusCode for controlled HTTP responses (4xx)
 */
const checkout = async ({
  cartId,
  userId,
  customerName,
  customerPhone,
  fulfillmentType,
  paymentMethod,
  address,
  instructions,
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Lock cart row ──────────────────────────────────────────
    const cartResult = await client.query(
      `SELECT id FROM carts WHERE id = $1 FOR UPDATE`,
      [cartId]
    );
    if (cartResult.rows.length === 0) {
      const err = new Error('Cart not found');
      err.statusCode = 404;
      throw err;
    }

    // ── 2. Fetch cart items with fresh variant/product data; lock variants ──
    //    Prices come from product_variants.price, NOT from cart_items.unit_price.
    const itemsResult = await client.query(
      `SELECT
         ci.id             AS cart_item_id,
         ci.quantity       AS quantity,
         pv.id             AS variant_id,
         pv.price          AS unit_price,
         pv.name           AS variant_name,
         pv.is_available   AS variant_available,
         pv.stock_quantity AS stock_quantity,
         p.id              AS product_id,
         p.name            AS product_name,
         p.is_available    AS product_available
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p          ON p.id  = pv.product_id
       WHERE ci.cart_id = $1
       FOR UPDATE OF pv`,
      [cartId]
    );

    // ── 3. Cart must not be empty ─────────────────────────────────
    if (itemsResult.rows.length === 0) {
      const err = new Error('Cart is empty. Add items before checking out.');
      err.statusCode = 400;
      throw err;
    }

    // ── 4. Validate each item ─────────────────────────────────────
    for (const item of itemsResult.rows) {
      if (!item.product_available) {
        const err = new Error(
          `Product "${item.product_name}" is no longer available.`
        );
        err.statusCode = 409;
        throw err;
      }
      if (!item.variant_available) {
        const err = new Error(
          `Variant "${item.variant_name}" is no longer available.`
        );
        err.statusCode = 409;
        throw err;
      }
      // Stock enforcement: only when stock_quantity > 0 (0 means not yet tracked)
      const qty   = parseInt(item.quantity, 10);
      const stock = parseInt(item.stock_quantity, 10);
      if (stock > 0 && qty > stock) {
        const err = new Error(
          `Insufficient stock for "${item.product_name}" ${item.variant_name}. ` +
          `Available: ${stock}, requested: ${qty}`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    // ── 5. Calculate totals from DB prices ────────────────────────
    const lineItems = itemsResult.rows.map((item) => {
      const qty      = parseInt(item.quantity, 10);
      const price    = parseFloat(item.unit_price); // from product_variants.price
      const subtotal = parseFloat((price * qty).toFixed(2));
      return {
        product_id:   item.product_id,
        variant_id:   item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity:     qty,
        unit_price:   price,
        subtotal,
      };
    });

    const totalAmount = parseFloat(
      lineItems.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2)
    );

    // ── 6. Insert order ────────────────────────────────────────────
    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, customer_name, customer_phone, fulfillment_type, status, total_amount)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING *`,
      [userId || null, customerName, customerPhone, fulfillmentType, totalAmount]
    );
    const order = orderResult.rows[0];

    // ── 7. Insert order_items (one per cart item) ─────────────────
    //    product_name + variant_name are snapshots; subtotal is stored (not derived)
    const insertedItems = [];
    for (const item of lineItems) {
      const r = await client.query(
        `INSERT INTO order_items
           (order_id, product_id, variant_id,
            product_name, variant_name,
            quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.variant_name,
          item.quantity,
          item.unit_price,
          item.subtotal,
        ]
      );
      insertedItems.push(r.rows[0]);
    }

    // ── 8. Insert payment record ──────────────────────────────────
    const paymentResult = await client.query(
      `INSERT INTO payments (order_id, method, amount, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
      [order.id, paymentMethod, totalAmount]
    );
    const payment = paymentResult.rows[0];

    // ── 9. Insert delivery (for BOTH DELIVERY and PICKUP) ─────────
    //    type mirrors fulfillment_type; address is NULL for PICKUP (DB allows it)
    const deliveryResult = await client.query(
      `INSERT INTO deliveries (order_id, type, address, instructions, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [order.id, fulfillmentType, address || null, instructions || null]
    );
    const delivery = deliveryResult.rows[0];

    // ── 10. Clear cart (ONLY after all inserts succeeded) ──────────
    await client.query(
      `DELETE FROM cart_items WHERE cart_id = $1`,
      [cartId]
    );

    // ── 11. Commit ───────────────────────────────────────────────
    await client.query('COMMIT');
    client.release();

    return formatOrderResponse(order, insertedItems, payment, delivery);

  } catch (err) {
    // ROLLBACK on any failure — no partial orders
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    client.release();
    throw err;
  }
};

// ─── GET ORDER BY ID ────────────────────────────────────────────────────

/**
 * Returns a fully populated order by its UUID.
 * Returns null if the order does not exist.
 * Throws HTTP 403 if the order belongs to a different user (unless isAdmin = true).
 *
 * @param {string}  orderId - UUID
 * @param {string}  userId  - UUID of the requesting user
 * @param {boolean} isAdmin - If true, ownership check is skipped
 * @returns {object|null}
 * @throws {Error} With .statusCode 403 if ownership check fails
 */
const getOrderById = async (orderId, userId, isAdmin = false) => {
  const orderResult = await pool.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );

  if (orderResult.rows.length === 0) return null;

  const order = orderResult.rows[0];

  // Ownership check — skip for admins
  if (!isAdmin && order.user_id !== userId) {
    const err = new Error('Access denied. You do not own this order.');
    err.statusCode = 403;
    throw err;
  }

  const items    = await fetchOrderItems(pool, orderId);
  const payment  = await fetchOrderPayment(pool, orderId);
  const delivery = await fetchOrderDelivery(pool, orderId);

  return formatOrderResponse(order, items, payment, delivery);
};

// ─── GET ORDERS BY USER ─────────────────────────────────────────────────

/**
 * Returns all orders for a given user, newest first.
 * Each order includes its items, payment, and delivery.
 *
 * @param {string} userId - UUID
 * @returns {object[]}
 */
const getOrdersByUser = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  const orders = [];
  for (const row of result.rows) {
    const items    = await fetchOrderItems(pool, row.id);
    const payment  = await fetchOrderPayment(pool, row.id);
    const delivery = await fetchOrderDelivery(pool, row.id);
    orders.push(formatOrderResponse(row, items, payment, delivery));
  }
  return orders;
};

// ─── GET ALL ORDERS (ADMIN) ─────────────────────────────────────────────

/**
 * Returns ALL orders in the system, newest first — for admin use.
 * Unlike getOrdersByUser, this is not scoped to any single user_id,
 * since admins need to see every customer's (and every guest's) orders.
 *
 * @param {object} filters
 * @param {string} [filters.status] - Optional order status to filter by (UPPERCASE)
 * @returns {object[]}
 */
const getAllOrders = async ({ status } = {}) => {
  let query = `SELECT * FROM orders`;
  const params = [];

  if (status) {
    params.push(status);
    query += ` WHERE status = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);

  const orders = [];
  for (const row of result.rows) {
    const items    = await fetchOrderItems(pool, row.id);
    const payment  = await fetchOrderPayment(pool, row.id);
    const delivery = await fetchOrderDelivery(pool, row.id);
    orders.push(formatOrderResponse(row, items, payment, delivery));
  }
  return orders;
};

// ─── UPDATE ORDER STATUS ─────────────────────────────────────────────────

/**
 * Updates the status of an order. Admin-only.
 * Status must be one of VALID_ORDER_STATUSES (UPPERCASE).
 *
 * @param {string} orderId - UUID
 * @param {string} status  - One of VALID_ORDER_STATUSES
 * @returns {object} Updated order with items, payment, delivery
 * @throws {Error} With .statusCode 400 for invalid status, 404 if not found
 */
const updateOrderStatus = async (orderId, status) => {
  if (!VALID_ORDER_STATUSES.includes(status)) {
    const err = new Error(
      `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE orders
     SET status     = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, orderId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  const order    = result.rows[0];
  const items    = await fetchOrderItems(pool, orderId);
  const payment  = await fetchOrderPayment(pool, orderId);
  const delivery = await fetchOrderDelivery(pool, orderId);

  return formatOrderResponse(order, items, payment, delivery);
};

// ─── DELETE ORDER ─────────────────────────────────────────────────────────

/**
 * Permanently deletes a single order. order_items, payments, and deliveries
 * all cascade automatically via their ON DELETE CASCADE foreign keys — no
 * need to delete those tables manually here.
 *
 * @param {string} orderId - UUID
 * @returns {boolean} true if an order was found and deleted.
 */
const deleteOrder = async (orderId) => {
  const result = await pool.query(
    `DELETE FROM orders WHERE id = $1 RETURNING id`,
    [orderId]
  );
  return result.rows.length > 0;
};

// ─── DELETE ALL ORDERS ──────────────────────────────────────────────────────

/**
 * Permanently deletes EVERY order in the system (and, via cascade, every
 * order_items/payments/deliveries row tied to them). Used for one-time
 * cleanup of test data — the controller layer requires an explicit
 * confirmation flag before this is ever called, since there's no undo.
 *
 * @returns {number} Count of orders deleted.
 */
const deleteAllOrders = async () => {
  const result = await pool.query(`DELETE FROM orders RETURNING id`);
  return result.rows.length;
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────

module.exports = {
  checkout,
  getOrderById,
  getOrdersByUser,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  deleteAllOrders,
};
