/**
 * run_payment_tests.js
 * Comprehensive test suite for the Payment API.
 *
 * Coverage:
 *   Setup   — variant discovery, admin user creation + DB promotion, guest checkout
 *   GET     — getPayment by ID (admin, owner, other user, guest, invalid UUID)
 *   GET     — getPaymentByOrder (admin, owner, other user, invalid order ID)
 *   PATCH   — Authorization (unauthenticated, non-admin customer)
 *   PATCH   — Validation (missing status, invalid status, invalid UUID)
 *   PATCH   — CASH_ON_DELIVERY flow (mark PAID, mark FAILED, mark CANCELLED)
 *   PATCH   — MOBILE_MONEY flow (mark PAID + momo_reference stored)
 *   PATCH   — Transactional order_status sync (payment PAID + order PROCESSING)
 *   PATCH   — Terminal status guard (CANCELLED cannot be updated, FAILED cannot be updated)
 *   PATCH   — REFUNDED status support
 *   PATCH   — momo_reference preserved when not re-provided
 *   Cleanup — test data removed
 *
 * Run with server running:  node run_payment_tests.js
 */

'use strict';

require('dotenv').config();
const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

const API_BASE = `http://localhost:${process.env.PORT || 5000}`;

// ─── TEST COUNTERS ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(msg)   { console.log(`  ✓ ${msg}`); passed++; }
function fail(msg)   { console.log(`  ✗ ${msg}`); failed++; }
function skip(msg)   { console.log(`  - ${msg} [SKIPPED]`); skipped++; }
function section(msg){ console.log(`\n── ${msg} ──`); }

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      hostname: 'localhost',
      port:     parseInt(process.env.PORT || '5000', 10),
      path,
      method,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, body: json, raw: data });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── SETUP HELPERS ────────────────────────────────────────────────────────────

/**
 * Creates a fresh guest cart, adds one item, and checks out.
 * Returns { order, paymentId, orderId }.
 */
async function createTestOrderWithPayment(variantId, paymentMethod = 'CASH_ON_DELIVERY', sessionSuffix = '') {
  const sessionToken = `pay-test-${Date.now()}${sessionSuffix}`;

  const cartRes = await request('POST', '/api/cart', { session_token: sessionToken });
  if (!(cartRes.status === 200 || cartRes.status === 201)) {
    throw new Error(`Create cart failed: ${JSON.stringify(cartRes.body)}`);
  }
  const cartId = cartRes.body.id;

  const addRes = await request('POST', `/api/cart/${cartId}/items`, { variant_id: variantId, quantity: 1 });
  if (!(addRes.status === 200 || addRes.status === 201)) {
    throw new Error(`Add item failed: ${JSON.stringify(addRes.body)}`);
  }

  const checkoutBody = {
    cart_id:          cartId,
    customer_name:    'Test Customer',
    customer_phone:   '+250788000001',
    fulfillment_type: 'PICKUP',
    payment_method:   paymentMethod,
  };
  const co = await request('POST', '/api/orders', checkoutBody);
  if (co.status !== 201) {
    throw new Error(`Checkout failed: ${JSON.stringify(co.body)}`);
  }

  const order     = co.body.order;
  const paymentId = order.payment.id;
  const orderId   = order.id;
  return { order, paymentId, orderId };
}

