/**
 * productController.js
 * Handles HTTP request/response for all product endpoints.
 * Delegates all database work to productService.
 */

const productService = require('../services/productService');

// ─── GET ALL PRODUCTS ─────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Returns all available products with variants as a flat list.
 * 48 rows = one row per variant (products × their variants).
 */
const getProducts = async (req, res) => {
  try {
    const products = await productService.getAllAvailableProducts();

    return res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
    });
  } catch (error) {
    console.error('Error fetching products:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve products.',
      error:   error.message,
    });
  }
};

// ─── GET SINGLE PRODUCT ───────────────────────────────────────────────────────

/**
 * GET /api/products/:id
 * Returns one product with nested category and variants array.
 * Returns 404 if the product does not exist.
 */
const getProductById = async (req, res) => {
  const { id } = req.params;

  // Validate: id must be a positive integer
  const productId = parseInt(id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid product ID. Must be a positive integer.',
    });
  }

  try {
    const product = await productService.getProductById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found with ID: ${productId}`,
      });
    }

    return res.status(200).json({
      success: true,
      data:    product,
    });
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product.',
      error:   error.message,
    });
  }
};

// ─── DIAGNOSTIC ───────────────────────────────────────────────────────────────

/**
 * GET /api/products/schema
 * Returns real DB column names for product-related tables.
 * For development/debugging only — remove in production.
 */
const getProductSchema = async (req, res) => {
  try {
    const schema = await productService.getProductSchema();
    return res.status(200).json({
      success: true,
      tables:  ['products', 'product_variants', 'categories'],
      columns: schema,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ─── CREATE PRODUCT ─────────────────────────────────────────────────────

/**
 * POST /api/products
 * Admin only. Creates a product plus its first variant in one request.
 * Body: { name, description, category_id, price, stock_quantity, unit }
 */
const createProduct = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { name, description, category_id, price, stock_quantity, unit } = req.body;

  if (!name || price === undefined || stock_quantity === undefined) {
    return res.status(400).json({
      success: false,
      message: 'name, price, and stock_quantity are required.',
    });
  }

  try {
    const product = await productService.createProduct({ name, description, category_id });
    const variant = await productService.createVariant({
      product_id: product.id,
      name: 'Standard',
      unit,
      price,
      stock_quantity,
    });

    return res.status(201).json({
      success: true,
      data: { ...product, variant_id: variant.id, price: variant.price, stock_quantity: variant.stock_quantity, unit: variant.unit },
    });
  } catch (error) {
    console.error('Error creating product:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create product.',
      error: error.message,
    });
  }
};

// ─── UPDATE PRODUCT ─────────────────────────────────────────────────────

/**
 * PUT /api/products/:id
 * Admin only. Updates product fields and, optionally, one variant's
 * price/stock/unit. If variant_id is not provided in the body, the
 * product's first variant is updated instead.
 * Body: { name, description, category_id, price, stock_quantity, unit, variant_id? }
 */
const updateProduct = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  const { name, description, category_id, price, stock_quantity, unit, variant_id } = req.body;

  try {
    const product = await productService.updateProduct(productId, { name, description, category_id });
    if (!product) {
      return res.status(404).json({ success: false, message: `Product not found with ID: ${productId}` });
    }

    let variant = null;
    if (price !== undefined && stock_quantity !== undefined) {
      let targetVariantId = variant_id;
      if (!targetVariantId) {
        const first = await productService.getFirstVariantForProduct(productId);
        targetVariantId = first ? first.id : null;
      }
      if (targetVariantId) {
        variant = await productService.updateVariant(targetVariantId, { unit, price, stock_quantity });
      }
    }

    return res.status(200).json({
      success: true,
      data: variant ? { ...product, variant_id: variant.id, price: variant.price, stock_quantity: variant.stock_quantity, unit: variant.unit } : product,
    });
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product.',
      error: error.message,
    });
  }
};

// ─── DELETE PRODUCT ─────────────────────────────────────────────────────

/**
 * DELETE /api/products/:id
 * Admin only. Soft-deletes the product and all its variants
 * (marks is_available = FALSE — nothing is actually removed).
 */
const deleteProduct = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  try {
    const deleted = await productService.softDeleteProduct(productId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `Product not found with ID: ${productId}` });
    }
    return res.status(200).json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    console.error(`Error deleting product ${productId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product.',
      error: error.message,
    });
  }
};

// ─── UPLOAD PRODUCT IMAGE ───────────────────────────────────────────────

/**
 * POST /api/products/:id/image
 * Admin only. Accepts a single file field named "image", saves it,
 * and stores its URL on the product.
 */
const uploadProductImage = async (req, res) => {
  // Role check is case-insensitive — tokens/DB store role as 'ADMIN' (uppercase).
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid product ID.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }

  try {
    // Store a relative path so the URL isn't hardcoded to localhost.
    // The frontend will prepend the API base URL at render time.
    const imageUrl = `/uploads/${req.file.filename}`;
    const product = await productService.updateProductImage(productId, imageUrl);

    if (!product) {
      return res.status(404).json({ success: false, message: `Product not found with ID: ${productId}` });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error(`Error uploading image for product ${productId}:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image.',
      error: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductSchema,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
};
