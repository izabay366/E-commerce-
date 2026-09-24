-- Run this once against your database (e.g. via psql, or whatever tool you
-- used to create the categories/products tables).

CREATE TABLE offers (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  subtitle    VARCHAR(255),
  code        VARCHAR(50),                       -- e.g. 'MUHANGA500', optional
  icon        VARCHAR(20) NOT NULL DEFAULT 'percent', -- 'percent' | 'gift'
  highlight   BOOLEAN NOT NULL DEFAULT FALSE,     -- true = dark emerald card, false = amber card
  sort_order  INTEGER NOT NULL DEFAULT 0,         -- lower shows first
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed it with your current three hardcoded offers so the homepage looks
-- identical right after you switch it over to the API.
INSERT INTO offers (title, subtitle, code, icon, highlight, sort_order) VALUES
  ('1,000 RWF off', 'Min. spend 10,000 RWF', NULL, 'percent', FALSE, 0),
  ('Free delivery', 'Min. spend 20,000 RWF', NULL, 'percent', FALSE, 1),
  ('First order? Save 500 RWF', NULL, 'MUHANGA500', 'gift', TRUE, 2);
