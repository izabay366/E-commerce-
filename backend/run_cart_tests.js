/**
 * run_cart_tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Muhanga Marketplace — Cart API Correction & Real Database Test Suite
 *
 * Performs (in order):
 *   1. Live DB schema inspection (column types for key columns)
 *   2. Find real Rice (Kigoma) 1kg variant ID
 *   3. Start server / verify it's running
 *   4. Run all Cart API tests against live data
 *   5. Verify existing product + category APIs still work
 *
 * Run: node run_cart_tests.js
 *
 * IMPORTANT: The server (src/server.js) must be running on port 5000
 *            BEFORE running this script, OR run run_tests.bat which does both.
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

// ─── COLOURS ─────────────────────────────────────────────────────────────────

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
  if (condition) { ok(message); passCount++; }
  else           { fail(message); failCount++; }
}

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: parseInt(process.env.PORT || '5000', 10),
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}╔═══════════════════════════════════════════════════╗`);
  console.log(`║  MUHANGA MARKETPLACE — CART API TEST SUITE        ║`);
  console.log(`╚═══════════════════════════════════════════════════╝${C.reset}`);

  // ── STEP 1: DB SCHEMA INSPECTION ──────────────────────────────────────────

  head('STEP 1: LIVE DB SCHEMA INSPECTION');

  const client = await pool.connect();
  let schemaRows, riceRows, riceVariantId, ricePrice, riceVariantName, riceProductName;

  try {
    const result = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'carts'            AND column_name = 'id')
          OR (table_name = 'cart_items'    AND column_name IN ('id', 'cart_id', 'variant_id'))
          OR (table_name = 'product_variants' AND column_name = 'id')
        )
      ORDER BY table_name, column_name
    `);
    schemaRows = result.rows;

    console.log('  Column types from information_schema:\n');
    for (const r of schemaRows) {
      console.log(`  ${r.table_name}.${r.column_name}`);
      console.log(`      data_type : ${r.data_type}`);
      console.log(`      udt_name  : ${r.udt_name}`);
      console.log(`      nullable  : ${r.is_nullable}`);
      console.log(`      default   : ${r.column_default || 'none'}`);
      console.log('');
    }

    // Verify the critical types
    const colMap = {};
    for (const r of schemaRows) {
      colMap[`${r.table_name}.${r.column_name}`] = r;
    }

    const cartsId       = colMap['carts.id'];
    const cartItemsId   = colMap['cart_items.id'];
    const cartItemsCart = colMap['cart_items.cart_id'];
    const cartItemsVar  = colMap['cart_items.variant_id'];
    const pvId          = colMap['product_variants.id'];

    assert(cartsId && cartsId.udt_name === 'uuid',
      `carts.id is UUID  (actual: ${cartsId?.udt_name})`);

    assert(pvId && (pvId.data_type === 'integer' || pvId.udt_name === 'int4'),
      `product_variants.id is INTEGER  (actual: ${pvId?.data_type})`);

    assert(cartItemsVar && (cartItemsVar.data_type === 'integer' || cartItemsVar.udt_name === 'int4'),
      `cart_items.variant_id is INTEGER  (actual: ${cartItemsVar?.data_type})`);

    assert(cartItemsCart && cartItemsCart.udt_name === 'uuid',
      `cart_items.cart_id is UUID  (actual: ${cartItemsCart?.udt_name})`);

    const itemIdType = cartItemsId?.data_type;
    info(`cart_items.id data_type = "${itemIdType}" (udt: ${cartItemsId?.udt_name})`);
    assert(cartItemsId !== undefined, `cart_items.id column found in schema`);

  } finally {
    client.release();
  }

  // ── STEP 2: FIND RICE (KIGOMA) 1KG VARIANT ───────────────────────────────

  head('STEP 2: FIND RICE (KIGOMA) 1KG VARIANT');

  const dbClient2 = await pool.connect();
  try {
    const rice = await dbClient2.query(`
      SELECT
        pv.id            AS variant_id,
        p.name           AS product_name,
        pv.name          AS variant_name,
        pv.price         AS price,
        pv.stock_quantity AS stock_quantity,
        pv.is_available  AS is_available
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.name ILIKE '%rice%kigoma%'
         OR p.name ILIKE '%kigoma%rice%'
      ORDER BY pv.price
    `);

    if (rice.rows.length === 0) {
      console.log(`\n  ${C.yellow}⚠ No "Rice (Kigoma)" product found. Listing all products:${C.reset}\n`);
      const prods = await dbClient2.query(
        `SELECT id, name FROM products ORDER BY name`
      );
      for (const r of prods.rows) {
        console.log(`  id: ${r.id}  name: "${r.name}"`);
      }
      console.log(`\n  ${C.yellow}⚠ STOPPING — cannot test without a real product variant.${C.reset}\n`);
      await pool.end();
      process.exit(1);
    }

    riceRows = rice.rows;
    console.log('  Rice (Kigoma) variants found:\n');
    for (const r of riceRows) {
      console.log(`  variant_id   : ${r.variant_id}  (INTEGER)`);
      console.log(`  product_name : "${r.product_name}"`);
      console.log(`  variant_name : "${r.variant_name}"`);
      console.log(`  price        : ${r.price}`);
      console.log(`  stock        : ${r.stock_quantity}`);
      console.log(`  available    : ${r.is_available}`);
      console.log('');
    }

    // Pick 1kg variant first, fall back to cheapest
    const target = riceRows.find(r =>
      r.variant_name && r.variant_name.toLowerCase().includes('1kg')
    ) || riceRows[0];

    riceVariantId   = parseInt(target.variant_id, 10);
    ricePrice       = parseFloat(target.price);
    riceVariantName = target.variant_name;
    riceProductName = target.product_name;

    info(`Selected for tests: variant_id=${riceVariantId} | "${riceProductName}" "${riceVariantName}" | price=${ricePrice}`);

  } finally {
    dbClient2.release();
  }

  // ── STEP 3: CHECK SERVER IS REACHABLE ────────────────────────────────────

  head('STEP 3: SERVER HEALTH CHECK');

  try {
    const health = await apiRequest('GET', '/');
    assert(health.status === 200, `GET /  →  HTTP ${health.status} (expected 200)`);
    info(`Response: ${JSON.stringify(health.body)}`);
  } catch (e) {
    fail(`Server not reachable at ${API_BASE} — is it running? Error: ${e.message}`);
    console.log(`\n  ${C.red}Start the server first:  node src/server.js${C.reset}\n`);
    await pool.end();
    process.exit(1);
  }

  // ── STEP 4: CREATE CART ────────────────────────────────────────────────────

  head('STEP 4: CREATE CART (POST /api/cart)');

  const sessionToken = `test-session-${Date.now()}`;
  const cartRes = await apiRequest('POST', '/api/cart', { session_token: sessionToken });
  assert(cartRes.status === 201, `POST /api/cart  →  HTTP ${cartRes.status} (expected 201)`);
  assert(typeof cartRes.body.id === 'string', `cart.id is a string (UUID)`);
  assert(/^[0-9a-f-]{36}$/i.test(cartRes.body.id), `cart.id matches UUID format`);
  info(`Cart ID: ${cartRes.body.id}`);

  const CART_ID = cartRes.body.id;

  // ── STEP 5: ADD ITEM — PRICE SECURITY TEST ────────────────────────────────

  head('STEP 5: ADD ITEM WITH PRICE INJECTION ATTEMPT (price security)');
  info(`Sending variant_id=${riceVariantId}, quantity=1, unit_price=1 (must be ignored)`);

  const secRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: riceVariantId,
    quantity:   1,
    unit_price: 1,               // attacker-supplied — must be IGNORED
  });
  assert(secRes.status === 200,
    `POST /api/cart/:id/items (price injection)  →  HTTP ${secRes.status} (expected 200)`);

  if (secRes.status === 200) {
    const addedItem = secRes.body.items && secRes.body.items[0];
    assert(!!addedItem,
      `Response has items array with at least one item`);

    if (addedItem) {
      assert(addedItem.unit_price === ricePrice,
        `unit_price is DB value ${ricePrice} — not injected value 1 (got: ${addedItem.unit_price})`);
      assert(addedItem.quantity === 1,
        `quantity = 1 (got: ${addedItem.quantity})`);
      assert(Math.abs(addedItem.subtotal - ricePrice * 1) < 0.01,
        `subtotal = ${ricePrice} × 1 = ${ricePrice} (got: ${addedItem.subtotal})`);
      assert(addedItem.variant_id === riceVariantId || addedItem.variant_id === String(riceVariantId),
        `variant_id matches ${riceVariantId} (got: ${addedItem.variant_id})`);
      info(`product_name : ${addedItem.product_name}`);
      info(`variant_name : ${addedItem.variant_name}`);
    }
  }

  // ── STEP 6: MAIN ADD ITEM TEST (quantity=2) ───────────────────────────────

  head('STEP 6: ADD ITEM — CLEAR CART, ADD 2 UNITS (main test)');

  // Clear cart first so we start fresh
  await apiRequest('DELETE', `/api/cart/${CART_ID}`);
  info('Cart cleared before main test.');

  const addRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: riceVariantId,
    quantity:   2,
  });

  assert(addRes.status === 200,
    `POST /api/cart/:id/items (quantity=2)  →  HTTP ${addRes.status} (expected 200)`);

  if (addRes.status === 200) {
    const item = addRes.body.items && addRes.body.items[0];
    assert(!!item, `Response contains at least one item`);

    if (item) {
      info(`  product_name : "${item.product_name}"`);
      info(`  variant_name : "${item.variant_name}"`);
      info(`  variant_id   : ${item.variant_id}`);
      info(`  unit_price   : ${item.unit_price}`);
      info(`  quantity     : ${item.quantity}`);
      info(`  subtotal     : ${item.subtotal}`);

      assert(item.product_name === riceProductName,
        `product_name = "${riceProductName}" (got: "${item.product_name}")`);
      assert(item.variant_name === riceVariantName,
        `variant_name = "${riceVariantName}" (got: "${item.variant_name}")`);
      assert(item.unit_price === ricePrice,
        `unit_price = ${ricePrice} (DB price, got: ${item.unit_price})`);
      assert(item.quantity === 2,
        `quantity = 2 (got: ${item.quantity})`);
      assert(Math.abs(item.subtotal - ricePrice * 2) < 0.01,
        `subtotal = ${ricePrice} × 2 = ${ricePrice * 2} (got: ${item.subtotal})`);
      assert(addRes.body.total_items === 2,
        `total_items = 2 (got: ${addRes.body.total_items})`);
      assert(Math.abs(addRes.body.subtotal - ricePrice * 2) < 0.01,
        `cart subtotal = ${ricePrice * 2} (got: ${addRes.body.subtotal})`);
    }
  }

  // ── STEP 7: DUPLICATE VARIANT — QUANTITY ACCUMULATION ────────────────────

  head('STEP 7: ADD SAME VARIANT AGAIN (duplicate → accumulate qty)');
  info(`Adding variant_id=${riceVariantId} with quantity=3 (existing=2, expected=5)`);

  const dupRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: riceVariantId,
    quantity:   3,
  });
  assert(dupRes.status === 200,
    `POST /api/cart/:id/items (duplicate)  →  HTTP ${dupRes.status} (expected 200)`);

  if (dupRes.status === 200) {
    const items = dupRes.body.items || [];
    assert(items.length === 1,
      `Only 1 row in cart_items (no duplicate row created). Got: ${items.length}`);
    if (items[0]) {
      assert(items[0].quantity === 5,
        `Accumulated quantity = 5 (2+3). Got: ${items[0].quantity}`);
      assert(Math.abs(items[0].subtotal - ricePrice * 5) < 0.01,
        `subtotal = ${ricePrice * 5} (got: ${items[0].subtotal})`);
    }
  }

  // ── STEP 8: INVALID VARIANT ────────────────────────────────────────────────

  head('STEP 8: INVALID VARIANT ID (999999999)');

  const invRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: 999999999,
    quantity:   1,
  });
  assert(invRes.status === 404,
    `POST with non-existent variant_id  →  HTTP ${invRes.status} (expected 404)`);
  assert(
    invRes.body && typeof invRes.body.message === 'string' &&
    invRes.body.message.toLowerCase().includes('variant'),
    `Error message mentions "variant" (got: "${invRes.body?.message}")`
  );

  // ── STEP 9: INVALID QUANTITY ───────────────────────────────────────────────

  head('STEP 9: INVALID QUANTITY (-1)');

  const qtyRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: riceVariantId,
    quantity:   -1,
  });
  assert(qtyRes.status === 400,
    `POST with quantity=-1  →  HTTP ${qtyRes.status} (expected 400)`);

  // ── STEP 10: VARIANT_ID AS UUID MUST FAIL ─────────────────────────────────

  head('STEP 10: variant_id AS UUID STRING MUST BE REJECTED');

  const uuidRes = await apiRequest('POST', `/api/cart/${CART_ID}/items`, {
    variant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    quantity:   1,
  });
  assert(uuidRes.status === 400,
    `POST with UUID variant_id  →  HTTP ${uuidRes.status} (expected 400 — UUID not valid for INTEGER column)`);

  // ── STEP 11: GET CART ──────────────────────────────────────────────────────

  head('STEP 11: GET CART (GET /api/cart/:cartId)');

  const getRes = await apiRequest('GET', `/api/cart/${CART_ID}`);
  assert(getRes.status === 200,
    `GET /api/cart/:cartId  →  HTTP ${getRes.status} (expected 200)`);

  if (getRes.status === 200) {
    const cart = getRes.body;
    const item = cart.items && cart.items[0];
    assert(!!item, `Cart has at least one item`);
    if (item) {
      assert(item.quantity === 5,
        `quantity = 5 (accumulated). Got: ${item.quantity}`);
      assert(item.unit_price === ricePrice,
        `unit_price = ${ricePrice} (DB). Got: ${item.unit_price}`);
      assert(Math.abs(item.subtotal - ricePrice * 5) < 0.01,
        `item subtotal = ${ricePrice * 5}. Got: ${item.subtotal}`);
      assert(cart.total_items === 5,
        `total_items = 5. Got: ${cart.total_items}`);
      assert(Math.abs(cart.subtotal - ricePrice * 5) < 0.01,
        `cart subtotal = ${ricePrice * 5}. Got: ${cart.subtotal}`);
    }
    info(`GET cart.id         : ${cart.id}`);
    info(`GET cart.total_items: ${cart.total_items}`);
    info(`GET cart.subtotal   : ${cart.subtotal}`);
  }

  // ── STEP 12: EXISTING APIS ─────────────────────────────────────────────────

  head('STEP 12: EXISTING API ENDPOINTS');

  const productsRes = await apiRequest('GET', '/api/products');
  assert(productsRes.status === 200,
    `GET /api/products  →  HTTP ${productsRes.status} (expected 200)`);
  assert(Array.isArray(productsRes.body) || Array.isArray(productsRes.body?.data),
    `GET /api/products returns array (or data array)`);

  const product1Res = await apiRequest('GET', '/api/products/1');
  assert(product1Res.status === 200 || product1Res.status === 404,
    `GET /api/products/1  →  HTTP ${product1Res.status} (expected 200 or 404)`);
  info(`GET /api/products/1  → HTTP ${product1Res.status}`);

  const categoriesRes = await apiRequest('GET', '/api/categories');
  assert(categoriesRes.status === 200,
    `GET /api/categories  →  HTTP ${categoriesRes.status} (expected 200)`);

  const cat1Res = await apiRequest('GET', '/api/categories/1');
  assert(cat1Res.status === 200 || cat1Res.status === 404,
    `GET /api/categories/1  →  HTTP ${cat1Res.status} (expected 200 or 404)`);
  info(`GET /api/categories/1  → HTTP ${cat1Res.status}`);

  // ── STEP 13: CLEANUP ──────────────────────────────────────────────────────

  head('STEP 13: CLEANUP — CLEAR TEST CART');

  const clearRes = await apiRequest('DELETE', `/api/cart/${CART_ID}`);
  assert(clearRes.status === 200,
    `DELETE /api/cart/:cartId (clear)  →  HTTP ${clearRes.status} (expected 200)`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────

  const total = passCount + failCount;
  console.log(`\n${C.bold}╔═══════════════════════════════════════════════════╗`);
  console.log(`║  TEST SUMMARY                                     ║`);
  console.log(`╚═══════════════════════════════════════════════════╝${C.reset}\n`);
  console.log(`  Real variant used  : variant_id=${riceVariantId}  "${riceProductName}" "${riceVariantName}"  price=${ricePrice}`);
  console.log(`  Cart ID used       : ${CART_ID}`);
  console.log(`  Total assertions   : ${total}`);
  console.log(`  ${C.green}PASSED${C.reset}             : ${passCount}`);
  console.log(`  ${failCount > 0 ? C.red : C.green}FAILED${C.reset}             : ${failCount}`);
  console.log('');
  if (failCount === 0) {
    console.log(`  ${C.green}${C.bold}✓ ALL TESTS PASSED${C.reset}\n`);
  } else {
    console.log(`  ${C.red}${C.bold}✗ ${failCount} TEST(S) FAILED — review output above${C.reset}\n`);
  }

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${C.red}FATAL ERROR:${C.reset}`, err.message);
  pool.end().catch(() => {});
  process.exit(1);
});
