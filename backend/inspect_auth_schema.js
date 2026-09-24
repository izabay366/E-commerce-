/**
 * inspect_auth_schema.js  —  READ-ONLY
 * Inspects: users table, carts table, orders table, all constraints/indexes.
 * Run: node inspect_auth_schema.js
 */
'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT,10),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});
const S2 = '═'.repeat(70);
const S1 = '─'.repeat(70);
function sec(t) { console.log(`\n${S2}\n  ${t}\n${S2}\n`); }
function sub(t) { console.log(`\n  ${S1.slice(0,55)}\n  ${t}\n  ${S1.slice(0,55)}\n`); }

async function inspectTable(client, tableName) {
  sub(`TABLE: ${tableName.toUpperCase()}`);

  // Columns
  const cols = await client.query(`
    SELECT ordinal_position, column_name, data_type, udt_name,
           numeric_precision, numeric_scale, character_maximum_length,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position`, [tableName]);

  if (cols.rows.length === 0) {
    console.log(`  ⚠  Table "${tableName}" does not exist or has no columns.\n`);
    return;
  }

  console.log(`  ${'#'.padEnd(4)}${'column_name'.padEnd(24)}${'data_type'.padEnd(16)}${'udt'.padEnd(12)}${'prec'.padEnd(6)}${'scale'.padEnd(7)}${'null?'.padEnd(7)} default`);
  console.log('  ' + '─'.repeat(90));
  for (const c of cols.rows) {
    console.log(
      `  ${String(c.ordinal_position).padEnd(4)}` +
      `${String(c.column_name).padEnd(24)}` +
      `${String(c.data_type).padEnd(16)}` +
      `${String(c.udt_name).padEnd(12)}` +
      `${String(c.numeric_precision ?? '').padEnd(6)}` +
      `${String(c.numeric_scale ?? '').padEnd(7)}` +
      `${String(c.is_nullable).padEnd(7)}` +
      `${c.column_default ?? 'none'}`
    );
  }

  // Constraints
  console.log('');
  const cons = await client.query(`
    SELECT tc.constraint_name, tc.constraint_type,
           kcu.column_name, kcu.ordinal_position,
           ccu.table_name AS ref_table, ccu.column_name AS ref_col,
           rc.delete_rule, rc.update_rule,
           cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
    LEFT JOIN information_schema.referential_constraints rc
      ON tc.constraint_name=rc.constraint_name AND tc.table_schema=rc.constraint_schema
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name=cc.constraint_name AND tc.table_schema=cc.constraint_schema
    WHERE tc.table_schema='public' AND tc.table_name=$1
    ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position`,
    [tableName]);

  const seen = new Set();
  for (const c of cons.rows) {
    const key = `${c.constraint_name}:${c.column_name}`;
    if (seen.has(key)) continue; seen.add(key);
    const ref  = c.ref_table  ? ` → ${c.ref_table}.${c.ref_col}`         : '';
    const del  = c.delete_rule ? ` [ON DELETE ${c.delete_rule}]`           : '';
    const chk  = c.check_clause ? ` (${c.check_clause})`                   : '';
    console.log(`  [${String(c.constraint_type).padEnd(12)}] ${c.constraint_name}  col="${c.column_name}"${ref}${del}${chk}`);
  }

  // Indexes
  console.log('');
  const idxs = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`,
    [tableName]);
  for (const i of idxs.rows) {
    console.log(`  [INDEX] ${i.indexname}`);
    console.log(`          ${i.indexdef}`);
  }
  console.log('');
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n${S2}`);
    console.log('  AUTH SCHEMA INSPECTION  (READ-ONLY)');
    console.log(`  ${new Date().toISOString()}`);
    console.log(S2);

    sec('CORE TABLES');
    for (const t of ['users','carts','cart_items','orders','order_items']) {
      await inspectTable(client, t);
    }

    sec('ALL PUBLIC TABLES IN DATABASE');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name`);
    for (const r of tables.rows) console.log(`  ${r.table_name}`);

    sec('ROW COUNTS');
    for (const t of ['users','carts','cart_items','orders','order_items','products','product_variants','categories']) {
      const r = await client.query(`SELECT COUNT(*) AS n FROM ${t}`).catch(()=>({rows:[{n:'TABLE NOT FOUND'}]}));
      console.log(`  ${t.padEnd(22)} ${r.rows[0].n}`);
    }

    sec('EXISTING FKs REFERENCING users.id');
    const fkRefs = await client.query(`
      SELECT tc.table_name, kcu.column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
        AND ccu.table_name='users' AND ccu.column_name='id'
      ORDER BY tc.table_name`);
    if (fkRefs.rows.length === 0) console.log('  No FKs reference users.id yet.');
    for (const r of fkRefs.rows) {
      console.log(`  ${r.table_name}.${r.column_name} → users.id  [ON DELETE ${r.delete_rule}]`);
    }

    console.log(`\n${S2}\n  INSPECTION COMPLETE — NO DATA MODIFIED.\n${S2}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
