/**
 * categoryService.js
 * All SQL queries related to categories.
 *
 * CONFIRMED LIVE SCHEMA — categories table:
 *   id (integer), name (varchar), description (text),
 *   image_url (text), is_active (boolean), created_at, updated_at
 *
 * NOTE: categories uses `is_active`, not `is_available`.
 */

const pool = require('../config/database');

// ─── GET ALL CATEGORIES ───────────────────────────────────────────────────────

/**
 * Returns all active categories with product count per category.
 * Only returns categories that have at least one available product.
 */
const getAllCategories = async () => {
  const result = await pool.query(`
    SELECT
      c.id,
      c.name,
      c.description,
      c.image_url,
      c.is_active,
      COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN products p
      ON p.category_id = c.id AND p.is_available = TRUE
    WHERE c.is_active = TRUE
    GROUP BY c.id, c.name, c.description, c.image_url, c.is_active
    ORDER BY c.name ASC
  `);

  return result.rows;
};

// ─── GET SINGLE CATEGORY BY ID ────────────────────────────────────────────────

/**
 * Returns one category with all its available products and variants.
 * Returns null if the category does not exist.
 *
 * @param {number} categoryId - The category ID (integer)
 */
const getCategoryById = async (categoryId) => {
  // Query 1: category info
  const categoryResult = await pool.query(
    `SELECT id, name, description, image_url, is_active
     FROM categories
     WHERE id = $1`,
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    return null;
  }

  const category = categoryResult.rows[0];

  // Query 2: all available products + variants in this category
  const productsResult = await pool.query(
    `SELECT
       p.id              AS product_id,
       p.name            AS product_name,
       p.description     AS description,
       p.image_url       AS image_url,
       pv.id             AS variant_id,
       pv.name           AS variant_name,
       pv.unit,
       pv.price,
       pv.stock_quantity,
       pv.is_available
     FROM products p
     LEFT JOIN product_variants pv ON pv.product_id = p.id
     WHERE p.category_id = $1
       AND p.is_available = TRUE
       AND pv.is_available = TRUE
     ORDER BY p.name ASC, pv.price ASC`,
    [categoryId]
  );

  // Group variants under each product
  const productsMap = new Map();
  for (const row of productsResult.rows) {
    if (!productsMap.has(row.product_id)) {
      productsMap.set(row.product_id, {
        id:          row.product_id,
        name:        row.product_name,
        description: row.description,
        image_url:   row.image_url,
        variants:    [],
      });
    }
    if (row.variant_id) {
      productsMap.get(row.product_id).variants.push({
        id:             row.variant_id,
        name:           row.variant_name,
        unit:           row.unit,
        price:          row.price,
        stock_quantity: row.stock_quantity,
        is_available:   row.is_available,
      });
    }
  }

  return {
    id:            category.id,
    name:          category.name,
    description:   category.description,
    image_url:     category.image_url,
    is_active:     category.is_active,
    products:      Array.from(productsMap.values()),
    product_count: productsMap.size,
  };
};

// ─── CREATE CATEGORY ──────────────────────────────────────────────────────────

/**
 * Creates a new category. Always active on creation.
 *
 * @param {{ name: string, description?: string, image_url?: string }} fields
 */
const createCategory = async ({ name, description, image_url }) => {
  const result = await pool.query(
    `INSERT INTO categories (name, description, image_url, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, name, description, image_url, is_active`,
    [name, description || null, image_url || null]
  );

  return result.rows[0];
};

// ─── UPDATE CATEGORY ──────────────────────────────────────────────────────────

/**
 * Updates a category's name/description/image. Returns null if the
 * category does not exist (any is_active state — editing an inactive
 * category is allowed, e.g. to fix it before reactivating).
 *
 * @param {number} categoryId
 * @param {{ name: string, description?: string, image_url?: string }} fields
 */
const updateCategory = async (categoryId, { name, description, image_url }) => {
  const result = await pool.query(
    `UPDATE categories
     SET name = $1, description = $2, image_url = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, description, image_url, is_active`,
    [name, description || null, image_url || null, categoryId]
  );

  return result.rows[0] || null;
};

// ─── SOFT-DELETE CATEGORY ─────────────────────────────────────────────────────

/**
 * Soft-deletes a category (is_active = FALSE). Products already assigned
 * to it are NOT reassigned or deleted — they simply stop appearing in
 * getAllCategories' counts since that query filters on c.is_active = TRUE.
 * Returns true if a row was actually updated, false if the id didn't exist.
 *
 * @param {number} categoryId
 */
const softDeleteCategory = async (categoryId) => {
  const result = await pool.query(
    `UPDATE categories
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [categoryId]
  );

  return result.rows.length > 0;
};

// ─── UPDATE CATEGORY IMAGE ────────────────────────────────────────────────────

/**
 * Sets a category's image_url after a file has been uploaded and saved to
 * disk by the upload middleware. Returns null if the category doesn't exist.
 *
 * @param {number} categoryId
 * @param {string} imageUrl - full URL built by the controller from req.file
 */
const updateCategoryImage = async (categoryId, imageUrl) => {
  const result = await pool.query(
    `UPDATE categories
     SET image_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, description, image_url, is_active`,
    [imageUrl, categoryId]
  );

  return result.rows[0] || null;
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryImage,
  softDeleteCategory,
};
