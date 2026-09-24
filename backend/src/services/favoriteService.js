/**
 * favoriteService.js
 * All SQL queries related to a customer's saved/favorited products.
 *
 * favorites:
 *   id (UUID), user_id (UUID FK -> users.id), product_id (INTEGER FK -> products.id),
 *   created_at. UNIQUE (user_id, product_id) — a product can only be favorited once per user.
 */

const pool = require('../config/database');

// ─── GET FAVORITES FOR A USER ───────────────────────────────────────────

/**
 * Returns all favorited products for a user, with product details joined in.
 * @param {string} userId - UUID
 */
const getFavoritesByUser = async (userId) => {
  const result = await pool.query(
    `SELECT
       f.id          AS favorite_id,
       f.created_at  AS favorited_at,
       p.id          AS product_id,
       p.name        AS name,
       p.description AS description,
       p.image_url   AS image_url,
       c.name        AS category
     FROM favorites f
     JOIN products p   ON p.id = f.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
};

// ─── ADD FAVORITE ────────────────────────────────────────────────────────

/**
 * Adds a product to a user's favorites. Safe to call if it already exists
 * (ON CONFLICT DO NOTHING) — won't throw a duplicate-key error.
 * @param {string} userId - UUID
 * @param {number} productId - INTEGER
 * @returns {object} The favorite row (existing or newly created).
 */
const addFavorite = async (userId, productId) => {
  const result = await pool.query(
    `INSERT INTO favorites (user_id, product_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING
     RETURNING *`,
    [userId, productId]
  );
  if (result.rows.length > 0) return result.rows[0];

  // Already existed — fetch and return the existing row instead.
  const existing = await pool.query(
    `SELECT * FROM favorites WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
  return existing.rows[0];
};

// ─── REMOVE FAVORITE ─────────────────────────────────────────────────────

/**
 * Removes a product from a user's favorites.
 * @param {string} userId - UUID
 * @param {number} productId - INTEGER
 * @returns {boolean} true if a row was actually deleted.
 */
const removeFavorite = async (userId, productId) => {
  const result = await pool.query(
    `DELETE FROM favorites WHERE user_id = $1 AND product_id = $2 RETURNING id`,
    [userId, productId]
  );
  return result.rows.length > 0;
};

module.exports = {
  getFavoritesByUser,
  addFavorite,
  removeFavorite,
};
