/**
 * run_cleaning_tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3 — Cleaning Services module test suite.
 *
 * Tests:
 *   A  GET /api/cleaning-services → 200 (public, no auth)
 *   B  GET /api/cleaning-services/:id — valid UUID → 200 or 404
 *   C  GET /api/cleaning-services/:id — invalid UUID → 400
 *   D  GET /api/cleaning-services/admin — no auth → 401
 *   E  GET /api/cleaning-services/admin — customer token → 403
 *   F  GET /api/cleaning-services/admin — admin token → 200
 *   G  POST /api/cleaning-services — admin create service → 201
 *   H  POST /api/cleaning-services — missing name → 400
 *   I  PATCH /api/cleaning-services/:id — admin update → 200
 *   J  GET /api/cleaners — no auth → 401
 *   K  GET /api/cleaners — customer token → 403
 *   L  GET /api/cleaners — admin token → 200
 *   M  POST /api/cleaners — admin create cleaner → 201
 *   N  POST /api/cleaners — invalid status → 400
 *   O  POST /api/cleaning-requests — no auth → 401
 *   P  POST /api/cleaning-requests — valid (authenticated) → 201
 *   Q  POST /api/cleaning-requests — missing required fields → 400
 *   R  GET /api/cleaning-requests/mine — customer → 200
 *   S  GET /api/cleaning-requests — customer → 403
 *   T  GET /api/cleaning-requests — admin → 200
 *   U  GET /api/cleaning-requests/:id — owner → 200
 *   V  GET /api/cleaning-requests/:id — different customer → 403
 *   W  PATCH /api/cleaning-requests/:id — admin update status → 200
 *   X  PATCH /api/cleaning-requests/:id — invalid status → 400
 *   Y  PATCH /api/cleaning-requests/:id/cancel — owner cancels PENDING → 200
 *   Z  PATCH /api/cleaning-requests/:id/cancel — non-owner → 403
 *   AA DELETE /api/cleaning-services/:id — admin deletes test service → 200
 *
 * Run: node run_cleaning_tests.js
 * Server must be running on port 5000.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const http  = require('http');
const { Pool } = require('pg');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

// ─── UNIQUE TEST DATA ────────────────────────────────────────────────────────

const TS          = Date.now();
const CUST_EMAIL  = `cleaning.cust.${TS}@muhanga.test`;
const CUST_PHONE  = `+2507${String(TS).slice(-8)}`;
const CUST2_EMAIL = `cleaning.cust2.${TS}@muhanga.test`;
const CUST2_PHONE = `+2507${String(TS + 1).slice(-8)}`;
const TEST_PASS   = 'CleanTest#2026';

// ─── TEST STATE ──────────────────────────────────────────────────────────────

let adminToken    = null;
let custToken     = null;
let cust2Token    = null;
let custUserId    = null;
let cust2UserId   = null;
let testServiceId = null;
let testCleanerId = null;
let testRequestId = null;

// ─── RUNNER ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function pass(label) { console.log(`  ✓  ${label}`); passed++; }
function fail(label, detail) {
  console.log(`  ✗  ${label}`);
  if (detail) console.log(`       → ${detail}`);
  failed++;
  failures.push({ label, detail });
}
function section(title) {
  console.log(`\n${'═'.repeat(65)}\n  ${title}\n${'═'.repeat(65)}\n`);
}
function assert(cond, okLabel, errLabel, detail) {
  if (cond) pass(okLabel); else fail(errLabel, detail);
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

// ─── SETUP: GET ADMIN TOKEN + CREATE TEST CUSTOMERS ──────────────────────────

async function setup() {
  section('SETUP — Admin login + create test customer accounts');

  // Login as admin (requires an ADMIN user to exist in DB)
  const adminLogin = await request('POST', '/api/auth/login', {
    email:    process.env.ADMIN_EMAIL || 'admin@muhanga.test',
    password: process.env.ADMIN_PASS  || 'Admin#2026',
  });
  if (adminLogin.status === 200 && adminLogin.body?.token) {
    adminToken = adminLogin.body.token;
    pass('Admin login → 200 + token');
  } else {
    fail('Admin login', `status=${adminLogin.status} — set ADMIN_EMAIL/ADMIN_PASS in .env or create an admin user. Msg: ${adminLogin.body?.message}`);
    console.log('  ⚠  Admin token unavailable — admin-only tests will report 401/403 as failures.');
  }

  // Register customer 1
  const r1 = await request('POST', '/api/auth/register', {
    first_name: 'Clean', last_name: 'Tester',
    phone: CUST_PHONE, email: CUST_EMAIL, password: TEST_PASS,
  });
  if (r1.status === 201) {
    custUserId = r1.body?.user?.id;
    const login1 = await request('POST', '/api/auth/login', { email: CUST_EMAIL, password: TEST_PASS });
    custToken = login1.body?.token;
    pass('Customer 1 registered + logged in');
  } else {
    fail('Customer 1 register', JSON.stringify(r1.body));
  }

  // Register customer 2
  const r2 = await request('POST', '/api/auth/register', {
    first_name: 'Other', last_name: 'Customer',
    phone: CUST2_PHONE, email: CUST2_EMAIL, password: TEST_PASS,
  });
  if (r2.status === 201) {
    cust2UserId = r2.body?.user?.id;
    const login2 = await request('POST', '/api/auth/login', { email: CUST2_EMAIL, password: TEST_PASS });
    cust2Token = login2.body?.token;
    pass('Customer 2 registered + logged in');
  } else {
    fail('Customer 2 register', JSON.stringify(r2.body));
  }
}

// ─── CLEANING SERVICES ────────────────────────────────────────────────────────

async function testPublicServices() {
  section('A — GET /api/cleaning-services (public, no auth) → 200');
  const res = await request('GET', '/api/cleaning-services');
  assert(res.status === 200, 'HTTP 200', `HTTP 200 expected, got ${res.status}`);
  assert(res.body?.success === true, 'success=true', 'success flag missing');
  assert(Array.isArray(res.body?.data), 'data is array', 'data is not array', JSON.stringify(res.body)?.slice(0,100));
}

async function testGetServiceById() {
  section('B/C — GET /api/cleaning-services/:id — valid/invalid UUIDs');

  // Valid UUID (even if no service exists yet)
  const fakeId = '00000000-0000-0000-0000-000000000001';
  const r1 = await request('GET', `/api/cleaning-services/${fakeId}`);
  assert(r1.status === 404 || r1.status === 200, 'Valid UUID → 200 or 404', `Got ${r1.status}`);

  // Invalid UUID
  const r2 = await request('GET', '/api/cleaning-services/not-a-uuid');
  assert(r2.status === 400, 'Invalid UUID → 400', `Expected 400, got ${r2.status}`, JSON.stringify(r2.body));
}

async function testAdminServicesAuth() {
  section('D/E/F — /api/cleaning-services/admin — auth checks');

  const r1 = await request('GET', '/api/cleaning-services/admin');
  assert(r1.status === 401, 'No auth → 401', `Expected 401, got ${r1.status}`);

  if (custToken) {
    const r2 = await request('GET', '/api/cleaning-services/admin', null, custToken);
    assert(r2.status === 403, 'Customer token → 403', `Expected 403, got ${r2.status}`);
  }

  if (adminToken) {
    const r3 = await request('GET', '/api/cleaning-services/admin', null, adminToken);
    assert(r3.status === 200, 'Admin token → 200', `Expected 200, got ${r3.status}`, JSON.stringify(r3.body)?.slice(0,200));
    assert(Array.isArray(r3.body?.data), 'data is array', 'data is not array');
  }
}

async function testCreateService() {
  section('G/H — POST /api/cleaning-services — create + validation');

  if (!adminToken) {
    fail('Create service', 'Skipped — no admin token');
    return;
  }

  // G: valid creation
  const r1 = await request('POST', '/api/cleaning-services', {
    name: `Test Cleaning Service ${TS}`,
    description: 'Phase 3 test service',
    base_price: 5000,
    estimated_duration: '2 hours',
  }, adminToken);
  assert(r1.status === 201, 'Service created → 201', `Expected 201, got ${r1.status}`, JSON.stringify(r1.body));
  if (r1.body?.data?.id) {
    testServiceId = r1.body.data.id;
    pass(`Service ID captured: ${testServiceId.slice(0, 8)}...`);
  }

  // H: missing name
  const r2 = await request('POST', '/api/cleaning-services', {
    base_price: 3000,
  }, adminToken);
  assert(r2.status === 400, 'Missing name → 400', `Expected 400, got ${r2.status}`);
}

async function testUpdateService() {
  section('I — PATCH /api/cleaning-services/:id — admin update');

  if (!adminToken || !testServiceId) {
    fail('Update service', 'Skipped — no admin token or service ID');
    return;
  }

  const res = await request('PATCH', `/api/cleaning-services/${testServiceId}`, {
    base_price: 6000,
    estimated_duration: '3 hours',
  }, adminToken);
  assert(res.status === 200, 'Update → 200', `Expected 200, got ${res.status}`, JSON.stringify(res.body));
  assert(res.body?.data?.base_price === 6000, 'base_price updated to 6000', `Got ${res.body?.data?.base_price}`);
}

// ─── CLEANERS ─────────────────────────────────────────────────────────────────

async function testCleanerAuth() {
  section('J/K/L — /api/cleaners — auth checks');

  const r1 = await request('GET', '/api/cleaners');
  assert(r1.status === 401, 'No auth → 401', `Expected 401, got ${r1.status}`);

  if (custToken) {
    const r2 = await request('GET', '/api/cleaners', null, custToken);
    assert(r2.status === 403, 'Customer → 403', `Expected 403, got ${r2.status}`);
  }

  if (adminToken) {
    const r3 = await request('GET', '/api/cleaners', null, adminToken);
    assert(r3.status === 200, 'Admin → 200', `Expected 200, got ${r3.status}`);
    assert(Array.isArray(r3.body?.data), 'data is array', 'not array');
  }
}

async function testCreateCleaner() {
  section('M/N — POST /api/cleaners — create + invalid status');

  if (!adminToken) {
    fail('Create cleaner', 'Skipped — no admin token');
    return;
  }

  // M: valid
  const r1 = await request('POST', '/api/cleaners', {
    name: `Test Cleaner ${TS}`,
    phone: `+25078${String(TS).slice(-7)}`,
    address: 'Muhanga Town',
    status: 'AVAILABLE',
  }, adminToken);
  assert(r1.status === 201, 'Cleaner created → 201', `Expected 201, got ${r1.status}`, JSON.stringify(r1.body));
  if (r1.body?.data?.id) testCleanerId = r1.body.data.id;

  // N: invalid status
  const r2 = await request('POST', '/api/cleaners', {
    name: 'Invalid Status Cleaner',
    phone: '+250788999999',
    status: 'DANCING',
  }, adminToken);
  assert(r2.status === 400, 'Invalid status → 400', `Expected 400, got ${r2.status}`);
}

// ─── CLEANING REQUESTS ────────────────────────────────────────────────────────

async function testRequestAuth() {
  section('O — POST /api/cleaning-requests — no auth → 401');

  const res = await request('POST', '/api/cleaning-requests', {
    customer_name: 'Guest',
    customer_phone: '+250788000000',
    service_id: testServiceId || '00000000-0000-0000-0000-000000000001',
    location: 'Muhanga',
  });
  assert(res.status === 401, 'No auth → 401', `Expected 401, got ${res.status}`);
}

async function testCreateRequest() {
  section('P — POST /api/cleaning-requests — valid authenticated → 201');

  if (!custToken || !testServiceId) {
    fail('Create request', 'Skipped — need customer token + service ID');
    return;
  }

  const res = await request('POST', '/api/cleaning-requests', {
    customer_name:  'Clean Tester',
    customer_phone: CUST_PHONE,
    service_id:     testServiceId,
    location:       'Muhanga, near the market',
    preferred_date: '2026-10-01',
    preferred_time: '09:00',
    notes:          'Please bring own equipment',
  }, custToken);

  assert(res.status === 201, 'Request created → 201', `Expected 201, got ${res.status}`, JSON.stringify(res.body));
  assert(res.body?.data?.id, 'request.id present', 'request.id missing');
  assert(res.body?.data?.status === 'PENDING', 'status = PENDING', `status = ${res.body?.data?.status}`);
  assert(res.body?.data?.user_id === custUserId, 'user_id matches customer', `user_id = ${res.body?.data?.user_id}`);
  assert(res.body?.data?.price !== undefined, 'price snapshotted from service', 'price missing');

  if (res.body?.data?.id) testRequestId = res.body.data.id;
}

async function testCreateRequestValidation() {
  section('Q — POST /api/cleaning-requests — missing required fields → 400');

  if (!custToken) {
    fail('Request validation', 'Skipped — no customer token');
    return;
  }

  // Missing location
  const r1 = await request('POST', '/api/cleaning-requests', {
    customer_name: 'Test',
    customer_phone: CUST_PHONE,
    service_id: testServiceId || '00000000-0000-0000-0000-000000000001',
    // location missing
  }, custToken);
  assert(r1.status === 400, 'Missing location → 400', `Expected 400, got ${r1.status}`);

  // Missing service_id
  const r2 = await request('POST', '/api/cleaning-requests', {
    customer_name: 'Test',
    customer_phone: CUST_PHONE,
    location: 'Muhanga',
  }, custToken);
  assert(r2.status === 400, 'Missing service_id → 400', `Expected 400, got ${r2.status}`);
}

async function testGetMyRequests() {
  section('R — GET /api/cleaning-requests/mine — customer → 200');

  if (!custToken) {
    fail('Get mine', 'Skipped — no customer token');
    return;
  }

  const res = await request('GET', '/api/cleaning-requests/mine', null, custToken);
  assert(res.status === 200, 'HTTP 200', `Expected 200, got ${res.status}`, JSON.stringify(res.body));
  assert(Array.isArray(res.body?.data), 'data is array', 'not array');
  if (testRequestId) {
    const found = res.body.data.find(r => r.id === testRequestId);
    assert(!!found, 'Test request appears in my list', 'Test request NOT in my list');
  }
}

async function testCustomerCannotSeeAllRequests() {
  section('S — GET /api/cleaning-requests — customer → 403');

  if (!custToken) {
    fail('Customer all requests', 'Skipped — no customer token');
    return;
  }

  const res = await request('GET', '/api/cleaning-requests', null, custToken);
  assert(res.status === 403, 'Customer → 403', `Expected 403, got ${res.status}`);
}

async function testAdminGetAllRequests() {
  section('T — GET /api/cleaning-requests — admin → 200');

  if (!adminToken) {
    fail('Admin all requests', 'Skipped — no admin token');
    return;
  }

  const res = await request('GET', '/api/cleaning-requests', null, adminToken);
  assert(res.status === 200, 'Admin → 200', `Expected 200, got ${res.status}`);
  assert(Array.isArray(res.body?.data), 'data is array', 'not array');
}

async function testGetRequestOwner() {
  section('U/V — GET /api/cleaning-requests/:id — owner vs different customer');

  if (!testRequestId) {
    fail('Request ownership', 'Skipped — no test request ID');
    return;
  }

  // U: owner can see
  if (custToken) {
    const r1 = await request('GET', `/api/cleaning-requests/${testRequestId}`, null, custToken);
    assert(r1.status === 200, 'Owner → 200', `Expected 200, got ${r1.status}`, JSON.stringify(r1.body));
  }

  // V: different customer → 403
  if (cust2Token) {
    const r2 = await request('GET', `/api/cleaning-requests/${testRequestId}`, null, cust2Token);
    assert(r2.status === 403, 'Non-owner → 403', `Expected 403, got ${r2.status}`);
  }
}

async function testAdminUpdateRequest() {
  section('W/X — PATCH /api/cleaning-requests/:id — admin update status + invalid status');

  if (!adminToken || !testRequestId) {
    fail('Admin update request', 'Skipped — no admin token or request ID');
    return;
  }

  // W: valid status update
  const r1 = await request('PATCH', `/api/cleaning-requests/${testRequestId}`, {
    status: 'CONFIRMED',
    cleaner_id: testCleanerId || null,
  }, adminToken);
  assert(r1.status === 200, 'Admin update → 200', `Expected 200, got ${r1.status}`, JSON.stringify(r1.body));
  assert(r1.body?.data?.status === 'CONFIRMED', 'Status updated to CONFIRMED', `Status = ${r1.body?.data?.status}`);

  // X: invalid status
  const r2 = await request('PATCH', `/api/cleaning-requests/${testRequestId}`, {
    status: 'FLYING',
  }, adminToken);
  assert(r2.status === 400, 'Invalid status → 400', `Expected 400, got ${r2.status}`);
}

async function testCancelRequest() {
  section('Y/Z — PATCH /api/cleaning-requests/:id/cancel — owner + non-owner');

  // Create a fresh PENDING request for cancellation test
  let cancelId = null;
  if (custToken && testServiceId) {
    const cr = await request('POST', '/api/cleaning-requests', {
      customer_name: 'Cancel Test',
      customer_phone: CUST_PHONE,
      service_id: testServiceId,
      location: 'Muhanga',
    }, custToken);
    if (cr.status === 201) cancelId = cr.body.data.id;
  }

  if (!cancelId) {
    fail('Cancel setup', 'Could not create request to cancel');
    return;
  }

  // Z: non-owner (cust2) tries to cancel
  if (cust2Token) {
    const r1 = await request('PATCH', `/api/cleaning-requests/${cancelId}/cancel`, null, cust2Token);
    assert(r1.status === 403, 'Non-owner cancel → 403', `Expected 403, got ${r1.status}`);
  }

  // Y: owner cancels
  if (custToken) {
    const r2 = await request('PATCH', `/api/cleaning-requests/${cancelId}/cancel`, null, custToken);
    assert(r2.status === 200, 'Owner cancel → 200', `Expected 200, got ${r2.status}`, JSON.stringify(r2.body));
    assert(r2.body?.data?.status === 'CANCELLED', 'Status = CANCELLED', `Status = ${r2.body?.data?.status}`);
  }

  // Y2: cannot cancel again (already cancelled)
  if (custToken && cancelId) {
    const r3 = await request('PATCH', `/api/cleaning-requests/${cancelId}/cancel`, null, custToken);
    assert(r3.status === 409, 'Already cancelled → 409', `Expected 409, got ${r3.status}`);
  }
}

async function testDeleteService() {
  section('AA — DELETE /api/cleaning-services/:id — admin cleanup test data');

  if (!adminToken || !testServiceId) {
    fail('Delete service', 'Skipped — no admin token or service ID');
    return;
  }

  const res = await request('DELETE', `/api/cleaning-services/${testServiceId}`, null, adminToken);
  // May return 200 (deleted) or 409 (requests exist referencing it)
  assert(
    res.status === 200 || res.status === 409,
    `Service delete → ${res.status} (200=deleted, 409=has requests)`,
    `Expected 200 or 409, got ${res.status}`,
    JSON.stringify(res.body)
  );
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────

async function cleanup() {
  // Remove all cleaning_requests created by our test users
  if (custUserId) {
    await pool.query('DELETE FROM cleaning_requests WHERE user_id = $1', [custUserId]).catch(() => {});
  }
  if (cust2UserId) {
    await pool.query('DELETE FROM cleaning_requests WHERE user_id = $1', [cust2UserId]).catch(() => {});
  }

  // Delete test service (if not already deleted)
  if (testServiceId) {
    await pool.query('DELETE FROM cleaning_services WHERE id = $1', [testServiceId]).catch(() => {});
  }

  // Delete test cleaner
  if (testCleanerId) {
    await pool.query('DELETE FROM cleaners WHERE id = $1', [testCleanerId]).catch(() => {});
  }

  // Delete test users
  if (custUserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [custUserId]).catch(() => {});
  }
  if (cust2UserId) {
    await pool.query('DELETE FROM users WHERE id = $1', [cust2UserId]).catch(() => {});
  }

  console.log('\n  (Test data cleaned up from DB)');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(65));
  console.log('  MUHANGA MARKETPLACE — CLEANING SERVICES TEST SUITE');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('═'.repeat(65));

  // Health check
  try {
    const health = await request('GET', '/', null, null);
    if (health.status !== 200) throw new Error(`Health check returned ${health.status}`);
    console.log('\n  ✓ Server is running\n');
  } catch (e) {
    console.error(`\n  ✗ SERVER NOT REACHABLE at ${BASE_URL}`);
    console.error('    Start the server first: node src/server.js\n');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  await setup();

  await testPublicServices();
  await testGetServiceById();
  await testAdminServicesAuth();
  await testCreateService();
  await testUpdateService();
  await testCleanerAuth();
  await testCreateCleaner();
  await testRequestAuth();
  await testCreateRequest();
  await testCreateRequestValidation();
  await testGetMyRequests();
  await testCustomerCannotSeeAllRequests();
  await testAdminGetAllRequests();
  await testGetRequestOwner();
  await testAdminUpdateRequest();
  await testCancelRequest();
  await testDeleteService();

  await cleanup();
  await pool.end().catch(() => {});

  // Summary
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
