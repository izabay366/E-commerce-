/**
 * database.js
 * PostgreSQL connection pool using the `pg` library.
 * All credentials are loaded from environment variables — never hard-coded.
 *
 * Production (Render + Neon): uses DATABASE_URL with SSL enabled.
 * Development (local):        uses individual DB_* vars without SSL.
 */

const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// In production (Render), Neon provides a single DATABASE_URL.
// In development, use individual DB_* environment variables.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
  : {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT, 10),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

// Log which config mode is active (sanitized — never log the full DATABASE_URL)
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  // Show host only, hide password
  const sanitized = url.replace(/:([^:@]+)@/, ':****@');
  console.log('🔌 DB mode: DATABASE_URL →', sanitized);
} else {
  console.log('🔌 DB mode: individual vars → host:', process.env.DB_HOST, 'db:', process.env.DB_NAME);
}

// Test the connection when this module is first loaded
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:');
    console.error('   Code   :', err.code);
    console.error('   Message:', err.message);
    console.error('   Detail :', err.detail || '(none)');
  } else {
    const dbLabel = process.env.DB_NAME || 'Neon (DATABASE_URL)';
    console.log('✅ Connected to PostgreSQL database:', dbLabel);
    release(); // Return the client to the pool
  }
});

module.exports = pool;
