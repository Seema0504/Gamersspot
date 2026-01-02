# Local Database Setup Guide

## 🎯 Objective
Set up your local `multivendor` PostgreSQL database to match the Supabase production schema.

---

## 📋 Prerequisites

- PostgreSQL installed locally
- Database `multivendor` already created
- Connection: `postgresql://postgres:postgres@localhost:5432/multivendor`

---

## 🚀 Quick Setup

### Step 1: Run the SQL Script

Copy the SQL below and run it in your `multivendor` database using pgAdmin, DBeaver, or psql:

```bash
psql -U postgres -d multivendor
```

Then paste the SQL script below:

```sql
-- ============================================================================
-- Local Development Database Setup (Multivendor)
-- Matches Supabase Production Schema
-- ============================================================================

SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. SHOPS TABLE (Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    upi_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ADMIN USERS (Authentication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'SHOP_OWNER', 'STAFF')),
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. SUBSCRIPTIONS (SaaS Billing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    monthly_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. STATIONS (Multi-Tenant, Composite Key)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stations (
    id INTEGER NOT NULL,
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

-- ============================================================================
-- 5. CUSTOMERS (Shop-Scoped Uniqueness)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, phone_number)
);

-- ============================================================================
-- 6. INVOICES
-- ============================================================================
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

-- ============================================================================
-- 7. SNACKS (Inventory)
-- ============================================================================
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

-- ============================================================================
-- 8. PRICING RULES
-- ============================================================================
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

-- ============================================================================
-- 9. BONUS CONFIG
-- ============================================================================
CREATE TABLE IF NOT EXISTS bonus_config (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id)
);

-- ============================================================================
-- 10. PAID EVENTS (Real-time Sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS paid_events (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255),
    station_ids INTEGER[] NOT NULL,
    reset_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shops_deleted_at ON shops(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_deleted_at ON admin_users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stations_shop_id ON stations(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- 1. Create default shop
INSERT INTO shops (id, name, address, phone, email, is_active)
VALUES (1, 'Gamers Spot - Local Dev', 'Local Development', '9876543210', 'dev@gamersspot.local', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Super Admin
INSERT INTO admin_users (username, password_hash, role, is_active, shop_id)
VALUES (
  'admin',
  '$2b$10$wBmtNMqZFmxPBsfwagX3deDtJK3ahWBCHBj9071xneIMaRJl79zC.', -- admin2026
  'SUPER_ADMIN',
  true,
  NULL
)
ON CONFLICT (username) DO NOTHING;

-- 3. Create Shop Owner for default shop
INSERT INTO admin_users (username, password_hash, role, is_active, shop_id)
VALUES (
  'shop1',
  '$2b$10$wBmtNMqZFmxPBsfwagX3deDtJK3ahWBCHBj9071xneIMaRJl79zC.', -- admin2026
  'SHOP_OWNER',
  true,
  1
)
ON CONFLICT (username) DO NOTHING;

-- 4. Create default subscription
INSERT INTO subscriptions (shop_id, plan_name, monthly_amount, status, end_date)
VALUES (1, 'PREMIUM', 0, 'ACTIVE', NOW() + INTERVAL '1 year')
ON CONFLICT DO NOTHING;

-- 5. Create default snacks
INSERT INTO snacks (shop_id, name, price, active, display_order) VALUES
  (1, 'Coke Bottle', 20, true, 1),
  (1, 'Coke Can', 40, true, 2),
  (1, 'Lays Chips', 5, true, 3),
  (1, 'Kurkure', 5, true, 4)
ON CONFLICT (shop_id, name) DO NOTHING;

-- 6. Create default pricing rules
INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate) VALUES
  (1, 'Playstation', 150, 200),
  (1, 'Steering Wheel', 150, 150),
  (1, 'System', 100, 100),
  (1, 'buffer_minutes', 10, 10),
  (1, 'extra_controller', 50, 50)
ON CONFLICT (shop_id, game_type) DO NOTHING;

-- 7. Create default bonus config
INSERT INTO bonus_config (shop_id, config_data) VALUES
  (1, '{
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
ON CONFLICT (shop_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== Local Development Database Setup Complete ===';
  RAISE NOTICE 'Shops: %', (SELECT COUNT(*) FROM shops);
  RAISE NOTICE 'Admin Users: %', (SELECT COUNT(*) FROM admin_users);
  RAISE NOTICE 'Subscriptions: %', (SELECT COUNT(*) FROM subscriptions);
  RAISE NOTICE 'Snacks: %', (SELECT COUNT(*) FROM snacks);
  RAISE NOTICE 'Pricing Rules: %', (SELECT COUNT(*) FROM pricing_rules);
  RAISE NOTICE '';
  RAISE NOTICE '=== Login Credentials ===';
  RAISE NOTICE 'Super Admin: admin / admin2026';
  RAISE NOTICE 'Shop Owner: shop1 / admin2026';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Database ready for local development!';
END $$;
```

