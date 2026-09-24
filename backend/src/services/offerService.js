/**
 * offerService.js
 * All SQL queries related to homepage promo offers.
 *
 * SCHEMA â€” offers table:
 *   id (integer), title (varchar), subtitle (varchar), code (varchar),
 *   icon (varchar: 'percent' | 'gift'), highlight (boolean),
 *   sort_order (integer), is_active (boolean), created_at, updated_at
 */

const pool = require('../config/database');

// â”€â”€â”€ GET ALL OFFERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns all active offers, ordered for display.
 * Used by both the public homepage and the admin list (same as categories).
 */
const getAllOffers = async () => {
  const result = await pool.query(`
    SELECT id, title, subtitle, code, icon, highlight, sort_order, is_active
    FROM offers
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, id ASC
  `);

  return result.rows;
};

// â”€â”€â”€ CREATE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Creates a new offer. Always active on creation.
 *
 * @param {{ title: string, subtitle?: string, code?: string, icon?: string, highlight?: boolean, sort_order?: number }} fields
 */
const createOffer = async ({ title, subtitle, code, icon, highlight, sort_order }) => {
  const result = await pool.query(
    `INSERT INTO offers (title, subtitle, code, icon, highlight, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING id, title, subtitle, code, icon, highlight, sort_order, is_active`,
    [title, subtitle || null, code || null, icon || 'percent', !!highlight, sort_order ?? 0]
  );

  return result.rows[0];
};

// â”€â”€â”€ UPDATE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Updates an offer's fields. Returns null if the offer does not exist.
 *
 * @param {number} offerId
 * @param {{ title: string, subtitle?: string, code?: string, icon?: string, highlight?: boolean, sort_order?: number }} fields
 */
const updateOffer = async (offerId, { title, subtitle, code, icon, highlight, sort_order }) => {
  const result = await pool.query(
    `UPDATE offers
     SET title = $1, subtitle = $2, code = $3, icon = $4, highlight = $5, sort_order = $6, updated_at = NOW()
     WHERE id = $7
     RETURNING id, title, subtitle, code, icon, highlight, sort_order, is_active`,
    [title, subtitle || null, code || null, icon || 'percent', !!highlight, sort_order ?? 0, offerId]
  );

  return result.rows[0] || null;
};

// â”€â”€â”€ SOFT-DELETE OFFER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Soft-deletes an offer (is_active = FALSE), same convention as categories.
 * Returns true if a row was actually updated, false if the id didn't exist.
 *
 * @param {number} offerId
 */
const softDeleteOffer = async (offerId) => {
  const result = await pool.query(
    `UPDATE offers
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [offerId]
  );

  return result.rows.length > 0;
};

module.exports = {
  getAllOffers,
  createOffer,
  updateOffer,
  softDeleteOffer,
};
