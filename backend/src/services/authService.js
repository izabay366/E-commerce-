/**
 * authService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All PostgreSQL queries for authentication.
 *
 * Live schema (users table):
 *   id            UUID    PK   DEFAULT gen_random_uuid()
 *   first_name    VARCHAR      NOT NULL
 *   last_name     VARCHAR      nullable
 *   phone         VARCHAR      NOT NULL  UNIQUE
 *   email         VARCHAR      nullable  UNIQUE
 *   password_hash TEXT         nullable  (always set via register; NULL = social/guest)
 *   role          VARCHAR      NOT NULL  DEFAULT 'CUSTOMER'  CHECK IN ('CUSTOMER','ADMIN')
 *   created_at    TIMESTAMP    NOT NULL  DEFAULT CURRENT_TIMESTAMP
 *   updated_at    TIMESTAMP    NOT NULL  DEFAULT CURRENT_TIMESTAMP
 *
 * Security:
 *   - password_hash is ONLY returned by findUserByEmailWithHash() — used
 *     exclusively inside authController for bcrypt comparison, then discarded.
 *   - All other functions select columns explicitly, excluding password_hash.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const pool = require('../config/database');

// ─── SAFE COLUMNS (never includes password_hash) ──────────────────────────────

const SAFE_USER_COLS =
  'id, first_name, last_name, phone, email, role, created_at, updated_at';

// ─── findUserByEmail ──────────────────────────────────────────────────────────

/**
 * Returns safe user fields (NO password_hash) for a given email.
 * Used to check if email already exists during registration.
 *
 * @param {string} email
 * @returns {object|null}
 */
const findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT ${SAFE_USER_COLS} FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
};

// ─── findUserByEmailWithHash ──────────────────────────────────────────────────

/**
 * Returns user row INCLUDING password_hash for bcrypt comparison.
 * ONLY called inside authController.login — hash is never forwarded to client.
 *
 * @param {string} email
 * @returns {object|null}  includes password_hash
 */
const findUserByEmailWithHash = async (email) => {
  const result = await pool.query(
    `SELECT id, first_name, last_name, phone, email, password_hash, role, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return result.rows[0] || null;
};

// ─── findUserByPhone ──────────────────────────────────────────────────────────

/**
 * Returns true if a user with this phone already exists.
 * Used for duplicate-phone check during registration.
 *
 * @param {string} phone
 * @returns {boolean}
 */
const phoneExists = async (phone) => {
  const result = await pool.query(
    `SELECT 1 FROM users WHERE phone = $1`,
    [phone.trim()]
  );
  return result.rows.length > 0;
};

// ─── findUserById ─────────────────────────────────────────────────────────────

/**
 * Returns safe user fields for a given UUID.
 * Used by GET /api/auth/me.
 *
 * @param {string} userId - UUID
 * @returns {object|null}
 */
const findUserById = async (userId) => {
  const result = await pool.query(
    `SELECT ${SAFE_USER_COLS} FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

// ─── createUser ───────────────────────────────────────────────────────────────

/**
 * Inserts a new user row and returns safe user fields.
 * password_hash must already be bcrypt-hashed by the controller.
 * role defaults to 'CUSTOMER' in the database — not passed here.
 *
 * @param {{ first_name: string, last_name: string|null, phone: string,
 *            email: string, password_hash: string }} data
 * @returns {object} Safe user row (no password_hash)
 * @throws PostgreSQL error 23505 if email or phone already exists (unique violation)
 */
const createUser = async ({ first_name, last_name, phone, email, password_hash }) => {
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, phone, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SAFE_USER_COLS}`,
    [
      first_name.trim(),
      last_name ? last_name.trim() : null,
      phone.trim(),
      email.toLowerCase().trim(),
      password_hash,
    ]
  );
  return result.rows[0];
};

// ─── getAllUsers ──────────────────────────────────────────────────────────────

/**
 * Returns all users (safe fields only, no password_hash), newest first.
 * Used by the admin "Customers" list.
 *
 * @returns {object[]}
 */
const getAllUsers = async () => {
  const result = await pool.query(
    `SELECT ${SAFE_USER_COLS} FROM users ORDER BY created_at DESC`
  );
  return result.rows;
};

// ─── deleteUser ───────────────────────────────────────────────────────────────

/**
 * Permanently deletes a user by id. There's no is_active/soft-delete column
 * on this table (unlike products/categories), so this is a hard delete.
 * Returns true if a row was actually removed, false if the id didn't exist.
 *
 * @param {string} userId - UUID
 * @returns {boolean}
 */
const deleteUser = async (userId) => {
  const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
  return result.rows.length > 0;
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  findUserByEmail,
  findUserByEmailWithHash,
  phoneExists,
  findUserById,
  createUser,
  getAllUsers,
  deleteUser,
};
