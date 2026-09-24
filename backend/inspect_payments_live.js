/**
 * inspect_payments_live.js
 * Queries live DB to reveal actual payments + orders + deliveries schema.
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

async function main() {
  const client = await pool.connect();
  try {
    const TABLES = ['payments', 'orders', 'deliveries', 'users'];

    // 1. Columns
    for (const tbl of TABLES) {
      const r = await client.query(`
        SELECT ordinal_position, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`, [tbl]);
      console.log(`\n=== TABLE: ${tbl.toUpperCase()} ===`);
      r.rows.forEach(c =>
        console.log(`  [${c.ordinal_position}] ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default || 'none'}`)
      );
    }

    // 2. Check constraints on payments + orders
    for (const tbl of ['payments', 'orders']) {
      const r = await client.query(`
        SELECT tc.constraint_name, cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc
          ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
        WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public' AND tc.table_name = $1`, [tbl]);
      console.log(`\n=== CHECK CONSTRAINTS on ${tbl.toUpperCase()} ===`);
      if (r.rows.length === 0) console.log('  (none)');
      else r.rows.forEach(c => console.log(`  ${c.constraint_name}: ${c.check_clause}`));
    }

    // 3. Unique constraints
    for (const tbl of ['payments']) {
      const r = await client.query(`
        SELECT tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public' AND tc.table_name = $1`, [tbl]);
      console.log(`\n=== UNIQUE CONSTRAINTS on ${tbl.toUpperCase()} ===`);
      if (r.rows.length === 0) console.log('  (none)');
      else r.rows.forEach(u => console.log(`  ${u.constraint_name}: ${u.column_name}`));
    }

    // 4. Row counts
    console.log('\n=== ROW COUNTS ===');
    for (const tbl of TABLES) {
      const r = await client.query(`SELECT COUNT(*) FROM ${tbl}`);
      console.log(`  ${tbl}: ${r.rows[0].count} rows`);
    }

    // 5. Sample payment row if any
    const sample = await client.query(`SELECT * FROM payments LIMIT 2`);
    console.log('\n=== SAMPLE PAYMENTS ROWS ===');
    if (sample.rows.length === 0) console.log('  (empty table)');
    else sample.rows.forEach(r => console.log(' ', JSON.stringify(r)));

    // 6. Users role values
    const roles = await client.query(`SELECT DISTINCT role FROM users`);
    console.log('\n=== DISTINCT user.role VALUES ===');
    roles.rows.forEach(r => console.log(' ', r.role));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
