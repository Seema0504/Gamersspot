-- Snacks Configuration Table
-- This table stores all available snacks with their prices
-- Allows easy addition of new snacks without code changes
-- All timestamps use Indian Standard Time (IST) - Asia/Kolkata timezone

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS snacks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_snacks_active ON snacks(active);
CREATE INDEX IF NOT EXISTS idx_snacks_display_order ON snacks(display_order);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_snacks_updated_at BEFORE UPDATE ON snacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default snacks
INSERT INTO snacks (name, price, active, display_order) VALUES
  ('Coke Bottle', 20, true, 1),
  ('Coke Can', 40, true, 2),
  ('Lays Chips', 5, true, 3),
  ('Kurkure', 5, true, 4)
ON CONFLICT (name) DO NOTHING;


