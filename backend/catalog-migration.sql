-- ============================================================
-- Catalog Migration — run in pgAdmin Query Tool against muhanga_market
-- Safe to run top-to-bottom. No DELETEs. No existing data destroyed.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- PART 1: New categories (14 — Electronics & Accessories excluded
-- per your updated catalog). Added alongside your existing 6.
-- ────────────────────────────────────────────────────────────

INSERT INTO categories (name, description, image_url, is_active) VALUES
  ('Fresh Vegetables',        NULL, NULL, TRUE),
  ('Fruits',                  NULL, NULL, TRUE),
  ('Rice, Flour & Grains',    NULL, NULL, TRUE),
  ('Cooking Oil',             NULL, NULL, TRUE),
  ('Dairy & Eggs',            NULL, NULL, TRUE),
  ('Bakery',                  NULL, NULL, TRUE),
  ('Canned & Packaged Food',  NULL, NULL, TRUE),
  ('Spices & Seasonings',     NULL, NULL, TRUE),
  ('Snacks & Sweets',         NULL, NULL, TRUE),
  ('Drinks',                  NULL, NULL, TRUE),
  ('Household Cleaning',      NULL, NULL, TRUE),
  ('Personal Care',           NULL, NULL, TRUE),
  ('Baby Products',           NULL, NULL, TRUE),
  ('School & Office',         NULL, NULL, TRUE);


-- ────────────────────────────────────────────────────────────
-- PART 2: Rename + recategorize 16 existing products that are
-- clearly the same item as a catalog entry, just named or
-- categorized differently. Each UPDATE also checks the current
-- name as a safety guard — if it doesn't match, nothing happens
-- (so this is safe to re-run without double-applying).
-- ────────────────────────────────────────────────────────────

