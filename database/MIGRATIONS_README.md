# Database Migration Scripts

This directory contains migration scripts for updating the database schema across different environments.

## Migration Files

### 📅 January 2, 2026 - Add shop_id to invoices table

**Files:**
- `supabase_test_migration_2026-01-02.sql` - For Supabase Test environment
- `supabase_production_migration_2026-01-02.sql` - For Supabase Production environment

**Changes:**
1. Adds `shop_id` column to `invoices` table
2. Creates index `idx_invoices_shop_id` for performance
3. Resets invoice sequence to prevent duplicate key errors
4. Creates default shop records

**Impact:**
- Enables multi-tenant support for invoices
- Changes invoice number format to: `INV-{SHOP_ID}-{YYYYMMDD}-{SEQUENCE}`
- Each shop gets its own daily invoice sequence

---

## How to Run Migrations

### 🧪 Test Environment (Supabase Test)

1. **Connect to Supabase Test Database:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your TEST project
   - Navigate to SQL Editor

2. **Run the Test Migration:**
   ```sql
   -- Copy and paste contents of:
   -- database/supabase_test_migration_2026-01-02.sql
   ```

3. **Verify:**
   - Check the console output for verification messages
   - Ensure no errors occurred
   - Test invoice generation in the application

### 🚀 Production Environment (Supabase Production)

⚠️ **IMPORTANT: Follow these steps carefully!**

1. **Backup Database:**
   - Go to Supabase Dashboard → Database → Backups
   - Create a manual backup before proceeding
   - Download backup for extra safety

2. **Review Migration Script:**
   - Open `database/supabase_production_migration_2026-01-02.sql`
   - **Update shop data in section 4** with actual production values
   - Review all SQL statements

3. **Test First:**
   - Ensure the test migration ran successfully
   - Test invoice generation in test environment
   - Verify no issues

4. **Schedule Downtime (if needed):**
   - Run during low-traffic period
   - Notify users if necessary

5. **Run Production Migration:**
   - Connect to Supabase Production Database
   - Copy and paste the migration script
   - Execute and monitor for errors

6. **Post-Migration Verification:**
   ```sql
   -- Verify shop_id column exists
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'invoices' AND column_name = 'shop_id';
   
   -- Verify index exists
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'invoices' AND indexname = 'idx_invoices_shop_id';
   
   -- Check shops
   SELECT id, name, is_active FROM shops ORDER BY id;
   
   -- Test invoice generation
   -- (Use the application to generate a test invoice)
   ```

7. **Application Testing:**
   - Generate a test invoice
   - Verify invoice number format: `INV-{SHOP_ID}-{YYYYMMDD}-{SEQUENCE}`
   - Check invoice appears in Daily Revenue Report
   - Test PDF download and print functionality

---

## Rollback Plan

If issues occur after migration:

### Rollback Steps:

1. **Restore from Backup:**
   - Go to Supabase Dashboard → Database → Backups
   - Select the backup created before migration
   - Click "Restore"

2. **Or Manual Rollback:**
   ```sql
   BEGIN;
   
   -- Remove shop_id column
   ALTER TABLE invoices DROP COLUMN IF EXISTS shop_id;
   
   -- Remove index
   DROP INDEX IF EXISTS idx_invoices_shop_id;
   
   -- Delete test shops (if needed)
   DELETE FROM shops WHERE id IN (1, 9, 10, 11);
   
   COMMIT;
   ```

---

## Migration Checklist

### Before Running:
- [ ] Database backup created
- [ ] Migration script reviewed
- [ ] Shop data updated (production only)
- [ ] Test environment migration successful
- [ ] Downtime scheduled (if needed)

### After Running:
- [ ] Migration completed without errors
- [ ] Verification queries passed
- [ ] Invoice generation tested
- [ ] Invoice numbers have correct format
- [ ] Reports show invoices correctly
- [ ] No application errors

---

## Troubleshooting

### Common Issues:

**1. "duplicate key value violates unique constraint"**
- Solution: The migration resets the sequence automatically
- If still occurs, run: `SELECT setval('invoices_id_seq', (SELECT MAX(id) FROM invoices));`

**2. "foreign key constraint violation"**
- Solution: Ensure shops exist before running migration
- Check: `SELECT * FROM shops;`

**3. "column already exists"**
- Solution: Migration uses `IF NOT EXISTS` - safe to re-run
- The migration is idempotent

**4. Invoices not showing in reports**
- Solution: Clear browser cache
- Check shop_id filter in report queries

---

## Contact

For issues or questions about migrations:
1. Check the documentation first
2. Review error messages carefully
3. Test in development/test environment
4. Create a backup before any changes

---

**Last Updated:** January 2, 2026  
**Version:** 2.6
