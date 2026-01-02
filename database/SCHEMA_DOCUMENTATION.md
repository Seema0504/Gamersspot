# Supabase Production Schema Documentation

## Overview

This document explains the complete database schema for **Gamers Spot SaaS v2.5** - a multi-tenant gaming station management system deployed on Supabase.

---

## 📋 Table of Contents

1. [Schema Overview](#schema-overview)
2. [Table Definitions](#table-definitions)
3. [Relationships](#relationships)
4. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
5. [Security & Access Control](#security--access-control)
6. [Indexes & Performance](#indexes--performance)
7. [Bootstrap Data](#bootstrap-data)
8. [Usage Examples](#usage-examples)

---

## Schema Overview

### Database Type
- **Platform**: Supabase (PostgreSQL 14+)
- **Timezone**: UTC (converted to IST in application layer)
- **Character Set**: UTF-8
- **Collation**: Default PostgreSQL

### Architecture Pattern
- **Multi-Tenant**: Shop-based isolation
- **Composite Keys**: Used for tenant-scoped entities (e.g., stations)
- **Foreign Keys**: Cascade deletes for data integrity
- **JSONB**: Used for flexible, schema-less data (snacks, config)

### Total Tables: 10
1. `shops` - Tenant/Shop records
2. `admin_users` - Authentication & authorization
3. `subscriptions` - SaaS billing
4. `stations` - Gaming stations (multi-tenant)
5. `customers` - Customer database (shop-scoped)
6. `invoices` - Billing records
7. `snacks` - Inventory management
8. `pricing_rules` - Dynamic pricing configuration
9. `bonus_config` - Bonus time settings
10. `paid_events` - Real-time synchronization

---

## Table Definitions

### 1. `shops` (Tenants)

**Purpose**: Represents each gaming cafe/shop in the SaaS system.

```sql
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns**:
- `id`: Auto-incrementing shop identifier
- `name`: Shop/cafe name (e.g., "Gamers Spot - Downtown")
- `address`: Physical location
- `phone`: Contact number
- `email`: Shop email for notifications
- `is_active`: Soft delete flag (inactive shops can't access system)
- `created_at`: Registration timestamp
- `updated_at`: Last modification timestamp

**Business Rules**:
- Each shop is a separate tenant
- Inactive shops cannot log in or access data
- Deleting a shop cascades to all related data

---

### 2. `admin_users` (Authentication)

**Purpose**: User accounts with role-based access control.

```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'SHOP_OWNER', 'STAFF')),
    shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns**:
- `id`: User identifier
- `username`: Unique login name
- `password_hash`: bcrypt hashed password (never store plain text!)
- `role`: User permission level
  - `SUPER_ADMIN`: Platform administrator (shop_id = NULL)
  - `SHOP_OWNER`: Shop manager (full access to their shop)
  - `STAFF`: Employee (limited access)
- `shop_id`: Which shop this user belongs to (NULL for Super Admin)
- `is_active`: Account status
- `last_login`: Last successful login timestamp

**Security**:
- Passwords hashed with bcrypt (cost factor: 10)
- Username must be unique across entire platform
- Super Admin has no shop_id (can access all shops)
- Deleting a shop deletes all its users

---

### 3. `subscriptions` (SaaS Billing)

**Purpose**: Track subscription plans and billing status for each shop.

```sql
CREATE TABLE subscriptions (
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
```

**Columns**:
- `shop_id`: Which shop this subscription belongs to
- `plan_name`: Subscription tier (e.g., 'TRIAL', 'PREMIUM_MONTHLY', 'ENTERPRISE')
- `status`: Current state
  - `ACTIVE`: Subscription is valid
  - `CANCELLED`: User cancelled (still active until end_date)
  - `EXPIRED`: Past end_date, access blocked
- `start_date`: When subscription began
- `end_date`: When subscription expires (NULL for lifetime plans)
- `monthly_amount`: Recurring charge amount

**Business Rules**:
- One active subscription per shop
- Expired subscriptions block shop access
- Trial plans typically have 14-30 day duration

---

### 4. `stations` (Gaming Stations - Multi-Tenant)

**Purpose**: Represents individual gaming stations/consoles in each shop.

```sql
CREATE TABLE stations (
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
```

**Composite Primary Key**: `(shop_id, id)`
- Allows Shop A and Shop B to both have "Station 1"
- Ensures station IDs are unique within each shop

**Columns**:
- `id`: Station slot number (1, 2, 3, etc.) - scoped to shop
- `shop_id`: Which shop owns this station
- `name`: Display name (e.g., "PS5 Station 1", "Xbox Seat 3")
- `game_type`: Type of gaming console (e.g., "PS5", "PS4", "Xbox", "PC")
- `elapsed_time`: Total time played in seconds
- `is_running`: Currently active session
- `is_done`: Session completed, ready for billing
- `is_paused`: Session paused (timer stopped)
- `paused_time`: Total paused duration in seconds
- `pause_start_time`: When current pause began (ISO timestamp)
- `extra_controllers`: Number of additional controllers (affects pricing)
- `snacks`: JSONB object with snack quantities `{"cokeCan": 2, "chips": 1}`
- `snacks_enabled`: Whether snacks feature is enabled for this station
- `customer_name`: Player name
- `customer_phone`: Player phone number
- `start_time`: Session start timestamp (ISO format)
- `end_time`: Session end timestamp (ISO format)

**State Machine**:
```
IDLE → RUNNING → PAUSED → RUNNING → DONE → IDLE
```

**JSONB Snacks Example**:
```json
{
  "cokeBottle": 1,
  "cokeCan": 2,
  "laysChips": 3
}
```

---

### 5. `customers` (Customer Database)

**Purpose**: Store customer information for repeat business tracking.

```sql
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, phone_number)
);
```

**Unique Constraint**: `(shop_id, phone_number)`
- Same phone number can exist in different shops
- Within a shop, phone numbers must be unique

**Columns**:
- `phone_number`: Customer's phone (10 digits in India)
- `customer_name`: Customer's name
- `shop_id`: Which shop this customer visited

**Use Cases**:
- Auto-fill customer name when phone is entered
- Customer loyalty tracking
- Marketing campaigns

---

### 6. `invoices` (Billing Records)

**Purpose**: Store completed transaction records.

```sql
CREATE TABLE invoices (
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
```

**Invoice Number Format**: `INV-{SHOP_ID}-{YYYYMMDD}-{SEQUENCE}`
- Example: `INV-11-20260102-0001`
- Shop 11's first invoice on January 2, 2026

**Columns**:
- `invoice_number`: Unique identifier (per shop)
- `stations`: JSONB array of station session details
- `subtotal`: Base cost before discount
- `discount`: Discount amount (can be negative for surcharges)
- `total`: Final amount charged
- `created_at`: Invoice generation timestamp

**JSONB Stations Example**:
```json
[
  {
    "id": 1,
    "name": "PS5 Station 1",
    "gameType": "PS5",
    "elapsedTime": 7200,
    "customerName": "John Doe",
    "snacks": {"cokeCan": 2}
  }
]
```

---

### 7. `snacks` (Inventory Management)

**Purpose**: Manage snacks/extras available for purchase.

```sql
CREATE TABLE snacks (
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
```

**Columns**:
- `name`: Snack name (e.g., "Coke Can", "Lays Chips")
- `price`: Price per unit
- `active`: Whether currently available for sale
- `display_order`: Sort order in UI (lower = first)

**Business Rules**:
- Each shop can have different snack menus
- Same snack name can have different prices per shop
- Inactive snacks don't show in UI but remain in historical invoices

---

### 8. `pricing_rules` (Dynamic Pricing)

**Purpose**: Configure hourly rates for different game types and days.

```sql
CREATE TABLE pricing_rules (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    weekday_rate INTEGER NOT NULL,
    weekend_rate INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, game_type)
);
```

**Columns**:
- `game_type`: Console type (e.g., "PS5", "PS4", "Xbox", "PC")
- `weekday_rate`: Hourly rate Monday-Friday (in rupees)
- `weekend_rate`: Hourly rate Saturday-Sunday (in rupees)

**Example**:
```
game_type: "PS5"
weekday_rate: 300 (₹300/hour)
weekend_rate: 400 (₹400/hour)
```

---

### 9. `bonus_config` (Bonus Time Settings)

**Purpose**: Configure free bonus time for extended play sessions.

```sql
CREATE TABLE bonus_config (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id)
);
```

**JSONB Config Example**:
```json
{
  "bonusRules": [
    {
      "minHours": 2,
      "bonusMinutes": 15,
      "description": "Play 2 hours, get 15 minutes free"
    },
    {
      "minHours": 4,
      "bonusMinutes": 30,
      "description": "Play 4 hours, get 30 minutes free"
    }
  ]
}
```

**Business Logic**:
- Bonus time is deducted from total elapsed time before billing
- Only the highest applicable bonus is applied
- Encourages longer play sessions

---

### 10. `paid_events` (Real-Time Sync)

**Purpose**: Synchronize "Mark as Paid" actions across multiple browser tabs/devices.

```sql
CREATE TABLE paid_events (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255),
    station_ids INTEGER[] NOT NULL,
    reset_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns**:
- `invoice_number`: Related invoice
- `station_ids`: Array of station IDs to reset `[1, 3, 5]`
- `reset_data`: JSONB with reset state for each station
- `processed`: Whether this event has been consumed by clients

**Use Case**:
1. User clicks "Mark as Paid" on Device A
2. Event inserted into `paid_events`
3. Device B polls this table every 2 seconds
4. Device B sees new event and resets stations
5. Multi-device synchronization achieved

---

## Relationships

### Entity Relationship Diagram (ERD)

```
shops (1) ──┬─── (N) admin_users
            ├─── (N) subscriptions
            ├─── (N) stations
            ├─── (N) customers
            ├─── (N) invoices
            ├─── (N) snacks
            ├─── (N) pricing_rules
            ├─── (1) bonus_config
            └─── (N) paid_events
```

### Foreign Key Constraints

All child tables have:
```sql
shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE
```

**Cascade Delete Behavior**:
- Deleting a shop deletes ALL related data
- Ensures no orphaned records
- Use with caution in production!

---

## Multi-Tenancy Architecture

### Tenant Isolation

**Shop-Based Isolation**:
- Every table (except `shops` and `admin_users`) has `shop_id`
- Queries MUST filter by `shop_id` to prevent data leakage
- Application layer enforces tenant context

**Example Query Pattern**:
```sql
-- ✅ CORRECT: Filtered by shop_id
SELECT * FROM stations WHERE shop_id = 11 AND is_running = true;

-- ❌ WRONG: No shop_id filter (security risk!)
SELECT * FROM stations WHERE is_running = true;
```

### Row-Level Security (RLS)

**Recommended Supabase RLS Policies**:

```sql
-- Enable RLS on all tables
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)

-- Example policy: Users can only see their shop's data
CREATE POLICY "Users can view own shop data" ON stations
  FOR SELECT
  USING (shop_id = current_setting('app.current_shop_id')::INTEGER);
```

---

## Security & Access Control

### Password Security

**Hashing Algorithm**: bcrypt
- **Cost Factor**: 10 (2^10 = 1024 iterations)
- **Salt**: Automatically generated per password
- **Hash Length**: 60 characters

**Example**:
```javascript
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('admin2026', 10);
// Result: $2b$10$wBmtNMqZFmxPBsfwagX3deDtJK3ahWBCHBj9071xneIMaRJl79zC.
```

### Role-Based Access Control (RBAC)

| Role | Permissions | shop_id |
|------|-------------|---------|
| `SUPER_ADMIN` | Full platform access, manage all shops | NULL |
| `SHOP_OWNER` | Full access to own shop data | Required |
| `STAFF` | Limited access (no settings/reports) | Required |

### Authentication Flow

1. User submits username + password
2. Backend queries `admin_users` by username
3. Compare password with `bcrypt.compare(password, password_hash)`
4. Check `is_active = true`
5. Check shop subscription status
6. Generate JWT token with `shop_id` and `role`
7. All subsequent requests include JWT
8. Middleware extracts `shop_id` from JWT
9. Queries automatically filter by `shop_id`

---

## Indexes & Performance

### Existing Indexes

```sql
-- Primary Keys (automatic indexes)
shops(id)
admin_users(id)
subscriptions(id)
stations(shop_id, id) -- Composite
customers(id)
invoices(id)
snacks(id)
pricing_rules(id)
bonus_config(id)
paid_events(id)

-- Unique Constraints (automatic indexes)
admin_users(username)
customers(shop_id, phone_number)
invoices(shop_id, invoice_number)
snacks(shop_id, name)
pricing_rules(shop_id, game_type)
bonus_config(shop_id)

-- Explicit Indexes
idx_stations_shop_id ON stations(shop_id)
idx_invoices_shop_id ON invoices(shop_id)
idx_customers_shop_id ON customers(shop_id)
idx_admin_users_username ON admin_users(username)
```

### Query Optimization Tips

**1. Always Filter by shop_id First**:
```sql
-- ✅ FAST: Uses idx_stations_shop_id
SELECT * FROM stations WHERE shop_id = 11 AND is_running = true;

-- ❌ SLOW: Full table scan
SELECT * FROM stations WHERE is_running = true;
```

**2. Use JSONB Indexes for Frequent Queries**:
```sql
-- If you frequently query snacks by specific items
CREATE INDEX idx_stations_snacks_gin ON stations USING GIN (snacks);

-- Then this query is fast:
SELECT * FROM stations WHERE snacks ? 'cokeCan';
```

**3. Partition Large Tables** (if needed):
```sql
-- For shops with millions of invoices, partition by month
CREATE TABLE invoices_2026_01 PARTITION OF invoices
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## Bootstrap Data

### Default Super Admin

**Credentials**:
- **Username**: `admin`
- **Password**: `admin2026`
- **Role**: `SUPER_ADMIN`

**Security Warning**:
⚠️ **CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!**

```sql
-- After first login, update password:
UPDATE admin_users 
SET password_hash = '$2b$10$NEW_HASH_HERE'
WHERE username = 'admin';
```

### Creating Your First Shop

```sql
-- 1. Create a shop
INSERT INTO shops (name, address, phone, email) 
VALUES ('My Gaming Cafe', '123 Main St', '9876543210', 'cafe@example.com')
RETURNING id; -- Returns shop_id (e.g., 1)

-- 2. Create shop owner account
INSERT INTO admin_users (username, password_hash, role, shop_id)
VALUES (
  'owner1',
  '$2b$10$...', -- Hash of your password
  'SHOP_OWNER',
  1 -- Use shop_id from step 1
);

-- 3. Create subscription
INSERT INTO subscriptions (shop_id, plan_name, status, end_date)
VALUES (1, 'TRIAL', 'ACTIVE', NOW() + INTERVAL '14 days');

-- 4. Create initial stations
INSERT INTO stations (id, shop_id, name, game_type)
VALUES 
  (1, 1, 'PS5 Station 1', 'PS5'),
  (2, 1, 'PS5 Station 2', 'PS5'),
  (3, 1, 'PS4 Station 1', 'PS4');

-- 5. Set pricing
INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
VALUES 
  (1, 'PS5', 300, 400),
  (1, 'PS4', 200, 250);

-- 6. Add snacks
INSERT INTO snacks (shop_id, name, price, display_order)
VALUES 
  (1, 'Coke Can', 40, 1),
  (1, 'Coke Bottle', 60, 2),
  (1, 'Lays Chips', 20, 3);
```

---

## Usage Examples

### Common Queries

**1. Get All Active Stations for a Shop**:
```sql
SELECT id, name, game_type, is_running, is_done, customer_name
FROM stations
WHERE shop_id = 11
  AND is_active = true
ORDER BY id;
```

**2. Generate Daily Revenue Report**:
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_invoices,
  SUM(total) as total_revenue,
  SUM(discount) as total_discounts
FROM invoices
WHERE shop_id = 11
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY DATE(created_at);
```

**3. Find Customers by Phone**:
```sql
SELECT customer_name, phone_number, created_at
FROM customers
WHERE shop_id = 11
  AND phone_number = '9876543210';
```

**4. Check Subscription Status**:
```sql
SELECT s.name as shop_name, sub.plan_name, sub.status, sub.end_date
FROM shops s
JOIN subscriptions sub ON s.id = sub.shop_id
WHERE s.id = 11
  AND sub.status = 'ACTIVE';
```

**5. Get Unprocessed Paid Events**:
```sql
SELECT id, invoice_number, station_ids, created_at
FROM paid_events
WHERE shop_id = 11
  AND processed = false
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

---

## Maintenance & Best Practices

### Regular Maintenance Tasks

**1. Archive Old Invoices** (annually):
```sql
-- Move invoices older than 3 years to archive table
CREATE TABLE invoices_archive AS
SELECT * FROM invoices WHERE created_at < NOW() - INTERVAL '3 years';

DELETE FROM invoices WHERE created_at < NOW() - INTERVAL '3 years';
```

**2. Clean Up Processed Events** (daily):
```sql
DELETE FROM paid_events 
WHERE processed = true 
  AND created_at < NOW() - INTERVAL '7 days';
```

**3. Update Statistics** (weekly):
```sql
ANALYZE stations;
ANALYZE invoices;
ANALYZE customers;
```

### Backup Strategy

**Supabase Automatic Backups**:
- Daily backups (retained for 7 days on free tier)
- Point-in-time recovery (paid plans)

**Manual Backup**:
```bash
# Export entire database
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql

# Export specific shop data
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --table=stations --table=invoices \
  --where="shop_id=11" > shop_11_backup.sql
```

---

## Migration from v2.4 to v2.5

If upgrading from previous version:

```sql
-- Add shop_id to invoices (if not exists)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS shop_id INTEGER DEFAULT 1 NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);

-- Reset sequence
SELECT setval('invoices_id_seq', (SELECT MAX(id) FROM invoices));
```

See `database/supabase_production_migration_2026-01-02.sql` for full migration script.

---

## Troubleshooting

### Common Issues

**1. "relation does not exist"**
- Solution: Run the schema script in Supabase SQL Editor
- Ensure you're connected to the correct database

**2. "duplicate key value violates unique constraint"**
- Solution: Check for existing records before INSERT
- Use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`

**3. "permission denied for table"**
- Solution: Check RLS policies
- Ensure JWT contains correct shop_id

**4. Slow queries**
- Solution: Add indexes on frequently queried columns
- Use `EXPLAIN ANALYZE` to identify bottlenecks

---

## Support & Resources

- **Supabase Documentation**: https://supabase.com/docs
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Project Repository**: (Your GitHub repo)
- **Migration Scripts**: `database/MIGRATIONS_README.md`

---

**Last Updated**: January 2, 2026  
**Schema Version**: 2.5  
**Author**: Gamers Spot Development Team
