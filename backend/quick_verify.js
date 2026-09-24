/**
 * quick_verify.js
 * Quick smoke test of the new GET /api/payments endpoint.
 * Run with server running: node quick_verify.js
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

const PORT = parseInt(process.env.PORT || '5000', 10);

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = http.request({ hostname: 'localhost', port: PORT, path, method, headers }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        let json = null; try { json = JSON.parse(d); } catch(_) {}
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function main() {
  const TS = Date.now();
  
  // 1. Register admin
  const reg = await req('POST', '/api/auth/register', {
    first_name: 'VerifyAdmin', phone: `+25078${String(TS).slice(-7)}`,
    email: `verify.admin.${TS}@muhanga.test`, password: 'AdminPass#2026'
  });
  if (reg.status !== 201) { console.error('Registration failed', reg.body); process.exit(1); }
  const adminId = reg.body.user.id;
  await pool.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [adminId]);
  const login = await req('POST', '/api/auth/login', { email: `verify.admin.${TS}@muhanga.test`, password: 'AdminPass#2026' });
  const adminToken = login.body.token;
  console.log('✓ Admin token obtained');

  // 2. Register customer
  const reg2 = await req('POST', '/api/auth/register', {
    first_name: 'VerifyCust', phone: `+25078${String(TS+1).slice(-7)}`,
    email: `verify.cust.${TS}@muhanga.test`, password: 'CustPass#2026'
  });
  const login2 = await req('POST', '/api/auth/login', { email: `verify.cust.${TS}@muhanga.test`, password: 'CustPass#2026' });
  const custToken = login2.body.token;

  // 3. Test GET /api/payments — no auth → 401
  const r401 = await req('GET', '/api/payments');
  console.log(`GET /api/payments (no auth): ${r401.status === 401 ? '✓ 401' : '✗ Got '+r401.status}`);

  // 4. Test GET /api/payments — customer → 403
  const r403 = await req('GET', '/api/payments', null, custToken);
  console.log(`GET /api/payments (customer): ${r403.status === 403 ? '✓ 403' : '✗ Got '+r403.status}`);

  // 5. Test GET /api/payments — admin → 200
  const r200 = await req('GET', '/api/payments', null, adminToken);
  console.log(`GET /api/payments (admin): ${r200.status === 200 ? '✓ 200' : '✗ Got '+r200.status} | count=${r200.body?.count} data=${Array.isArray(r200.body?.data)}`);

  // 6. Test ?status=PENDING
  const rPending = await req('GET', '/api/payments?status=PENDING', null, adminToken);
  console.log(`GET /api/payments?status=PENDING: ${rPending.status === 200 ? '✓ 200' : '✗ Got '+rPending.status}`);
  
  // 7. Test ?status=INVALID → 400
  const rBad = await req('GET', '/api/payments?status=INVALID', null, adminToken);
  console.log(`GET /api/payments?status=INVALID: ${rBad.status === 400 ? '✓ 400' : '✗ Got '+rBad.status}`);

  // 8. Test ?method=CASH_ON_DELIVERY
  const rCOD = await req('GET', '/api/payments?method=CASH_ON_DELIVERY', null, adminToken);
  console.log(`GET /api/payments?method=CASH_ON_DELIVERY: ${rCOD.status === 200 ? '✓ 200' : '✗ Got '+rCOD.status}`);

  // 9. Test ?method=BITCOIN → 400
  const rBadM = await req('GET', '/api/payments?method=BITCOIN', null, adminToken);
  console.log(`GET /api/payments?method=BITCOIN: ${rBadM.status === 400 ? '✓ 400' : '✗ Got '+rBadM.status}`);

  // 10. Inspect a sample payment if any exist
  if (r200.body?.data?.length > 0) {
    const sample = r200.body.data[0];
    console.log('\nSample payment item:');
    console.log('  id:', sample.id?.slice(0, 8));
    console.log('  order_id:', sample.order_id?.slice(0, 8));
    console.log('  method:', sample.method);
    console.log('  amount:', sample.amount, '(type:', typeof sample.amount + ')');
    console.log('  status:', sample.status);
    console.log('  order_status:', sample.order_status);
    console.log('  customer.name:', sample.customer?.name);
    console.log('  customer.phone:', sample.customer?.phone);
    console.log('  customer.email:', sample.customer?.email);
  }

  // Cleanup
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, reg2.body.user.id]).catch(() => {});
  await pool.end();
  console.log('\n✓ Verification complete');
}

main().catch(e => { console.error('FATAL:', e.message); pool.end(); process.exit(1); });
