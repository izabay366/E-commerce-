/**
 * run_auth_tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication test suite for Muhanga Marketplace.
 *
 * Tests (A–M):
 *   A  Register new user                     → 201
 *   B  Register duplicate email              → 409
 *   B2 Register duplicate phone              → 409
 *   C  Password is hashed in DB              → bcrypt hash confirmed
 *   D  Login with correct password           → 200 + JWT
 *   E  Login with wrong password             → 401
 *   F  JWT returned and parseable            → valid JWT structure
 *   G  GET /api/auth/me with valid JWT       → 200 + user object
 *   H  GET /api/auth/me without token        → 401
 *   I  GET /api/auth/me with invalid token   → 401
 *   J  password_hash never in any response   → confirmed absent
 *   K  GET /api/products still works         → 200
 *   L  GET /api/categories still works       → 200
 *   M  Cart API regression (create + add)    → 201, 200
 *
 * Run: node run_auth_tests.js
 * Server must be running on port 5000.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const http  = require('http');
const { Pool } = require('pg');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ─── UNIQUE TEST USER (avoids conflicts across runs) ──────────────────────────

const TS          = Date.now();
const TEST_EMAIL  = `auth.test.${TS}@muhanga.test`;
const TEST_PHONE  = `+2507${String(TS).slice(-8)}`;
const TEST_PASS   = 'SecurePass#2026';
const TEST_FNAME  = 'AuthTest';
const TEST_LNAME  = 'User';

// Track created test user ID for cleanup assertions
let createdUserId  = null;
let validToken     = null;
let testCartId     = null;

// ─── TEST RUNNER HELPERS ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ✗  ${label}`);
  if (detail) console.log(`       → ${detail}`);
  failed++;
  failures.push({ label, detail });
}

function section(title) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(65) + '\n');
}

function assert(condition, passLabel, failLabel, detail) {
  if (condition) pass(passLabel);
  else fail(failLabel, detail);
}

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────

function request(method, path, body, token) {
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
      res.on('data', chunk => data += chunk);
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

// ─── RESPONSE SECURITY CHECKER ────────────────────────────────────────────────

/** Returns true if no property in the object tree contains a bcrypt hash. */
function containsPasswordHash(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const str = JSON.stringify(obj);
  return (
    str.includes('password_hash') ||
    str.includes('"password"') ||
    // bcrypt hashes start with $2b$ or $2a$
    /"\$2[ab]\$\d{2}\$/.test(str)
  );
}

// ─── TEST SUITES ─────────────────────────────────────────────────────────────

async function testRegister() {
  section('A — REGISTER NEW USER  →  expected 201');

  const res = await request('POST', '/api/auth/register', {
    first_name: TEST_FNAME,
    last_name:  TEST_LNAME,
    phone:      TEST_PHONE,
    email:      TEST_EMAIL,
    password:   TEST_PASS,
  });

  assert(res.status === 201, `HTTP 201 received`, `HTTP 201 expected, got ${res.status}`, JSON.stringify(res.body));
  assert(res.body?.user?.id,         'user.id present',         'user.id missing');
  assert(res.body?.user?.email === TEST_EMAIL.toLowerCase(), 'user.email correct', 'user.email wrong', res.body?.user?.email);
  assert(res.body?.user?.first_name === TEST_FNAME,          'user.first_name correct', 'user.first_name wrong');
  assert(res.body?.user?.role === 'CUSTOMER',                'user.role = CUSTOMER',    'user.role wrong', res.body?.user?.role);
  assert(!containsPasswordHash(res.body),                    'password_hash NOT in response', 'password_hash LEAKED in register response');

  if (res.body?.user?.id) createdUserId = res.body.user.id;
}

async function testRegisterDuplicate() {
  section('B — REGISTER DUPLICATE EMAIL  →  expected 409');

  const res = await request('POST', '/api/auth/register', {
    first_name: 'Dupe',
    phone:      TEST_PHONE + '1', // different phone to isolate email check
    email:      TEST_EMAIL,       // same email
    password:   'AnotherPass123',
  });

  assert(res.status === 409, `HTTP 409 received`, `HTTP 409 expected, got ${res.status}`, JSON.stringify(res.body));
  assert(res.body?.message?.toLowerCase().includes('email'), 'message mentions email', 'message unclear', res.body?.message);
}

