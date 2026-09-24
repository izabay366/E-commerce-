-- ============================================================
-- MUHANGA MARKETPLACE — LIVE DATABASE SCHEMA
-- Database: muhanga_market  |  PostgreSQL 18  |  Port: 5433
-- ============================================================
-- Updated after migration v1.1.0 (Shopping Flow Foundation)
-- Date: 2026-08-16
--
-- This file reflects the ACTUAL live schema.
-- DO NOT recreate or DROP these tables.
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────
-- Price lives in product_variants, not here.
CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    name         VARCHAR(150) NOT NULL,
    description  TEXT,
    image_url    TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- ─── PRODUCT VARIANTS ─────────────────────────────────────────────────────────
-- v1.1.0: stock_quantity is now NOT NULL DEFAULT 0 CHECK >= 0
-- v1.1.0: price CHECK (IS NULL OR >= 0)
CREATE TABLE product_variants (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id     UUID REFERENCES products(id) ON DELETE CASCADE,
    name           VARCHAR(150),
    unit           VARCHAR(50),
    price          DECIMAL(12, 2) CHECK (price IS NULL OR price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_available   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- NOTE: No password_hash yet — authentication not yet implemented.
CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100),
    last_name  VARCHAR(100),
    phone      VARCHAR(20),
    email      VARCHAR(150) UNIQUE,
    role       VARCHAR(20) DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── CARTS ────────────────────────────────────────────────────────────────────
-- v1.1.0: Added user_id (nullable), session_token, updated_at
-- user_id NULL = guest cart
-- session_token = guest session identifier (unique per session when not NULL)
CREATE TABLE carts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    session_token VARCHAR(255),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- ─── CART ITEMS ───────────────────────────────────────────────────────────────
-- v1.1.0: Completed from skeleton.
-- unit_price = price snapshot at time of adding to cart.
-- UNIQUE (cart_id, variant_id): one row per variant per cart.
CREATE TABLE cart_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (cart_id, variant_id)
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────
-- v1.1.0: Added user_id (nullable = guest orders preserved), updated_at
-- DISCOVERED in v1.1.0: orders_fulfillment_check constraint exists in live DB
--   Exact definition: run  \d orders  in psql to confirm.
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name    VARCHAR(150),
    customer_phone   VARCHAR(20),
    total_amount     DECIMAL(12, 2),
    status           VARCHAR(50),
    fulfillment_type VARCHAR(50),
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

-- ─── ORDER ITEMS ──────────────────────────────────────────────────────────────
-- product_name, variant_name, unit_price = text snapshots for historical accuracy.
-- v1.1.0: Added variant_id (nullable FK — existing rows unaffected).
CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
    variant_id   UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(150),
    variant_name VARCHAR(150),
    quantity     INT,
    unit_price   DECIMAL(12, 2),
    subtotal     DECIMAL(12, 2)
);

-- ─── PAYMENTS ─────────────────────────────────────────────────────────────────
-- v1.1.0: Added momo_reference, updated_at, UNIQUE on order_id
CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id       UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    method         VARCHAR(50),
    status         VARCHAR(50),
    momo_reference VARCHAR(100),
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
);

-- ─── DELIVERIES ───────────────────────────────────────────────────────────────
CREATE TABLE deliveries (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
    address    TEXT,
    status     VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── CLEANING SERVICES ────────────────────────────────────────────────────────
CREATE TABLE cleaning_services (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               VARCHAR(150),
    description        TEXT,
    base_price         DECIMAL(12, 2),
    estimated_duration VARCHAR(100)
);

-- ─── CLEANERS ─────────────────────────────────────────────────────────────────
CREATE TABLE cleaners (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name    VARCHAR(150),
    phone   VARCHAR(20),
    address TEXT,
    status  VARCHAR(50)
);

-- ─── CLEANING REQUESTS ────────────────────────────────────────────────────────
CREATE TABLE cleaning_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name  VARCHAR(150),
    customer_phone VARCHAR(20),
    service_id     UUID REFERENCES cleaning_services(id),
    cleaner_id     UUID REFERENCES cleaners(id),
    location       TEXT,
    preferred_date DATE,
    preferred_time TIME,
    price          DECIMAL(12, 2),
    status         VARCHAR(50),
    created_at     TIMESTAMP DEFAULT NOW()
);

