-- ============================================================================
-- Gamers Spot SaaS - v2.5 Full Production Schema (Supabase)
-- ============================================================================
-- Run this script in the Supabase SQL Editor to set up the complete
-- multi-tenant database structure.
-- ============================================================================

-- 1. SHOPS TABLE (Tenants)
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADMIN USERS (Authentication)
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'SHOP_OWNER', 'STAFF')),
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE, -- NULL for Super Admin
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUBSCRIPTIONS (SaaS Billing)
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL, -- e.g., 'TRIAL', 'PREMIUM_MONTHLY'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CANCELLED', 'EXPIRED'
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    monthly_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STATIONS (Multi-Tenant, Composite Key)
CREATE TABLE IF NOT EXISTS stations (
    id INTEGER NOT NULL, -- Slot ID (1, 2, 3...)
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
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
    PRIMARY KEY (shop_id, id)
);

-- 5. CUSTOMERS (Shop-Scoped Uniqueness)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, phone_number)
);

-- 6. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255) NOT NULL,
    stations JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, invoice_number)
);

-- 7. SNACKS (Inventory)
CREATE TABLE IF NOT EXISTS snacks (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, name)
);

-- 8. PRICING RULES
CREATE TABLE IF NOT EXISTS pricing_rules (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    weekday_rate INTEGER NOT NULL,
    weekend_rate INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, game_type)
);

-- 9. BONUS CONFIG
CREATE TABLE IF NOT EXISTS bonus_config (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id)
);

-- 10. PAID EVENTS (Real-time Sync)
CREATE TABLE IF NOT EXISTS paid_events (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255),
    station_ids INTEGER[] NOT NULL,
    reset_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_stations_shop_id ON stations(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ============================================================================
-- 11. DEFAULT SUPER ADMIN (BOOTSTRAP)
-- ============================================================================
-- Username: admin
-- Password: admin2026
-- Role: SUPER_ADMIN

INSERT INTO admin_users (username, password_hash, role, is_active, shop_id, created_at)
VALUES (
  'admin', 
  '$2b$10$wBmtNMqZFmxPBsfwagX3deDtJK3ahWBCHBj9071xneIMaRJl79zC.', -- Hash for 'admin2026'
  'SUPER_ADMIN', 
  true, 
  NULL, -- Super Admin has no shop_id
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Verification
-- SELECT * FROM admin_users WHERE username = 'admin';