async function testRegisterDuplicatePhone() {
  section('B2 — REGISTER DUPLICATE PHONE  →  expected 409');

  const res = await request('POST', '/api/auth/register', {
    first_name: 'Dupe',
    phone:      TEST_PHONE,         // same phone
    email:      `other.${TS}@muhanga.test`, // different email
    password:   'AnotherPass123',
  });

  assert(res.status === 409, `HTTP 409 received`, `HTTP 409 expected, got ${res.status}`, JSON.stringify(res.body));
  assert(res.body?.message?.toLowerCase().includes('phone'), 'message mentions phone', 'message unclear', res.body?.message);
}

async function testPasswordHashed() {
  section('C — PASSWORD IS HASHED IN DATABASE  →  bcrypt hash confirmed');

  if (!createdUserId) {
    fail('DB hash check', 'Skipped — user was not created in test A');
    return;
  }

  const result = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`, [createdUserId]
  );

  if (result.rows.length === 0) {
    fail('User found in DB', 'User not found in database');
    return;
  }

  const hash = result.rows[0].password_hash;
  assert(!!hash,                  'password_hash column is set (not NULL)', 'password_hash is NULL');
  assert(/^\$2[ab]\$/.test(hash), 'password_hash is a bcrypt hash',        'password_hash is NOT bcrypt', hash?.slice(0, 10));
  assert(hash !== TEST_PASS,      'plaintext password NOT stored',          'PLAINTEXT PASSWORD STORED — CRITICAL BUG');
}

async function testLogin() {
  section('D — LOGIN CORRECT PASSWORD  →  expected 200 + JWT');

  const res = await request('POST', '/api/auth/login', {
    email:    TEST_EMAIL,
    password: TEST_PASS,
  });

  assert(res.status === 200,      `HTTP 200 received`,        `HTTP 200 expected, got ${res.status}`, JSON.stringify(res.body));
  assert(!!res.body?.token,       'token present in response', 'token MISSING from response');
  assert(!!res.body?.user?.id,    'user object present',       'user object missing');
  assert(res.body?.user?.email === TEST_EMAIL.toLowerCase(), 'user.email correct', 'user.email wrong');
  assert(!containsPasswordHash(res.body), 'password_hash NOT in response', 'password_hash LEAKED in login response');

  if (res.body?.token) validToken = res.body.token;
}

async function testLoginWrongPassword() {
  section('E — LOGIN WRONG PASSWORD  →  expected 401');

  const res = await request('POST', '/api/auth/login', {
    email:    TEST_EMAIL,
    password: 'WrongPassword999',
  });

  assert(res.status === 401, `HTTP 401 received`, `HTTP 401 expected, got ${res.status}`, JSON.stringify(res.body));
  // Must NOT reveal whether email exists
  assert(
    !res.body?.message?.toLowerCase().includes('email not found') &&
    !res.body?.message?.toLowerCase().includes('user not found'),
    'Generic error message (no user enumeration)',
    'Response reveals whether email exists — user enumeration risk',
    res.body?.message
  );
}

async function testJwtStructure() {
  section('F — JWT STRUCTURE  →  3 base64 parts, decodable header+payload');

  if (!validToken) {
    fail('JWT structure check', 'Skipped — no token from test D');
    return;
  }

  const parts = validToken.split('.');
  assert(parts.length === 3, 'JWT has 3 parts (header.payload.signature)', `JWT malformed — ${parts.length} parts`);

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    assert(!!payload.userId, 'payload.userId present', 'payload.userId missing', JSON.stringify(payload));
    assert(!!payload.email,  'payload.email present',  'payload.email missing');
    assert(!!payload.role,   'payload.role present',   'payload.role missing');
    assert(!!payload.exp,    'payload.exp (expiry) present', 'payload.exp missing');
    assert(!payload.password_hash, 'password_hash NOT in JWT payload', 'password_hash in JWT payload — LEAK');
  } catch (e) {
    fail('JWT payload decode', e.message);
  }
}

async function testGetMe() {
  section('G — GET /api/auth/me with valid JWT  →  expected 200');

  if (!validToken) {
    fail('GET /me', 'Skipped — no valid token from test D');
    return;
  }

  const res = await request('GET', '/api/auth/me', null, validToken);

  assert(res.status === 200,       `HTTP 200 received`,         `HTTP 200 expected, got ${res.status}`, JSON.stringify(res.body));
  assert(!!res.body?.user?.id,     'user.id present',           'user.id missing');
  assert(res.body?.user?.email === TEST_EMAIL.toLowerCase(), 'user.email correct', 'user.email wrong');
  assert(!containsPasswordHash(res.body), 'password_hash NOT in /me response', 'password_hash LEAKED in /me response');
}

async function testGetMeNoToken() {
  section('H — GET /api/auth/me without token  →  expected 401');

  const res = await request('GET', '/api/auth/me', null, null);

  assert(res.status === 401, `HTTP 401 received`, `HTTP 401 expected, got ${res.status}`, JSON.stringify(res.body));
}

async function testGetMeInvalidToken() {
  section('I — GET /api/auth/me with invalid JWT  →  expected 401');

  const res = await request('GET', '/api/auth/me', null, 'not.a.real.token');

  assert(res.status === 401, `HTTP 401 received`, `HTTP 401 expected, got ${res.status}`, JSON.stringify(res.body));
}

async function testNoPasswordInAllResponses() {
  section('J — password_hash NEVER returned by any auth endpoint  →  confirmed');

  // Already checked in A, D, G — this is an explicit summary assertion
  console.log('  (Checked individually in tests A, D, G — reporting aggregate)\n');

  // Re-check /me
  if (validToken) {
    const res = await request('GET', '/api/auth/me', null, validToken);
    assert(!containsPasswordHash(res.body), '/api/auth/me: no hash leak', '/api/auth/me LEAKS password_hash');
  }

  // Register response (re-register different user to test)
  const ts2  = Date.now() + 1;
  const res2 = await request('POST', '/api/auth/register', {
    first_name: 'HashCheck',
    phone:      `+2507${String(ts2).slice(-8)}`,
    email:      `hashcheck.${ts2}@muhanga.test`,
    password:   'CheckPass123',
  });
  assert(!containsPasswordHash(res2.body), 'POST /register: no hash leak', 'POST /register LEAKS password_hash');

  // Login response
  const res3 = await request('POST', '/api/auth/login', {
    email:    TEST_EMAIL,
    password: TEST_PASS,
  });
  assert(!containsPasswordHash(res3.body), 'POST /login: no hash leak', 'POST /login LEAKS password_hash');

  // Cleanup the hash-check user from DB
  if (res2.status === 201 && res2.body?.user?.id) {
    await pool.query('DELETE FROM users WHERE id = $1', [res2.body.user.id]).catch(() => {});
  }
}

async function testProductsApi() {
  section('K — GET /api/products still works  →  expected 200');

  const res = await request('GET', '/api/products', null, null);
  assert(res.status === 200,               'HTTP 200 received',           `HTTP 200 expected, got ${res.status}`);
  assert(Array.isArray(res.body?.data || res.body?.products || res.body), 'Response has data/products array', 'Unexpected response shape', JSON.stringify(res.body)?.slice(0,120));
}

async function testCategoriesApi() {
  section('L — GET /api/categories still works  →  expected 200');

  const res = await request('GET', '/api/categories', null, null);
  assert(res.status === 200,               'HTTP 200 received',           `HTTP 200 expected, got ${res.status}`);
  assert(Array.isArray(res.body?.data || res.body?.categories || res.body), 'Response has data/categories array', 'Unexpected response shape', JSON.stringify(res.body)?.slice(0,120));
}

async function testCartApiRegression() {
  section('M — CART API REGRESSION  →  create cart + add item');

  // M1: Create cart
  const c1 = await request('POST', '/api/cart', {
    session_token: `auth-test-regression-${Date.now()}`,
  });
  assert(c1.status === 201 || c1.status === 200, `Cart created (${c1.status})`, `Cart creation failed, got ${c1.status}`, JSON.stringify(c1.body));

  testCartId = c1.body?.id || c1.body?.cart?.id;
  if (!testCartId) {
    fail('Cart ID extracted', 'Could not get cart ID from response: ' + JSON.stringify(c1.body));
    return;
  }

  // M2: Add item (Rice Kigoma 1kg, variant_id = 1)
  const c2 = await request('POST', `/api/cart/${testCartId}/items`, {
    variant_id: 1,
    quantity:   2,
  });
  assert(c2.status === 200, `Add item HTTP 200`, `Add item expected 200, got ${c2.status}`, JSON.stringify(c2.body)?.slice(0, 200));

  if (c2.status === 200) {
    const items = c2.body?.items || [];
    const riceItem = items.find(i => i.variant_id === 1);
    assert(!!riceItem,            'Rice variant in cart items',     'Rice variant missing from items');
    assert(riceItem?.quantity === 2, 'quantity = 2',                `quantity = ${riceItem?.quantity}`);
    assert(riceItem?.unit_price > 0, 'unit_price > 0 (from DB)',   `unit_price = ${riceItem?.unit_price} (expected > 0)`);
    assert(riceItem?.unit_price === 1800, 'unit_price = 1800 (DB price)', `unit_price = ${riceItem?.unit_price}`);
    assert(riceItem?.subtotal === 3600,   'subtotal = 3600 (2 × 1800)',   `subtotal = ${riceItem?.subtotal}`);
  }

  // M3: GET cart
  const c3 = await request('GET', `/api/cart/${testCartId}`);
  assert(c3.status === 200, 'GET cart HTTP 200', `GET cart expected 200, got ${c3.status}`);
  assert((c3.body?.items?.length ?? 0) >= 1, 'Cart has items', 'Cart returned 0 items');

  // Cleanup cart
  if (testCartId) {
    await request('DELETE', `/api/cart/${testCartId}`).catch(() => {});
  }
}

async function testRegistrationValidation() {
  section('A2 — REGISTRATION VALIDATION  →  missing fields = 400');

  // Missing first_name
  const r1 = await request('POST', '/api/auth/register', {
    phone: TEST_PHONE + '99', email: 'x@x.com', password: 'pass1234',
  });
  assert(r1.status === 400, 'Missing first_name → 400', `Expected 400 got ${r1.status}`);

  // Missing phone
  const r2 = await request('POST', '/api/auth/register', {
    first_name: 'X', email: 'x@x.com', password: 'pass1234',
  });
  assert(r2.status === 400, 'Missing phone → 400', `Expected 400 got ${r2.status}`);

  // Invalid email
  const r3 = await request('POST', '/api/auth/register', {
    first_name: 'X', phone: TEST_PHONE + '55', email: 'not-an-email', password: 'pass1234',
  });
  assert(r3.status === 400, 'Invalid email → 400', `Expected 400 got ${r3.status}`);

  // Short password
  const r4 = await request('POST', '/api/auth/register', {
    first_name: 'X', phone: TEST_PHONE + '77', email: 'x2@x.com', password: 'short',
  });
  assert(r4.status === 400, 'Short password → 400', `Expected 400 got ${r4.status}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(65));
  console.log('  MUHANGA MARKETPLACE — AUTH + REGRESSION TESTS');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Test email: ${TEST_EMAIL}`);
  console.log(`  Test phone: ${TEST_PHONE}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═'.repeat(65));

  // Check server is up
  try {
    const health = await request('GET', '/', null, null);
    if (health.status !== 200) throw new Error(`Health check returned ${health.status}`);
    console.log(`\n  ✓ Server is running\n`);
  } catch (e) {
    console.error(`\n  ✗ SERVER NOT REACHABLE at ${BASE_URL}`);
    console.error('    Start the server first: node src/server.js\n');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // Run all tests in sequence
  await testRegistrationValidation();
  await testRegister();
  await testRegisterDuplicate();
  await testRegisterDuplicatePhone();
  await testPasswordHashed();
  await testLogin();
  await testLoginWrongPassword();
  await testJwtStructure();
  await testGetMe();
  await testGetMeNoToken();
  await testGetMeInvalidToken();
  await testNoPasswordInAllResponses();
  await testProductsApi();
  await testCategoriesApi();
  await testCartApiRegression();

  // ── Cleanup test user ───────────────────────────────────────────────────────
  if (createdUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [createdUserId]).catch(() => {});
    console.log(`\n  (Test user ${createdUserId} cleaned up from DB)\n`);
  }

  await pool.end().catch(() => {});

  // ── Final summary ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  RESULTS');
  console.log('═'.repeat(65));
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of failures) {
      console.log(`  ✗ ${f.label}`);
      if (f.detail) console.log(`      ${f.detail}`);
    }
  } else {
    console.log('\n  ✓ ALL TESTS PASSED');
  }

  console.log('═'.repeat(65) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  pool.end().catch(() => {});
  process.exit(1);
});
