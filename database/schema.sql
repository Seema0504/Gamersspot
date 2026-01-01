-- Gamers Spot Database Schema
-- Run this SQL in your PostgreSQL database (Neon, Supabase, etc.)
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

-- Stations table
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

-- Create unique constraint on id if it doesn't exist (for ON CONFLICT)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stations_pkey'
  ) THEN
    ALTER TABLE stations ADD CONSTRAINT stations_pkey PRIMARY KEY (id);
  END IF;
END $$;

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

-- Create index on stations for faster queries
CREATE INDEX IF NOT EXISTS idx_stations_is_done ON stations(is_done);
CREATE INDEX IF NOT EXISTS idx_stations_game_type ON stations(game_type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Function to update updated_at timestamp (using Indian timezone)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'Asia/Kolkata');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

