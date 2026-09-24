/**
 * productService.js
 * All SQL queries related to products and product variants.
 *
 * CONFIRMED LIVE SCHEMA (muhanga_market, PostgreSQL 18, port 5433):
 *
 * products:
 *   id (integer), category_id (integer), name (varchar),
 *   description (text), image_url (text), is_available (boolean),
 *   created_at, updated_at
 *
 * product_variants:
 *   id (integer), product_id (integer), name (varchar), unit (varchar),
 *   price (numeric), stock_quantity (numeric), is_available (boolean),
 *   created_at, updated_at
 *
 * categories:
 *   id (integer), name (varchar), description (text),
 *   image_url (text), is_active (boolean), created_at, updated_at
 */

const pool = require('../config/database');

// ─── GET ALL PRODUCTS ─────────────────────────────────────────────────────────

/**
 * Returns all available products with their variants (flat list).
 * 48 rows = 48 variants across all products (one row per variant).
 */
const getAllAvailableProducts = async () => {
  const result = await pool.query(`
    SELECT
      p.id              AS id,
      p.name            AS name,
      p.description     AS description,
      p.image_url       AS image_url,
      c.name            AS category,
      pv.id             AS variant_id,
      pv.name           AS variant,
      pv.unit           AS unit,
      pv.price          AS price,
      pv.stock_quantity AS stock_quantity,
      pv.is_available   AS is_available
    FROM products p
    LEFT JOIN categories c   ON c.id = p.category_id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.is_available = TRUE
      AND pv.is_available = TRUE
    ORDER BY c.name ASC, p.name ASC, pv.price ASC
  `);

  return result.rows;
};

// ─── GET SINGLE PRODUCT BY ID ─────────────────────────────────────────────────

/**
 * Returns one product with its category and all variants grouped.
 * Returns null if the product does not exist.
 *
 * @param {number} productId - The product ID (integer)
 * @returns {object|null} Product with nested category and variants array
 */
const getProductById = async (productId) => {
  // Query 1: product + category
  const productResult = await pool.query(
    `SELECT
       p.id              AS id,
       p.name            AS name,
       p.description     AS description,
       p.image_url       AS image_url,
       p.is_available    AS is_available,
       p.created_at      AS created_at,
       c.id              AS category_id,
       c.name            AS category_name,
       c.description     AS category_description
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    return null; // Product not found → controller sends 404
  }

  const product = productResult.rows[0];

  // Query 2: all variants for this product
  const variantsResult = await pool.query(
    `SELECT
       id,
       name,
       unit,
       price,
       stock_quantity,
       is_available
     FROM product_variants
     WHERE product_id = $1
     ORDER BY price ASC`,
    [productId]
  );

  // Compose structured response
  return {
    id:          product.id,
    name:        product.name,
    description: product.description,
    image_url:   product.image_url,
    is_available: product.is_available,
    created_at:  product.created_at,
    category: {
      id:          product.category_id,
      name:        product.category_name,
      description: product.category_description,
    },
    variants: variantsResult.rows,
  };
};

// ─── DIAGNOSTIC ───────────────────────────────────────────────────────────────

/**
 * Returns real column names for all product-related tables.
 * For development use only.
 */
const getProductSchema = async () => {
  const result = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('products', 'product_variants', 'categories')
    ORDER BY table_name, ordinal_position
  `);
  return result.rows;
};

// ─── CREATE PRODUCT ─────────────────────────────────────────────────────

/**
 * Creates a new product row.
 * @param {object} data - { name, description, category_id, image_url }
 * @returns {object} The newly created product row.
 */
const createProduct = async ({ name, description, category_id, image_url }) => {
  const result = await pool.query(
    `INSERT INTO products (name, description, category_id, image_url, is_available)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING *`,
    [name, description || null, category_id || null, image_url || null]
  );
  return result.rows[0];
};

/**
 * Creates a variant for a given product.
 * @param {object} data - { product_id, name, unit, price, stock_quantity }
 * @returns {object} The newly created variant row.
 */
const createVariant = async ({ product_id, name, unit, price, stock_quantity }) => {
  const result = await pool.query(
    `INSERT INTO product_variants (product_id, name, unit, price, stock_quantity, is_available)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING *`,
    [product_id, name || 'Standard', unit || null, price, stock_quantity]
  );
  return result.rows[0];
};

// ─── UPDATE PRODUCT ─────────────────────────────────────────────────────

/**
 * Updates a product's own fields (name, description, category).
 * @param {number} id
 * @param {object} data - { name, description, category_id }
 * @returns {object|null} Updated product row, or null if not found.
 */
const updateProduct = async (id, { name, description, category_id }) => {
  const result = await pool.query(
    `UPDATE products
     SET name = $1, description = $2, category_id = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [name, description || null, category_id || null, id]
  );
  return result.rows[0] || null;
};

/**
 * Updates a specific variant's price/stock/unit.
 * @param {number} variantId
 * @param {object} data - { unit, price, stock_quantity }
 * @returns {object|null} Updated variant row, or null if not found.
 */
const updateVariant = async (variantId, { unit, price, stock_quantity }) => {
  const result = await pool.query(
    `UPDATE product_variants
     SET unit = $1, price = $2, stock_quantity = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [unit || null, price, stock_quantity, variantId]
  );
  return result.rows[0] || null;
};

/**
 * Returns the first variant belonging to a product (lowest id).
 * Used when an edit request doesn't specify which variant to update.
 * @param {number} productId
 * @returns {object|null}
 */
const getFirstVariantForProduct = async (productId) => {
  const result = await pool.query(
    `SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id ASC LIMIT 1`,
    [productId]
  );
  return result.rows[0] || null;
};

/**
 * Updates a product's image_url.
 * @param {number} id
 * @param {string} imageUrl
 * @returns {object|null}
 */
const updateProductImage = async (id, imageUrl) => {
  const result = await pool.query(
    `UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [imageUrl, id]
  );
  return result.rows[0] || null;
};

// ─── DELETE (SOFT) PRODUCT ──────────────────────────────────────────────

/**
 * Soft-deletes a product: marks it and all its variants unavailable.
 * Nothing is actually removed from the database.
 * @param {number} id
 * @returns {boolean} true if a product was found and updated.
 */
const softDeleteProduct = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `UPDATE products SET is_available = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE product_variants SET is_available = FALSE, updated_at = NOW() WHERE product_id = $1`,
      [id]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllAvailableProducts,
  getProductById,
  getProductSchema,
  createProduct,
  createVariant,
  updateProduct,
  updateVariant,
  getFirstVariantForProduct,
  updateProductImage,
  softDeleteProduct,
};

