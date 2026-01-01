# 🏪 Multi-Vendor Architecture Guide

**Generated:** January 1, 2026  
**Version:** 3.0 - Multi-Vendor Support  
**Purpose:** Transform Gamers Spot from single-shop to multi-shop platform

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Changes](#architecture-changes)
3. [Database Schema](#database-schema)
4. [Setup Instructions](#setup-instructions)
5. [Code Migration Guide](#code-migration-guide)
6. [API Changes](#api-changes)
7. [Testing Multi-Vendor](#testing-multi-vendor)
8. [Adding New Tenants](#adding-new-tenants)

---

## 🎯 Overview

### What Changed?

The application has been upgraded from a **single-tenant** system (one shop) to a **multi-tenant** system (multiple shops) using PostgreSQL schema-based isolation.

### Key Benefits

✅ **Data Isolation** - Each shop's data is completely separate  
✅ **Shared Infrastructure** - One codebase, one database, multiple shops  
✅ **Scalability** - Easily add new shops without code changes  
✅ **Cost Effective** - Share hosting costs across all shops  
✅ **Centralized Management** - Manage all shops from one platform  

### Architecture Type

**Schema-Based Multi-Tenancy:**
- All shops share the same database
- Each shop's data is in a separate schema (`multivendor`)
- Tenant isolation via `tenant_id` foreign key
- Search path controls which schema is accessed

---

## 🏗️ Architecture Changes

### Before (Single-Tenant)

```
Database: gamersspot-local
Schema: public
├── stations (all stations)
├── invoices (all invoices)
├── snacks (all snacks)
└── customers (all customers)
```

### After (Multi-Tenant)

```
Database: gamersspot-local
Schema: multivendor
├── tenants (master table - all shops)
├── stations (tenant_id + data)
├── invoices (tenant_id + data)
├── snacks (tenant_id + data)
├── customers (tenant_id + data)
├── paid_events (tenant_id + data)
└── settings (tenant_id + data)
```

### Tenant Isolation

Every table (except `tenants`) has:
- `tenant_id` column (foreign key to `tenants.id`)
- `ON DELETE CASCADE` - deleting a tenant deletes all their data
- Unique constraints scoped to tenant (e.g., `UNIQUE(tenant_id, invoice_number)`)

---

## 🗄️ Database Schema

### 1. Tenants Table (Master)

```sql
CREATE TABLE multivendor.tenants (
  id SERIAL PRIMARY KEY,
  tenant_code VARCHAR(50) UNIQUE NOT NULL,  -- 'shop1', 'shop2', etc.
  shop_name VARCHAR(255) NOT NULL,           -- 'Gamers Spot - MG Road'
  owner_name VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  is_active BOOLEAN DEFAULT true,
  subscription_plan VARCHAR(50) DEFAULT 'basic',
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);
```

**Purpose:** Master registry of all gaming shops

### 2. Stations Table (Tenant-Scoped)

```sql
CREATE TABLE multivendor.stations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES multivendor.tenants(id) ON DELETE CASCADE,
  station_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  game_type VARCHAR(50) NOT NULL,
  -- ... all existing columns ...
  UNIQUE(tenant_id, station_number)
);
```

**Key Changes:**
- Added `tenant_id` foreign key
- Added `station_number` (1, 2, 3... per tenant)
- Unique constraint: `(tenant_id, station_number)`

### 3. Other Tables

All tables follow the same pattern:
- `invoices`: `UNIQUE(tenant_id, invoice_number)`
- `snacks`: `UNIQUE(tenant_id, name)`
- `customers`: `UNIQUE(tenant_id, phone_number)`
- `settings`: `UNIQUE(tenant_id, setting_type)`

---

## 🚀 Setup Instructions

### Step 1: Run Multi-Vendor Setup

```powershell
# Navigate to project directory
cd "c:\Dev\Gamers Spot\Multi Vendor\Version 1\Gamersspot"

# Run setup script
.\setup-multivendor.ps1
```

**What This Does:**
1. Creates `multivendor` schema
2. Creates all 7 tables with tenant isolation
3. Creates indexes for performance
4. Creates helper functions
5. Inserts default tenant (`tenant_code: 'default'`)
6. Inserts default snacks and settings for default tenant

### Step 2: Verify Setup

```sql
-- Check schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'multivendor';

-- Check tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'multivendor';

-- Check default tenant
SELECT * FROM multivendor.tenants;

-- Check default snacks
SELECT s.*, t.shop_name 
FROM multivendor.snacks s
JOIN multivendor.tenants t ON s.tenant_id = t.id;
```

### Step 3: Update Environment Variables

Add to `.env.local`:

```env
# Multi-Vendor Configuration
USE_MULTIVENDOR=true
DEFAULT_TENANT_CODE=default
```

---

## 💻 Code Migration Guide

### Database Connection Changes

**Old Way (Single-Tenant):**
```javascript
import { getDbClient, closeDbClient } from './db.js';

const db = await getDbClient();
const result = await db.client.query('SELECT * FROM stations');
await closeDbClient(db);
```

**New Way (Multi-Tenant):**
```javascript
import { getDbClient, closeDbClient } from './db-multivendor.js';

// Get client with tenant context
const db = await getDbClient({
  useMultiVendor: true,
  tenantCode: 'default'  // or from request header/session
});

// Query automatically scoped to tenant
const result = await db.client.query(
  'SELECT * FROM stations WHERE tenant_id = $1',
  [db.tenantInfo.id]
);

await closeDbClient(db);
```

### API Endpoint Changes

**Example: Stations API**

**Before:**
```javascript
// GET /api/stations
const result = await db.client.query('SELECT * FROM stations');
```

**After:**
```javascript
// GET /api/stations
// Extract tenant from header/session
const tenantCode = req.headers['x-tenant-code'] || 'default';

const db = await getDbClient({ useMultiVendor: true, tenantCode });
const tenantId = db.tenantInfo.id;

const result = await db.client.query(
  'SELECT * FROM stations WHERE tenant_id = $1 ORDER BY station_number',
  [tenantId]
);
```

### Frontend Changes

**Add Tenant Context:**
```javascript
// In App.jsx or context provider
const [currentTenant, setCurrentTenant] = useState('default');

// Add to API calls
const fetchStations = async () => {
  const response = await fetch('/api/stations', {
    headers: {
      'X-Tenant-Code': currentTenant
    }
  });
  // ...
};
```

---

## 🔌 API Changes

### New Headers

All API requests should include:
```
X-Tenant-Code: default
```

### Modified Endpoints

#### 1. Stations API

**GET /api/stations**
- Header: `X-Tenant-Code: default`
- Returns: Stations for specified tenant only

**POST /api/stations**
- Header: `X-Tenant-Code: default`
- Body: Station data (tenant_id added automatically)

#### 2. Invoices API

**GET /api/invoices**
- Header: `X-Tenant-Code: default`
- Returns: Invoices for specified tenant only

#### 3. Settings API

**GET /api/settings?type=pricing**
- Header: `X-Tenant-Code: default`
- Returns: Pricing config for specified tenant

### New Endpoints

#### Tenants API

**GET /api/tenants**
- Returns: List of all tenants (admin only)

**POST /api/tenants**
- Body: New tenant data
- Returns: Created tenant

**GET /api/tenants/:tenantCode**
- Returns: Specific tenant details

---

## 🧪 Testing Multi-Vendor

### Test 1: Create Second Tenant

```sql
INSERT INTO multivendor.tenants (
  tenant_code,
  shop_name,
  owner_name,
  contact_phone,
  is_active
) VALUES (
  'shop2',
  'Gamers Spot - Koramangala',
  'John Doe',
  '9876543210',
  true
);
```

### Test 2: Add Stations for Shop 2

```sql
-- Get tenant_id for shop2
SELECT id FROM multivendor.tenants WHERE tenant_code = 'shop2';

-- Insert stations (assuming tenant_id = 2)
INSERT INTO multivendor.stations (
  tenant_id,
  station_number,
  name,
  game_type
) VALUES
  (2, 1, 'PS5 Station 1', 'Playstation'),
  (2, 2, 'PS5 Station 2', 'Playstation');
```

### Test 3: Verify Isolation

```sql
-- Stations for default tenant
SELECT * FROM multivendor.stations WHERE tenant_id = 1;

-- Stations for shop2
SELECT * FROM multivendor.stations WHERE tenant_id = 2;

-- Should return different results
```

### Test 4: Frontend Testing

```javascript
// Test switching tenants
setCurrentTenant('default');
await fetchStations(); // Should show default tenant's stations

setCurrentTenant('shop2');
await fetchStations(); // Should show shop2's stations
```

---

## ➕ Adding New Tenants

### Method 1: SQL Insert

```sql
INSERT INTO multivendor.tenants (
  tenant_code,
  shop_name,
  owner_name,
  contact_phone,
  contact_email,
  address,
  city,
  state,
  is_active,
  subscription_plan
) VALUES (
  'shop3',
  'Gamers Spot - Indiranagar',
  'Jane Smith',
  '9876543211',
  'jane@example.com',
  '123 Main St',
  'Bangalore',
  'Karnataka',
  true,
  'premium'
);

-- Add default snacks for new tenant
DO $$
DECLARE
  new_tenant_id INTEGER;
BEGIN
  SELECT id INTO new_tenant_id FROM multivendor.tenants WHERE tenant_code = 'shop3';
  
  INSERT INTO multivendor.snacks (tenant_id, name, price, active, display_order) VALUES
    (new_tenant_id, 'Coke Bottle', 20, true, 1),
    (new_tenant_id, 'Coke Can', 40, true, 2),
    (new_tenant_id, 'Lays Chips', 5, true, 3),
    (new_tenant_id, 'Kurkure', 5, true, 4);
    
  -- Add default settings
  INSERT INTO multivendor.settings (tenant_id, setting_type, setting_data) VALUES
    (new_tenant_id, 'pricing', '{
      "Playstation": {"weekday": 150, "weekend": 200},
      "Steering Wheel": {"weekday": 150, "weekend": 150},
      "System": {"weekday": 100, "weekend": 100},
      "extraControllerRate": 50,
      "bufferMinutes": 10
    }'::jsonb),
    (new_tenant_id, 'bonus', '{
      "Playstation": {
        "weekday": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600},
        "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
      }
    }'::jsonb);
END $$;
```

### Method 2: API Endpoint (Future)

```javascript
// POST /api/tenants
const response = await fetch('/api/tenants', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantCode: 'shop3',
    shopName: 'Gamers Spot - Indiranagar',
    ownerName: 'Jane Smith',
    contactPhone: '9876543211',
    city: 'Bangalore',
    state: 'Karnataka'
  })
});
```

---

## 📊 Migration Checklist

### Database Layer
- [x] Create multivendor schema
- [x] Create tenants table
- [x] Create tenant-scoped tables
- [x] Add indexes for performance
- [x] Create helper functions
- [ ] Migrate existing data from public schema (if needed)

### Backend Layer
- [x] Create db-multivendor.js
- [ ] Update all API endpoints to support tenant context
- [ ] Add tenant middleware
- [ ] Create tenants API
- [ ] Update reports to filter by tenant

### Frontend Layer
- [ ] Add tenant selector component
- [ ] Update API client to send tenant header
- [ ] Add tenant context provider
- [ ] Update all components to use tenant context
- [ ] Add tenant management UI (admin)

### Testing
- [ ] Test tenant isolation
- [ ] Test multi-tenant queries
- [ ] Test tenant switching
- [ ] Test data migration
- [ ] Performance testing with multiple tenants

---

## 🔒 Security Considerations

### Tenant Isolation
- ✅ Database-level isolation via `tenant_id`
- ✅ Foreign key constraints prevent cross-tenant access
- ✅ Unique constraints scoped to tenant
- ⚠️ Application must validate tenant access

### Access Control
- Implement role-based access control (RBAC)
- Verify user has permission to access tenant
- Log all tenant switches
- Audit cross-tenant queries

### Data Protection
- Each tenant's data is isolated
- Deleting tenant cascades to all their data
- Backup strategy per tenant
- GDPR compliance per tenant

---

## 📈 Performance Optimization

### Indexes
All tables have indexes on:
- `tenant_id` (for filtering)
- `(tenant_id, created_at)` (for date-range queries)
- `(tenant_id, unique_field)` (for lookups)

### Query Optimization
```sql
-- Good: Uses index
SELECT * FROM multivendor.stations WHERE tenant_id = 1;

-- Bad: Full table scan
SELECT * FROM multivendor.stations WHERE shop_name = 'Shop 1';
```

### Connection Pooling
- Use connection pooling (already implemented)
- Set `search_path` per connection
- Release connections after use

---

## 🎉 Next Steps

1. **Run Setup Script**
   ```powershell
   .\setup-multivendor.ps1
   ```

2. **Update API Endpoints**
   - Modify each API file to use `db-multivendor.js`
   - Add tenant context extraction
   - Update queries to filter by `tenant_id`

3. **Update Frontend**
   - Add tenant selector
   - Update API calls with tenant header
   - Test tenant switching

4. **Add Tenant Management**
   - Create admin UI for managing tenants
   - Add tenant creation form
   - Add tenant settings page

5. **Deploy to Production**
   - Run multivendor setup on Supabase
   - Update Vercel environment variables
   - Test thoroughly before going live

---

**Documentation Version:** 3.0  
**Last Updated:** January 1, 2026  
**Status:** Ready for Implementation