UPDATE products SET name = 'Cassava flour', category_id = (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains')
  WHERE id = 5 AND name = 'Cassava Flour';

UPDATE products SET name = 'Sweet potatoes', category_id = (SELECT id FROM categories WHERE name = 'Fresh Vegetables')
  WHERE id = 7 AND name = 'Sweet Potatoes';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Fresh Vegetables')
  WHERE id = 8 AND name = 'Onions';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Fresh Vegetables')
  WHERE id = 9 AND name = 'Tomatoes';

UPDATE products SET name = 'Wheat flour', category_id = (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains')
  WHERE id = 13 AND name = 'Wheat Flour';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Spices & Seasonings')
  WHERE id = 11 AND name = 'Salt';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Spices & Seasonings')
  WHERE id = 12 AND name = 'Sugar';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
  WHERE id = 38 AND name = 'Eggs';

UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
  WHERE id = 40 AND name = 'Butter';

UPDATE products SET name = 'Fresh milk', category_id = (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
  WHERE id = 15 AND name = 'Milk (Fresh, Pasteurized)';

UPDATE products SET name = 'Powdered milk', category_id = (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
  WHERE id = 16 AND name = 'Milk (Powdered)';

UPDATE products SET name = 'Yogurt', category_id = (SELECT id FROM categories WHERE name = 'Dairy & Eggs')
  WHERE id = 20 AND name = 'Yogurt (Plain)';

UPDATE products SET name = 'Sunflower oil', category_id = (SELECT id FROM categories WHERE name = 'Cooking Oil')
  WHERE id = 10 AND name = 'Cooking Oil (Sunflower)';

UPDATE products SET name = 'Bread', category_id = (SELECT id FROM categories WHERE name = 'Bakery')
  WHERE id = 39 AND name = 'Bread (Sliced Loaf)';

UPDATE products SET name = 'Potatoes', category_id = (SELECT id FROM categories WHERE name = 'Fresh Vegetables')
  WHERE id = 6 AND name = 'Irish Potatoes';

UPDATE products SET name = 'Maize flour', category_id = (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains')
  WHERE id = 4 AND name = 'Maize Flour (Ubugali)';


-- ────────────────────────────────────────────────────────────
-- PART 3: Hide the "NIL" test entry (Beverages, id 45).
-- Soft-hidden only, not deleted — matches your existing
-- soft-delete convention (is_available = FALSE).
-- ────────────────────────────────────────────────────────────

UPDATE products SET is_available = FALSE WHERE id = 45 AND name = 'NIL';
UPDATE product_variants SET is_available = FALSE WHERE product_id = 45;


-- ────────────────────────────────────────────────────────────
-- PART 4: New products (91) with one placeholder "Standard"
-- variant each — price 0, stock 0, hidden until you set a real
-- price via Admin > Products and flip it available.
-- Left out entirely: everything on your "must not be active" list,
-- Electronics & Accessories, and Chapati/Samosa (already exist as
-- prepared Ready-to-Eat items — not duplicated here).
-- ────────────────────────────────────────────────────────────

-- Fresh Vegetables (7 new — Tomatoes/Onions/Sweet potatoes/Potatoes already existed)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Red onions', (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Cassava',    (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Carrots',    (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Cabbage',    (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Garlic',     (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Ginger',     (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE),
  ('Mushrooms',  (SELECT id FROM categories WHERE name = 'Fresh Vegetables'), FALSE);

-- Fruits (11 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Bananas',       (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Avocado',       (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Mango',         (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Pineapple',     (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Watermelon',    (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Passion fruit', (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Oranges',       (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Lemons',        (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Apples',        (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Papaya',        (SELECT id FROM categories WHERE name = 'Fruits'), FALSE),
  ('Strawberries',  (SELECT id FROM categories WHERE name = 'Fruits'), FALSE);

-- Rice, Flour & Grains (8 new — Wheat/Cassava/Maize flour already existed)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Basmati rice',    (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Jasmine rice',     (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Long grain rice',  (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Local rice',       (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Brown rice',       (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Baking flour',     (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Beans',            (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE),
  ('Green peas',       (SELECT id FROM categories WHERE name = 'Rice, Flour & Grains'), FALSE);

-- Cooking Oil (3 new — Sunflower oil already existed)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Zahabu',    (SELECT id FROM categories WHERE name = 'Cooking Oil'), FALSE),
  ('Palm oil',  (SELECT id FROM categories WHERE name = 'Cooking Oil'), FALSE),
  ('Olive oil', (SELECT id FROM categories WHERE name = 'Cooking Oil'), FALSE);

-- Dairy & Eggs (3 new — Fresh/Powdered milk, Yogurt, Eggs, Butter already existed)
INSERT INTO products (name, category_id, is_available) VALUES
  ('UHT milk',  (SELECT id FROM categories WHERE name = 'Dairy & Eggs'), FALSE),
  ('Cheese',    (SELECT id FROM categories WHERE name = 'Dairy & Eggs'), FALSE),
  ('Margarine', (SELECT id FROM categories WHERE name = 'Dairy & Eggs'), FALSE);

-- Bakery (7 new — Bread already existed; Chapati/Samosa intentionally not duplicated)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Whole wheat bread', (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('White bread',       (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('Baguette',          (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('Croissant',         (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('Doughnuts',         (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('Muffins',           (SELECT id FROM categories WHERE name = 'Bakery'), FALSE),
  ('Pizza',             (SELECT id FROM categories WHERE name = 'Bakery'), FALSE);

-- Canned & Packaged Food (4 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Tomato paste', (SELECT id FROM categories WHERE name = 'Canned & Packaged Food'), FALSE),
  ('Mayonnaise',   (SELECT id FROM categories WHERE name = 'Canned & Packaged Food'), FALSE),
  ('Ketchup',      (SELECT id FROM categories WHERE name = 'Canned & Packaged Food'), FALSE),
  ('Sardines',     (SELECT id FROM categories WHERE name = 'Canned & Packaged Food'), FALSE);

-- Spices & Seasonings (9 new — Salt, Sugar already existed)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Black pepper',   (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Curry powder',   (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Garlic powder',  (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Ginger powder',  (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Chili',          (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Royco',          (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Stock cubes',    (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Soy sauce',      (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE),
  ('Vinegar',        (SELECT id FROM categories WHERE name = 'Spices & Seasonings'), FALSE);

-- Snacks & Sweets (4 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Biscuits',     (SELECT id FROM categories WHERE name = 'Snacks & Sweets'), FALSE),
  ('Potato chips', (SELECT id FROM categories WHERE name = 'Snacks & Sweets'), FALSE),
  ('Chocolate',    (SELECT id FROM categories WHERE name = 'Snacks & Sweets'), FALSE),
  ('Chewing gum',  (SELECT id FROM categories WHERE name = 'Snacks & Sweets'), FALSE);

-- Drinks (13 new — your existing Fanta/water/juice/tea in "Beverages" are left
-- untouched since it wasn't clear they're identical to these catalog items;
-- you may end up with both and can consolidate manually later if you wish)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Large refillable water', (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Fanta',                  (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Mirinda',                (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Energy drinks',          (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Mango juice',            (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Orange juice',           (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Apple juice',            (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Passion juice',          (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Pineapple juice',        (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Mixed fruit juice',      (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Tea bags',               (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Loose tea',              (SELECT id FROM categories WHERE name = 'Drinks'), FALSE),
  ('Black coffee',           (SELECT id FROM categories WHERE name = 'Drinks'), FALSE);

-- Household Cleaning (6 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Toilet cleaner',   (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE),
  ('Floor cleaner',    (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE),
  ('Glass cleaner',    (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE),
  ('Bathroom cleaner', (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE),
  ('Hand wash',        (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE),
  ('Sponges',          (SELECT id FROM categories WHERE name = 'Household Cleaning'), FALSE);

-- Personal Care (9 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Bath soap',     (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Body wash',     (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Body lotion',   (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Shampoo',       (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Toothpaste',    (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Toothbrush',    (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Mouthwash',     (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Roll-on',       (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE),
  ('Sanitary pads', (SELECT id FROM categories WHERE name = 'Personal Care'), FALSE);

-- Baby Products (4 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Baby diapers', (SELECT id FROM categories WHERE name = 'Baby Products'), FALSE),
  ('Baby wipes',   (SELECT id FROM categories WHERE name = 'Baby Products'), FALSE),
  ('Baby powder',  (SELECT id FROM categories WHERE name = 'Baby Products'), FALSE),
  ('Baby lotion',  (SELECT id FROM categories WHERE name = 'Baby Products'), FALSE);

-- School & Office (3 new)
INSERT INTO products (name, category_id, is_available) VALUES
  ('Exercise books', (SELECT id FROM categories WHERE name = 'School & Office'), FALSE),
  ('Notebooks',       (SELECT id FROM categories WHERE name = 'School & Office'), FALSE),
  ('Pens',             (SELECT id FROM categories WHERE name = 'School & Office'), FALSE);


-- ────────────────────────────────────────────────────────────
-- PART 5: One placeholder "Standard" variant for every product
-- inserted in Part 4 (91 products, all currently price 0 / stock 0 /
-- unavailable). This lets each one show up immediately in
-- Admin > Products, ready for you to fill in real details.
-- Only touches products that don't already have a variant.
-- ────────────────────────────────────────────────────────────

INSERT INTO product_variants (product_id, name, unit, price, stock_quantity, is_available)
SELECT p.id, 'Standard', 'piece', 0, 0, FALSE
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
);


-- ────────────────────────────────────────────────────────────
-- VALIDATION QUERIES — run these after the above to confirm results
-- ────────────────────────────────────────────────────────────

-- Should return 20 (6 existing + 14 new)
SELECT COUNT(*) AS total_categories FROM categories WHERE is_active = TRUE;

-- Should return 137 (46 original + 91 new)
SELECT COUNT(*) AS total_products FROM products;

-- Should return 91 — all newly added, all hidden, all price 0 awaiting your input
SELECT id, name, category_id FROM products
WHERE id IN (SELECT product_id FROM product_variants WHERE price = 0 AND stock_quantity = 0)
ORDER BY category_id, name;

-- Confirm NIL is hidden, not deleted
SELECT id, name, is_available FROM products WHERE id = 45;
