-- ============================================================
-- PHASE 3 MIGRATION — Cleaning Services Module
-- Database: muhanga_market  |  PostgreSQL 18  |  Port: 5433
-- Date: 2026-09-10
-- ============================================================
-- SAFE TO RUN: Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- Does NOT drop or modify any existing columns.
-- Does NOT touch products, cart, orders, payments, or auth tables.
-- ============================================================

-- ─── cleaning_services: add is_active flag ────────────────────────────────────
ALTER TABLE cleaning_services
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── cleaners: add is_active flag ────────────────────────────────────────────
ALTER TABLE cleaners
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── cleaning_requests: add user_id for ownership tracking ───────────────────
-- Nullable so guest requests (name+phone only) are still supported.
ALTER TABLE cleaning_requests
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ─── cleaning_requests: add notes/instructions field ─────────────────────────
ALTER TABLE cleaning_requests
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── cleaning_requests: add updated_at for tracking status changes ────────────
ALTER TABLE cleaning_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- ─── Indexes for new columns ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cleaning_requests_user_id
  ON cleaning_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_cleaning_requests_service_id
  ON cleaning_requests(service_id);

CREATE INDEX IF NOT EXISTS idx_cleaning_requests_status
  ON cleaning_requests(status);

CREATE INDEX IF NOT EXISTS idx_cleaning_requests_cleaner_id
  ON cleaning_requests(cleaner_id);

-- ============================================================
-- VERIFICATION: After running, confirm with:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('cleaning_services','cleaners','cleaning_requests')
--   ORDER BY table_name, ordinal_position;
-- ============================================================
