-- Paid Events Table for Multi-Browser Sync
-- This table tracks when stations are paid/reset so all browsers can sync
-- All timestamps use Indian Standard Time (IST) - Asia/Kolkata timezone

-- Set timezone to Asia/Kolkata for this session
SET timezone = 'Asia/Kolkata';

CREATE TABLE IF NOT EXISTS paid_events (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),
  station_ids INTEGER[] NOT NULL,
  reset_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
  processed BOOLEAN DEFAULT false
);

-- Create index for faster queries on recent unprocessed events
CREATE INDEX IF NOT EXISTS idx_paid_events_created_at ON paid_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paid_events_processed ON paid_events(processed);

-- Function to clean up old processed events (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_paid_events()
RETURNS void AS $$
BEGIN
  DELETE FROM paid_events 
  WHERE processed = true 
  AND created_at < (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

