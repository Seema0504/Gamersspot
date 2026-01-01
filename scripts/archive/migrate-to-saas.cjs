const { Client } = require('pg');
const { resolve } = require('path');
const dotenv = require('dotenv');

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// SQL MIGRATION SCRIPT
const MIGRATION_SQL = `
BEGIN;

-- 1. Create Shops Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Default Shop (Migration Bucket)
-- ------------------------------------------------------------------------------
INSERT INTO shops (id, name, is_active)
VALUES (1, 'Gamers Spot HQ', true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to ensure next shop uses ID 2
SELECT setval('shops_id_seq', (SELECT MAX(id) FROM shops));


-- 3. Create Subscriptions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) DEFAULT 'PREMIUM_MONTHLY',
    monthly_amount DECIMAL(10,2) DEFAULT 0.00,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ, -- If NULL, lifetime active
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CANCELLED, GRACE_PERIOD
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_payment_date TIMESTAMPTZ
);

-- Seed subscription for default shop (Lifetime access for migration)
INSERT INTO subscriptions (shop_id, plan_name, status, end_date)
VALUES (1, 'LEGACY_MIGRATION', 'ACTIVE', NOW() + INTERVAL '10 years')
ON CONFLICT DO NOTHING;


-- 4. Modify admin_users (RBAC)
-- ------------------------------------------------------------------------------
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'SHOP_OWNER',
ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id);

-- Update existing users to be SHOP_OWNERs of the default shop
UPDATE admin_users SET shop_id = 1, role = 'SHOP_OWNER' WHERE shop_id IS NULL;


-- 5. Add shop_id to Operational Tables
-- ------------------------------------------------------------------------------

-- Helper function to safely add isolation
CREATE OR REPLACE FUNCTION add_shop_isolation(tbl_name text) RETURNS void AS $$
BEGIN
    -- Add column if not exists
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS shop_id INTEGER', tbl_name);
    
    -- Link existing data to Shop 1
    EXECUTE format('UPDATE %I SET shop_id = 1 WHERE shop_id IS NULL', tbl_name);
    
    -- Add Not Null Constraint
    EXECUTE format('ALTER TABLE %I ALTER COLUMN shop_id SET NOT NULL', tbl_name);
    
    -- Add Foreign Key
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS fk_%I_shop', tbl_name, tbl_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%I_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE', tbl_name, tbl_name);
    
    -- Add Index
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_shop_id ON %I(shop_id)', tbl_name, tbl_name);
END;
$$ LANGUAGE plpgsql;

-- Apply to operational tables
SELECT add_shop_isolation('stations');
SELECT add_shop_isolation('invoices');
SELECT add_shop_isolation('snacks');
SELECT add_shop_isolation('customers');
SELECT add_shop_isolation('paid_events');
SELECT add_shop_isolation('bonus_config');

-- 6. Special Handling for Pricing Rules (Composite PK)
-- ------------------------------------------------------------------------------
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS shop_id INTEGER;
UPDATE pricing_rules SET shop_id = 1 WHERE shop_id IS NULL;
ALTER TABLE pricing_rules ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE pricing_rules ADD CONSTRAINT fk_pricing_rules_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- Drop old PK and constraints if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_rules_pkey') THEN
        ALTER TABLE pricing_rules DROP CONSTRAINT pricing_rules_pkey;
    END IF;
END $$;

-- Create new Composite PK
ALTER TABLE pricing_rules ADD PRIMARY KEY (shop_id, game_type);


-- 7. Cleanup
-- ------------------------------------------------------------------------------
DROP FUNCTION add_shop_isolation;

COMMIT;
`;

// EXECUTION
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
    console.error('❌ POSTGRES_URL not found via .env.local');
    process.exit(1);
}

const client = new Client({ connectionString });

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');
        await client.connect();

        console.log('🚀 Starting SaaS Migration...');
        await client.query(MIGRATION_SQL);

        console.log('✅ Migration Successful!');

        // Verify
        const shops = await client.query('SELECT * FROM shops');
        console.log(`\n📋 Registered Shops: ${shops.rows.length}`);
        console.log(shops.rows);

    } catch (e) {
        console.error('❌ Migration Failed:', e);
        if (e.code === '23505') {
            console.log('ℹ️ (Duplicate Key Error usually means migration already ran partially)');
        }
    } finally {
        await client.end();
    }
}

runMigration();
