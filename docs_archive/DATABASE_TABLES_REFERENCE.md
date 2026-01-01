# 📊 Multi-Vendor Database - Complete Table Structure

**Database:** `multivendor`  
**Schema:** `multivendor`  
**Total Tables:** 7

---

## 📋 Table Overview

| # | Table Name | Purpose | Row Count |
|---|------------|---------|-----------|
| 1 | **tenants** | Master shop registry | 1 (default tenant) |
| 2 | **stations** | Gaming stations per tenant | 0 (ready for data) |
| 3 | **invoices** | Billing records per tenant | 0 (ready for data) |
| 4 | **paid_events** | Multi-device sync per tenant | 0 (ready for data) |
| 5 | **snacks** | Items/snacks per tenant | 4 (default items) |
| 6 | **customers** | Customer database per tenant | 0 (ready for data) |
| 7 | **settings** | Pricing/bonus config per tenant | 2 (pricing, bonus) |

---

## 1️⃣ **multivendor.tenants** (Master Table)

**Purpose:** Registry of all gaming shops

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment tenant ID |
| `tenant_code` | VARCHAR(50) | UNIQUE NOT NULL | Unique identifier (e.g., 'default', 'shop2') |
| `shop_name` | VARCHAR(255) | NOT NULL | Display name |
| `owner_name` | VARCHAR(255) | NULL | Shop owner name |
| `contact_phone` | VARCHAR(20) | NULL | Contact number |
| `contact_email` | VARCHAR(255) | NULL | Contact email |
| `address` | TEXT | NULL | Shop address |
| `city` | VARCHAR(100) | NULL | City |
| `state` | VARCHAR(100) | NULL | State |
| `country` | VARCHAR(100) | DEFAULT 'India' | Country |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `subscription_plan` | VARCHAR(50) | DEFAULT 'basic' | Subscription tier |
| `subscription_expires_at` | TIMESTAMPTZ | NULL | Subscription expiry |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Registration date |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| `settings` | JSONB | DEFAULT '{}' | Shop-specific settings |

**Current Data:**
```
id: 1
tenant_code: default
shop_name: Gamers Spot - Main Branch
is_active: true
subscription_plan: premium
```

---

## 2️⃣ **multivendor.stations**

**Purpose:** Gaming stations with tenant isolation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment station ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `station_number` | INTEGER | NOT NULL | Station number within tenant |
| `name` | VARCHAR(255) | NOT NULL | Station display name |
| `game_type` | VARCHAR(50) | NOT NULL | 'Playstation', 'Steering Wheel', 'System' |
| `elapsed_time` | INTEGER | DEFAULT 0 | Elapsed time in seconds |
| `is_running` | BOOLEAN | DEFAULT false | Timer running status |
| `is_done` | BOOLEAN | DEFAULT false | Session completed flag |
| `is_paused` | BOOLEAN | DEFAULT false | Timer paused status |
| `paused_time` | INTEGER | DEFAULT 0 | Total paused duration |
| `pause_start_time` | VARCHAR(50) | NULL | Pause start timestamp |
| `extra_controllers` | INTEGER | DEFAULT 0 | Number of extra controllers |
| `snacks` | JSONB | DEFAULT '{}' | Snacks consumed |
| `snacks_enabled` | BOOLEAN | DEFAULT false | Snacks feature enabled |
| `customer_name` | VARCHAR(255) | DEFAULT '' | Customer name |
| `customer_phone` | VARCHAR(20) | DEFAULT '' | Customer phone |
| `start_time` | VARCHAR(50) | NULL | Session start time |
| `end_time` | VARCHAR(50) | NULL | Session end time |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** `(tenant_id, station_number)`

---

## 3️⃣ **multivendor.invoices**

**Purpose:** Billing records with tenant isolation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment invoice ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `invoice_number` | VARCHAR(255) | NOT NULL | Invoice number |
| `stations` | JSONB | NOT NULL | Array of station data |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Subtotal before discount |
| `discount` | DECIMAL(10,2) | DEFAULT 0 | Discount amount |
| `total` | DECIMAL(10,2) | NOT NULL | Final total |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Invoice creation |

**Unique Constraint:** `(tenant_id, invoice_number)`

---

## 4️⃣ **multivendor.paid_events**

**Purpose:** Multi-device synchronization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment event ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `invoice_number` | VARCHAR(255) | NULL | Associated invoice |
| `station_ids` | INTEGER[] | NOT NULL | Array of station IDs |
| `reset_data` | JSONB | NOT NULL | Station reset state |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Event creation |
| `processed` | BOOLEAN | DEFAULT false | Processing status |

---

## 5️⃣ **multivendor.snacks**

