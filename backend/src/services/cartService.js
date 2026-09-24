/**
 * cartService.js
 * All SQL queries related to carts and cart items.
 *
 * LIVE SCHEMA (muhanga_market, PostgreSQL, port 5433):
 *
 * carts:
 *   id           UUID (PRIMARY KEY, default gen_random_uuid())
 *   user_id      UUID | NULL
 *   session_token VARCHAR
 *   created_at, updated_at
 *
 * cart_items:
 *   id           INTEGER SERIAL (PRIMARY KEY)
 *   cart_id      UUID    NOT NULL  (FK → carts.id ON DELETE CASCADE)
 *   product_id   INTEGER NOT NULL  (FK → products.id ON DELETE RESTRICT)  ← REQUIRED in INSERT
 *   variant_id   INTEGER NOT NULL  (FK → product_variants.id ON DELETE RESTRICT)
 *   quantity     NUMERIC(12,3) NOT NULL  ← pg returns as JS string; always parseInt()
 *   unit_price   NUMERIC(12,2) NOT NULL  ← pg returns as JS string; always parseFloat()
 *   created_at   TIMESTAMP NOT NULL
 *   updated_at   TIMESTAMP nullable
 *   UNIQUE INDEX on (cart_id, variant_id) — used by ON CONFLICT clause
 *
 * product_variants:
 *   id           INTEGER SERIAL (PRIMARY KEY)   ← NOT UUID
 *   product_id   INTEGER (FK → products.id)
 *   name         VARCHAR
 *   unit         VARCHAR
 *   price        DECIMAL(12,2)
 *   stock_quantity INTEGER
 *   is_available BOOLEAN
 *
 * Design decisions:
 *   - Prices are ALWAYS read from the database; never accepted from the client.
 *   - variant_id is validated as a positive INTEGER at the controller layer.
 *   - Transactions are used when adding/updating items to prevent race conditions
 *     and ensure stock validation is atomic.
 *   - Numeric fields returned as JS numbers (parseFloat) — not PostgreSQL strings.
 */

const pool = require('../config/database');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Formats a cart row + array of item rows into the standard cart response shape.
 * Prices/subtotals are returned as numbers, not PostgreSQL numeric strings.
 *
 * @param {object}   cart  - Row from the carts table
 * @param {object[]} items - Rows from the cart_items + join query
 * @returns {object} Formatted cart response
 */
function formatCartResponse(cart, items) {
  const formattedItems = items.map((item) => ({
    id:           item.id,
    product_id:   item.product_id,
    product_name: item.product_name,
    variant_id:   item.variant_id,
    variant_name: item.variant_name,
    // quantity is NUMERIC in PostgreSQL — pg driver returns it as a JS string.
    // Parse to integer to ensure correct arithmetic in subtotals and totals.
    quantity:     parseInt(item.quantity, 10),
    unit_price:   parseFloat(item.unit_price),
    subtotal:     parseFloat(item.unit_price) * parseInt(item.quantity, 10),
  }));

  const totalItems = formattedItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal   = formattedItems.reduce((sum, i) => sum + i.subtotal, 0);

  return {
    id:            cart.id,
    user_id:       cart.user_id,
    session_token: cart.session_token,
    items:         formattedItems,
    total_items:   totalItems,
    subtotal:      subtotal,
  };
}

// ─── FETCH CART ITEMS ─────────────────────────────────────────────────────────

/**
 * Returns all items belonging to a cart, joined with product and variant info.
 *
 * @param {object} client - pg pool or client
 * @param {string} cartId - UUID (carts.id)
 */
