-- ============================================================================
-- GAMERS SPOT - MULTI-VENDOR SCHEMA SETUP
-- ============================================================================
-- This script creates a new 'multivendor' schema with all necessary tables
-- for supporting multiple gaming shops in a single database
-- 
-- Usage: psql -U your_username -d your_database -f multivendor_setup.sql
-- Or run in pgAdmin, DBeaver, or any PostgreSQL client
-- ============================================================================

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. CREATE MULTIVENDOR SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS multivendor;

-- Grant usage on schema
GRANT USAGE ON SCHEMA multivendor TO PUBLIC;
GRANT ALL ON SCHEMA multivendor TO CURRENT_USER;

-- ============================================================================
-- 2. CREATE TENANTS TABLE (Master table for all shops)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.tenants (
  id SERIAL PRIMARY KEY,
  tenant_code VARCHAR(50) UNIQUE NOT NULL,  -- Unique identifier (e.g., 'shop1', 'shop2')
  shop_name VARCHAR(255) NOT NULL,           -- Display name (e.g., 'Gamers Spot - MG Road')
  owner_name VARCHAR(255),                   -- Shop owner name
  contact_phone VARCHAR(20),                 -- Contact number
  contact_email VARCHAR(255),                -- Contact email
  address TEXT,                              -- Shop address
  city VARCHAR(100),                         -- City
  state VARCHAR(100),                        -- State
  country VARCHAR(100) DEFAULT 'India',      -- Country
  is_active BOOLEAN DEFAULT true,            -- Active/inactive status
  subscription_plan VARCHAR(50) DEFAULT 'basic',  -- Subscription tier
  subscription_expires_at TIMESTAMPTZ,       -- Subscription expiry
  created_at TIMESTAMPTZ DEFAULT NOW(),      -- Registration date
  updated_at TIMESTAMPTZ DEFAULT NOW(),      -- Last update
  settings JSONB DEFAULT '{}'::jsonb         -- Shop-specific settings
);

-- Create indexes for tenants
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_code ON multivendor.tenants(tenant_code);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON multivendor.tenants(is_active);

-- ============================================================================
-- 3. CREATE STATIONS TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.stations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL,           -- Station number within tenant (1, 2, 3...)
  name VARCHAR(255) NOT NULL,
  game_type VARCHAR(50) NOT NULL,
  elapsed_time INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT false,
  is_done BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  paused_time INTEGER DEFAULT 0,
  pause_start_time VARCHAR(50),
  extra_controllers INTEGER DEFAULT 0,
  snacks JSONB DEFAULT '{}'::jsonb,
  snacks_enabled BOOLEAN DEFAULT false,
  customer_name VARCHAR(255) DEFAULT '',
  customer_phone VARCHAR(20) DEFAULT '',
  start_time VARCHAR(50),
  end_time VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, station_number)          -- Unique station number per tenant
);

-- Create indexes for stations
CREATE INDEX IF NOT EXISTS idx_mv_stations_tenant_id ON multivendor.stations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_stations_is_done ON multivendor.stations(is_done);
CREATE INDEX IF NOT EXISTS idx_mv_stations_game_type ON multivendor.stations(game_type);
CREATE INDEX IF NOT EXISTS idx_mv_stations_tenant_station ON multivendor.stations(tenant_id, station_number);

-- ============================================================================
-- 4. CREATE INVOICES TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(255) NOT NULL,
  stations JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)          -- Unique invoice number per tenant
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS idx_mv_invoices_tenant_id ON multivendor.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_invoices_created_at ON multivendor.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_mv_invoices_tenant_date ON multivendor.invoices(tenant_id, created_at);

-- ============================================================================
-- 5. CREATE PAID_EVENTS TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.paid_events (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(255),
  station_ids INTEGER[] NOT NULL,
  reset_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false
);

-- Create indexes for paid_events
CREATE INDEX IF NOT EXISTS idx_mv_paid_events_tenant_id ON multivendor.paid_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_paid_events_created_at ON multivendor.paid_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mv_paid_events_processed ON multivendor.paid_events(processed);
CREATE INDEX IF NOT EXISTS idx_mv_paid_events_tenant_date ON multivendor.paid_events(tenant_id, created_at);

-- ============================================================================
-- 6. CREATE SNACKS TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.snacks (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)                    -- Unique snack name per tenant
);

-- Create indexes for snacks
CREATE INDEX IF NOT EXISTS idx_mv_snacks_tenant_id ON multivendor.snacks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_snacks_active ON multivendor.snacks(active);
CREATE INDEX IF NOT EXISTS idx_mv_snacks_display_order ON multivendor.snacks(display_order);

-- ============================================================================
-- 7. CREATE CUSTOMERS TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.customers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number)            -- Unique phone per tenant
);

-- Create indexes for customers
CREATE INDEX IF NOT EXISTS idx_mv_customers_tenant_id ON multivendor.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_customers_phone ON multivendor.customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_mv_customers_tenant_phone ON multivendor.customers(tenant_id, phone_number);

-- ============================================================================
-- 8. CREATE SETTINGS TABLE (with tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS multivendor.settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  setting_type VARCHAR(50) NOT NULL,         -- 'pricing', 'bonus', etc.
  setting_data JSONB NOT NULL,               -- Configuration data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, setting_type)            -- One setting per type per tenant
);

-- Create indexes for settings
CREATE INDEX IF NOT EXISTS idx_mv_settings_tenant_id ON multivendor.settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mv_settings_type ON multivendor.settings(setting_type);

