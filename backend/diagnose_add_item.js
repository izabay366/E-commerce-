/**
 * diagnose_add_item.js
 * ─────────────────────────────────────────────────────────────────────────────
 * READ-ONLY + ROLLBACK-ONLY diagnosis for the Cart API 500 error.
 *
 * Investigates:
 *   1. All column types on cart_items (every column, not just IDs)
 *   2. All constraints on cart_items (PK, FK, UNIQUE, CHECK, NOT NULL)
 *   3. All indexes on cart_items
 *   4. Whether the UNIQUE(cart_id, variant_id) constraint exists
 *   5. Whether the ON CONFLICT clause matches an actual constraint
 *   6. Live simulation of the failing INSERT — inside a ROLLBACK transaction
 *      to capture the exact PostgreSQL error without persisting data
 *   7. State of the test cart used by run_cart_tests.js
 *   8. quantity column type (INTEGER vs NUMERIC — affects + arithmetic)
 *
 * DOES NOT persist any changes. All INSERT attempts use ROLLBACK.
 * Run: node diagnose_add_item.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

const SEP  = '─'.repeat(72);
const SEP2 = '═'.repeat(72);
function section(t) { console.log(`\n${SEP2}\n  ${t}\n${SEP2}\n`); }
function sub(t)     { console.log(`\n  ${SEP.slice(0,60)}\n  ${t}\n  ${SEP.slice(0,60)}\n`); }
function row(l, v)  { console.log(`  ${String(l).padEnd(42)} ${v}`); }
function ok(m)      { console.log(`  ✓  ${m}`); }
function warn(m)    { console.log(`  ⚠  ${m}`); }
function err(m)     { console.log(`  ✗  ${m}`); }

async function main() {
  const client = await pool.connect();

  try {
    console.log(`\n${SEP2}`);
    console.log('  MUHANGA MARKETPLACE — ADD-ITEM 500 DIAGNOSIS  (READ-ONLY + ROLLBACK)');
    console.log(`  ${new Date().toISOString()}`);
    console.log(`${SEP2}`);

    // ── 1. ALL COLUMNS ON cart_items ─────────────────────────────────────────

    section('1 — FULL COLUMN DETAILS: cart_items');

    const cols = await client.query(`
      SELECT
        ordinal_position,
        column_name,
        data_type,
        udt_name,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'cart_items'
      ORDER BY ordinal_position
    `);

    console.log(`  ${'#'.padEnd(4)} ${'column_name'.padEnd(16)} ${'data_type'.padEnd(14)} ${'udt'.padEnd(10)} ${'prec'.padEnd(6)} ${'scale'.padEnd(6)} ${'nullable'.padEnd(10)} default`);
    console.log('  ' + SEP);
    for (const c of cols.rows) {
      console.log(
        `  ${String(c.ordinal_position).padEnd(4)} ` +
        `${String(c.column_name).padEnd(16)} ` +
        `${String(c.data_type).padEnd(14)} ` +
        `${String(c.udt_name).padEnd(10)} ` +
        `${String(c.numeric_precision || '').padEnd(6)} ` +
        `${String(c.numeric_scale    || '').padEnd(6)} ` +
        `${String(c.is_nullable).padEnd(10)} ` +
        `${c.column_default || 'none'}`
      );
    }

    // Specific check on quantity
    const qtyCol = cols.rows.find(c => c.column_name === 'quantity');
    if (qtyCol) {
      console.log(`\n  quantity column detail:`);
      row('    data_type',       qtyCol.data_type);
      row('    udt_name',        qtyCol.udt_name);
      row('    numeric_scale',   qtyCol.numeric_scale ?? 'null');
      row('    numeric_precision', qtyCol.numeric_precision ?? 'null');
      row('    is_nullable',     qtyCol.is_nullable);

      if (qtyCol.data_type === 'numeric' || qtyCol.data_type === 'decimal') {
        warn('quantity is NUMERIC/DECIMAL — arithmetic with JS integer may return NUMERIC.');
        warn('existingItem.rows[0].quantity is a string from pg driver (e.g. "1.000").');
        warn('"1.000" + 2  =  "1.0002"  (string concat, not numeric add!) — BUG RISK.');
      } else if (qtyCol.data_type === 'integer') {
        ok('quantity is INTEGER — arithmetic is safe.');
      } else {
        warn(`quantity is ${qtyCol.data_type} — check arithmetic behaviour.`);
      }
    } else {
      err('quantity column NOT FOUND on cart_items!');
    }

    // ── 2. ALL CONSTRAINTS ON cart_items ─────────────────────────────────────

    section('2 — ALL CONSTRAINTS: cart_items');

    const constraints = await client.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name  AS references_table,
        ccu.column_name AS references_column,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema   = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema   = ccu.table_schema
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema   = rc.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name   = 'cart_items'
      ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position
    `);

    for (const c of constraints.rows) {
      const ref = c.references_table ? ` → ${c.references_table}.${c.references_column}` : '';
      const del = c.delete_rule ? ` [ON DELETE ${c.delete_rule}]` : '';
      console.log(`  [${c.constraint_type.padEnd(11)}] ${c.constraint_name}  col="${c.column_name}"${ref}${del}`);
    }

    // Critical: does UNIQUE(cart_id, variant_id) exist?
    const uniqueOnConflict = constraints.rows.filter(c =>
      c.constraint_type === 'UNIQUE' &&
      (c.column_name === 'cart_id' || c.column_name === 'variant_id')
    );
    console.log('');
    if (uniqueOnConflict.length >= 2) {
      ok('UNIQUE constraint covering cart_id + variant_id EXISTS → ON CONFLICT is valid.');
    } else if (uniqueOnConflict.length > 0) {
      warn(`Only ${uniqueOnConflict.length} of 2 needed UNIQUE columns found — check constraint.`);
    } else {
      err('NO UNIQUE constraint on (cart_id, variant_id) found!');
      err('ON CONFLICT (cart_id, variant_id) in addItemToCart WILL FAIL with:');
      err('  ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification');
    }

    // ── 3. ALL INDEXES ON cart_items ─────────────────────────────────────────

    section('3 — ALL INDEXES: cart_items');

    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename  = 'cart_items'
      ORDER BY indexname
    `);

    if (indexes.rows.length === 0) {
      warn('No indexes found on cart_items.');
    } else {
      for (const idx of indexes.rows) {
        console.log(`  Index: ${idx.indexname}`);
        console.log(`    ${idx.indexdef}`);
        console.log('');
      }
    }

    // Check for unique index (alternative to constraint)
    const hasUniqueIndex = indexes.rows.some(i =>
      i.indexdef.toLowerCase().includes('unique') &&
      i.indexdef.toLowerCase().includes('cart_id') &&
      i.indexdef.toLowerCase().includes('variant_id')
    );
    if (hasUniqueIndex) {
      ok('Unique index on (cart_id, variant_id) found — ON CONFLICT will work via index.');
    } else if (uniqueOnConflict.length < 2) {
      err('No unique index OR unique constraint on (cart_id, variant_id).');
      err('This is the root cause of the HTTP 500.');
    }

    // ── 4. CHECK CONSTRAINTS ──────────────────────────────────────────────────

    section('4 — CHECK CONSTRAINTS: cart_items');

    const checks = await client.query(`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name  = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name   = 'cart_items'
        AND tc.constraint_type = 'CHECK'
    `);

    if (checks.rows.length === 0) {
      console.log('  No CHECK constraints on cart_items.\n');
    } else {
      for (const c of checks.rows) {
        console.log(`  [CHECK] ${c.constraint_name}: ${c.check_clause}`);
      }
      console.log('');
    }

    // ── 5. LIVE SIMULATION — INSERT WITH ROLLBACK ─────────────────────────────

    section('5 — LIVE INSERT SIMULATION (transaction + ROLLBACK — no data persisted)');

    // Use a known valid cart ID from the database
    const testCartQ = await client.query(`SELECT id FROM carts LIMIT 1`);
    if (testCartQ.rows.length === 0) {
      warn('No carts in database — cannot simulate INSERT.');
    } else {
      const testCartId = testCartQ.rows[0].id;
      const testVariantId = 1;  // Rice (Kigoma) 1kg — confirmed to exist
      const testQuantity  = 2;
      const testUnitPrice = 1800.00;

      console.log(`  Simulating: INSERT INTO cart_items`);
      row('  cart_id (UUID)',     testCartId);
      row('  variant_id (INT)',   testVariantId);
      row('  quantity (INT)',     testQuantity);
      row('  unit_price (DEC)',   testUnitPrice);
      console.log('');

      // Simulation A: bare INSERT (no ON CONFLICT)
      sub('5a — Bare INSERT (no ON CONFLICT)');
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [testCartId, testVariantId, testQuantity, testUnitPrice]
        );
        await client.query('ROLLBACK');
        ok('Bare INSERT succeeded then ROLLED BACK — schema accepts (cart_id, variant_id, quantity, unit_price).');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        err(`Bare INSERT failed: ${e.message}`);
        row('  PG error code', e.code || 'none');
        row('  PG detail',     e.detail || 'none');
        row('  PG hint',       e.hint   || 'none');
      }

      // Simulation B: ON CONFLICT INSERT
      sub('5b — ON CONFLICT (cart_id, variant_id) INSERT');
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (cart_id, variant_id)
           DO UPDATE SET
             quantity   = EXCLUDED.quantity,
             unit_price = EXCLUDED.unit_price,
             updated_at = NOW()`,
          [testCartId, testVariantId, testQuantity, testUnitPrice]
        );
        await client.query('ROLLBACK');
        ok('ON CONFLICT INSERT succeeded then ROLLED BACK — constraint exists and is valid.');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        err(`ON CONFLICT INSERT failed: ${e.message}`);
        row('  PG error code', e.code || 'none');
        row('  PG detail',     e.detail || 'none');
        row('  PG hint',       e.hint   || 'none');
        row('  PG constraint', e.constraint || 'none');
        if (e.code === '42P10') {
          err('ERROR CODE 42P10 = invalid_column_reference');
          err('Root cause: ON CONFLICT (cart_id, variant_id) references columns');
          err('that do NOT have a matching UNIQUE constraint or unique index.');
        }
      }

      // Simulation C: quantity arithmetic (NUMERIC vs INTEGER issue)
      sub('5c — quantity arithmetic type check');
      const existQ = await client.query(
        `SELECT id, quantity, pg_typeof(quantity) AS qty_type FROM cart_items LIMIT 1`
      );
      if (existQ.rows.length > 0) {
        const r = existQ.rows[0];
        row('  quantity value from DB',  r.quantity);
        row('  typeof in PostgreSQL',    r.qty_type);
        row('  typeof in JS',            typeof r.quantity);
        row('  JS value',               JSON.stringify(r.quantity));

        const jsQty = r.quantity;
        const added = jsQty + 2;
        row('  jsQty + 2 result',        JSON.stringify(added));
        row('  typeof result',           typeof added);

        if (typeof jsQty === 'string') {
          err(`quantity arrives in JS as a STRING ("${jsQty}"), not a number.`);
          err(`"${jsQty}" + 2 = "${jsQty}2"  (string concatenation — WRONG!)`);
          err('Fix: use parseInt(existingItem.rows[0].quantity, 10) before arithmetic.');
        } else {
          ok(`quantity arrives in JS as ${typeof jsQty} — arithmetic is safe.`);
        }
      } else {
        console.log('  No cart_items rows to test (empty table).\n');
        // Still check pg_typeof from a literal
        const typeQ = await client.query(`
          SELECT pg_typeof(quantity) AS qty_type
          FROM cart_items
          LIMIT 1
        `).catch(() => null);
        if (typeQ && typeQ.rows.length > 0) {
          row('  pg_typeof(quantity)', typeQ.rows[0].qty_type);
        }
      }
    }

    // ── 6. TEST CART EXISTENCE CHECK ──────────────────────────────────────────

    section('6 — TEST CART STATE');

    // The cart created by run_cart_tests.js (from last run output)
    // Also check generically
    const testCartIds = [
      '2559f339-6af3-4031-a7cb-f4c1e807e879',  // specified in task
      'dd015314-0279-46d5-8210-99a1e551337f',  // from data_integrity_check output
    ];

    for (const cid of testCartIds) {
      const cr = await client.query(
        `SELECT id, session_token, created_at FROM carts WHERE id = $1`, [cid]
      );
      if (cr.rows.length > 0) {
        ok(`Cart ${cid} EXISTS`);
        row('  session_token', cr.rows[0].session_token);
        const items = await client.query(
          `SELECT id, variant_id, quantity, unit_price FROM cart_items WHERE cart_id = $1`, [cid]
        );
        row('  cart_items count', items.rows.length);
        for (const i of items.rows) {
          console.log(`  item_id=${i.id}  variant_id=${i.variant_id}  qty=${i.quantity}  price=${i.unit_price}`);
        }
      } else {
        warn(`Cart ${cid} does NOT exist in database.`);
      }
      console.log('');
    }

    // ── 7. ALL CARTS SUMMARY ──────────────────────────────────────────────────

    section('7 — ALL CARTS IN DATABASE');

    const allCarts = await client.query(
      `SELECT id, session_token, created_at FROM carts ORDER BY created_at DESC`
    );
    row('Total carts', allCarts.rows.length);
    for (const c of allCarts.rows) {
      console.log(`  ${c.id}  session="${c.session_token}"  created=${c.created_at?.toISOString()}`);
    }

    // ── 8. COMPLETE SQL TRACE ─────────────────────────────────────────────────

    section('8 — EXACT SQL STATEMENTS USED BY addItemToCart');

    console.log('  Statement 1 (cart exists check):');
    console.log('    SELECT id, user_id, session_token FROM carts WHERE id = $1 FOR UPDATE');
    console.log('    params: [cartId:UUID]');
    console.log('');
    console.log('  Statement 2 (variant fetch + price):');
    console.log('    SELECT id, price, stock_quantity, is_available');
    console.log('    FROM product_variants WHERE id = $1');
    console.log('    params: [variantId:INTEGER]');
    console.log('');
    console.log('  Statement 3 (existing item check):');
    console.log('    SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2');
    console.log('    params: [cartId:UUID, variantId:INTEGER]');
    console.log('');
    console.log('  Statement 4 (upsert — THE FAILING STATEMENT):');
    console.log('    INSERT INTO cart_items (cart_id, variant_id, quantity, unit_price)');
    console.log('    VALUES ($1, $2, $3, $4)');
    console.log('    ON CONFLICT (cart_id, variant_id)   ← REQUIRES UNIQUE CONSTRAINT');
    console.log('    DO UPDATE SET quantity=EXCLUDED.quantity, unit_price=EXCLUDED.unit_price, updated_at=NOW()');
    console.log('    params: [cartId:UUID, variantId:INTEGER, newQuantity:number, unitPrice:float]');
    console.log('');
    console.log('  RISK: existingItem.rows[0].quantity is returned by pg driver.');
    console.log('  If quantity column is NUMERIC, pg returns it as a JS string.');
    console.log('  Then: string + integer = string concatenation → wrong newQuantity value.');

    // ── 9. SUMMARY ────────────────────────────────────────────────────────────

    section('9 — ROOT CAUSE SUMMARY');

    const hasUniq = uniqueOnConflict.length >= 2 || hasUniqueIndex;

    if (!hasUniq) {
      err('ROOT CAUSE A: ON CONFLICT clause has no matching UNIQUE constraint/index.');
      err('  cartService.js line ~245: ON CONFLICT (cart_id, variant_id)');
      err('  PostgreSQL error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"');
      err('  Fix option 1 (preferred): ALTER TABLE cart_items ADD CONSTRAINT ...');
      err('    — BUT user said DO NOT ALTER SCHEMA.');
      err('  Fix option 2: Replace ON CONFLICT with explicit SELECT → INSERT or UPDATE.');
      console.log('');
    } else {
      ok('UNIQUE constraint or index on (cart_id, variant_id) is present.');
    }

    if (qtyCol && (qtyCol.data_type === 'numeric' || qtyCol.data_type === 'decimal')) {
      err('ROOT CAUSE B: quantity is NUMERIC — pg driver returns it as JS string.');
      err('  existingItem.rows[0].quantity is a string, e.g. "1.000"');
      err('  "1.000" + 2 = "1.0002" (string concat) → inserted as invalid quantity.');
      err('  Fix: parseInt(existingItem.rows[0].quantity, 10)');
      console.log('');
    }

    console.log(SEP2);
    console.log('  DIAGNOSIS COMPLETE — NO DATA WAS MODIFIED.');
    console.log(SEP2 + '\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error('\nFATAL:', e.message, e.stack);
  pool.end().catch(() => {});
  process.exit(1);
});
