-- ============================================================================
-- Migration: Multi-tenant, UPI, and Pricing Rules Update
-- Date: January 2, 2026
-- Version: 2.6
-- Environment: SUPABASE TEST DATABASE
-- Description: Adds multi-tenant support, creates default shop records,
--              adds UPI payment support, and configures pricing rules
-- ============================================================================

-- Set timezone to Asia/Kolkata
SET timezone = 'Asia/Kolkata';

BEGIN;

-- ============================================================================
-- 1. Add shop_id column to invoices table
-- ============================================================================
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS shop_id INTEGER DEFAULT 1 NOT NULL;

-- Add comment to column
COMMENT ON COLUMN invoices.shop_id IS 'Foreign key to shops table for multi-tenant support';

-- ============================================================================
-- 2. Create index for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);

-- ============================================================================
-- 3. Reset invoice sequence to prevent duplicate key errors
-- ============================================================================
-- This ensures the sequence is in sync with existing invoice IDs
SELECT setval('invoices_id_seq', COALESCE((SELECT MAX(id) FROM invoices), 1));

-- ============================================================================
-- 4. Create default shops (if they don't exist)
-- ============================================================================
-- Test environment shop data
INSERT INTO shops (id, name, address, phone, email, is_active, created_at) 
VALUES 
  (1, 'Gamers Spot Test', 'Test Location', '1234567890', 'test@gamersspot.com', true, NOW()),
  (9, 'Test Shop 1', 'Test Location 1', '1234567890', 'shop1@test.com', true, NOW()),
  (10, 'Test Shop 2', 'Test Location 2', '1234567890', 'shop2@test.com', true, NOW()),
  (11, 'Test Shop 3', 'Test Location 3', '1234567890', 'shop3@test.com', true, NOW())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = NOW();

-- 4b. Create default subscriptions for test shops
INSERT INTO subscriptions (shop_id, plan_name, monthly_amount, status, start_date, end_date)
SELECT id, 'TRIAL', 0, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days'
FROM shops
WHERE id IN (1, 9, 10, 11)
AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE shop_id = shops.id AND status = 'ACTIVE');

-- ============================================================================
-- 5. Verify the migration
-- ============================================================================
DO $$
DECLARE
  shop_id_exists BOOLEAN;
  index_exists BOOLEAN;
  shop_count INTEGER;
BEGIN
  -- Check if shop_id column exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'shop_id'
  ) INTO shop_id_exists;
  
  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE tablename = 'invoices' 
    AND indexname = 'idx_invoices_shop_id'
  ) INTO index_exists;
  
  -- Count shops
  SELECT COUNT(*) FROM shops INTO shop_count;
  
  -- Report results
  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'shop_id column exists: %', shop_id_exists;
  RAISE NOTICE 'idx_invoices_shop_id exists: %', index_exists;
  RAISE NOTICE 'Total shops created: %', shop_count;
  
  -- Fail if critical components are missing
  IF NOT shop_id_exists THEN
    RAISE EXCEPTION 'Migration failed: shop_id column was not created';
  END IF;
  
  IF NOT index_exists THEN
    RAISE EXCEPTION 'Migration failed: idx_invoices_shop_id index was not created';
  END IF;
  
  RAISE NOTICE '=== Migration Completed Successfully ===';
END $$;

COMMIT;

-- ============================================================================
-- 6. Add upi_id to shops table (WhatsApp Payment Support)
-- ============================================================================
BEGIN;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
COMMENT ON COLUMN shops.upi_id IS 'UPI ID for WhatsApp Payments';
COMMIT;

-- ============================================================================
-- 7. Add Pricing Rules for Buffer and Extra Controllers
-- ============================================================================
BEGIN;
-- Buffer Minutes (For all shops)
INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
SELECT s.id, 'buffer_minutes', 10, 10
FROM shops s
WHERE NOT EXISTS (
    SELECT 1 FROM pricing_rules pr 
    WHERE pr.shop_id = s.id AND pr.game_type = 'buffer_minutes'
);

-- Extra Controller (For all shops)
INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
SELECT s.id, 'extra_controller', 50, 50
FROM shops s
WHERE NOT EXISTS (
    SELECT 1 FROM pricing_rules pr 
    WHERE pr.shop_id = s.id AND pr.game_type = 'extra_controller'
);
COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================
-- 1. All existing invoices will have shop_id = 1 (default)
-- 2. New invoices will use the shop_id from the authenticated user
-- 3. Invoice numbers now include shop_id: INV-{SHOP_ID}-{YYYYMMDD}-{SEQUENCE}
-- 4. Each shop has its own daily invoice sequence
-- ============================================================================
