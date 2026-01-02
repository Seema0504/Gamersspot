# Soft Delete Migration Guide
**Date:** January 3, 2026  
**Purpose:** Add soft delete functionality to preserve data for audit trail

---

## 📋 Migration SQL Script

Run this SQL in your Supabase SQL Editor (both Test and Production databases):

```sql
-- ============================================================================
-- Migration: Add Soft Delete Support for Shops
-- Date: January 3, 2026
-- Description: Adds deleted_at column to shops table and related tables
--              for soft delete functionality (audit trail preservation)
-- ============================================================================

SET timezone = 'Asia/Kolkata';

BEGIN;

-- ============================================================================
-- 1. Add deleted_at column to shops table
-- ============================================================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN shops.deleted_at IS 'Timestamp when shop was soft-deleted (NULL = active)';

-- ============================================================================
-- 2. Add deleted_at to admin_users (for user deactivation)
-- ============================================================================
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN admin_users.deleted_at IS 'Timestamp when user was soft-deleted (NULL = active)';

-- ============================================================================
-- 3. Create index for soft delete queries (performance optimization)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shops_deleted_at ON shops(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_deleted_at ON admin_users(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. Create helper function to soft delete a shop
-- ============================================================================
CREATE OR REPLACE FUNCTION soft_delete_shop(p_shop_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_shop_name VARCHAR(255);
BEGIN
    -- Get shop name
    SELECT name INTO v_shop_name FROM shops WHERE id = p_shop_id AND deleted_at IS NULL;
    
    IF v_shop_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Shop not found or already deleted'
        );
    END IF;
    
    -- Soft delete the shop
    UPDATE shops 
    SET deleted_at = NOW() 
    WHERE id = p_shop_id;
    
    -- Soft delete associated admin users
    UPDATE admin_users 
    SET deleted_at = NOW() 
    WHERE shop_id = p_shop_id AND deleted_at IS NULL;
    
    RETURN jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'shop_name', v_shop_name,
        'deleted_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Create helper function to restore a soft-deleted shop
-- ============================================================================
CREATE OR REPLACE FUNCTION restore_shop(p_shop_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_shop_name VARCHAR(255);
BEGIN
    -- Get shop name
    SELECT name INTO v_shop_name FROM shops WHERE id = p_shop_id AND deleted_at IS NOT NULL;
    
    IF v_shop_name IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Shop not found or not deleted'
        );
    END IF;
    
    -- Restore the shop
    UPDATE shops 
    SET deleted_at = NULL 
    WHERE id = p_shop_id;
    
    -- Restore associated admin users
    UPDATE admin_users 
    SET deleted_at = NULL 
    WHERE shop_id = p_shop_id AND deleted_at IS NOT NULL;
    
    RETURN jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'shop_name', v_shop_name,
        'restored_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Create view for active shops only
-- ============================================================================
CREATE OR REPLACE VIEW active_shops AS
SELECT * FROM shops WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. Verification
-- ============================================================================
DO $$
DECLARE
    deleted_at_exists BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    -- Check if deleted_at column exists on shops
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shops' AND column_name = 'deleted_at'
    ) INTO deleted_at_exists;
    
    -- Check if index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'shops' AND indexname = 'idx_shops_deleted_at'
    ) INTO index_exists;
    
    RAISE NOTICE '=== Soft Delete Migration Verification ===';
    RAISE NOTICE 'deleted_at column exists: %', deleted_at_exists;
    RAISE NOTICE 'idx_shops_deleted_at exists: %', index_exists;
    
    IF deleted_at_exists AND index_exists THEN
        RAISE NOTICE '=== Migration Completed Successfully ===';
    ELSE
        RAISE EXCEPTION 'Migration failed - missing components';
    END IF;
END $$;

COMMIT;
```

---

## 🔧 Usage Examples

### Soft Delete a Shop (via SQL)
```sql
SELECT soft_delete_shop(1);
```

### Restore a Deleted Shop (via SQL)
```sql
SELECT restore_shop(1);
```

### Query Active Shops Only
```sql
SELECT * FROM active_shops;
-- OR
SELECT * FROM shops WHERE deleted_at IS NULL;
```

### Query Deleted Shops
```sql
SELECT * FROM shops WHERE deleted_at IS NOT NULL;
```

### Hard Delete Old Soft-Deleted Shops (Cleanup - run periodically)
```sql
-- Delete shops that have been soft-deleted for more than 90 days
DELETE FROM shops WHERE deleted_at < NOW() - INTERVAL '90 days';
```

---

## ✅ What Changed in the Code

### Backend API (`api/admin.js`)

1. **Delete Endpoint** - Now performs soft delete:
   ```javascript
   // OLD: DELETE FROM shops WHERE id = ?
   // NEW: UPDATE shops SET deleted_at = NOW() WHERE id = ?
   ```

2. **Shops Listing** - Excludes soft-deleted shops:
   ```javascript
   // Added: WHERE s.deleted_at IS NULL
   ```

3. **Admin Users** - Also soft-deleted with shop:
   ```javascript
   UPDATE admin_users SET deleted_at = NOW() 
   WHERE shop_id = ? AND deleted_at IS NULL
   ```

### Frontend (No changes needed)
- Delete button still works the same way
- Deleted shops automatically disappear from the list
- Success message now says "archived (soft deleted)"

---

## 📊 Benefits of Soft Delete

1. **Data Preservation**
   - All shop data, invoices, customers preserved
   - Can restore accidentally deleted shops
   - Maintains audit trail for compliance

2. **Safety**
   - No permanent data loss
   - Can review deleted shops before hard delete
   - Supports data recovery requests

3. **Performance**
   - Faster than hard delete (no cascade operations)
   - Indexed queries remain fast
   - Can defer hard delete to off-peak hours

---

## 🔄 Future Enhancements

### Add Restore Functionality to UI
```javascript
// In AdminDashboard.jsx
const handleRestoreShop = async (shopId) => {
    const res = await fetch('/api/admin?action=restore-shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shopId })
    });
    // Handle response...
};
```

### Add Backend Restore Endpoint
```javascript
// In api/admin.js
if (req.method === 'POST' && action === 'restore-shop') {
    const { shopId } = req.body;
    await client.query(`UPDATE shops SET deleted_at = NULL WHERE id = $1`, [shopId]);
    await client.query(`UPDATE admin_users SET deleted_at = NULL WHERE shop_id = $1`, [shopId]);
    return res.status(200).json({ success: true, message: 'Shop restored' });
}
```

### Add "Show Deleted Shops" Toggle
```javascript
// In AdminDashboard.jsx
const [showDeleted, setShowDeleted] = useState(false);

// Update fetchShops to include deleted if toggle is on
const url = `/api/admin?action=shops${showDeleted ? '&includeDeleted=true' : ''}`;
```

---

## ⚠️ Important Notes

1. **Run Migration Before Deploying Code**
   - Database must have `deleted_at` column before code update
   - Otherwise queries will fail

2. **Periodic Cleanup Recommended**
   - Set up cron job to hard delete old soft-deleted shops
   - Suggested: Delete after 90 days
   - Prevents database bloat

3. **Backup Before Migration**
   - Always backup database before running migrations
   - Test in Test environment first

---

## 🚀 Deployment Checklist

- [ ] Run migration SQL in Test database
- [ ] Test soft delete functionality in Test environment
- [ ] Verify shops list excludes deleted shops
- [ ] Run migration SQL in Production database
- [ ] Deploy updated code to Production
- [ ] Test delete functionality in Production
- [ ] Set up periodic cleanup job (optional)
