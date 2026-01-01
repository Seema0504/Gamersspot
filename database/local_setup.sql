-- Gamers Spot - Complete Local PostgreSQL Database Setup
-- Run this script in your local PostgreSQL database to set up all required tables
-- Usage: psql -U your_username -d your_database -f local_setup.sql
-- Or copy and paste into pgAdmin, DBeaver, or any PostgreSQL client
-- All timestamps use Indian Standard Time (IST) - Asia/Kolkata timezone

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. STATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  game_type VARCHAR(50) NOT NULL,
  elapsed_time INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT false,
  is_done BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  paused_time INTEGER DEFAULT 0,
  pause_start_time VARCHAR(50),
  extra_controllers INTEGER DEFAULT 0,
  snacks JSONB DEFAULT '{"cokeBottle": 0, "cokeCan": 0}'::jsonb,
  snacks_enabled BOOLEAN DEFAULT false,
  customer_name VARCHAR(255) DEFAULT '',
  customer_phone VARCHAR(20) DEFAULT '',
  start_time VARCHAR(50),
  end_time VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create unique constraint on id if it doesn't exist (for ON CONFLICT)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stations_pkey'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT stations_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ============================================================================
-- 2. INVOICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  stations JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. PAID EVENTS TABLE (for multi-browser sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS paid_events (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),
  station_ids INTEGER[] NOT NULL,
  reset_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false
);

-- ============================================================================
-- 4. SNACKS TABLE (for dynamic snack management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS snacks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stations_is_done ON stations(is_done);
CREATE INDEX IF NOT EXISTS idx_stations_game_type ON stations(game_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_paid_events_created_at ON paid_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paid_events_processed ON paid_events(processed);
CREATE INDEX IF NOT EXISTS idx_snacks_active ON snacks(active);
CREATE INDEX IF NOT EXISTS idx_snacks_display_order ON snacks(display_order);

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp (using Indian timezone)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'Asia/Kolkata');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to clean up old processed paid events (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_paid_events()
RETURNS void AS $$
BEGIN
  DELETE FROM paid_events 
  WHERE processed = true 
  AND created_at < (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Trigger to auto-update updated_at for stations
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for snacks
DROP TRIGGER IF EXISTS update_snacks_updated_at ON snacks;
CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON snacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. INSERT DEFAULT DATA
-- ============================================================================

-- Insert default snacks
INSERT INTO snacks (name, price, active, display_order) VALUES
  ('Coke Bottle', 20, true, 1),
  ('Coke Can', 40, true, 2),
  ('Lays Chips', 5, true, 3),
  ('Kurkure', 5, true, 4)
ON CONFLICT (name) DO NOTHING;

-- NO DEFAULT STATIONS - All stations must be created through Manage Stations
-- The stations table will start empty for 100% customization
-- Insert default stations (only if they don't exist)
-- INSERT INTO stations (id, name, game_type, elapsed_time, is_running, is_done, extra_controllers, snacks, customer_name, start_time, end_time)
-- VALUES
--   (1, 'PS5 Station 1', 'PS5', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (2, 'PS5 Station 2', 'PS5', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (3, 'PS5 Station 3', 'PS5', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (4, 'PS5 Station 4', 'PS5', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (5, 'PS5 Station 5', 'PS5', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (6, 'Steering Wheel', 'Steering Wheel', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL),
--   (7, 'System Game', 'System', 0, false, false, 0, '{"cokeBottle": 0, "cokeCan": 0}'::jsonb, '', NULL, NULL)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. VERIFICATION
-- ============================================================================

-- Display summary of created tables
SELECT 
  'Tables Created Successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('stations', 'invoices', 'paid_events', 'snacks')) as tables_count;

-- Display default stations
SELECT 
  id, 
  name, 
  game_type, 
  elapsed_time, 
  is_running, 
  is_done 
FROM stations 
ORDER BY id;

-- Display default snacks
SELECT 
  id,
  name,
  price,
  active,
  display_order
FROM snacks
ORDER BY display_order, name;

-- Success message
SELECT '✅ Local database setup completed successfully!' as message;