**Purpose:** Items/snacks per tenant

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment snack ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `name` | VARCHAR(255) | NOT NULL | Snack name |
| `price` | DECIMAL(10,2) | NOT NULL | Price per unit |
| `active` | BOOLEAN | DEFAULT true | Active status |
| `display_order` | INTEGER | DEFAULT 0 | Display order |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** `(tenant_id, name)`

**Current Data (tenant_id = 1):**
```
1. Coke Bottle - ₹20
2. Coke Can - ₹40
3. Lays Chips - ₹5
4. Kurkure - ₹5
```

---

## 6️⃣ **multivendor.customers**

**Purpose:** Customer database per tenant

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment customer ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `phone_number` | VARCHAR(20) | NOT NULL | Customer phone |
| `customer_name` | VARCHAR(255) | NOT NULL | Customer name |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | First visit |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** `(tenant_id, phone_number)`

---

## 7️⃣ **multivendor.settings**

**Purpose:** Pricing and bonus configuration per tenant

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment setting ID |
| `tenant_id` | INTEGER | NOT NULL, FK → tenants(id) | Tenant owner |
| `setting_type` | VARCHAR(50) | NOT NULL | 'pricing', 'bonus', etc. |
| `setting_data` | JSONB | NOT NULL | Configuration data |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update |

**Unique Constraint:** `(tenant_id, setting_type)`

**Current Data (tenant_id = 1):**

**1. Pricing Configuration:**
```json
{
  "Playstation": {
    "weekday": 150,
    "weekend": 200
  },
  "Steering Wheel": {
    "weekday": 150,
    "weekend": 150
  },
  "System": {
    "weekday": 100,
    "weekend": 100
  },
  "extraControllerRate": 50,
  "bufferMinutes": 10
}
```

**2. Bonus Configuration:**
```json
{
  "Playstation": {
    "weekday": {
      "oneHour": 900,      // 15 min bonus
      "twoHours": 1800,    // 30 min bonus
      "threeHours": 3600   // 60 min bonus
    },
    "weekend": {
      "oneHour": 0,
      "twoHours": 0,
      "threeHours": 0
    }
  }
}
```

---

## 🔑 Indexes

**Performance Optimization:**

| Table | Index Name | Columns |
|-------|------------|---------|
| tenants | `idx_tenants_tenant_code` | tenant_code |
| tenants | `idx_tenants_is_active` | is_active |
| stations | `idx_mv_stations_tenant_id` | tenant_id |
| stations | `idx_mv_stations_is_done` | is_done |
| stations | `idx_mv_stations_game_type` | game_type |
| stations | `idx_mv_stations_tenant_station` | tenant_id, station_number |
| invoices | `idx_mv_invoices_tenant_id` | tenant_id |
| invoices | `idx_mv_invoices_created_at` | created_at |
| invoices | `idx_mv_invoices_tenant_date` | tenant_id, created_at |
| paid_events | `idx_mv_paid_events_tenant_id` | tenant_id |
| paid_events | `idx_mv_paid_events_created_at` | created_at DESC |
| paid_events | `idx_mv_paid_events_processed` | processed |
| snacks | `idx_mv_snacks_tenant_id` | tenant_id |
| snacks | `idx_mv_snacks_active` | active |
| customers | `idx_mv_customers_tenant_id` | tenant_id |
| customers | `idx_mv_customers_phone` | phone_number |
| settings | `idx_mv_settings_tenant_id` | tenant_id |

---

## ⚙️ Functions

| Function | Purpose |
|----------|---------|
| `update_updated_at_column()` | Auto-update updated_at timestamp |
| `cleanup_old_paid_events()` | Clean up old processed events (24h+) |
| `get_next_station_number(tenant_id)` | Get next available station number |

---

## 🔗 Relationships

```
tenants (1) ──┬── (many) stations
              ├── (many) invoices
              ├── (many) paid_events
              ├── (many) snacks
              ├── (many) customers
              └── (many) settings
```

**All relationships use `ON DELETE CASCADE`** - deleting a tenant removes all their data.

---

## 📊 Current Database State

| Metric | Value |
|--------|-------|
| **Total Tables** | 7 |
| **Total Tenants** | 1 (default) |
| **Total Stations** | 0 (ready for data) |
| **Total Invoices** | 0 (ready for data) |
| **Total Snacks** | 4 (default items) |
| **Total Customers** | 0 (ready for data) |
| **Total Settings** | 2 (pricing, bonus) |
| **Total Indexes** | 17 |
| **Total Functions** | 3 |

---

## ✅ Database Ready For:

- ✅ Multi-tenant gaming station management
- ✅ Tenant-isolated data storage
- ✅ Scalable to unlimited shops
- ✅ Complete data isolation per tenant
- ✅ Production-ready with indexes and constraints

---

**Generated:** January 1, 2026  
**Database:** multivendor  
**Schema:** multivendor  
**Status:** Ready for use