async function fetchCartItems(client, cartId) {
  const result = await client.query(
    `SELECT
       ci.id           AS id,
       ci.variant_id   AS variant_id,
       ci.quantity     AS quantity,
       ci.unit_price   AS unit_price,
       p.id            AS product_id,
       p.name          AS product_name,
       pv.name         AS variant_name
     FROM cart_items ci
     JOIN product_variants pv ON pv.id = ci.variant_id
     JOIN products p           ON p.id  = pv.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cartId]
  );
  return result.rows;
}

// ─── CREATE OR GET GUEST CART ─────────────────────────────────────────────────

/**
 * Finds or creates a guest cart for the given session_token.
 * Returns { cart, created } where created=true means a new cart was inserted.
 *
 * @param {string} sessionToken - Unique guest session identifier
 * @returns {{ cart: object, created: boolean }}
 */
const findOrCreateGuestCart = async (sessionToken) => {
  // Check for an existing cart first
  const existing = await pool.query(
    `SELECT id, user_id, session_token, created_at, updated_at
     FROM carts
     WHERE session_token = $1
     LIMIT 1`,
    [sessionToken]
  );

  if (existing.rows.length > 0) {
    const cartRow = existing.rows[0];
    const items   = await fetchCartItems(pool, cartRow.id);
    return { cart: formatCartResponse(cartRow, items), created: false };
  }

  // No cart exists — create one with user_id = NULL
  const inserted = await pool.query(
    `INSERT INTO carts (user_id, session_token)
     VALUES (NULL, $1)
     RETURNING id, user_id, session_token, created_at, updated_at`,
    [sessionToken]
  );

  const cartRow = inserted.rows[0];
  return { cart: formatCartResponse(cartRow, []), created: true };
};

// ─── FIND OR CREATE CART (guest or logged-in) ─────────────────────────────────

/**
 * Resolves the correct cart for a request. If userId is present (the person
 * is logged in), their account's own cart takes priority; if they also have
 * a separate guest cart from this browser (same sessionToken), its items are
 * merged in via the same addItemToCart logic (so stock/price rules still
 * apply), then the now-empty guest cart is left behind. If the user has no
 * cart yet at all, their current guest cart (if any) is simply attached to
 * their account instead of creating a second one.
 *
 * @param {{ userId: string|null, sessionToken: string|null }} params
 * @returns {{ cart: object, created: boolean }}
 */
const findOrCreateCartForRequest = async ({ userId, sessionToken }) => {
  if (!userId) {
    // Not logged in — existing guest-only behavior, unchanged.
    return findOrCreateGuestCart(sessionToken);
  }

  // Does this user already have a cart tied to their account?
  const existingUserCart = await pool.query(
    `SELECT id, user_id, session_token, created_at, updated_at
     FROM carts
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (existingUserCart.rows.length > 0) {
    const userCartRow = existingUserCart.rows[0];

    // If this browser also has a separate guest cart with items, merge them in.
    if (sessionToken) {
      const guestCart = await pool.query(
        `SELECT id FROM carts WHERE session_token = $1 AND id != $2 LIMIT 1`,
        [sessionToken, userCartRow.id]
      );
      if (guestCart.rows.length > 0) {
        const guestItems = await fetchCartItems(pool, guestCart.rows[0].id);
        for (const item of guestItems) {
          // Reuses the same stock-checked add logic as a normal add-to-cart.
          await addItemToCart(userCartRow.id, item.variant_id, item.quantity);
        }
        await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [guestCart.rows[0].id]);
      }
    }

    const items = await fetchCartItems(pool, userCartRow.id);
    return { cart: formatCartResponse(userCartRow, items), created: false };
  }

  // No cart on the account yet — attach the current guest cart to it, if one exists.
  if (sessionToken) {
    const guestCart = await pool.query(
      `SELECT id, user_id, session_token, created_at, updated_at
       FROM carts
       WHERE session_token = $1
       LIMIT 1`,
      [sessionToken]
    );
    if (guestCart.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE carts SET user_id = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, user_id, session_token, created_at, updated_at`,
        [userId, guestCart.rows[0].id]
      );
      const items = await fetchCartItems(pool, updated.rows[0].id);
      return { cart: formatCartResponse(updated.rows[0], items), created: false };
    }
  }

  // Nothing existed at all — create a fresh cart tied straight to this account.
  const inserted = await pool.query(
    `INSERT INTO carts (user_id, session_token)
     VALUES ($1, $2)
     RETURNING id, user_id, session_token, created_at, updated_at`,
    [userId, sessionToken || null]
  );
  return { cart: formatCartResponse(inserted.rows[0], []), created: true };
};

// ─── GET CART BY ID ───────────────────────────────────────────────────────────

/**
 * Returns a fully-populated cart by its UUID, or null if not found.
 *
 * @param {string} cartId - UUID
 * @returns {object|null}
 */
const getCartById = async (cartId) => {
  const cartResult = await pool.query(
    `SELECT id, user_id, session_token, created_at, updated_at
     FROM carts
     WHERE id = $1`,
    [cartId]
  );

  if (cartResult.rows.length === 0) return null;

  const cartRow = cartResult.rows[0];
  const items   = await fetchCartItems(pool, cartRow.id);
  return formatCartResponse(cartRow, items);
};

// ─── ADD ITEM TO CART ─────────────────────────────────────────────────────────

/**
 * Adds a variant to the cart, or increments quantity if it already exists.
 * Uses a transaction to ensure atomicity (stock check + insert/update).
 *
 * Stock enforcement:
 *   - When stock_quantity > 0, validates that new total <= stock_quantity.
 *   - When stock_quantity = 0 AND is_available = TRUE, stock not yet populated;
 *     enforcement is skipped so cart functionality can be tested independently.
 *
 * @param {string} cartId    - UUID (carts.id)
 * @param {number} variantId - INTEGER (product_variants.id — NOT UUID)
 * @param {number} quantity  - Requested quantity (positive integer)
 * @returns {object} Updated full cart
 * @throws {Error} With .statusCode for controlled HTTP responses
 */
const addItemToCart = async (cartId, variantId, quantity) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify cart exists
    const cartResult = await client.query(
      `SELECT id, user_id, session_token FROM carts WHERE id = $1 FOR UPDATE`,
      [cartId]
    );
    if (cartResult.rows.length === 0) {
      const err = new Error('Cart not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify variant exists and is available — price AND product_id are ALWAYS from DB.
    //    product_id is required because cart_items.product_id is NOT NULL.
    const variantResult = await client.query(
      `SELECT id, product_id, price, stock_quantity, is_available
       FROM product_variants
       WHERE id = $1`,
      [variantId]
    );
    if (variantResult.rows.length === 0) {
      const err = new Error('Product variant not found');
      err.statusCode = 404;
      throw err;
    }

    const variant       = variantResult.rows[0];
    const productId     = parseInt(variant.product_id, 10); // FK → products.id (NOT NULL)
    const unitPrice     = parseFloat(variant.price);
    const stockQuantity = parseInt(variant.stock_quantity, 10);

    if (!variant.is_available) {
      const err = new Error('Product variant is not available');
      err.statusCode = 409;
      throw err;
    }

    // 3. Check if variant already exists in cart
    const existingItem = await client.query(
      `SELECT id, quantity FROM cart_items
       WHERE cart_id = $1 AND variant_id = $2`,
      [cartId, variantId]
    );

    // quantity column is NUMERIC(12,3) — pg driver returns it as a JS string (e.g. "1.000").
    // Must parseInt() before arithmetic; otherwise "1.000" + 2 = "1.0002" (string concat).
    const existingQty = existingItem.rows.length > 0
      ? parseInt(existingItem.rows[0].quantity, 10)
      : 0;
    const newQuantity = existingQty + quantity;

    // 4. Stock validation — only enforce when stock_quantity > 0
    if (stockQuantity > 0 && newQuantity > stockQuantity) {
      const err = new Error(
        `Insufficient stock. Available: ${stockQuantity}, requested: ${newQuantity}`
      );
      err.statusCode = 409;
      throw err;
    }

    // 5. Upsert cart item.
    //    cart_items.product_id is NOT NULL — must be supplied from product_variants.product_id.
    //    ON CONFLICT uses the unique_cart_variant index on (cart_id, variant_id).
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cart_id, variant_id)
       DO UPDATE SET
         quantity   = EXCLUDED.quantity,
         unit_price = EXCLUDED.unit_price,
         updated_at = NOW()`,
      [cartId, productId, variantId, newQuantity, unitPrice]
    );

    await client.query('COMMIT');

    // 6. Return updated cart (fetch items after commit)
    const cartRow = cartResult.rows[0];
    const items   = await fetchCartItems(client, cartId);

    client.release();
    return formatCartResponse(cartRow, items);
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
};

// ─── UPDATE CART ITEM ─────────────────────────────────────────────────────────

/**
 * Updates the quantity of an existing cart item.
 * Validates ownership and stock. Price is refreshed from DB on every update.
 *
 * @param {string} cartId   - UUID (carts.id)
 * @param {number} itemId   - INTEGER (cart_items.id — NOT UUID)
 * @param {number} quantity - New quantity (positive integer)
 * @returns {object} Updated full cart
 * @throws {Error} With .statusCode for controlled HTTP responses
 */
const updateCartItem = async (cartId, itemId, quantity) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify cart item exists
    const itemResult = await client.query(
      `SELECT id, cart_id, variant_id FROM cart_items WHERE id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      const err = new Error('Cart item not found');
      err.statusCode = 404;
      throw err;
    }

    const item = itemResult.rows[0];

    // 2. Verify item belongs to the specified cart
    // Note: item.cart_id is UUID (string), cartId is UUID (string) — direct comparison is correct.
    if (item.cart_id !== cartId) {
      const err = new Error('Cart item does not belong to the specified cart');
      err.statusCode = 404;
      throw err;
    }

    // 3. Get the current variant data (price + stock from DB — never from client)
    const variantResult = await client.query(
      `SELECT id, price, stock_quantity, is_available
       FROM product_variants
       WHERE id = $1`,
      [item.variant_id]
    );

    if (variantResult.rows.length === 0) {
      const err = new Error('Product variant no longer exists');
      err.statusCode = 404;
      throw err;
    }

    const variant       = variantResult.rows[0];
    const unitPrice     = parseFloat(variant.price);
    const stockQuantity = parseInt(variant.stock_quantity, 10);

    if (!variant.is_available) {
      const err = new Error('Product variant is no longer available');
      err.statusCode = 409;
      throw err;
    }

    // 4. Stock validation — only enforce when stock_quantity > 0
    if (stockQuantity > 0 && quantity > stockQuantity) {
      const err = new Error(
        `Insufficient stock. Available: ${stockQuantity}, requested: ${quantity}`
      );
      err.statusCode = 409;
      throw err;
    }

    // 5. Update with new quantity and refreshed price from DB
    await client.query(
      `UPDATE cart_items
       SET quantity   = $1,
           unit_price = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [quantity, unitPrice, itemId]
    );

    await client.query('COMMIT');

    // 6. Return updated cart
    const cartResult = await client.query(
      `SELECT id, user_id, session_token FROM carts WHERE id = $1`,
      [cartId]
    );
    const items = await fetchCartItems(client, cartId);

    client.release();
    return formatCartResponse(cartResult.rows[0], items);
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
};