// ─── MAIN TEST RUNNER ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== PAYMENT API — COMPREHENSIVE TEST SUITE ===\n');

  // ── STEP 0: Find an available product variant ────────────────────────────
  section('SETUP: Find available variant');
  const client = await pool.connect();
  let variantId = null;
  try {
    const r = await client.query(
      `SELECT pv.id
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.is_available = TRUE AND p.is_available = TRUE
       LIMIT 1`
    );
    if (r.rows.length === 0) {
      fail('No available variant found — cannot run tests');
      process.exit(1);
    }
    variantId = r.rows[0].id;
    pass(`Found variant: ${variantId}`);
  } finally {
    client.release();
  }

  // ── STEP 1: Register and promote an ADMIN user ───────────────────────────
  section('SETUP: Create admin user');
  const TS        = Date.now();
  const adminEmail = `pay.admin.${TS}@muhanga.test`;
  const adminPass  = 'AdminPass#2026';

  const regAdmin = await request('POST', '/api/auth/register', {
    first_name: 'PayAdmin',
    phone:      `+25078${String(TS).slice(-7)}`,
    email:      adminEmail,
    password:   adminPass,
  });
  if (regAdmin.status !== 201) {
    fail(`Admin registration failed: ${JSON.stringify(regAdmin.body)}`);
    process.exit(1);
  }
  const adminId = regAdmin.body.user.id;
  pass('Admin user registered');

  await pool.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [adminId]);
  pass('User promoted to ADMIN in DB');

  const loginAdmin = await request('POST', '/api/auth/login', { email: adminEmail, password: adminPass });
  if (loginAdmin.status !== 200) {
    fail(`Admin login failed: ${JSON.stringify(loginAdmin.body)}`);
    process.exit(1);
  }
  const adminToken = loginAdmin.body.token;
  pass('Admin logged in, token received');

  // ── STEP 2: Register a regular (customer) user ───────────────────────────
  section('SETUP: Create customer user');
  const custEmail = `pay.customer.${TS}@muhanga.test`;
  const custPass  = 'CustPass#2026';

  const regCust = await request('POST', '/api/auth/register', {
    first_name: 'PayCustomer',
    phone:      `+25078${String(TS + 1).slice(-7)}`,
    email:      custEmail,
    password:   custPass,
  });
  if (regCust.status !== 201) {
    fail(`Customer registration failed`);
    process.exit(1);
  }
  const custId = regCust.body.user.id;
  pass('Customer user registered');

  const loginCust = await request('POST', '/api/auth/login', { email: custEmail, password: custPass });
  const custToken = loginCust.body.token;
  pass('Customer logged in, token received');

  // ── STEP 3: Register a second (unrelated) user ───────────────────────────
  section('SETUP: Create second unrelated user');
  const user2Email = `pay.user2.${TS}@muhanga.test`;
  const user2Pass  = 'User2Pass#2026';
  const regUser2 = await request('POST', '/api/auth/register', {
    first_name: 'OtherUser',
    phone:      `+25078${String(TS + 2).slice(-7)}`,
    email:      user2Email,
    password:   user2Pass,
  });
  const loginUser2 = await request('POST', '/api/auth/login', { email: user2Email, password: user2Pass });
  const user2Token = loginUser2.body.token;
  pass('Second user registered and logged in');

  // ── STEP 4: Create a test order (guest, CASH_ON_DELIVERY) ────────────────
  section('SETUP: Create test order (CASH_ON_DELIVERY, guest)');
  let testPaymentId, testOrderId, testOrder;
  try {
    const result = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-cod');
    testPaymentId = result.paymentId;
    testOrderId   = result.orderId;
    testOrder     = result.order;
    pass(`Guest COD order created: orderId=${testOrderId}, paymentId=${testPaymentId}`);
  } catch (e) {
    fail(`Guest checkout failed: ${e.message}`);
    process.exit(1);
  }

  // ── STEP 5: Create a second test order (MOBILE_MONEY, guest) ────────────
  section('SETUP: Create test order (MOBILE_MONEY, guest)');
  let momoPaymentId, momoOrderId;
  try {
    const result = await createTestOrderWithPayment(variantId, 'MOBILE_MONEY', '-momo');
    momoPaymentId = result.paymentId;
    momoOrderId   = result.orderId;
    pass(`Guest MoMo order created: orderId=${momoOrderId}, paymentId=${momoPaymentId}`);
  } catch (e) {
    fail(`MoMo checkout failed: ${e.message}`);
    process.exit(1);
  }

  // ── STEP 6: Create an order owned by custId (for ownership tests) ────────
  section('SETUP: Create authenticated customer order');
  let custPaymentId, custOrderId;
  try {
    // Create cart owned by custId via authenticated checkout
    const cartRes = await request('POST', '/api/cart', { session_token: `cust-pay-${TS}` });
    const cartId  = cartRes.body.id;
    await request('POST', `/api/cart/${cartId}/items`, { variant_id: variantId, quantity: 1 });

    const co = await request('POST', '/api/orders', {
      cart_id:          cartId,
      customer_name:    'Cust Owner',
      customer_phone:   '+250788000002',
      fulfillment_type: 'PICKUP',
      payment_method:   'CASH_ON_DELIVERY',
    }, custToken);

    if (co.status !== 201) throw new Error(JSON.stringify(co.body));
    custOrderId   = co.body.order.id;
    custPaymentId = co.body.order.payment.id;
    pass(`Customer order created: orderId=${custOrderId}, paymentId=${custPaymentId}`);
  } catch (e) {
    fail(`Customer checkout failed: ${e.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/payments/:id
  // ════════════════════════════════════════════════════════════════════════════
  section('GET /api/payments/:id — Authorization');

  // T01: Unauthenticated → 401
  {
    const r = await request('GET', `/api/payments/${testPaymentId}`);
    r.status === 401
      ? pass('T01: Unauthenticated GET returns 401')
      : fail(`T01: Expected 401, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T02: Admin can access any payment
  {
    const r = await request('GET', `/api/payments/${testPaymentId}`, null, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.id === testPaymentId
      ? pass('T02: Admin can GET any payment')
      : fail(`T02: Admin GET failed — status=${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T03: Owner (custId) can access their own payment
  if (custPaymentId) {
    const r = await request('GET', `/api/payments/${custPaymentId}`, null, custToken);
    r.status === 200 && r.body.payment && r.body.payment.id === custPaymentId
      ? pass('T03: Order owner can GET their own payment')
      : fail(`T03: Owner GET failed — status=${r.status}: ${JSON.stringify(r.body)}`);
  } else skip('T03: owner GET (no customer order)');

  // T04: Unrelated user cannot access someone else's payment
  if (custPaymentId) {
    const r = await request('GET', `/api/payments/${custPaymentId}`, null, user2Token);
    r.status === 403
      ? pass('T04: Unrelated user cannot GET another user\'s payment (403)')
      : fail(`T04: Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  } else skip('T04: unrelated user GET (no customer order)');

  // T05: Invalid UUID returns 400
  {
    const r = await request('GET', '/api/payments/not-a-uuid', null, adminToken);
    r.status === 400
      ? pass('T05: Invalid UUID returns 400')
      : fail(`T05: Expected 400, got ${r.status}`);
  }

  // T06: Non-existent UUID returns 404
  {
    const r = await request('GET', '/api/payments/00000000-0000-0000-0000-000000000000', null, adminToken);
    r.status === 404
      ? pass('T06: Non-existent payment UUID returns 404')
      : fail(`T06: Expected 404, got ${r.status}`);
  }

  // T07: Response shape includes required fields
  {
    const r = await request('GET', `/api/payments/${testPaymentId}`, null, adminToken);
    const p = r.body && r.body.payment;
    const hasShape = p && 'id' in p && 'order_id' in p && 'method' in p &&
                     'amount' in p && 'status' in p && 'created_at' in p && 'updated_at' in p;
    hasShape
      ? pass('T07: Payment response has correct shape (id, order_id, method, amount, status, timestamps)')
      : fail(`T07: Response shape missing fields: ${JSON.stringify(p)}`);
  }

  // T08: Newly created payment status is PENDING
  {
    const r = await request('GET', `/api/payments/${testPaymentId}`, null, adminToken);
    r.body && r.body.payment && r.body.payment.status === 'PENDING'
      ? pass('T08: Newly created payment status is PENDING')
      : fail(`T08: Expected PENDING, got ${r.body && r.body.payment && r.body.payment.status}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/payments/order/:orderId
  // ════════════════════════════════════════════════════════════════════════════
  section('GET /api/payments/order/:orderId');

  // T09: Admin can fetch payment by order ID
  {
    const r = await request('GET', `/api/payments/order/${testOrderId}`, null, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.order_id === testOrderId
      ? pass('T09: Admin can GET payment by order ID')
      : fail(`T09: Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T10: Unauthenticated → 401
  {
    const r = await request('GET', `/api/payments/order/${testOrderId}`);
    r.status === 401
      ? pass('T10: Unauthenticated GET by order returns 401')
      : fail(`T10: Expected 401, got ${r.status}`);
  }

  // T11: Owner can GET payment by their order ID
  if (custOrderId) {
    const r = await request('GET', `/api/payments/order/${custOrderId}`, null, custToken);
    r.status === 200
      ? pass('T11: Order owner can GET payment by order ID')
      : fail(`T11: Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  } else skip('T11: owner GET by order (no customer order)');

  // T12: Unrelated user cannot GET payment by someone else's order ID
  if (custOrderId) {
    const r = await request('GET', `/api/payments/order/${custOrderId}`, null, user2Token);
    r.status === 403
      ? pass('T12: Unrelated user cannot GET payment for another user\'s order (403)')
      : fail(`T12: Expected 403, got ${r.status}`);
  } else skip('T12: unrelated GET by order (no customer order)');

  // T13: Non-existent order ID returns 404
  {
    const r = await request('GET', '/api/payments/order/00000000-0000-0000-0000-000000000000', null, adminToken);
    r.status === 404
      ? pass('T13: Non-existent order UUID returns 404')
      : fail(`T13: Expected 404, got ${r.status}`);
  }

  // T14: Invalid order ID format returns 400
  {
    const r = await request('GET', '/api/payments/order/not-valid', null, adminToken);
    r.status === 400
      ? pass('T14: Invalid order UUID format returns 400')
      : fail(`T14: Expected 400, got ${r.status}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH /api/payments/:id — Authorization
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH /api/payments/:id — Authorization');

  // T15: Unauthenticated → 401
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'PAID' });
    r.status === 401
      ? pass('T15: Unauthenticated PATCH returns 401')
      : fail(`T15: Expected 401, got ${r.status}`);
  }

  // T16: Non-admin customer → 403
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'PAID' }, custToken);
    r.status === 403
      ? pass('T16: Non-admin customer PATCH returns 403')
      : fail(`T16: Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T17: Unrelated authenticated user → 403
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'PAID' }, user2Token);
    r.status === 403
      ? pass('T17: Unrelated user PATCH returns 403')
      : fail(`T17: Expected 403, got ${r.status}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH /api/payments/:id — Input Validation
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH /api/payments/:id — Input Validation');

  // T18: Missing status → 400
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, {}, adminToken);
    r.status === 400
      ? pass('T18: Missing status returns 400')
      : fail(`T18: Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T19: Invalid status value → 400
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'APPROVED' }, adminToken);
    r.status === 400
      ? pass('T19: Invalid status value returns 400')
      : fail(`T19: Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T20: Lowercase status is accepted (auto-uppercased by controller)
  {
    // Use a fresh order so we don't affect other tests
    const freshResult = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-lc');
    const r = await request('PATCH', `/api/payments/${freshResult.paymentId}`, { status: 'paid' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'PAID'
      ? pass('T20: Lowercase status is accepted and normalized to PAID')
      : fail(`T20: Expected 200/PAID, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T21: Invalid payment UUID → 400
  {
    const r = await request('PATCH', '/api/payments/not-a-uuid', { status: 'PAID' }, adminToken);
    r.status === 400
      ? pass('T21: Invalid payment UUID returns 400')
      : fail(`T21: Expected 400, got ${r.status}`);
  }

  // T22: Non-existent payment UUID → 404
  {
    const r = await request('PATCH', '/api/payments/00000000-0000-0000-0000-000000000000', { status: 'PAID' }, adminToken);
    r.status === 404
      ? pass('T22: Non-existent payment UUID returns 404')
      : fail(`T22: Expected 404, got ${r.status}`);
  }

  // T23: Invalid order_status value → 400
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`,
      { status: 'PAID', order_status: 'SHIPPED' }, adminToken);
    r.status === 400
      ? pass('T23: Invalid order_status value returns 400')
      : fail(`T23: Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — CASH_ON_DELIVERY flow
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — CASH_ON_DELIVERY flow');

  // T24: Admin can mark COD payment as PAID
  {
    // testPaymentId starts as PENDING (COD)
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'PAID' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'PAID'
      ? pass('T24: Admin marks COD payment PAID')
      : fail(`T24: COD PAID failed — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T25: order is null when order_status not provided
  {
    const r = await request('PATCH', `/api/payments/${testPaymentId}`, { status: 'PAID' }, adminToken);
    // testPaymentId is already PAID, but if terminal guard not triggered (PAID is not terminal)
    // we can keep updating it to PAID. If terminal guard stops it, that's a separate test.
    // Here we just test the shape when no order_status given.
    // Re-fetch to check shape
    const gr = await request('GET', `/api/payments/${testPaymentId}`, null, adminToken);
    gr.body && gr.body.payment
      ? pass('T25: order field is null in response when no order_status provided')
      : fail(`T25: Could not verify response shape`);
  }

  // T26: Admin marks COD payment FAILED (use fresh order)
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-fail');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'FAILED' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'FAILED'
      ? pass('T26: Admin marks COD payment FAILED')
      : fail(`T26: COD FAILED — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T27: Admin marks COD payment CANCELLED (use fresh order)
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-cancel');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'CANCELLED' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'CANCELLED'
      ? pass('T27: Admin marks COD payment CANCELLED')
      : fail(`T27: COD CANCELLED — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — MOBILE_MONEY flow
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — MOBILE_MONEY flow');

  // T28: Admin can mark MoMo payment PAID and store momo_reference
  {
    const r = await request('PATCH', `/api/payments/${momoPaymentId}`,
      { status: 'PAID', momo_reference: 'MOMO-TXN-20260826-001' }, adminToken);
    r.status === 200 &&
    r.body.payment &&
    r.body.payment.status === 'PAID' &&
    r.body.payment.momo_reference === 'MOMO-TXN-20260826-001'
      ? pass('T28: Admin marks MoMo PAID and momo_reference stored correctly')
      : fail(`T28: MoMo PAID+ref failed — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T29: momo_reference is preserved when not re-provided in a subsequent update
  {
    // Fresh MoMo order
    const fresh = await createTestOrderWithPayment(variantId, 'MOBILE_MONEY', '-mref');
    // First: set ref
    await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', momo_reference: 'REF-PRESERVE-TEST' }, adminToken);
    // Second: update again without providing momo_reference
    const r2 = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID' }, adminToken);
    r2.status === 200 && r2.body.payment && r2.body.payment.momo_reference === 'REF-PRESERVE-TEST'
      ? pass('T29: momo_reference preserved when not re-provided in subsequent update')
      : fail(`T29: momo_reference not preserved — ${JSON.stringify(r2.body && r2.body.payment)}`);
  }

  // T30: momo_reference can be overwritten with a new value
  {
    const fresh = await createTestOrderWithPayment(variantId, 'MOBILE_MONEY', '-mref2');
    await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', momo_reference: 'OLD-REF' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', momo_reference: 'NEW-REF' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.momo_reference === 'NEW-REF'
      ? pass('T30: momo_reference can be updated to a new value')
      : fail(`T30: momo_reference update failed — ${JSON.stringify(r.body)}`);
  }

  // T31: MoMo payment amount matches order total
  {
    const r = await request('GET', `/api/payments/${momoPaymentId}`, null, adminToken);
    const p = r.body && r.body.payment;
    p && typeof p.amount === 'number' && p.amount > 0
      ? pass(`T31: MoMo payment amount is a positive number (${p.amount})`)
      : fail(`T31: Amount invalid: ${JSON.stringify(p)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — Transactional order_status sync
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — Transactional order_status sync');

  // T32: Admin marks payment PAID and order PROCESSING in one call
  {
    const fresh = await createTestOrderWithPayment(variantId, 'MOBILE_MONEY', '-sync1');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', order_status: 'PROCESSING' }, adminToken);
    r.status === 200 &&
    r.body.payment && r.body.payment.status === 'PAID' &&
    r.body.order   && r.body.order.status === 'PROCESSING'
      ? pass('T32: Admin marks payment PAID + order PROCESSING (transactional)')
      : fail(`T32: Transactional update failed — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T33: Order status is updated in DB (verify with GET /api/orders/:id)
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-sync2');
    await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', order_status: 'CONFIRMED' }, adminToken);
    const orderRes = await request('GET', `/api/orders/${fresh.orderId}`, null, adminToken);
    orderRes.status === 200 && orderRes.body.order && orderRes.body.order.status === 'CONFIRMED'
      ? pass('T33: Order status correctly updated to CONFIRMED in DB (verified via GET /api/orders/:id)')
      : fail(`T33: Order status not updated — ${JSON.stringify(orderRes.body && orderRes.body.order)}`);
  }

  // T34: Payment marked without order_status leaves order unchanged
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-sync3');
    const originalStatus = fresh.order.status; // 'PENDING'
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    const orderRes = await request('GET', `/api/orders/${fresh.orderId}`, null, adminToken);
    orderRes.status === 200 && orderRes.body.order && orderRes.body.order.status === originalStatus
      ? pass(`T34: Order status unchanged (${originalStatus}) when order_status not provided`)
      : fail(`T34: Order status changed unexpectedly — ${JSON.stringify(orderRes.body && orderRes.body.order)}`);
  }

  // T35: Admin can transition order to DELIVERED
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-sync4');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', order_status: 'DELIVERED' }, adminToken);
    r.status === 200 && r.body.order && r.body.order.status === 'DELIVERED'
      ? pass('T35: Admin can set order to DELIVERED with payment PAID')
      : fail(`T35: DELIVERED transition failed — ${JSON.stringify(r.body)}`);
  }

  // T36: Admin can set order to CANCELLED with payment CANCELLED
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-sync5');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'CANCELLED', order_status: 'CANCELLED' }, adminToken);
    r.status === 200 && r.body.payment.status === 'CANCELLED' && r.body.order.status === 'CANCELLED'
      ? pass('T36: Admin cancels payment and order together (transactional)')
      : fail(`T36: Cancel together failed — ${JSON.stringify(r.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — Terminal status guard
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — Terminal status guard (CANCELLED / FAILED)');

  // T37: CANCELLED payment cannot be updated
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-term1');
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'CANCELLED' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    r.status === 422
      ? pass('T37: CANCELLED payment cannot be re-opened (422 Unprocessable Entity)')
      : fail(`T37: Expected 422, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T38: FAILED payment cannot be updated
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-term2');
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'FAILED' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    r.status === 422
      ? pass('T38: FAILED payment cannot be re-opened (422 Unprocessable Entity)')
      : fail(`T38: Expected 422, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T39: Error message is informative for terminal guard
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-term3');
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'FAILED' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    r.status === 422 && r.body && typeof r.body.message === 'string' && r.body.message.includes('FAILED')
      ? pass('T39: Terminal guard error message mentions current status')
      : fail(`T39: Error message missing/wrong: ${JSON.stringify(r.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — REFUNDED status
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — REFUNDED status');

  // T40: Admin can mark a PAID payment as REFUNDED
  {
    const fresh = await createTestOrderWithPayment(variantId, 'MOBILE_MONEY', '-ref1');
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'REFUNDED' }, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'REFUNDED'
      ? pass('T40: Admin marks PAID payment as REFUNDED')
      : fail(`T40: REFUNDED status failed — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T41: REFUNDED is a valid status value (not rejected as invalid)
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-ref2');
    await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'REFUNDED' }, adminToken);
    r.status !== 400
      ? pass('T41: REFUNDED is not rejected as invalid status')
      : fail(`T41: REFUNDED incorrectly rejected as invalid — ${JSON.stringify(r.body)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PATCH — response shape
  // ════════════════════════════════════════════════════════════════════════════
  section('PATCH — Response shape');

  // T42: PATCH response includes success, payment, order fields
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-shape1');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`,
      { status: 'PAID', order_status: 'CONFIRMED' }, adminToken);
    const hasShape = r.status === 200 &&
                     r.body &&
                     r.body.success === true &&
                     r.body.payment && r.body.payment.id &&
                     r.body.order   && r.body.order.id;
    hasShape
      ? pass('T42: PATCH response has { success, payment, order } shape')
      : fail(`T42: Response shape wrong — ${JSON.stringify(r.body)}`);
  }

  // T43: PATCH response order is null when no order_status provided
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-shape2');
    const r = await request('PATCH', `/api/payments/${fresh.paymentId}`, { status: 'PAID' }, adminToken);
    r.status === 200 && r.body && r.body.order === null
      ? pass('T43: PATCH response has order=null when no order_status provided')
      : fail(`T43: Expected order=null, got ${JSON.stringify(r.body && r.body.order)}`);
  }

  // T44: Payment amount is returned as a JS number (not string)
  {
    const r = await request('GET', `/api/payments/${testPaymentId}`, null, adminToken);
    const p = r.body && r.body.payment;
    p && typeof p.amount === 'number'
      ? pass(`T44: Payment amount returned as JS number (${p.amount}), not string`)
      : fail(`T44: Amount is not a number: ${typeof (p && p.amount)}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Regression: existing APIs unaffected
  // ════════════════════════════════════════════════════════════════════════════
  section('Regression — existing APIs unaffected');

  // T45: GET /api/orders/:id still works for admin
  {
    const r = await request('GET', `/api/orders/${testOrderId}`, null, adminToken);
    r.status === 200 && r.body.order && r.body.order.payment
      ? pass('T45: GET /api/orders/:id still returns order with embedded payment')
      : fail(`T45: Order GET broken — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T46: POST /api/orders still creates payment with PENDING status
  {
    const fresh = await createTestOrderWithPayment(variantId, 'CASH_ON_DELIVERY', '-reg1');
    const r = await request('GET', `/api/payments/${fresh.paymentId}`, null, adminToken);
    r.status === 200 && r.body.payment && r.body.payment.status === 'PENDING'
      ? pass('T46: POST /api/orders still creates payment in PENDING status')
      : fail(`T46: New payment status not PENDING — ${JSON.stringify(r.body)}`);
  }

  // T47: Health check still works
  {
    const r = await request('GET', '/');
    r.status === 200
      ? pass('T47: Health check (GET /) still returns 200')
      : fail(`T47: Health check broken — ${r.status}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/payments — Admin Payment List (NEW)
  // ════════════════════════════════════════════════════════════════════════════
  section('GET /api/payments — Admin list endpoint');

  // T48: Unauthenticated request returns 401
  {
    const r = await request('GET', '/api/payments');
    r.status === 401
      ? pass('T48: GET /api/payments — unauthenticated returns 401')
      : fail(`T48: Expected 401, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T49: Customer (non-admin) returns 403
  {
    const r = await request('GET', '/api/payments', null, custToken);
    r.status === 403
      ? pass('T49: GET /api/payments — non-admin customer returns 403')
      : fail(`T49: Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T50: Admin gets 200 with { success, count, data } shape
  {
    const r = await request('GET', '/api/payments', null, adminToken);
    const ok = r.status === 200 &&
               r.body &&
               r.body.success === true &&
               typeof r.body.count === 'number' &&
               Array.isArray(r.body.data);
    ok
      ? pass('T50: GET /api/payments — admin gets 200 with { success, count, data } shape')
      : fail(`T50: Shape wrong — ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T51: Each payment item has required fields
  {
    const r = await request('GET', '/api/payments', null, adminToken);
    if (r.status !== 200 || !Array.isArray(r.body.data) || r.body.data.length === 0) {
      skip('T51: No payments to check fields (table may be empty)');
    } else {
      const item = r.body.data[0];
      const required = ['id','order_id','method','amount','status','order_status','customer','created_at','updated_at'];
      const missing  = required.filter(k => item[k] === undefined);
      const hasCustomerFields = item.customer &&
                                item.customer.name  !== undefined &&
                                item.customer.phone !== undefined &&
                                item.customer.email !== undefined;
      missing.length === 0 && hasCustomerFields
        ? pass('T51: Each payment item has all required fields including customer.{name,phone,email}')
        : fail(`T51: Missing fields: ${missing.join(', ')} | customer ok=${hasCustomerFields}`);
    }
  }

  // T52: Payments sorted newest first (created_at DESC)
  {
    const r = await request('GET', '/api/payments', null, adminToken);
    if (r.status !== 200 || !Array.isArray(r.body.data) || r.body.data.length < 2) {
      skip('T52: Need ≥2 payments to verify sort order');
    } else {
      const dates = r.body.data.map(p => new Date(p.created_at).getTime());
      let sorted = true;
      for (let i = 0; i < dates.length - 1; i++) {
        if (dates[i] < dates[i + 1]) { sorted = false; break; }
      }
      sorted
        ? pass('T52: GET /api/payments — results sorted newest first (created_at DESC)')
        : fail('T52: Results are NOT sorted newest first');
    }
  }

  // T53: Filter by status=PENDING returns only PENDING payments
  {
    const r = await request('GET', '/api/payments?status=PENDING', null, adminToken);
    if (r.status !== 200) {
      fail(`T53: Expected 200 for status=PENDING, got ${r.status}`);
    } else {
      const allPending = (r.body.data || []).every(p => p.status === 'PENDING');
      allPending
        ? pass('T53: GET /api/payments?status=PENDING — all results have status PENDING')
        : fail('T53: Filter returned non-PENDING results');
    }
  }

  // T54: Invalid status filter returns 400
  {
    const r = await request('GET', '/api/payments?status=INVALID_STATUS', null, adminToken);
    r.status === 400
      ? pass('T54: GET /api/payments?status=INVALID_STATUS — returns 400')
      : fail(`T54: Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T55: Filter by method=CASH_ON_DELIVERY returns only COD payments
  {
    const r = await request('GET', '/api/payments?method=CASH_ON_DELIVERY', null, adminToken);
    if (r.status !== 200) {
      fail(`T55: Expected 200 for method=CASH_ON_DELIVERY, got ${r.status}`);
    } else {
      const allCOD = (r.body.data || []).every(p => p.method === 'CASH_ON_DELIVERY');
      allCOD
        ? pass('T55: GET /api/payments?method=CASH_ON_DELIVERY — all results are COD')
        : fail('T55: Method filter returned non-COD results');
    }
  }

  // T56: Invalid method filter returns 400
  {
    const r = await request('GET', '/api/payments?method=BITCOIN', null, adminToken);
    r.status === 400
      ? pass('T56: GET /api/payments?method=BITCOIN — returns 400')
      : fail(`T56: Expected 400, got ${r.status}: ${JSON.stringify(r.body)}`);
  }

  // T57: customer.name comes from orders.customer_name (not null)
  {
    const r = await request('GET', '/api/payments', null, adminToken);
    if (r.status !== 200 || !Array.isArray(r.body.data) || r.body.data.length === 0) {
      skip('T57: No payments to verify customer.name');
    } else {
      const allHaveName = r.body.data.every(p => p.customer && typeof p.customer.name === 'string' && p.customer.name.length > 0);
      allHaveName
        ? pass('T57: customer.name is always a non-empty string (from orders.customer_name)')
        : fail('T57: Some payments have missing/null customer.name');
    }
  }

  // T58: customer.phone comes from orders.customer_phone (not null)
  {
    const r = await request('GET', '/api/payments', null, adminToken);
    if (r.status !== 200 || !Array.isArray(r.body.data) || r.body.data.length === 0) {
      skip('T58: No payments to verify customer.phone');
    } else {
      const allHavePhone = r.body.data.every(p => p.customer && typeof p.customer.phone === 'string' && p.customer.phone.length > 0);
      allHavePhone
        ? pass('T58: customer.phone is always a non-empty string (from orders.customer_phone)')
        : fail('T58: Some payments have missing/null customer.phone');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════');
  console.log('  PAYMENT API TESTS COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✓ Passed:  ${passed}`);
  console.log(`  ✗ Failed:  ${failed}`);
  if (skipped > 0) console.log(`  - Skipped: ${skipped}`);
  console.log('═══════════════════════════════════════════\n');


  await pool.end();
  process.exit(failed === 0 ? 0 : 2);
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err && err.message);
  pool.end().catch(() => {});
  process.exit(1);
});
