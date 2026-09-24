/**
 * run-catalog-migration.js
 * Runs catalog-migration.sql against the database using the same
 * connection config the app already uses (backend/src/config/database.js).
 *
 * Usage (from the backend folder):
 *   node run-catalog-migration.js
 */

'use strict';

// Load environment variables FIRST, before requiring the database pool —
// same order server.js uses. Without this, DB_PASSWORD etc. come through
// as undefined and the connection fails.
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('./src/config/database');

const SQL_FILE = path.join(__dirname, 'catalog-migration.sql');

async function run() {
  console.log(`Reading ${SQL_FILE} ...`);
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Running migration inside a transaction...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration committed successfully.\n');

    // ── Run the validation queries and print results ──────────────────
    const categories = await client.query(
      `SELECT COUNT(*) AS total_categories FROM categories WHERE is_active = TRUE`
    );
    console.log('Total active categories:', categories.rows[0].total_categories, '(expected 20)');

    const products = await client.query(`SELECT COUNT(*) AS total_products FROM products`);
    console.log('Total products:', products.rows[0].total_products, '(expected 137)');

    const nil = await client.query(
      `SELECT id, name, is_available FROM products WHERE id = 45`
    );
    console.log('NIL row:', nil.rows[0]);

    const newOnes = await client.query(
      `SELECT COUNT(*) AS new_count FROM products p
       JOIN product_variants pv ON pv.product_id = p.id
       WHERE pv.price = 0 AND pv.stock_quantity = 0`
    );
    console.log('New placeholder products awaiting pricing:', newOnes.rows[0].new_count, '(expected 91)');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed — rolled back, nothing was changed.');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
