-- ============================================================================
-- Migration: Multi-tenant, UPI, and Pricing Rules Update
-- Date: January 2, 2026
-- Version: 2.6
-- Environment: SUPABASE PRODUCTION DATABASE
-- Description: Adds multi-tenant support, creates/updates shop records,
--              adds UPI payment support, and configures pricing rules
-- 
-- ⚠️ IMPORTANT: Review and update shop data before running in production!
-- ⚠️ BACKUP your database before running this migration!
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
-- ⚠️ IMPORTANT: Update these values with your actual production shop data!
-- ⚠️ Review shop IDs, names, addresses, phone numbers, and emails before running!

INSERT INTO shops (id, name, address, phone, email, is_active, created_at) 
VALUES 
  (1, 'Gamers Spot - Main Branch', 'Main Location Address', '1234567890', 'main@gamersspot.com', true, NOW())
  -- Add more shops as needed:
  -- (2, 'Shop Name', 'Address', 'Phone', 'Email', true, NOW()),
  -- (3, 'Shop Name', 'Address', 'Phone', 'Email', true, NOW())
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = NOW();

-- ============================================================================
-- 5. Link existing admin users to shops (if needed)
-- ============================================================================
-- Update admin_users table to ensure all users have correct shop_id
-- Review and uncomment if needed:
-- UPDATE admin_users SET shop_id = 1 WHERE username = 'admin' AND shop_id IS NULL;

-- ============================================================================
-- 6. Verify the migration
-- ============================================================================
DO $$
DECLARE
  shop_id_exists BOOLEAN;
  index_exists BOOLEAN;
  shop_count INTEGER;
  invoice_count INTEGER;
  invoices_without_shop INTEGER;
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
  
  -- Count invoices
  SELECT COUNT(*) FROM invoices INTO invoice_count;
  
  -- Count invoices without valid shop_id
  SELECT COUNT(*) 
  FROM invoices i 
  LEFT JOIN shops s ON i.shop_id = s.id 
  WHERE s.id IS NULL 
  INTO invoices_without_shop;
  
  -- Report results
  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'shop_id column exists: %', shop_id_exists;
  RAISE NOTICE 'idx_invoices_shop_id exists: %', index_exists;
  RAISE NOTICE 'Total shops: %', shop_count;
  RAISE NOTICE 'Total invoices: %', invoice_count;
  RAISE NOTICE 'Invoices without valid shop: %', invoices_without_shop;
  
  -- Fail if critical components are missing
  IF NOT shop_id_exists THEN
    RAISE EXCEPTION 'Migration failed: shop_id column was not created';
  END IF;
  
  IF NOT index_exists THEN
    RAISE EXCEPTION 'Migration failed: idx_invoices_shop_id index was not created';
  END IF;
  
  IF invoices_without_shop > 0 THEN
    RAISE WARNING 'Found % invoices without valid shop_id - please review!', invoices_without_shop;
  END IF;
  
  RAISE NOTICE '=== Migration Completed Successfully ===';
END $$;

COMMIT;

-- ============================================================================
-- 7. Add upi_id to shops table (WhatsApp Payment Support)
-- ============================================================================
BEGIN;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
COMMENT ON COLUMN shops.upi_id IS 'UPI ID for WhatsApp Payments';
COMMIT;

-- ============================================================================
-- 8. Add Pricing Rules for Buffer and Extra Controllers
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
-- 5. Verify that all admin users have correct shop_id assignments
-- 
-- Next Steps:
-- 1. Review and update shop data in section 4
-- 2. Test in Supabase Test environment first
-- 3. Backup production database before running
-- 4. Run this migration during low-traffic period
-- 5. Verify invoice generation works correctly after migration
-- ============================================================================
