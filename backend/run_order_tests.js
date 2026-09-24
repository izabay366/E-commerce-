/**
 * run_order_tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Muhanga Marketplace — Order API Test Suite
 *
 * Tests (in order):
 *   S — DB Schema Verification
 *   H — Happy Path: Guest DELIVERY + CASH_ON_DELIVERY
 *   A — Happy Path: Authenticated PICKUP + MOBILE_MONEY
 *   P — Price Integrity
 *   V — Validation Errors
 *   R — Order Retrieval
 *   U — Order Status Update (Admin)
 *   X — Cart + Auth Regression
 *
 * Run:
 *   node run_order_tests.js
 *
 * IMPORTANT: The server must be running on port 5000 first:
 *   node src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const http = require('http');
const { Pool } = require('pg');

// ─── DB CONFIG ────────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

const API_BASE = `http://localhost:${process.env.PORT || 5000}`;
const PORT     = parseInt(process.env.PORT || '5000', 10);

// ─── TEST STATE ───────────────────────────────────────────────────────────────

const state = {
  testVariantId:   null,  // real product_variant.id (INTEGER) from DB
  guestCartId:     null,  // guest cart UUID for DELIVERY test
  authCartId:      null,  // authenticated cart UUID for PICKUP test
  authToken:       null,  // JWT for authenticated user
  authUserId:      null,  // UUID of authenticated user
  guestOrderId:    null,  // UUID of created guest order
  authOrderId:     null,  // UUID of created auth order
  testEmail:       `order.test.${Date.now()}@muhanga.test`,
  testPhone:       `+25075${String(Date.now()).slice(-7)}`,
};

// ─── COLOURS ──────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
};
const ok   = (msg) => console.log(`${C.green}  ✓ PASS${C.reset}  ${msg}`);
const fail = (msg) => console.log(`${C.red}  ✗ FAIL${C.reset}  ${msg}`);
const info = (msg) => console.log(`${C.cyan}  ℹ INFO${C.reset}  ${msg}`);
const head = (msg) => console.log(`\n${C.bold}${C.yellow}══ ${msg} ══${C.reset}\n`);

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) { ok(message);   passCount++; }
  else           { fail(message); failCount++; }
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port:     PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (bodyStr)  options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    if (token)    options.headers['Authorization']  = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end',  () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

const GET    = (path, token)       => apiRequest('GET',   path, null, token);
const POST   = (path, body, token) => apiRequest('POST',  path, body, token);
const PATCH  = (path, body, token) => apiRequest('PATCH', path, body, token);

// UUID regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (s) => typeof s === 'string' && UUID_RE.test(s);

// ─── SECTION S — DB SCHEMA VERIFICATION ───────────────────────────────────────

async function sectionSchema() {
  head('S — DB SCHEMA VERIFICATION');

  const client = await pool.connect();
  try {
    // S1: orders.id is UUID
    const r1 = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders' AND column_name='id'`);
    assert(r1.rows[0]?.data_type === 'uuid', 'S1: orders.id is uuid');

    // S2: orders.status DEFAULT = 'PENDING'
    const r2 = await client.query(`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders' AND column_name='status'`);
    assert(
      r2.rows[0]?.column_default?.includes('PENDING'),
      "S2: orders.status DEFAULT = 'PENDING'"
    );

    // S3: order_items.id is integer
    const r3 = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='order_items' AND column_name='id'`);
    assert(r3.rows[0]?.data_type === 'integer', 'S3: order_items.id is integer');

    // S4: order_items.variant_id is integer (NOT uuid)
    const r4 = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='order_items' AND column_name='variant_id'`);
    assert(r4.rows[0]?.data_type === 'integer', 'S4: order_items.variant_id is integer (not uuid)');

    // S5: payments.id is uuid
    const r5 = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='payments' AND column_name='id'`);
    assert(r5.rows[0]?.data_type === 'uuid', 'S5: payments.id is uuid');

    // S6: deliveries.id is uuid
    const r6 = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='deliveries' AND column_name='id'`);
    assert(r6.rows[0]?.data_type === 'uuid', 'S6: deliveries.id is uuid');

    // S7: Find a real available variant to use in tests
    const r7 = await client.query(`
      SELECT pv.id FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.is_available = TRUE AND p.is_available = TRUE
      ORDER BY pv.id ASC LIMIT 1`);
    if (r7.rows.length > 0) {
      state.testVariantId = parseInt(r7.rows[0].id, 10);
      info(`Using variant_id = ${state.testVariantId} for cart/checkout tests`);
      assert(true, 'S7: Found available variant in product_variants');
    } else {
      assert(false, 'S7: Found available variant in product_variants');
    }

    // S8: order_items.subtotal column exists and is NOT NULL
    const r8 = await client.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='order_items' AND column_name='subtotal'`);
    assert(r8.rows[0]?.is_nullable === 'NO', 'S8: order_items.subtotal is NOT NULL (stored column)');

  } finally {
    client.release();
  }
}

// ─── SECTION H — GUEST DELIVERY CHECKOUT ─────────────────────────────────────

async function sectionGuestDelivery() {
  head('H — HAPPY PATH: Guest DELIVERY + CASH_ON_DELIVERY');

  if (!state.testVariantId) {
    fail('H: Skipped — no test variant available');
    return;
  }

  // H-setup: Create a guest cart, then add an item via the items endpoint
  info('Setting up guest cart...');
  const sessionToken = `order-test-guest-${Date.now()}`;

  // Step 1: Create/get cart by session_token (returns cart object directly)
  const cartRes = await POST('/api/cart', { session_token: sessionToken });
  if (cartRes.status !== 200 && cartRes.status !== 201) {
    fail(`H-setup: Create guest cart — got HTTP ${cartRes.status}`);
    info('Remaining H tests skipped');
    return;
  }
  // Cart API returns the cart object directly (not nested under .cart)
  state.guestCartId = cartRes.body.id;
  info(`Guest cart created: ${state.guestCartId}`);

  // Step 2: Add item to cart via POST /api/cart/:cartId/items
  const addRes = await POST(`/api/cart/${state.guestCartId}/items`, {
    variant_id: state.testVariantId,
    quantity:   2,
  });
  if (addRes.status !== 200 && addRes.status !== 201) {
    fail(`H-setup: Add item to guest cart — got HTTP ${addRes.status}: ${JSON.stringify(addRes.body)}`);
    info('Remaining H tests skipped');
    return;
  }

  // H1: POST /api/orders (guest, DELIVERY, CASH_ON_DELIVERY) → 201
  const checkoutBody = {
    cart_id:          state.guestCartId,
    customer_name:    'Test Customer',
    customer_phone:   '+250788001001',
    fulfillment_type: 'DELIVERY',
    payment_method:   'CASH_ON_DELIVERY',
    address:          'Nyamirambo, Kigali, near the blue gate',
    instructions:     'Call on arrival',
  };
  const r1 = await POST('/api/orders', checkoutBody);
  assert(r1.status === 201, `H1: Guest DELIVERY checkout → HTTP 201 (got ${r1.status})`);

  if (r1.status !== 201) {
    info(`  Error: ${JSON.stringify(r1.body)}`);
    info('Remaining H tests skipped');
    return;
  }

  const order = r1.body.order;
  state.guestOrderId = order?.id;

  // H2: response.order.id is UUID
  assert(isUUID(order?.id), `H2: order.id is UUID (got ${order?.id})`);

  // H3: order.status = 'PENDING'
  assert(order?.status === 'PENDING', `H3: order.status = 'PENDING' (got ${order?.status})`);

  // H4: fulfillment_type = 'DELIVERY'
  assert(order?.fulfillment_type === 'DELIVERY', `H4: order.fulfillment_type = 'DELIVERY'`);

  // H5: user_id = null (guest order)
  assert(order?.user_id === null, `H5: order.user_id = null for guest (got ${order?.user_id})`);

  // H6: customer_name and customer_phone are stored
  assert(order?.customer_name === 'Test Customer', `H6: order.customer_name stored correctly`);
  assert(order?.customer_phone === '+250788001001', `H6b: order.customer_phone stored correctly`);

  // H7: items array is non-empty
  assert(Array.isArray(order?.items) && order.items.length > 0, 'H7: order.items array is non-empty');

  // H8: order_items.variant_id is INTEGER (not UUID)
  const firstItem = order?.items?.[0];
  assert(
    typeof firstItem?.variant_id === 'number' && Number.isInteger(firstItem.variant_id),
    `H8: order_items.variant_id is INTEGER (got ${typeof firstItem?.variant_id}: ${firstItem?.variant_id})`
  );

  // H9: product_name is not null (snapshot)
  assert(
    typeof firstItem?.product_name === 'string' && firstItem.product_name.length > 0,
    `H9: order_items.product_name is a non-empty string (snapshot)`
  );

  // H10: subtotal = unit_price × quantity
  if (firstItem) {
    const expectedSubtotal = parseFloat((firstItem.unit_price * firstItem.quantity).toFixed(2));
    assert(
      Math.abs(firstItem.subtotal - expectedSubtotal) < 0.01,
      `H10: order_items.subtotal = unit_price × quantity (${firstItem.unit_price} × ${firstItem.quantity} = ${expectedSubtotal}, got ${firstItem.subtotal})`
    );
  }

  // H11: total_amount = sum of all subtotals
  if (order?.items) {
    const sumSubtotals = parseFloat(order.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    assert(
      Math.abs(order.total_amount - sumSubtotals) < 0.01,
      `H11: total_amount = sum of subtotals (${sumSubtotals}, got ${order.total_amount})`
    );
  }

  // H12: payment object exists with correct method
  assert(isUUID(order?.payment?.id), 'H12: payment.id is UUID');
  assert(order?.payment?.method === 'CASH_ON_DELIVERY', `H12b: payment.method = 'CASH_ON_DELIVERY'`);
  assert(order?.payment?.status === 'PENDING', `H12c: payment.status = 'PENDING'`);
  assert(
    Math.abs(order?.payment?.amount - order?.total_amount) < 0.01,
    `H12d: payment.amount = total_amount`
  );

  // H13: delivery object exists with type = 'DELIVERY'
  assert(isUUID(order?.delivery?.id), 'H13: delivery.id is UUID');
  assert(order?.delivery?.type === 'DELIVERY', `H13b: delivery.type = 'DELIVERY'`);
  assert(order?.delivery?.status === 'PENDING', `H13c: delivery.status = 'PENDING'`);
  assert(order?.delivery?.address?.includes('Nyamirambo'), 'H13d: delivery.address stored');

  // H14: Cart is now empty
  const cartCheck = await GET(`/api/cart/${state.guestCartId}`);
  // Cart GET returns the cart object directly — items are at body.items
  const items = cartCheck.body.items || [];
  assert(items.length === 0, `H14: Cart is empty after checkout (got ${items.length} items)`);

}

// ─── SECTION A — AUTHENTICATED PICKUP CHECKOUT ───────────────────────────────

async function sectionAuthPickup() {
  head('A — HAPPY PATH: Authenticated PICKUP + MOBILE_MONEY');

  if (!state.testVariantId) {
    fail('A: Skipped — no test variant available');
    return;
  }

  // A-setup: Register a new test user
  const regRes = await POST('/api/auth/register', {
    first_name: 'OrderTest',
    last_name:  'User',
    phone:      state.testPhone,
    email:      state.testEmail,
    password:   'TestPassword123!',
  });

  if (regRes.status !== 201) {
    fail(`A-setup: Register test user — got HTTP ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    info('Remaining A tests skipped');
    return;
  }

  // Login to get JWT
  const loginRes = await POST('/api/auth/login', {
    email:    state.testEmail,
    password: 'TestPassword123!',
  });

  if (loginRes.status !== 200) {
    fail(`A-setup: Login test user — got HTTP ${loginRes.status}`);
    info('Remaining A tests skipped');
    return;
  }

  state.authToken  = loginRes.body.token;
  state.authUserId = loginRes.body.user?.id;
  info(`Auth user: ${state.authUserId}`);

  // Create a cart, then add an item via the items endpoint
  const authSession = `order-test-auth-${Date.now()}`;

  // Step 1: Create/get cart (returns cart object directly)
  const cartRes = await POST('/api/cart', { session_token: authSession });
  if (cartRes.status !== 200 && cartRes.status !== 201) {
    fail(`A-setup: Create auth cart — got HTTP ${cartRes.status}`);
    return;
  }
  state.authCartId = cartRes.body.id;
  info(`Auth cart: ${state.authCartId}`);

  // Step 2: Add item via POST /api/cart/:cartId/items
  const addRes = await POST(`/api/cart/${state.authCartId}/items`, {
    variant_id: state.testVariantId,
    quantity:   1,
  });
  if (addRes.status !== 200 && addRes.status !== 201) {
    fail(`A-setup: Add item to auth cart — got HTTP ${addRes.status}: ${JSON.stringify(addRes.body)}`);
    return;
  }

  // A1: POST /api/orders (authenticated, PICKUP, MOBILE_MONEY) → 201
  const checkoutBody = {
    cart_id:          state.authCartId,
    customer_name:    'OrderTest User',
    customer_phone:   state.testPhone,
    fulfillment_type: 'PICKUP',
    payment_method:   'MOBILE_MONEY',
  };
  const r1 = await POST('/api/orders', checkoutBody, state.authToken);
  assert(r1.status === 201, `A1: Auth PICKUP checkout → HTTP 201 (got ${r1.status})`);

  if (r1.status !== 201) {
    info(`  Error: ${JSON.stringify(r1.body)}`);
    info('Remaining A tests skipped');
    return;
  }

  const order = r1.body.order;
  state.authOrderId = order?.id;

  // A2: order.user_id matches the authenticated user UUID
  assert(
    order?.user_id === state.authUserId,
    `A2: order.user_id matches auth user (${state.authUserId})`
  );

  // A3: delivery.type = 'PICKUP'
  assert(order?.delivery?.type === 'PICKUP', `A3: delivery.type = 'PICKUP' for PICKUP order`);

  // A4: payment.method = 'MOBILE_MONEY'
  assert(order?.payment?.method === 'MOBILE_MONEY', `A4: payment.method = 'MOBILE_MONEY'`);

  // A5: Cart is empty
  const cartCheck = await GET(`/api/cart/${state.authCartId}`);
  // Cart GET returns the cart object directly — items are at body.items
  const items = cartCheck.body.items || [];
  assert(items.length === 0, `A5: Cart is empty after PICKUP checkout`);


  // A6: No address stored for PICKUP
  assert(
    order?.delivery?.address === null || order?.delivery?.address === undefined,
    `A6: delivery.address is null for PICKUP order (got ${order?.delivery?.address})`
  );
}

// ─── SECTION P — PRICE INTEGRITY ─────────────────────────────────────────────

async function sectionPriceIntegrity() {
  head('P — PRICE INTEGRITY');

  if (!state.testVariantId) {
    fail('P: Skipped — no test variant');
    return;
  }

  // Fetch real DB price for the test variant
  const client = await pool.connect();
  let dbPrice;
  try {
    const r = await client.query(
      'SELECT price FROM product_variants WHERE id = $1',
      [state.testVariantId]
    );
    dbPrice = r.rows[0] ? parseFloat(r.rows[0].price) : null;
  } finally {
    client.release();
  }

  if (dbPrice === null) {
    fail('P: Could not read DB price for test variant');
    return;
  }
  info(`DB price for variant ${state.testVariantId}: ${dbPrice}`);

  // Create a new cart with 3 units and attempt checkout with client-injected price
  const sessionToken = `order-test-price-${Date.now()}`;

  // Step 1: Create cart
  const cartRes = await POST('/api/cart', { session_token: sessionToken });
  if (cartRes.status !== 200 && cartRes.status !== 201) {
    fail(`P-setup: Create price-test cart — got HTTP ${cartRes.status}`);
    return;
  }
  const priceCartId = cartRes.body.id;

  // Step 2: Add 3 items
  const addRes = await POST(`/api/cart/${priceCartId}/items`, {
    variant_id: state.testVariantId,
    quantity:   3,
  });
  if (addRes.status !== 200 && addRes.status !== 201) {
    fail(`P-setup: Add items to price-test cart — got HTTP ${addRes.status}`);
    return;
  }

  const checkoutBody = {
    cart_id:          priceCartId,
    customer_name:    'Price Test',
    customer_phone:   '+250788002002',
    fulfillment_type: 'PICKUP',
    payment_method:   'CASH_ON_DELIVERY',
    unit_price:       1,     // ← injected client price (should be ignored)
    price:            1,     // ← alternate injection attempt (should be ignored)
  };

  const r = await POST('/api/orders', checkoutBody);
  if (r.status !== 201) {
    fail(`P-setup: Price test checkout failed — HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    return;
  }

  const priceOrder = r.body.order;
  const item = priceOrder?.items?.[0];

  // P1: unit_price in order = DB price (not 1)
  assert(
    item && Math.abs(item.unit_price - dbPrice) < 0.01,
    `P1: unit_price from DB = ${dbPrice} (not client-injected 1, got ${item?.unit_price})`
  );

  // P2: subtotal = DB price × 3
  const expectedSubtotal = parseFloat((dbPrice * 3).toFixed(2));
  assert(
    item && Math.abs(item.subtotal - expectedSubtotal) < 0.01,
    `P2: subtotal = DB_price × 3 = ${expectedSubtotal} (got ${item?.subtotal})`
  );

  // P3: total_amount = same as subtotal (only 1 item)
  assert(
    Math.abs(priceOrder.total_amount - expectedSubtotal) < 0.01,
    `P3: total_amount = ${expectedSubtotal} (got ${priceOrder.total_amount})`
  );
}

// ─── SECTION V — VALIDATION ERRORS ───────────────────────────────────────────

async function sectionValidation() {
  head('V — VALIDATION ERRORS');

  if (!state.testVariantId) {
    fail('V: Skipped — no test variant');
    return;
  }

  // Create a fresh cart with an item for validation tests
  const sessionToken = `order-test-val-${Date.now()}`;
  const cartRes = await POST('/api/cart', { session_token: sessionToken });
  const validCartId = cartRes.body.id || 'unknown';
  // Add an item so the cart is non-empty for the real checkout attempt
  if (validCartId !== 'unknown') {
    await POST(`/api/cart/${validCartId}/items`, {
      variant_id: state.testVariantId,
      quantity:   1,
    });
  }
  const validBase = {
    cart_id:          validCartId,
    customer_name:    'Validation Test',
    customer_phone:   '+250788003003',
    fulfillment_type: 'DELIVERY',
    payment_method:   'CASH_ON_DELIVERY',
    address:          'Test Address',
  };

  // V1: Missing cart_id
  const v1 = await POST('/api/orders', { ...validBase, cart_id: undefined });
  assert(v1.status === 400, `V1: Missing cart_id → HTTP 400 (got ${v1.status})`);

  // V2: cart_id not a UUID
  const v2 = await POST('/api/orders', { ...validBase, cart_id: '12345' });
  assert(v2.status === 400, `V2: cart_id not UUID → HTTP 400 (got ${v2.status})`);

  // V3: Cart not found (valid UUID, not in DB)
  const v3 = await POST('/api/orders', {
    ...validBase,
    cart_id: '00000000-0000-0000-0000-000000000000',
  });
  assert(v3.status === 404, `V3: Cart not found → HTTP 404 (got ${v3.status})`);

  // V4: Missing customer_name
  const v4 = await POST('/api/orders', { ...validBase, customer_name: '' });
  assert(v4.status === 400, `V4: Missing customer_name → HTTP 400 (got ${v4.status})`);

  // V5: Missing customer_phone
  const v5 = await POST('/api/orders', { ...validBase, customer_phone: '' });
  assert(v5.status === 400, `V5: Missing customer_phone → HTTP 400 (got ${v5.status})`);

  // V6: Invalid fulfillment_type value
  const v6 = await POST('/api/orders', { ...validBase, fulfillment_type: 'express' });
  assert(v6.status === 400, `V6: Invalid fulfillment_type 'express' → HTTP 400 (got ${v6.status})`);

  // V7: Lowercase fulfillment_type 'delivery' (DB requires UPPERCASE)
  const v7 = await POST('/api/orders', { ...validBase, fulfillment_type: 'delivery' });
  assert(v7.status === 400, `V7: Lowercase fulfillment_type 'delivery' → HTTP 400 (got ${v7.status})`);

  // V8: DELIVERY without address
  const v8 = await POST('/api/orders', { ...validBase, fulfillment_type: 'DELIVERY', address: '' });
  assert(v8.status === 400, `V8: DELIVERY without address → HTTP 400 (got ${v8.status})`);

  // V9: Invalid payment_method
  const v9 = await POST('/api/orders', { ...validBase, payment_method: 'card' });
  assert(v9.status === 400, `V9: Invalid payment_method 'card' → HTTP 400 (got ${v9.status})`);

  // V10: Lowercase payment_method
  const v10 = await POST('/api/orders', { ...validBase, payment_method: 'cash_on_delivery' });
  assert(v10.status === 400, `V10: Lowercase payment_method 'cash_on_delivery' → HTTP 400 (got ${v10.status})`);

  // V11: Missing payment_method
  const v11 = await POST('/api/orders', { ...validBase, payment_method: '' });
  assert(v11.status === 400, `V11: Missing payment_method → HTTP 400 (got ${v11.status})`);

  // V12: Empty cart — create a cart but add nothing, then checkout
  //      This is hard to test without a dedicated empty-cart endpoint, so we
  //      use a freshly-created cart UUID from a session that has never had items
  //      (by using a fresh session token and NOT adding items)
  const emptySession = `order-test-empty-${Date.now()}`;
  // Create an empty cart by just GETting it (or via a session that exists but is empty)
  // Actually, we need to create a cart first. Let's create one and clear it.
  // Create an empty cart (no items added)
  const emptyCartRes = await POST('/api/cart', { session_token: emptySession });
  const emptyCartId = emptyCartRes.body.id;
  const v12 = await POST('/api/orders', {
    ...validBase,
    cart_id: emptyCartId || validCartId,
  });
  // Either 400 (empty cart) or 404 (cart gone) — both are acceptable
  assert(
    v12.status === 400 || v12.status === 404,
    `V12: Empty cart checkout → HTTP 400 or 404 (got ${v12.status})`
  );
}

// ─── SECTION R — ORDER RETRIEVAL ─────────────────────────────────────────────

async function sectionRetrieval() {
  head('R — ORDER RETRIEVAL');

  if (!state.authToken || !state.authOrderId) {
    fail('R: Skipped — no authenticated order available');
    return;
  }

  // R1: GET /api/orders (JWT) → 200 + array
  const r1 = await GET('/api/orders', state.authToken);
  assert(r1.status === 200, `R1: GET /api/orders with JWT → HTTP 200 (got ${r1.status})`);
  assert(r1.body.success === true, 'R1b: response.success = true');
  assert(Array.isArray(r1.body.data), 'R1c: response.data is an array');

  // R2: GET /api/orders — no token → 401
  const r2 = await GET('/api/orders');
  assert(r2.status === 401, `R2: GET /api/orders without token → HTTP 401 (got ${r2.status})`);

  // R3: GET /api/orders/:orderId — own order → 200
  const r3 = await GET(`/api/orders/${state.authOrderId}`, state.authToken);
  assert(r3.status === 200, `R3: GET own order → HTTP 200 (got ${r3.status})`);
  assert(r3.body.order?.id === state.authOrderId, 'R3b: response.order.id matches');

  // R4: Response has items, payment, delivery nested
  const ord = r3.body.order;
  assert(Array.isArray(ord?.items),       'R4a: order.items is an array');
  assert(ord?.payment !== undefined,      'R4b: order.payment exists');
  assert(ord?.delivery !== undefined,     'R4c: order.delivery exists');

  // R5: order_items.variant_id in response is INTEGER
  if (ord?.items?.length > 0) {
    assert(
      typeof ord.items[0].variant_id === 'number',
      `R5: order_items.variant_id is number (INTEGER) in response`
    );
  }

  // R6: GET /api/orders/:not-uuid → 400
  const r6 = await GET('/api/orders/not-a-uuid', state.authToken);
  assert(r6.status === 400, `R6: GET /api/orders/:not-uuid → HTTP 400 (got ${r6.status})`);

  // R7: GET /api/orders/:valid-uuid-not-found → 404
  const r7 = await GET('/api/orders/00000000-0000-0000-0000-000000000000', state.authToken);
  assert(r7.status === 404, `R7: GET non-existent order UUID → HTTP 404 (got ${r7.status})`);

  // R8: Guest order (user_id = null) — cannot be retrieved by auth user
  //     (it belongs to no user — getOrderById returns 403 because order.user_id !== req.user.id)
  if (state.guestOrderId) {
    const r8 = await GET(`/api/orders/${state.guestOrderId}`, state.authToken);
    assert(
      r8.status === 403 || r8.status === 404,
      `R8: Auth user cannot access guest order → HTTP 403 or 404 (got ${r8.status})`
    );
  }
}

// ─── SECTION U — ORDER STATUS UPDATE ─────────────────────────────────────────

async function sectionStatusUpdate() {
  head('U — ORDER STATUS UPDATE (Admin)');

  if (!state.authToken || !state.authOrderId) {
    fail('U: Skipped — no order or auth token available');
    return;
  }

  // U1: PATCH status with CUSTOMER role → 403
  const u1 = await PATCH(
    `/api/orders/${state.authOrderId}/status`,
    { status: 'CONFIRMED' },
    state.authToken
  );
  assert(u1.status === 403, `U1: CUSTOMER role → HTTP 403 (got ${u1.status})`);

  // U2: Invalid status value → 400
  const u2 = await PATCH(
    `/api/orders/${state.authOrderId}/status`,
    { status: 'shipped' },
    state.authToken
  );
  assert(u2.status === 400 || u2.status === 403, `U2: Invalid status 'shipped' → HTTP 400 or 403 (got ${u2.status})`);

  // U3: Lowercase status → 400
  const u3 = await PATCH(
    `/api/orders/${state.authOrderId}/status`,
    { status: 'confirmed' },
    state.authToken
  );
  assert(u3.status === 400 || u3.status === 403, `U3: Lowercase 'confirmed' → HTTP 400 or 403 (got ${u3.status})`);

  // NOTE: Admin role test requires an ADMIN user in the DB.
  // This is flagged as informational — ADMIN account must be created separately.
  info('U4: Admin PATCH test skipped — requires ADMIN role account in DB');
  info('    Create an ADMIN user, get JWT, and test PATCH manually.');
}

// ─── SECTION X — REGRESSION ──────────────────────────────────────────────────

async function sectionRegression() {
  head('X — REGRESSION (Cart + Auth + Products)');

  // X1: GET /api/products → 200
  const x1 = await GET('/api/products');
  assert(x1.status === 200, `X1: GET /api/products → HTTP 200 (got ${x1.status})`);
  assert(x1.body.success === true, 'X1b: products response.success = true');
  assert(Array.isArray(x1.body.data) && x1.body.data.length > 0, 'X1c: products data.length > 0');

  // X2: GET /api/categories → 200
  const x2 = await GET('/api/categories');
  assert(x2.status === 200, `X2: GET /api/categories → HTTP 200 (got ${x2.status})`);
  assert(x2.body.success === true, 'X2b: categories response.success = true');
  assert(Array.isArray(x2.body.data) && x2.body.data.length > 0, 'X2c: categories data.length > 0');

  // X3: Auth register + login still works
  const regEmail = `regression.${Date.now()}@muhanga.test`;
  const regPhone = `+25079${String(Date.now()).slice(-7)}`;
  const x3 = await POST('/api/auth/register', {
    first_name: 'Regress',
    last_name:  'Test',
    phone:      regPhone,
    email:      regEmail,
    password:   'TestPassword123!',
  });
  assert(x3.status === 201, `X3: POST /api/auth/register → HTTP 201 (got ${x3.status})`);

  const x3b = await POST('/api/auth/login', { email: regEmail, password: 'TestPassword123!' });
  assert(x3b.status === 200, `X3b: POST /api/auth/login → HTTP 200 (got ${x3b.status})`);

  // X4: Cart add + get still works
  const x4Session = `regression-cart-${Date.now()}`;
  const x4 = await POST('/api/cart', {
    session_token: x4Session,
    variant_id:    state.testVariantId || 1,
    quantity:      1,
  });
  assert(
    x4.status === 200 || x4.status === 201,
    `X4: POST /api/cart → HTTP 200/201 (got ${x4.status})`
  );

  // X5: Health check
  const x5 = await GET('/');
  assert(x5.status === 200, `X5: GET / health check → HTTP 200 (got ${x5.status})`);
}

// ─── SERVER CHECK ──────────────────────────────────────────────────────────────

async function checkServer() {
  try {
    const r = await GET('/');
    if (r.status === 200) {
      info('Server is running ✓');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── CLEANUP ──────────────────────────────────────────────────────────────────

async function cleanup() {
  // Remove test users created during this run
  if (state.testEmail) {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [state.testEmail]);
    } catch (_) { /* ignore */ }
  }
  // Clean up test orders (cascade deletes order_items, payments, deliveries)
  if (state.guestOrderId) {
    try { await pool.query('DELETE FROM orders WHERE id = $1', [state.guestOrderId]); } catch (_) {}
  }
  if (state.authOrderId) {
    try { await pool.query('DELETE FROM orders WHERE id = $1', [state.authOrderId]); } catch (_) {}
  }
  // Clean up test carts
  for (const cartId of [state.guestCartId, state.authCartId]) {
    if (cartId) {
      try {
        await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
        await pool.query('DELETE FROM carts WHERE id = $1', [cartId]);
      } catch (_) {}
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(65));
  console.log('  MUHANGA MARKETPLACE — ORDER API TESTS');
  console.log(`  Server: ${API_BASE}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═'.repeat(65));

  // Server check
  const serverUp = await checkServer();
  if (!serverUp) {
    console.log(`\n  ${C.red}✗ SERVER NOT REACHABLE at ${API_BASE}${C.reset}`);
    console.log('    Start the server first: node src/server.js\n');
    process.exit(1);
  }

  try {
    await sectionSchema();
    await sectionGuestDelivery();
    await sectionAuthPickup();
    await sectionPriceIntegrity();
    await sectionValidation();
    await sectionRetrieval();
    await sectionStatusUpdate();
    await sectionRegression();
  } finally {
    await cleanup();
    await pool.end();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(65));
  if (failCount === 0) {
    console.log(`${C.green}${C.bold}  ✓ ALL ${passCount} TESTS PASSED${C.reset}  (${elapsed}s)`);
  } else {
    console.log(`${C.green}  ✓ ${passCount} passed${C.reset}`);
    console.log(`${C.red}  ✗ ${failCount} failed${C.reset}  (${elapsed}s)`);
  }
  console.log('═'.repeat(65) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  pool.end().catch(() => {});
  process.exit(1);
});
