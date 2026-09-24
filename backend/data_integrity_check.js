/**
 * data_integrity_check.js
 * ─────────────────────────────────────────────────────────────────────────────
 * READ-ONLY data integrity investigation for Muhanga Marketplace.
 *
 * Investigates:
 *   1. Duplicate product variants (same product + name + unit + price)
 *   2. References to suspect variant IDs (1,2,3,4,5,6) in cart_items / order_items
 *   3. Duplicate parent products
 *   4. Cart data health (orphan cart_items)
 *   5. Final recommendation
 *
 * DOES NOT:
 *   - ALTER any table
 *   - DELETE any row
 *   - UPDATE any row
 *   - INSERT any row
 *
 * Run: node data_integrity_check.js
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

// ─── FORMATTING HELPERS ───────────────────────────────────────────────────────

const SEP  = '─'.repeat(72);
const SEP2 = '═'.repeat(72);

function section(title) {
  console.log('\n' + SEP2);
  console.log('  ' + title);
  console.log(SEP2 + '\n');
}

function subsection(title) {
  console.log('\n  ' + SEP.slice(0, 60));
  console.log('  ' + title);
  console.log('  ' + SEP.slice(0, 60) + '\n');
}

function row(label, value) {
  const padded = String(label).padEnd(38, ' ');
  console.log(`  ${padded} ${value}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();

  try {
    console.log('\n' + SEP2);
    console.log('  MUHANGA MARKETPLACE — DATA INTEGRITY CHECK  (READ-ONLY)');
    console.log('  ' + new Date().toISOString());
    console.log(SEP2);

    // ── 1. CONFIRMED SCHEMA TYPES ──────────────────────────────────────────

    section('STEP 1 — CONFIRMED COLUMN TYPES (live verification)');

    const typeResult = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'carts'               AND column_name = 'id')
          OR (table_name = 'cart_items'       AND column_name IN ('id','cart_id','variant_id'))
          OR (table_name = 'product_variants' AND column_name = 'id')
          OR (table_name = 'order_items'      AND column_name IN ('id','variant_id'))
          OR (table_name = 'products'         AND column_name = 'id')
        )
      ORDER BY table_name, column_name
    `);

    for (const r of typeResult.rows) {
      row(`${r.table_name}.${r.column_name}`, `data_type="${r.data_type}"  udt="${r.udt_name}"  default=${r.column_default || 'none'}`);
    }

    // ── 2. DUPLICATE PRODUCT VARIANTS ─────────────────────────────────────

    section('STEP 2 — DUPLICATE PRODUCT VARIANTS');
    console.log('  Groups: same product_id + variant name + unit + price\n');

    const dupVariants = await client.query(`
      SELECT
        p.id                                    AS product_id,
        p.name                                  AS product_name,
        pv.name                                 AS variant_name,
        pv.unit                                 AS unit,
        pv.price                                AS price,
        COUNT(*)                                AS duplicate_count,
        array_agg(pv.id ORDER BY pv.id)         AS variant_ids,
        array_agg(pv.is_available ORDER BY pv.id) AS availabilities,
        array_agg(pv.stock_quantity ORDER BY pv.id) AS stocks
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      GROUP BY p.id, p.name, pv.name, pv.unit, pv.price
      HAVING COUNT(*) > 1
      ORDER BY p.name, pv.name, pv.price
    `);

    if (dupVariants.rows.length === 0) {
      console.log('  ✓ No duplicate variant groups found.\n');
    } else {
      console.log(`  ⚠  Found ${dupVariants.rows.length} duplicate group(s):\n`);
      for (const g of dupVariants.rows) {
        console.log(`  Group:`);
        row('  product_id', g.product_id);
        row('  product_name', `"${g.product_name}"`);
        row('  variant_name', `"${g.variant_name}"`);
        row('  unit', `"${g.unit}"`);
        row('  price', g.price);
        row('  duplicate_count', g.duplicate_count);
        row('  variant_ids', `[ ${g.variant_ids.join(', ')} ]`);
        row('  is_available', `[ ${g.availabilities.join(', ')} ]`);
        row('  stock_quantity', `[ ${g.stocks.join(', ')} ]`);
        console.log('');
      }
    }

    // ── 3. ALL RICE VARIANTS (IDs 1–6) DETAILED VIEW ──────────────────────

    section('STEP 3 — RICE VARIANT DETAIL (IDs 1, 2, 3, 4, 5, 6)');

    const riceDetail = await client.query(`
      SELECT
        pv.id            AS variant_id,
        p.id             AS product_id,
        p.name           AS product_name,
        pv.name          AS variant_name,
        pv.unit          AS unit,
        pv.price         AS price,
        pv.stock_quantity,
        pv.is_available,
        pv.created_at
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id IN (1, 2, 3, 4, 5, 6)
      ORDER BY pv.id
    `);

    if (riceDetail.rows.length === 0) {
      console.log('  No variants with IDs 1–6 found.\n');
    } else {
      for (const v of riceDetail.rows) {
        console.log(`  Variant ID: ${v.variant_id}`);
        row('    product_id',    v.product_id);
        row('    product_name',  `"${v.product_name}"`);
        row('    variant_name',  `"${v.variant_name}"`);
        row('    unit',          `"${v.unit}"`);
        row('    price',         v.price);
        row('    stock_quantity', v.stock_quantity);
        row('    is_available',  v.is_available);
        row('    created_at',    v.created_at ? v.created_at.toISOString() : 'null');
        console.log('');
      }
    }

    // ── 4. REFERENCES TO VARIANT IDs 1–6 ──────────────────────────────────

    section('STEP 4 — REFERENCES TO VARIANT IDs 1–6');

    subsection('4a. cart_items references');

    // Check if cart_items table exists
    const ciExists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'cart_items'
    `);

    if (ciExists.rows.length === 0) {
      console.log('  cart_items table does not exist.\n');
    } else {
      const ciRefs = await client.query(`
        SELECT
          ci.variant_id,
          COUNT(*)        AS reference_count,
          array_agg(ci.id ORDER BY ci.id) AS cart_item_ids,
          array_agg(DISTINCT ci.cart_id)  AS cart_ids
        FROM cart_items ci
        WHERE ci.variant_id IN (1, 2, 3, 4, 5, 6)
        GROUP BY ci.variant_id
        ORDER BY ci.variant_id
      `);

      // Show zero counts for IDs with no references
      const refMap = {};
      for (const r of ciRefs.rows) refMap[r.variant_id] = r;

      for (const id of [1, 2, 3, 4, 5, 6]) {
        const ref = refMap[id];
        if (ref) {
          row(`  variant_id ${id}`, `${ref.reference_count} cart_item row(s)  [item IDs: ${ref.cart_item_ids.join(', ')}]`);
        } else {
          row(`  variant_id ${id}`, '0 references in cart_items');
        }
      }
      console.log('');
    }

    subsection('4b. order_items references');

    const oiExists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'order_items'
    `);

    if (oiExists.rows.length === 0) {
      console.log('  order_items table does not exist (orders not yet implemented).\n');
    } else {
      // Check if order_items has a variant_id column
      const oiCol = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_items'
          AND column_name = 'variant_id'
      `);

      if (oiCol.rows.length === 0) {
        console.log('  order_items exists but has no variant_id column.\n');
      } else {
        const oiRefs = await client.query(`
          SELECT
            oi.variant_id,
            COUNT(*) AS reference_count,
            array_agg(oi.id ORDER BY oi.id) AS order_item_ids
          FROM order_items oi
          WHERE oi.variant_id IN (1, 2, 3, 4, 5, 6)
          GROUP BY oi.variant_id
          ORDER BY oi.variant_id
        `);

        const oiMap = {};
        for (const r of oiRefs.rows) oiMap[r.variant_id] = r;

        for (const id of [1, 2, 3, 4, 5, 6]) {
          const ref = oiMap[id];
          if (ref) {
            row(`  variant_id ${id}`, `${ref.reference_count} order_item row(s)  [item IDs: ${ref.order_item_ids.join(', ')}]`);
          } else {
            row(`  variant_id ${id}`, '0 references in order_items');
          }
        }
        console.log('');
      }
    }

    // ── 5. DUPLICATE PARENT PRODUCTS ──────────────────────────────────────

    section('STEP 5 — DUPLICATE PARENT PRODUCTS');

    const dupProducts = await client.query(`
      SELECT
        p.name          AS product_name,
        p.category_id,
        COUNT(p.id)     AS product_count,
        array_agg(p.id ORDER BY p.id) AS product_ids,
        array_agg(
          (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id)
          ORDER BY p.id
        ) AS variant_counts
      FROM products p
      GROUP BY p.name, p.category_id
      HAVING COUNT(p.id) > 1
      ORDER BY p.name
    `);

    if (dupProducts.rows.length === 0) {
      console.log('  ✓ No duplicate parent products found.\n');
    } else {
      console.log(`  ⚠  Found ${dupProducts.rows.length} duplicate product group(s):\n`);
      for (const g of dupProducts.rows) {
        console.log(`  Duplicate product:`);
        row('  product_name',   `"${g.product_name}"`);
        row('  category_id',    g.category_id);
        row('  product_count',  g.product_count);
        row('  product_ids',    `[ ${g.product_ids.join(', ')} ]`);
        row('  variant_counts', `[ ${g.variant_counts.join(', ')} ]`);
        console.log('');
      }
    }

    // Full product list
    subsection('All products with variant counts');
    const allProds = await client.query(`
      SELECT
        p.id, p.name, p.category_id,
        COUNT(pv.id) AS variant_count
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      GROUP BY p.id, p.name, p.category_id
      ORDER BY p.name, p.id
    `);
    console.log(`  ${'ID'.padEnd(6)} ${'Category'.padEnd(10)} ${'Variants'.padEnd(10)} Product Name`);
    console.log('  ' + '─'.repeat(60));
    for (const p of allProds.rows) {
      console.log(`  ${String(p.id).padEnd(6)} ${String(p.category_id).padEnd(10)} ${String(p.variant_count).padEnd(10)} "${p.name}"`);
    }
    console.log('');

    // ── 6. CART DATA HEALTH ────────────────────────────────────────────────

    section('STEP 6 — CART DATA HEALTH');

    const cartCount = await client.query(`SELECT COUNT(*) AS n FROM carts`);
    row('Total carts', cartCount.rows[0].n);

    const ciCount = await client.query(`SELECT COUNT(*) AS n FROM cart_items`);
    row('Total cart_items', ciCount.rows[0].n);

    // Orphan cart_items = rows whose cart_id doesn't exist in carts
    const orphanCI = await client.query(`
      SELECT COUNT(*) AS n
      FROM cart_items ci
      WHERE NOT EXISTS (SELECT 1 FROM carts c WHERE c.id = ci.cart_id)
    `);
    row('Orphan cart_items (no parent cart)', orphanCI.rows[0].n);

    // Orphan cart_items = rows whose variant_id doesn't exist in product_variants
    const orphanVariant = await client.query(`
      SELECT COUNT(*) AS n
      FROM cart_items ci
      WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.id = ci.variant_id)
    `);
    row('cart_items with missing variant', orphanVariant.rows[0].n);

    // Carts with items
    const cartsWithItems = await client.query(`
      SELECT COUNT(DISTINCT cart_id) AS n FROM cart_items
    `);
    row('Carts that have at least 1 item', cartsWithItems.rows[0].n);

    // Show all cart_items for full picture
    const allCI = await client.query(`
      SELECT
        ci.id          AS item_id,
        ci.cart_id,
        ci.variant_id,
        ci.quantity,
        ci.unit_price,
        pv.name        AS variant_name,
        p.name         AS product_name
      FROM cart_items ci
      LEFT JOIN product_variants pv ON pv.id = ci.variant_id
      LEFT JOIN products p           ON p.id  = pv.product_id
      ORDER BY ci.id
    `);

    console.log('');
    if (allCI.rows.length === 0) {
      console.log('  cart_items is currently empty.\n');
    } else {
      console.log(`  All cart_items (${allCI.rows.length} row(s)):\n`);
      console.log(`  ${'item_id'.padEnd(10)} ${'cart_id'.padEnd(38)} ${'var_id'.padEnd(8)} ${'qty'.padEnd(5)} ${'unit_price'.padEnd(12)} product / variant`);
      console.log('  ' + '─'.repeat(100));
      for (const ci of allCI.rows) {
        console.log(
          `  ${String(ci.item_id).padEnd(10)} ` +
          `${String(ci.cart_id).padEnd(38)} ` +
          `${String(ci.variant_id).padEnd(8)} ` +
          `${String(ci.quantity).padEnd(5)} ` +
          `${String(ci.unit_price).padEnd(12)} ` +
          `"${ci.product_name || 'N/A'}" / "${ci.variant_name || 'N/A'}"`
        );
      }
      console.log('');
    }

    // ── 7. FINAL RECOMMENDATION ────────────────────────────────────────────

    section('STEP 7 — FINAL RECOMMENDATION');

    console.log('  A. WHICH VARIANTS ARE TRUE DUPLICATES?');
    console.log('  ─────────────────────────────────────────────────────────');
    if (dupVariants.rows.length > 0) {
      for (const g of dupVariants.rows) {
        const ids = g.variant_ids;
        const keep = ids[0];
        const drop = ids.slice(1);
        console.log(`  "${g.product_name}" — "${g.variant_name}" ${g.unit} @ ${g.price}`);
        console.log(`    All IDs    : [ ${ids.join(', ')} ]`);
        console.log(`    Suggested keep : ${keep}  (lowest ID)`);
        console.log(`    Suggested drop : [ ${drop.join(', ')} ]  (pending reference check)`);
        console.log('');
      }
    } else {
      console.log('  No true duplicates detected by (product + name + unit + price).\n');
    }

    console.log('  B. WHICH VARIANTS ARE CURRENTLY REFERENCED?');
    console.log('  ─────────────────────────────────────────────────────────');
    // Summarise from ciRefs above — requery compactly
    const refSummary = await client.query(`
      SELECT
        variant_id,
        COUNT(*) AS total_refs,
        'cart_items' AS source
      FROM cart_items
      WHERE variant_id IN (1,2,3,4,5,6)
      GROUP BY variant_id
      UNION ALL
      SELECT variant_id, COUNT(*), 'order_items'
      FROM order_items
      WHERE variant_id IN (1,2,3,4,5,6)
      GROUP BY variant_id
    `).catch(() => ({ rows: [] }));  // graceful if order_items doesn't exist

    const refsByVar = {};
    for (const r of refSummary.rows) {
      if (!refsByVar[r.variant_id]) refsByVar[r.variant_id] = {};
      refsByVar[r.variant_id][r.source] = parseInt(r.total_refs, 10);
    }

    for (const id of [1, 2, 3, 4, 5, 6]) {
      const refs = refsByVar[id] || {};
      const ci   = refs['cart_items']  || 0;
      const oi   = refs['order_items'] || 0;
      const flag = (ci + oi > 0) ? '  ⚠  REFERENCED' : '  ✓  unreferenced';
      row(`  variant_id ${id}`, `cart_items=${ci}  order_items=${oi}  ${flag}`);
    }
    console.log('');

    console.log('  C. CAN DUPLICATES SAFELY BE CLEANED LATER?');
    console.log('  ─────────────────────────────────────────────────────────');
    console.log('  Rule: A duplicate variant CAN be deleted only if:');
    console.log('    - cart_items reference count = 0');
    console.log('    - order_items reference count = 0');
    console.log('  Referenced duplicates must have cart/order rows migrated');
    console.log('  to the surviving variant ID BEFORE deletion.');
    console.log('  See reference counts in section B above.\n');

    console.log('  D. DATA-INTEGRITY BLOCKERS FOR THE CART API?');
    console.log('  ─────────────────────────────────────────────────────────');
    const orphanCount = parseInt(orphanCI.rows[0].n, 10);
    const missingVarCount = parseInt(orphanVariant.rows[0].n, 10);
    if (orphanCount === 0 && missingVarCount === 0) {
      console.log('  ✓ No orphan cart_items detected.');
      console.log('  ✓ All cart_items.variant_id values resolve to existing product_variants rows.');
      console.log('  ✓ No structural blockers for the Cart API.\n');
    } else {
      if (orphanCount > 0)     console.log(`  ⚠  ${orphanCount} orphan cart_items (cart_id not in carts).`);
      if (missingVarCount > 0) console.log(`  ⚠  ${missingVarCount} cart_items reference a variant_id that no longer exists.`);
      console.log('  These must be resolved before the Cart API can serve affected rows cleanly.\n');
    }

    console.log(SEP2);
    console.log('  INSPECTION COMPLETE — NO DATA WAS MODIFIED.');
    console.log(SEP2 + '\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  console.error(err.stack);
  pool.end().catch(() => {});
  process.exit(1);
});
