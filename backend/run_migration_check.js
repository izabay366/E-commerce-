/**
 * run_migration_check.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Checks whether the Phase 3 cleaning_migration.sql columns and indexes exist
 * in the live PostgreSQL database. Applies the migration if anything is missing.
 *
 * Usage (from the backend/ directory):
 *   node run_migration_check.js
 *
 * Exit codes:
 *   0 — all required columns and indexes are present
 *   1 — something is still missing, or a fatal error occurred
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Load .env from the same directory as this script (backend/.env).
// Explicit path so the script works regardless of the cwd it is invoked from.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');

// ─── Database connection ──────────────────────────────────────────────────────
// Mirror the same variable names used by src/config/database.js
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME     || 'muhanga_market',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

// ─── What must exist after the migration ─────────────────────────────────────
const REQUIRED_COLUMNS = [
  { table: 'cleaning_services', column: 'is_active'  },
  { table: 'cleaners',          column: 'is_active'  },
  { table: 'cleaning_requests', column: 'notes'      },
  { table: 'cleaning_requests', column: 'user_id'    },
  { table: 'cleaning_requests', column: 'updated_at' },
];

const REQUIRED_INDEXES = [
  'idx_cleaning_requests_user_id',
  'idx_cleaning_requests_service_id',
  'idx_cleaning_requests_status',
  'idx_cleaning_requests_cleaner_id',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function header(title) {
  const line = '═'.repeat(60);
  console.log(`\n${line}\n  ${title}\n${line}\n`);
}

/**
 * Returns two Sets: cols (table.column keys) and idx (index names).
 */
async function queryState(client) {
  const colRes = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_name  IN ('cleaning_services', 'cleaners', 'cleaning_requests')
      AND column_name IN ('is_active', 'notes', 'user_id', 'updated_at')
  `);

  const idxRes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE indexname = ANY($1::text[])
  `, [REQUIRED_INDEXES]);

  return {
    cols: new Set(colRes.rows.map(r => `${r.table_name}.${r.column_name}`)),
    idx:  new Set(idxRes.rows.map(r => r.indexname)),
  };
}

/**
 * Prints pass/fail for every required column and index.
 * Returns { missingCols[], missingIdx[] }.
 */
function printState(state) {
  const missingCols = [];
  const missingIdx  = [];

  for (const { table, column } of REQUIRED_COLUMNS) {
    const key = `${table}.${column}`;
    if (state.cols.has(key)) {
      console.log(`  ✓  column  ${key}`);
    } else {
      console.log(`  ✗  MISSING column  ${key}`);
      missingCols.push(key);
    }
  }

  for (const idx of REQUIRED_INDEXES) {
    if (state.idx.has(idx)) {
      console.log(`  ✓  index   ${idx}`);
    } else {
      console.log(`  ✗  MISSING index   ${idx}`);
      missingIdx.push(idx);
    }
  }

  return { missingCols, missingIdx };
}

/**
 * Parses the migration SQL into individual executable statements.
 *
 * WHY NOT split(';').filter(s => !s.startsWith('--'))?
 *   After splitting on ';', each chunk may BEGIN with comment lines
 *   such as "-- ─── cleaning_services ...\nALTER TABLE ...".
 *   Calling startsWith('--') on the full chunk falsely matches and
 *   DISCARDS the valid ALTER TABLE statement inside it.
 *
 * CORRECT APPROACH:
 *   1. Strip ALL single-line comment text (-- ... to end of line) from
 *      the source first, leaving the actual SQL intact.
 *   2. Strip block comments if any.
 *   3. Split on semicolons.
 *   4. Trim whitespace and discard empty strings.
 */
function parseSqlStatements(sql) {
  // Remove every single-line comment (-- to end of line)
  let stripped = sql.replace(/--[^\n]*/g, '');

  // Remove block comments /* ... */ (non-greedy, handles multi-line)
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');

  return stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nCleaning Services — Phase 3 Migration Checker');
  console.log(
    `DB: ${process.env.DB_NAME || 'muhanga_market'} ` +
    `@ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5433'}`
  );

  const client = await pool.connect();

  try {
    // ── BEFORE ────────────────────────────────────────────────────────────────
    header('BEFORE — current database state');
    const before = await queryState(client);
    const { missingCols, missingIdx } = printState(before);

    if (missingCols.length === 0 && missingIdx.length === 0) {
      header('FINAL RESULT');
      console.log('✅  Migration already fully applied. Nothing to do.\n');
      console.log('    The Cleaning Services module is ready to use.\n');
      client.release();
      await pool.end();
      process.exit(0);
    }

    console.log(
      `\n  → ${missingCols.length} column(s) and ` +
      `${missingIdx.length} index(es) need to be added.`
    );

    // ── MIGRATION ─────────────────────────────────────────────────────────────
    header('MIGRATION — applying cleaning_migration.sql');

    const migrationPath = path.join(__dirname, '..', 'database', 'cleaning_migration.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const rawSql      = fs.readFileSync(migrationPath, 'utf8');
    const statements  = parseSqlStatements(rawSql);

    console.log(`  Parsed ${statements.length} statement(s) from migration file.\n`);

    // Wrap in a transaction so a partial failure rolls back cleanly
    await client.query('BEGIN');

    try {
      for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);

        try {
          await client.query(stmt);
          console.log(`  ✓  ${preview}`);
        } catch (stmtErr) {
          // IF NOT EXISTS guards make duplicates safe — log as warning, not error
          if (/already exists/i.test(stmtErr.message)) {
            console.log(`  ⚠  already exists (safe) — ${preview}`);
          } else {
            // Any unexpected error is fatal — rollback immediately
            console.error(`\n  ✗  ERROR executing statement:`);
            console.error(`     SQL : ${preview}`);
            console.error(`     PG  : ${stmtErr.message}`);
            await client.query('ROLLBACK');
            console.error('\n  Transaction rolled back.\n');
            client.release();
            await pool.end();
            process.exit(1);
          }
        }
      }

      await client.query('COMMIT');
      console.log('\n  Transaction committed.\n');

    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    }

    // ── AFTER ─────────────────────────────────────────────────────────────────
    header('AFTER — verifying database state');
    const after = await queryState(client);
    const { missingCols: stillMissingCols, missingIdx: stillMissingIdx } = printState(after);

    // ── FINAL RESULT ──────────────────────────────────────────────────────────
    header('FINAL RESULT');

    const allPresent = stillMissingCols.length === 0 && stillMissingIdx.length === 0;

    if (allPresent) {
      console.log('✅  All required columns and indexes are now present.');
      console.log('    The Cleaning Services module is ready to use.\n');
    } else {
      console.log('❌  Migration incomplete. Items still missing:');
      for (const c of stillMissingCols) console.log(`     column : ${c}`);
      for (const i of stillMissingIdx)  console.log(`     index  : ${i}`);
      console.log('\n    Review the errors above and rerun.\n');
    }

    client.release();
    await pool.end();
    process.exit(allPresent ? 0 : 1);

  } catch (fatalErr) {
    console.error('\n❌  Fatal error:', fatalErr.message);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

main();

