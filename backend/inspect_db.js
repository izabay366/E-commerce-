/**
 * inspect_db.js — ONE-TIME READ-ONLY DATABASE INSPECTION SCRIPT
 * 
 * Purpose: Query the live muhanga_market PostgreSQL database schema.
 * This script ONLY reads from information_schema and pg_* system tables.
 * It does NOT modify any tables, columns, or data.
 * 
 * Run with: node inspect_db.js
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

const TARGET_TABLES = [
  'users', 'carts', 'cart_items', 'orders', 'order_items',
  'payments', 'deliveries', 'cleaning_services', 'cleaners',
  'cleaning_requests', 'service_reviews'
];

async function inspect() {
  const client = await pool.connect();

  try {
    // 1. COLUMNS
    const columns = await client.query(`
      SELECT
        c.table_name,
        c.ordinal_position,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable,
        c.column_default,
        c.udt_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = ANY($1)
      ORDER BY c.table_name, c.ordinal_position
    `, [TARGET_TABLES]);

    // 2. PRIMARY KEYS
    const pks = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name
    `, [TARGET_TABLES]);

    // 3. FOREIGN KEYS
    const fks = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name  AS referenced_table,
        ccu.column_name AS referenced_column,
        tc.constraint_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, kcu.column_name
    `, [TARGET_TABLES]);

    // 4. UNIQUE CONSTRAINTS
    const uniques = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, kcu.column_name
    `, [TARGET_TABLES]);

    // 5. CHECK CONSTRAINTS
    const checks = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, tc.constraint_name
    `, [TARGET_TABLES]);

    // 6. INDEXES
    const indexes = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1)
      ORDER BY tablename, indexname
    `, [TARGET_TABLES]);

    // 7. WHICH TARGET TABLES ACTUALLY EXIST
    const existing = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
      ORDER BY table_name
    `, [TARGET_TABLES]);

    // 8. ROW COUNTS
    const countQueries = existing.rows.map(r =>
      `SELECT '${r.table_name}' AS tbl, COUNT(*)::int AS cnt FROM ${r.table_name}`
    );
    const counts = countQueries.length > 0
      ? await client.query(countQueries.join(' UNION ALL ') + ' ORDER BY tbl')
      : { rows: [] };

    // ── OUTPUT ──────────────────────────────────────────────────────────────
    console.log('\n=== MUHANGA MARKETPLACE — LIVE DB INSPECTION ===\n');
    console.log('Database:', process.env.DB_NAME);
    console.log('Host:    ', process.env.DB_HOST + ':' + process.env.DB_PORT);

    // Tables found
    console.log('\n--- TABLES FOUND ---');
    const foundTables = existing.rows.map(r => r.table_name);
    const missingTables = TARGET_TABLES.filter(t => !foundTables.includes(t));
    console.log('Found   :', foundTables.join(', '));
    console.log('Missing :', missingTables.length > 0 ? missingTables.join(', ') : 'none');

    // Row counts
    console.log('\n--- ROW COUNTS ---');
    counts.rows.forEach(r => console.log(`  ${r.tbl}: ${r.cnt} rows`));

    // Columns per table
    console.log('\n--- COLUMNS ---');
    let currentTable = '';
    columns.rows.forEach(col => {
      if (col.table_name !== currentTable) {
        currentTable = col.table_name;
        console.log(`\n  TABLE: ${currentTable.toUpperCase()}`);
        console.log('  ' + '-'.repeat(60));
      }
      const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
      const def = col.column_default ? ` DEFAULT: ${col.column_default}` : '';
      console.log(`  [${col.ordinal_position}] ${col.column_name} | ${col.data_type} | ${nullable}${def}`);
    });

    // Primary keys
    console.log('\n--- PRIMARY KEYS ---');
    pks.rows.forEach(pk => {
      console.log(`  ${pk.table_name}.${pk.column_name} (${pk.constraint_name})`);
    });

    // Foreign keys
    console.log('\n--- FOREIGN KEYS ---');
    if (fks.rows.length === 0) {
      console.log('  none found');
    } else {
      fks.rows.forEach(fk => {
        console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column} [ON DELETE ${fk.delete_rule}]`);
      });
    }

    // Unique constraints
    console.log('\n--- UNIQUE CONSTRAINTS ---');
    if (uniques.rows.length === 0) {
      console.log('  none found');
    } else {
      uniques.rows.forEach(u => {
        console.log(`  ${u.table_name}.${u.column_name} (${u.constraint_name})`);
      });
    }

    // Check constraints
    console.log('\n--- CHECK CONSTRAINTS ---');
    if (checks.rows.length === 0) {
      console.log('  none found');
    } else {
      checks.rows.forEach(c => {
        console.log(`  ${c.table_name}: ${c.check_clause} (${c.constraint_name})`);
      });
    }

    // Indexes
    console.log('\n--- INDEXES ---');
    if (indexes.rows.length === 0) {
      console.log('  none found');
    } else {
      indexes.rows.forEach(i => {
        console.log(`  ${i.tablename}: ${i.indexname}`);
        console.log(`    ${i.indexdef}`);
      });
    }

    console.log('\n=== INSPECTION COMPLETE ===\n');

  } finally {
    client.release();
    await pool.end();
  }
}

inspect().catch(err => {
  console.error('Inspection failed:', err.message);
  process.exit(1);
});
