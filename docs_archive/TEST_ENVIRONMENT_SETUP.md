# Test Environment Setup Guide

## Overview
This guide walks you through setting up a separate **TEST database** in Supabase for preview deployments on Vercel. This ensures that:
- ✅ Production data remains safe during testing
- ✅ Test branch changes use the test database
- ✅ Production deployments only use the production database
- ✅ Preview deployments are isolated from production

---

## Step 1: Create a New Supabase Project (Test Database)

### Option A: Create a New Organization (Recommended for Complete Isolation)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Organization"** (if you want complete separation)
3. Name it: `Gamersspot-Test` or similar
4. Create a new project inside this organization:
   - **Project Name**: `gamersspot-test`
   - **Database Password**: Choose a strong password (save it securely!)
   - **Region**: Choose the same region as production (e.g., Southeast Asia - Singapore)
   - **Pricing Plan**: Free (sufficient for testing)

### Option B: Use Same Organization (Easier Management)
1. Go to your existing Supabase organization
2. Click **"New Project"**
3. Create new project:
   - **Project Name**: `gamersspot-test`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Same as production
   - **Pricing Plan**: Free

---

## Step 2: Run the Test Database Setup Script

### 2.1 Access SQL Editor
1. In your new `gamersspot-test` project dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **"New query"**

### 2.2 Execute Setup Script
1. Open the file: `database/supabase_test_setup.sql`
2. **Copy the entire contents** of the file
3. **Paste** into the Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter`)

### 2.3 Verify Setup
You should see output showing:
- ✅ 5 tables created (`customers`, `stations`, `invoices`, `snacks`, `paid_events`)
- ✅ Default data inserted (8 stations, 4 snacks, 1 test customer)
- ✅ All indexes and triggers created

To verify, run this query in the SQL Editor:
```sql
SELECT 'customers' as table_name, COUNT(*) as row_count FROM customers
UNION ALL
SELECT 'stations', COUNT(*) FROM stations
UNION ALL
SELECT 'snacks', COUNT(*) FROM snacks
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'paid_events', COUNT(*) FROM paid_events;
```

Expected output:
| table_name   | row_count |
|--------------|-----------|
| customers    | 1         |
| stations     | 8         |
| snacks       | 4         |
| invoices     | 0         |
| paid_events  | 0         |

---

## Step 3: Get the Test Database Connection String

### 3.1 Navigate to Database Settings
1. In your `gamersspot-test` project
2. Go to: **Settings** → **Database** (left sidebar)

### 3.2 Copy Connection Pooler String
1. Scroll down to **"Connection pooling"**
2. **Mode**: Transaction
3. **Connection string**: Copy the full URL
   - Should look like: `postgresql://postgres.xxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
4. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with your actual database password

### 3.3 Save Connection String
Save this connection string securely - you'll need it for Vercel configuration.

---

## Step 4: Configure Vercel Environment Variables

### 4.1 Access Vercel Project Settings
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **Gamersspot** project
3. Click **"Settings"** tab
4. Click **"Environment Variables"** in the left sidebar

### 4.2 Add TEST_POSTGRES_URL for Preview Deployments

#### Add new environment variable:
- **Key**: `TEST_POSTGRES_URL`
- **Value**: Paste your test database connection string (from Step 3.2)
- **Environments**: 
  - ✅ **Preview** (IMPORTANT!)
  - ✅ **Development** (OPTIONAL)
  - ❌ **Production** (DO NOT CHECK - production should use POSTGRES_URL)

#### Verify Existing POSTGRES_URL (Production):
- Make sure `POSTGRES_URL` is set and only applies to **Production** environment
- This should point to your production Supabase database

### 4.3 Visual Guide for Environment Variable Setup

