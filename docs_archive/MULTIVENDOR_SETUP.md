# Multi-Vendor Setup - Quick Start Guide

## ✅ What We've Created

I've set up the complete multi-vendor architecture for your Gamers Spot application. Here's what's been created:

### 📁 New Files Created

1. **`database/multivendor_setup.sql`** - Complete schema setup script
   - Creates `multivendor` schema
   - Creates 7 tables with tenant isolation
   - Adds indexes, functions, and triggers
   - Inserts default tenant and sample data

2. **`api/db-multivendor.js`** - Enhanced database connection utility
   - Supports both single-tenant and multi-tenant modes
   - Handles tenant context and validation
   - Schema switching capability

3. **`setup-multivendor.cjs`** - Node.js setup script
   - Automated database setup
   - Verification and testing

4. **`MULTIVENDOR_GUIDE.md`** - Comprehensive documentation
   - Architecture overview
   - Migration guide
   - Testing instructions
   - Best practices

5. **`setup-multivendor.ps1`** - PowerShell setup script (alternative)

---

## 🚀 How to Run the Setup

### Option 1: Using Docker (Recommended)

**Step 1: Update your connection string**

Your Docker PostgreSQL is running on:
- **Host:** localhost
- **Port:** 5432 (not 5434)
- **Database:** gamersspot (not gamersspot-local)
- **Username:** postgres
- **Password:** postgres

Update your `.env.local` file with:
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gamersspot
```

**Step 2: Run the setup script**

```bash
node setup-multivendor.cjs
```

This will:
- Connect to your local PostgreSQL database
- Create the `multivendor` schema
- Create all 7 tables
- Insert default tenant
- Verify the setup

---

### Option 2: Manual SQL Execution

If you prefer to run the SQL manually:

1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to: `localhost:5432/gamersspot`
3. Open and execute: `database/multivendor_setup.sql`

---

## 📊 What Gets Created

### Schema: `multivendor`

**Tables:**
1. **tenants** - Master table for all shops
2. **stations** - Gaming stations (with tenant_id)
3. **invoices** - Billing records (with tenant_id)
4. **paid_events** - Multi-device sync (with tenant_id)
5. **snacks** - Snacks/items (with tenant_id)
6. **customers** - Customer database (with tenant_id)
7. **settings** - Pricing/bonus config (with tenant_id)

**Default Tenant:**
- **Code:** `default`
- **Name:** Gamers Spot - Main Branch
- **Status:** Active
- **Plan:** Premium

---

## 🧪 Verify the Setup

After running the setup, verify with these SQL queries:

```sql
-- Check schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'multivendor';

-- Check all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'multivendor';

-- Check default tenant
SELECT * FROM multivendor.tenants;

-- Check default snacks
SELECT * FROM multivendor.snacks;

-- Check default settings
SELECT * FROM multivendor.settings;
```

---

## 🔧 Troubleshooting

### Issue: "password authentication failed"

**Solution:** Update `.env.local` with correct credentials:
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gamersspot
```

### Issue: "Cannot find module 'pg'"

**Solution:** Install dependencies:
```bash
npm install
```

### Issue: "Connection refused"

**Solution:** Start Docker container:
```bash
docker-compose up -d
```

Check if running:
```bash
docker ps
```

---

## 📝 Next Steps

After successful setup:

1. **Test the Schema**
   - Run verification queries above
   - Check that all tables exist
   - Verify default tenant data

2. **Update Application Code**
   - Modify API endpoints to use `db-multivendor.js`
   - Add tenant context to requests
   - Update frontend to send tenant header

3. **Add More Tenants**
   - Use SQL or create an admin UI
   - Each tenant gets isolated data
   - Configure pricing/settings per tenant

4. **Deploy to Production**
   - Run setup on Supabase
   - Update environment variables
   - Test thoroughly

---

## 📖 Full Documentation

For complete details, see:
- **`MULTIVENDOR_GUIDE.md`** - Complete architecture guide
- **`COMPREHENSIVE_PROJECT_DOCUMENTATION_2025-12-30.md`** - Original project docs

---

## ✨ Key Features

✅ **Complete Data Isolation** - Each shop's data is separate  
✅ **Shared Infrastructure** - One database, multiple shops  
✅ **Easy Scaling** - Add shops without code changes  
✅ **Backward Compatible** - Can still use single-tenant mode  
✅ **Production Ready** - Includes indexes, constraints, triggers  

---

## 🎯 Quick Command Reference

```bash
# Install dependencies
npm install

# Run multi-vendor setup
node setup-multivendor.cjs

# Start Docker database
docker-compose up -d

# Check Docker status
docker ps

# View Docker logs
docker logs gamersspot-db

# Stop Docker
docker-compose down
```

---

**Setup Date:** January 1, 2026  
**Version:** 3.0 - Multi-Vendor Support  
**Status:** Ready to Deploy