-- ─── SERVICE REVIEWS ──────────────────────────────────────────────────────────
-- SKELETON — columns to be confirmed in a future migration
CREATE TABLE service_reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_products_category ON products(category_id);

-- v1.1.0
CREATE UNIQUE INDEX uq_idx_carts_session_token  ON carts(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_carts_user_id                  ON carts(user_id);
CREATE INDEX idx_cart_items_cart_id             ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id          ON cart_items(variant_id);
CREATE INDEX idx_orders_user_id                 ON orders(user_id);
CREATE INDEX idx_order_items_order_id           ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id         ON order_items(variant_id);
CREATE INDEX idx_payments_order_id              ON payments(order_id);
CREATE INDEX idx_deliveries_order_id            ON deliveries(order_id);
-- ─── ⚠  STALE PRE-v1.1.0 DEFINITIONS BELOW — DO NOT RUN ─────────────────────
-- The following SQL fragments are from the original skeleton schema that was
-- superseded by migration v1.1.0. They are kept here for historical reference
-- ONLY. The live database already has the correct v1.1.0 schema defined above.
-- Running any of these statements against the live DB will fail or corrupt data.
-- See Phase 11 cleanup task for the planned removal of this section.
-- ─────────────────────────────────────────────────────────────────────────────

    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id     UUID REFERENCES products(id) ON DELETE CASCADE,
    name           VARCHAR(150),
    unit           VARCHAR(50),
    price          DECIMAL(12, 2),
    stock_quantity INT,
    is_available   BOOLEAN NOT NULL DEFAULT TRUE
);

-- USERS
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(150) UNIQUE,
    role         VARCHAR(20) DEFAULT 'customer',
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- CARTS
CREATE TABLE carts (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- CART ITEMS
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    -- additional columns to be confirmed
);

-- ORDERS
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name    VARCHAR(150),
    customer_phone   VARCHAR(20),
    total_amount     DECIMAL(12, 2),
    status           VARCHAR(50),
    fulfillment_type VARCHAR(50),
    created_at       TIMESTAMP DEFAULT NOW()
);

-- ORDER ITEMS
CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(150),
    variant_name VARCHAR(150),
    quantity     INT,
    unit_price   DECIMAL(12, 2),
    subtotal     DECIMAL(12, 2)
);

-- PAYMENTS
CREATE TABLE payments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
    method     VARCHAR(50),
    status     VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- DELIVERIES
CREATE TABLE deliveries (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id   UUID REFERENCES orders(id) ON DELETE CASCADE,
    address    TEXT,
    status     VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLEANING SERVICES
CREATE TABLE cleaning_services (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name               VARCHAR(150),
    description        TEXT,
    base_price         DECIMAL(12, 2),
    estimated_duration VARCHAR(100)
);

-- CLEANERS
CREATE TABLE cleaners (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name    VARCHAR(150),
    phone   VARCHAR(20),
    address TEXT,
    status  VARCHAR(50)
);

-- CLEANING REQUESTS
CREATE TABLE cleaning_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name  VARCHAR(150),
    customer_phone VARCHAR(20),
    service_id     UUID REFERENCES cleaning_services(id),
    cleaner_id     UUID REFERENCES cleaners(id),
    location       TEXT,
    preferred_date DATE,
    preferred_time TIME,
    price          DECIMAL(12, 2),
    status         VARCHAR(50),
    created_at     TIMESTAMP DEFAULT NOW()
);

-- SERVICE REVIEWS
CREATE TABLE service_reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP DEFAULT NOW()
    -- additional columns to be confirmed
);