// ─── REMOVE CART ITEM ─────────────────────────────────────────────────────────

/**
 * Removes a single item from the cart.
 * Validates ownership before deletion.
 *
 * @param {string} cartId - UUID (carts.id)
 * @param {number} itemId - INTEGER (cart_items.id — NOT UUID)
 * @returns {boolean} true on success
 * @throws {Error} With .statusCode 404 if not found or wrong cart
 */
const removeCartItem = async (cartId, itemId) => {
  const itemResult = await pool.query(
    `SELECT id, cart_id FROM cart_items WHERE id = $1`,
    [itemId]
  );

  if (itemResult.rows.length === 0) {
    const err = new Error('Cart item not found');
    err.statusCode = 404;
    throw err;
  }

  // Note: item.cart_id is UUID (string), cartId is UUID (string) — direct comparison is correct.
  if (itemResult.rows[0].cart_id !== cartId) {
    const err = new Error('Cart item does not belong to the specified cart');
    err.statusCode = 404;
    throw err;
  }

  await pool.query(`DELETE FROM cart_items WHERE id = $1`, [itemId]);
  return true;
};

// ─── CLEAR CART ───────────────────────────────────────────────────────────────

/**
 * Removes ALL items from a cart without deleting the cart record itself.
 *
 * @param {string} cartId - UUID
 * @returns {boolean} true if cart existed, false if not found
 */
const clearCart = async (cartId) => {
  const cartResult = await pool.query(
    `SELECT id FROM carts WHERE id = $1`,
    [cartId]
  );

  if (cartResult.rows.length === 0) return false;

  await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
  return true;
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  findOrCreateGuestCart,
  findOrCreateCartForRequest,
  getCartById,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