```
Environment Variable Configuration:
┌─────────────────────────────────────────────────────────────┐
│ Name: TEST_POSTGRES_URL                                      │
│ Value: postgresql://postgres.xxx...pooler.supabase.com:6543 │
│                                                               │
│ Environments:                                                 │
│ [ ] Production    (UNCHECKED)                                │
│ [✓] Preview       (CHECKED)                                  │
│ [✓] Development   (CHECKED)                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Name: POSTGRES_URL                                           │
│ Value: postgresql://postgres.xxx...pooler.supabase.com:6543 │
│                                                               │
│ Environments:                                                 │
│ [✓] Production    (CHECKED)                                  │
│ [ ] Preview       (UNCHECKED)                                │
│ [ ] Development   (UNCHECKED)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 5: Test the Configuration

### 5.1 Trigger a Preview Deployment
1. Make a small change to your test branch (or create a PR)
2. Push to GitHub
3. Vercel will automatically create a preview deployment

### 5.2 Verify Database Selection
1. Go to your preview deployment URL
2. Check Vercel logs: **Deployments** → Select the preview deployment → **"Function Logs"**
3. Look for these log messages:
   ```
   🔧 Vercel Environment: preview
   🧪 Using TEST database (preview/development)
   ```

### 5.3 Test Functionality
1. Open the preview deployment
2. Try creating a session, adding snacks, generating an invoice
3. Verify the data is being written to the **TEST database** (check Supabase test project dashboard)

### 5.4 Verify Production Isolation
1. Deploy to production (merge to main branch)
2. Check production logs - should see:
   ```
   🔧 Vercel Environment: production
   📊 Using PRODUCTION database
   ```

---

## Step 6: Code Changes Summary

The following code changes have been made to support environment-based database selection:

### Modified Files:
1. **`api/db.js`** - Updated to check `VERCEL_ENV` and use:
   - `TEST_POSTGRES_URL` for preview/development environments
   - `POSTGRES_URL` for production environment
   - Clear console logging to identify which database is being used

2. **`database/supabase_test_setup.sql`** ✨ NEW
   - Complete database schema for test environment
   - Includes all tables, indexes, triggers, and sample test data

3. **`.gitignore`** - Updated to include `supabase_test_setup.sql` in version control

---

## How It Works

### Database Selection Logic Flow:
```
┌─────────────────────────────────────────────────────────┐
│ Application deployed on Vercel                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Check VERCEL_ENV     │
        └──────┬───────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ Production  │  │ Preview/Dev │
└──────┬──────┘  └──────┬──────┘
       │                │
       ▼                ▼
  POSTGRES_URL    TEST_POSTGRES_URL
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Production   │  │ Test         │
│ Database     │  │ Database     │
└──────────────┘  └──────────────┘
```

---

## Troubleshooting

### Issue: Preview deployment still using production database

**Solution:**
1. Check Vercel environment variables - ensure `TEST_POSTGRES_URL` is set for **Preview** environment
2. Redeploy the preview (redeploy from Vercel dashboard)
3. Check function logs for warning messages

### Issue: Connection timeout errors

**Solution:**
1. Verify the test database is not paused (Supabase free tier auto-pauses after inactivity)
2. Go to Supabase test project dashboard → Restore if paused
3. Ensure you're using the **Connection Pooler** URL (port 6543), not direct connection

### Issue: Tables not found errors

**Solution:**
1. Verify the setup script ran successfully in Supabase SQL Editor
2. Check table list in Supabase: **Table Editor** → should see all 5 tables
3. Re-run the setup script if needed

---

## Best Practices

### 1. **Regular Test Data Cleanup**
Periodically clean test database to avoid clutter:
```sql
-- Run in Supabase SQL Editor (TEST database only!)
TRUNCATE invoices, paid_events RESTART IDENTITY CASCADE;
-- This keeps stations, customers, and snacks intact
```

### 2. **Keep Test and Production Schemas in Sync**
- When you make schema changes to production, update `supabase_test_setup.sql`
- Re-run the updated script in the test database

### 3. **Monitor Both Databases**
- Set up monitoring/alerts for both databases in Supabase
- Check usage monthly to stay within free tier limits

### 4. **Database Credentials Security**
- Never commit database passwords or connection strings to Git
- Use Vercel environment variables for all sensitive data
- Rotate database passwords periodically

---

## Environment Variable Reference

| Variable           | Environment(s)       | Purpose                                    |
|--------------------|----------------------|--------------------------------------------|
| `POSTGRES_URL`     | Production           | Production Supabase database connection    |
| `TEST_POSTGRES_URL`| Preview, Development | Test Supabase database connection          |
| `VERCEL_ENV`       | Auto-set by Vercel   | Current environment (`production/preview`) |
| `VERCEL`           | Auto-set by Vercel   | Indicates running on Vercel (`1`)          |

---

## Next Steps

1. ✅ Create test Supabase project
2. ✅ Run database setup script
3. ✅ Configure Vercel environment variables
4. ✅ Test preview deployment
5. ✅ Verify production deployment still uses production database

**You're all set!** 🎉

Your test branch deployments will now use the test database, keeping your production data safe!
