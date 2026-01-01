-- Supabase PostgreSQL Setup for Gamers Spot
-- Run this in Supabase SQL Editor
-- All timestamps use Indian Standard Time (IST) - Asia/Kolkata timezone

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

-- Customers table to store customer phone numbers and names
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create index on phone_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone_number ON customers(phone_number);

-- Stations table (with all latest columns)
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

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  stations JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Snacks table
CREATE TABLE IF NOT EXISTS snacks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Paid events table (for multi-device sync)
CREATE TABLE IF NOT EXISTS paid_events (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),
  station_ids INTEGER[] NOT NULL,
  reset_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  processed BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stations_is_done ON stations(is_done);
CREATE INDEX IF NOT EXISTS idx_stations_game_type ON stations(game_type);
CREATE INDEX IF NOT EXISTS idx_stations_is_running ON stations(is_running);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_snacks_active ON snacks(active);
CREATE INDEX IF NOT EXISTS idx_snacks_display_order ON snacks(display_order);
CREATE INDEX IF NOT EXISTS idx_paid_events_created_at ON paid_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paid_events_processed ON paid_events(processed);

-- Function to update updated_at timestamp automatically (using Indian timezone)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'Asia/Kolkata');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on station updates
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at 
    BEFORE UPDATE ON stations
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on snacks
DROP TRIGGER IF EXISTS update_snacks_updated_at ON snacks;
CREATE TRIGGER update_snacks_updated_at 
    BEFORE UPDATE ON snacks
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at on customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default snacks
INSERT INTO snacks (name, price, active, display_order) VALUES
  ('Coke Bottle', 20, true, 1),
  ('Coke Can', 40, true, 2),
  ('Lays Chips', 5, true, 3),
  ('Kurkure', 5, true, 4)
ON CONFLICT (name) DO NOTHING;

-- Function to clean up old processed paid events
CREATE OR REPLACE FUNCTION cleanup_old_paid_events()
RETURNS void AS $$
BEGIN
  DELETE FROM paid_events 
  WHERE processed = true 
  AND created_at < (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