-- ============================================================================
-- 9. CREATE FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION multivendor.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to clean up old processed paid events (older than 24 hours)
CREATE OR REPLACE FUNCTION multivendor.cleanup_old_paid_events()
RETURNS void AS $$
BEGIN
  DELETE FROM multivendor.paid_events 
  WHERE processed = true 
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to get next station number for a tenant
CREATE OR REPLACE FUNCTION multivendor.get_next_station_number(p_tenant_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(station_number), 0) + 1 
  INTO next_number
  FROM multivendor.stations 
  WHERE tenant_id = p_tenant_id;
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. CREATE TRIGGERS
-- ============================================================================

-- Trigger to auto-update updated_at for tenants
DROP TRIGGER IF EXISTS update_tenants_updated_at ON multivendor.tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON multivendor.tenants
    FOR EACH ROW EXECUTE FUNCTION multivendor.update_updated_at_column();

-- Trigger to auto-update updated_at for stations
DROP TRIGGER IF EXISTS update_stations_updated_at ON multivendor.stations;
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON multivendor.stations
    FOR EACH ROW EXECUTE FUNCTION multivendor.update_updated_at_column();

-- Trigger to auto-update updated_at for snacks
DROP TRIGGER IF EXISTS update_snacks_updated_at ON multivendor.snacks;
CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON multivendor.snacks
    FOR EACH ROW EXECUTE FUNCTION multivendor.update_updated_at_column();

-- Trigger to auto-update updated_at for customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON multivendor.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON multivendor.customers
    FOR EACH ROW EXECUTE FUNCTION multivendor.update_updated_at_column();

-- Trigger to auto-update updated_at for settings
DROP TRIGGER IF EXISTS update_settings_updated_at ON multivendor.settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON multivendor.settings
    FOR EACH ROW EXECUTE FUNCTION multivendor.update_updated_at_column();

-- ============================================================================
-- 11. INSERT DEFAULT TENANT (for migration from single-tenant)
-- ============================================================================

-- Insert default tenant (this will be your current shop)
INSERT INTO multivendor.tenants (
  tenant_code, 
  shop_name, 
  is_active,
  subscription_plan,
  settings
) VALUES (
  'default',
  'Gamers Spot - Main Branch',
  true,
  'premium',
  '{}'::jsonb
) ON CONFLICT (tenant_code) DO NOTHING;

-- Get the tenant_id for default tenant
DO $$
DECLARE
  default_tenant_id INTEGER;
BEGIN
  SELECT id INTO default_tenant_id FROM multivendor.tenants WHERE tenant_code = 'default';
  
  -- Insert default snacks for the default tenant
  INSERT INTO multivendor.snacks (tenant_id, name, price, active, display_order) VALUES
    (default_tenant_id, 'Coke Bottle', 20, true, 1),
    (default_tenant_id, 'Coke Can', 40, true, 2),
    (default_tenant_id, 'Lays Chips', 5, true, 3),
    (default_tenant_id, 'Kurkure', 5, true, 4)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  
  -- Insert default pricing settings
  INSERT INTO multivendor.settings (tenant_id, setting_type, setting_data) VALUES
    (default_tenant_id, 'pricing', '{
      "Playstation": {"weekday": 150, "weekend": 200},
      "Steering Wheel": {"weekday": 150, "weekend": 150},
      "System": {"weekday": 100, "weekend": 100},
      "extraControllerRate": 50,
      "bufferMinutes": 10
    }'::jsonb),
    (default_tenant_id, 'bonus', '{
      "Playstation": {
        "weekday": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600},
        "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
      },
      "Steering Wheel": {
        "weekday": {"oneHour": 0, "twoHours": 0, "threeHours": 0},
        "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
      },
      "System": {
        "weekday": {"oneHour": 0, "twoHours": 0, "threeHours": 0},
        "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
      }
    }'::jsonb)
  ON CONFLICT (tenant_id, setting_type) DO NOTHING;
  
  RAISE NOTICE 'Default tenant created with ID: %', default_tenant_id;
END $$;

-- ============================================================================
-- 12. GRANT PERMISSIONS
-- ============================================================================

-- Grant all privileges on all tables in multivendor schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA multivendor TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA multivendor TO CURRENT_USER;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA multivendor TO CURRENT_USER;

-- ============================================================================
-- 13. VERIFICATION
-- ============================================================================

-- Display summary of created tables
SELECT 
  'Multi-Vendor Schema Created Successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'multivendor' 
   AND table_name IN ('tenants', 'stations', 'invoices', 'paid_events', 'snacks', 'customers', 'settings')) as tables_count;

-- Display tenants
SELECT 
  id,
  tenant_code,
  shop_name,
  is_active,
  subscription_plan,
  created_at
FROM multivendor.tenants
ORDER BY id;

-- Display default snacks
SELECT 
  s.id,
  t.tenant_code,
  s.name,
  s.price,
  s.active
FROM multivendor.snacks s
JOIN multivendor.tenants t ON s.tenant_id = t.id
ORDER BY s.tenant_id, s.display_order;

-- Success message
SELECT '✅ Multi-vendor database setup completed successfully!' as message;
SELECT '📊 Schema: multivendor' as info;
SELECT '🏪 Default tenant created: "default"' as info;
SELECT '🎮 Ready to add more shops!' as info;
