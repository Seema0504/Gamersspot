-- ============================================================================
-- GAMERS SPOT - TEST DATABASE SETUP
-- ============================================================================
-- This script creates all tables and initial data for the TEST environment
-- Run this in your Supabase TEST database (separate from production)
-- All timestamps use Indian Standard Time (IST) - Asia/Kolkata timezone
-- ============================================================================

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. CUSTOMERS TABLE
-- ============================================================================
-- Stores customer phone numbers and names
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON customers(phone_number);

-- ============================================================================
-- 2. STATIONS TABLE
-- ============================================================================
-- Stores gaming station information and session data
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  game_type VARCHAR(50) NOT NULL,
  elapsed_time INTEGER DEFAULT 0,
  is_running BOOLEAN DEFAULT false,
  is_done BOOLEAN DEFAULT false,
  extra_controllers INTEGER DEFAULT 0,
  snacks JSONB DEFAULT '{"cokeBottle": 0, "cokeCan": 0}'::jsonb,
  snacks_enabled BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  paused_time INTEGER DEFAULT 0,
  pause_start_time VARCHAR(50),
  customer_name VARCHAR(255) DEFAULT '',
  customer_phone VARCHAR(20) DEFAULT '',
  start_time VARCHAR(50),
  end_time VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stations_is_done ON stations(is_done);
CREATE INDEX IF NOT EXISTS idx_stations_game_type ON stations(game_type);

-- ============================================================================
-- 3. INVOICES TABLE
-- ============================================================================
-- Stores billing information for completed sessions
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  stations JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- ============================================================================
-- 4. SNACKS TABLE
-- ============================================================================
-- Stores snack inventory with prices
CREATE TABLE IF NOT EXISTS snacks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_snacks_active ON snacks(active);
CREATE INDEX IF NOT EXISTS idx_snacks_display_order ON snacks(display_order);

-- ============================================================================
-- 5. PAID EVENTS TABLE
-- ============================================================================
-- Tracks payment events for multi-browser synchronization
CREATE TABLE IF NOT EXISTS paid_events (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),
  station_ids INTEGER[] NOT NULL,
  reset_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  processed BOOLEAN DEFAULT false
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_paid_events_created_at ON paid_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paid_events_processed ON paid_events(processed);

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

-- Function to clean up old processed events (older than 24 hours)
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

-- Trigger to auto-update updated_at on stations table
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on customers table
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on snacks table
DROP TRIGGER IF EXISTS update_snacks_updated_at ON snacks;
CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON snacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. TEST DATA
-- ============================================================================

-- Insert default snacks for testing
INSERT INTO snacks (name, price, active, display_order) VALUES
  ('Coke Bottle', 20, true, 1),
  ('Coke Can', 40, true, 2),
  ('Lays Chips', 5, true, 3),
  ('Kurkure', 5, true, 4)
ON CONFLICT (name) DO NOTHING;

-- Insert default stations (1-8)
INSERT INTO stations (id, name, game_type) VALUES
  (1, 'PS5 Station 1', 'ps5'),
  (2, 'PS5 Station 2', 'ps5'),
  (3, 'PS5 Station 3', 'ps5'),
  (4, 'PS5 Station 4', 'ps5'),
  (5, 'PS4 Station 1', 'ps4'),
  (6, 'PS4 Station 2', 'ps4'),
  (7, 'PS4 Station 3', 'ps4'),
  (8, 'PS4 Station 4', 'ps4')
ON CONFLICT (id) DO NOTHING;

-- Insert sample test customer
INSERT INTO customers (phone_number, customer_name) VALUES
  ('9999999999', 'Test Customer')
ON CONFLICT (phone_number) DO NOTHING;

-- ============================================================================
-- 9. VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify setup

-- Check all tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify data
SELECT 'customers' as table_name, COUNT(*) as row_count FROM customers
UNION ALL
SELECT 'stations', COUNT(*) FROM stations
UNION ALL
SELECT 'snacks', COUNT(*) FROM snacks
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'paid_events', COUNT(*) FROM paid_events;

-- ============================================================================
-- Setup Complete!
-- ============================================================================
