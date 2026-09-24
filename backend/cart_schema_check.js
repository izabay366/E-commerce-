/**
 * cart_schema_check.js — Read-only schema and data inspection for Cart API correction.
 *
 * Queries:
 *   1. Exact data types for: carts.id, cart_items.id, cart_items.cart_id,
 *      cart_items.variant_id, product_variants.id
 *   2. A sample of real product_variants rows (with product name) to find Rice 1kg
 *
 * Does NOT modify any data.
 * Run with: node cart_schema_check.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {

    // ── 1. Exact column types for the four critical columns ─────────────────
    console.log('\n=== CRITICAL COLUMN DATA TYPES ===\n');

    const typeCheck = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'carts'            AND column_name = 'id')
          OR (table_name = 'cart_items'    AND column_name IN ('id','cart_id','variant_id'))
          OR (table_name = 'product_variants' AND column_name = 'id')
        )
      ORDER BY table_name, column_name
    `);

    typeCheck.rows.forEach(r => {
      console.log(
        `  ${r.table_name}.${r.column_name}` +
        `  =>  data_type: "${r.data_type}"` +
        `  udt_name: "${r.udt_name}"` +
        `  nullable: ${r.is_nullable}` +
        `  default: ${r.column_default || 'none'}`
      );
    });

    // ── 2. FK constraint details for cart_items.variant_id ──────────────────
    console.log('\n=== FOREIGN KEY: cart_items.variant_id ===\n');

    const fkCheck = await client.query(`
      SELECT
        kcu.column_name,
        ccu.table_name  AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'cart_items'
        AND kcu.column_name = 'variant_id'
    `);

    fkCheck.rows.forEach(r => {
      console.log(`  cart_items.${r.column_name}  →  ${r.referenced_table}.${r.referenced_column}`);
    });

    // ── 3. Real product variants — find Rice (Kigoma) 1kg ───────────────────
    console.log('\n=== REAL PRODUCT VARIANTS (all, ordered by product name) ===\n');

    const variants = await client.query(`
      SELECT
        pv.id            AS variant_id,
        p.name           AS product_name,
        pv.name          AS variant_name,
        pv.unit          AS unit,
        pv.price         AS price,
        pv.stock_quantity AS stock_quantity,
        pv.is_available  AS is_available
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ORDER BY p.name, pv.price
    `);

    variants.rows.forEach(r => {
      console.log(
        `  variant_id: ${r.variant_id}` +
        `  |  product: "${r.product_name}"` +
        `  |  variant: "${r.variant_name}"` +
        `  |  unit: "${r.unit}"` +
        `  |  price: ${r.price}` +
        `  |  stock: ${r.stock_quantity}` +
        `  |  available: ${r.is_available}`
      );
    });

    // ── 4. Specifically Rice (Kigoma) variants ───────────────────────────────
    console.log('\n=== RICE (KIGOMA) VARIANTS ONLY ===\n');

    const rice = await client.query(`
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
      console.log('  No Rice (Kigoma) product found — listing all products:');
      const prods = await client.query(`SELECT id, name FROM products ORDER BY name`);
      prods.rows.forEach(r => console.log(`    id: ${r.id}  name: "${r.name}"`));
    } else {
      rice.rows.forEach(r => {
        console.log(
          `  variant_id: ${r.variant_id}` +
          `  |  "${r.product_name}"  "${r.variant_name}"` +
          `  |  price: ${r.price}` +
          `  |  stock: ${r.stock_quantity}` +
          `  |  available: ${r.is_available}`
        );
      });
    }

    console.log('\n=== INSPECTION COMPLETE ===\n');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