---

## 🔑 Default Login Credentials

After running the script, you'll have these accounts:

### Super Admin (for Admin Dashboard)
- **Username:** `admin`
- **Password:** `admin2026`
- **Access:** Full platform access, can manage all shops

### Shop Owner (for Shop Dashboard)
- **Username:** `shop1`
- **Password:** `admin2026`
- **Shop:** Gamers Spot - Local Dev (ID: 1)

---

## ✅ What Gets Created

1. **Tables (10):**
   - `shops` - Shop/tenant master table
   - `admin_users` - Authentication & users
   - `subscriptions` - Billing & plans
   - `stations` - Gaming stations
   - `customers` - Customer database
   - `invoices` - Transaction records
   - `snacks` - Inventory
   - `pricing_rules` - Dynamic pricing
   - `bonus_config` - Bonus settings
   - `paid_events` - Real-time sync

2. **Default Shop:**
   - Name: "Gamers Spot - Local Dev"
   - ID: 1
   - Status: Active
   - Subscription: Premium (1 year)

3. **Sample Data:**
   - 4 default snacks
   - Pricing rules for 3 game types
   - Bonus configuration
   - 2 admin users (Super Admin + Shop Owner)

---

## 🧪 Testing

After setup, test your local environment:

1. **Start your dev server:**
   ```bash
   npm run dev:all
   ```

2. **Test Super Admin Login:**
   - Navigate to `/admin-login`
   - Login with `admin / admin2026`
   - You should see 1 shop in the dashboard

3. **Test Shop Owner Login:**
   - Navigate to `/login`
   - Login with `shop1 / admin2026`
   - You should see the shop dashboard

4. **Create a new shop:**
   - Use Super Admin dashboard
   - Click "Create Shop"
   - Fill in details and create

---

## 🔄 Reset Database (if needed)

If you need to start fresh:

```sql
-- Drop all tables
DROP TABLE IF EXISTS paid_events CASCADE;
DROP TABLE IF EXISTS bonus_config CASCADE;
DROP TABLE IF EXISTS pricing_rules CASCADE;
DROP TABLE IF EXISTS snacks CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Then run the setup script again
```

---

## 📝 Notes

- All tables use `shop_id` for multi-tenant isolation
- Soft delete is enabled (`deleted_at` column)
- Timestamps use Asia/Kolkata timezone
- Foreign keys have CASCADE delete
- Indexes optimized for common queries

---

## ✅ Verification Checklist

After running the script, verify:

- [ ] All 10 tables created
- [ ] 1 shop exists (ID: 1)
- [ ] 2 admin users created
- [ ] 1 active subscription
- [ ] 4 snacks available
- [ ] 5 pricing rules set
- [ ] Can login as Super Admin
- [ ] Can login as Shop Owner
- [ ] Super Admin dashboard shows 1 shop

---

**You're all set for local development!** 🚀
