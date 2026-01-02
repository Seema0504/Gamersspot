# Database Schema Analysis & Recommendations
**Generated:** 2026-01-03  
**Database:** Gamers Spot SaaS Multi-Tenant System

---

## ✅ Current Schema Overview

### Tables (10 Total)
1. **shops** - Tenant/Shop master table
2. **admin_users** - Authentication & user management
3. **subscriptions** - SaaS billing & plans
4. **stations** - Gaming stations (multi-tenant)
5. **customers** - Customer database (shop-scoped)
6. **invoices** - Transaction records
7. **snacks** - Inventory management
8. **pricing_rules** - Dynamic pricing configuration
9. **bonus_config** - Bonus/discount settings
10. **paid_events** - Real-time sync events

---

## 🔗 Foreign Key Relationships

### ✅ PROPERLY CONFIGURED (with CASCADE)

| Child Table | Foreign Key | Parent Table | Constraint | Status |
|-------------|-------------|--------------|------------|--------|
| **admin_users** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **subscriptions** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **stations** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **customers** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **invoices** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **snacks** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **pricing_rules** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **bonus_config** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |
| **paid_events** | shop_id | shops(id) | `ON DELETE CASCADE` | ✅ Good |

**Result:** All 9 child tables have proper CASCADE constraints! ✅

---

## 🔍 Schema Analysis

### ✅ Strengths

1. **Multi-Tenant Architecture**
   - All tables properly scoped to `shop_id`
   - Composite primary key on `stations` (shop_id, id)
   - Shop-scoped uniqueness constraints

2. **Data Integrity**
   - All foreign keys have `ON DELETE CASCADE`
   - Unique constraints on critical fields
   - Check constraints on roles

3. **Performance**
   - Indexes on all foreign keys
   - Composite indexes where needed
   - Username index for fast authentication

4. **Audit Trail**
   - `created_at` on all tables
   - `updated_at` on mutable tables
   - Timestamptz for timezone awareness

### ⚠️ Potential Issues & Recommendations

#### 1. **Missing `upi_id` in Schema Definition**
**Issue:** The production schema file doesn't include the `upi_id` column added via migration.

**Current State:**
```sql
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    -- upi_id is MISSING here
    is_active BOOLEAN DEFAULT true,
    ...
);
```

**Recommendation:**
```sql
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    upi_id VARCHAR(255),  -- ✅ ADD THIS
    is_active BOOLEAN DEFAULT true,
    ...
);
```

#### 2. **Inconsistent Constraint Naming**
**Issue:** Some constraints use auto-generated names, making debugging harder.

**Recommendation:** Use explicit constraint names:
```sql
-- Instead of:
shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE

-- Use:
shop_id INTEGER,
CONSTRAINT fk_admin_users_shop FOREIGN KEY (shop_id) 
    REFERENCES shops(id) ON DELETE CASCADE
```

#### 3. **Missing Indexes**
**Recommendation:** Add these for better performance:
```sql
-- For subscription queries
CREATE INDEX idx_subscriptions_shop_status 
    ON subscriptions(shop_id, status);

-- For invoice date range queries
CREATE INDEX idx_invoices_created_at 
    ON invoices(shop_id, created_at DESC);

-- For customer phone lookups
CREATE INDEX idx_customers_phone 
    ON customers(shop_id, phone_number);
```

#### 4. **No Soft Delete Support**
**Current:** Hard deletes only (data permanently lost)

**Recommendation:** Add soft delete capability:
```sql
ALTER TABLE shops ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Then use:
-- DELETE: UPDATE shops SET deleted_at = NOW() WHERE id = ?
-- QUERY: SELECT * FROM shops WHERE deleted_at IS NULL
```

#### 5. **Missing Data Validation**
**Recommendation:** Add check constraints:
```sql
-- Phone number format
ALTER TABLE shops 
    ADD CONSTRAINT chk_phone_format 
    CHECK (phone ~ '^[6-9][0-9]{9}$');

-- Email format
ALTER TABLE shops 
    ADD CONSTRAINT chk_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');

-- UPI ID format
ALTER TABLE shops 
    ADD CONSTRAINT chk_upi_format 
    CHECK (upi_id IS NULL OR upi_id ~* '^[a-zA-Z0-9._-]+@[a-zA-Z]+$');
```

---

## 📊 Relationship Diagram

```
shops (Parent)
├── admin_users (CASCADE ✅)
├── subscriptions (CASCADE ✅)
├── stations (CASCADE ✅)
├── customers (CASCADE ✅)
├── invoices (CASCADE ✅)
├── snacks (CASCADE ✅)
├── pricing_rules (CASCADE ✅)
├── bonus_config (CASCADE ✅)
└── paid_events (CASCADE ✅)
```

---

## 🛠️ Recommended Schema Updates

### Priority 1: Add Missing Column
```sql
-- Add upi_id to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255);
COMMENT ON COLUMN shops.upi_id IS 'UPI ID for WhatsApp payment links';
```

### Priority 2: Add Performance Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_status 
    ON subscriptions(shop_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_shop_created 
    ON invoices(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone 
    ON customers(shop_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_paid_events_processed 
    ON paid_events(shop_id, processed);
```

### Priority 3: Add Data Validation (Optional)
```sql
-- Phone validation
ALTER TABLE shops 
    ADD CONSTRAINT chk_phone_format 
    CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$');

-- Email validation
ALTER TABLE shops 
    ADD CONSTRAINT chk_email_format 
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$');
```

---

## ✅ Conclusion

**Overall Assessment:** Your database schema is **well-designed** with proper multi-tenant architecture and CASCADE constraints.

**Key Findings:**
- ✅ All foreign keys have `ON DELETE CASCADE`
- ✅ Proper indexing on critical columns
- ✅ Multi-tenant isolation working correctly
- ⚠️ Missing `upi_id` in base schema (added via migration)
- ⚠️ Could benefit from additional performance indexes
- ⚠️ No soft delete capability (optional enhancement)

**Action Items:**
1. Update base schema file to include `upi_id`
2. Add recommended performance indexes
3. Consider soft delete for audit trail (optional)
4. Add database-level validation constraints (optional)

---

**Note:** The manual deletion order in the delete-shop API endpoint is a **safety measure** that works regardless of CASCADE configuration, making the code more portable across different database setups.
