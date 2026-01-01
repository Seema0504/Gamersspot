# 📊 All Databases Overview

**Container:** gamersspot-db (Docker PostgreSQL 15)  
**Host:** localhost:5432  
**Total Databases:** 3

---

## 🗄️ Database Summary

| # | Database | Purpose | Tables | Status |
|---|----------|---------|--------|--------|
| 1 | **gamersspot** | Original production database | 4 | ✅ Active |
| 2 | **multivendor** | New database (production structure) | 5 | ✅ Ready |
| 3 | **postgres** | System database | 0 | ✅ System |

---

## 1️⃣ **gamersspot** Database

**Purpose:** Your original database with local data

### Tables (4):

| Table | Rows | Description |
|-------|------|-------------|
| **stations** | 0 | Gaming stations |
| **invoices** | 0 | Billing records |
| **paid_events** | 0 | Multi-device sync |
| **snacks** | 4 | Items/snacks |

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/gamersspot
```

**Current Data:**
- ✅ 4 snacks configured
- Empty stations (ready for use)
- Empty invoices
- Empty paid events

---

## 2️⃣ **multivendor** Database

**Purpose:** New database with production structure from Supabase

### Tables (5):

| Table | Rows | Description |
|-------|------|-------------|
| **stations** | 0 | Gaming stations (production structure) |
| **invoices** | 0 | Billing records (production structure) |
| **paid_events** | 0 | Multi-device sync (production structure) |
| **snacks** | 0 | Items/snacks (production structure) |
| **customers** | 0 | Customer database (production structure) |

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/multivendor
```

**Current Data:**
- ❌ Empty (structure only, no data)
- ✅ Has exact same structure as Supabase production
- ✅ Includes `customers` table (from production)

---

## 3️⃣ **postgres** Database

**Purpose:** PostgreSQL system database

### Tables:
- (No user tables - system database only)

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/postgres
```

**Note:** This is the default PostgreSQL database. Don't use it for your application.

---

## 🔍 Key Differences

### gamersspot vs multivendor

| Feature | gamersspot | multivendor |
|---------|------------|-------------|
| **Source** | Local setup | Supabase production |
| **Tables** | 4 | 5 |
| **customers table** | ❌ No | ✅ Yes |
| **Data** | 4 snacks | Empty |
| **Structure** | Local | Production |

**Main Difference:** `multivendor` has the `customers` table that exists in your production database, while `gamersspot` doesn't have it.

---

## 🎯 Which Database Should You Use?

### Use **gamersspot** if:
- ✅ You want to continue with your current local setup
- ✅ You don't need the customers table
- ✅ You already have data in it

### Use **multivendor** if:
- ✅ You want to match production structure exactly
- ✅ You need the customers table
- ✅ You want a clean slate with production structure

---

## 🔌 How to Switch Databases

### Currently Using:
Check your `.env.local` file to see which database your app is using.

### To Switch to gamersspot:
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gamersspot
```

### To Switch to multivendor:
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/multivendor
```

Then restart your app:
```bash
# Stop current app (Ctrl+C in terminal)
npm run dev:all
```

---

## 📋 Quick Commands

### List all databases:
```bash
docker exec gamersspot-db psql -U postgres -c "\l"
```

### Show tables in gamersspot:
```bash
docker exec gamersspot-db psql -U postgres -d gamersspot -c "\dt"
```

### Show tables in multivendor:
```bash
docker exec gamersspot-db psql -U postgres -d multivendor -c "\dt"
```

### Show all databases with details:
```bash
node show-all-databases.cjs
```

---

## 🗂️ Database Structure Comparison

### gamersspot (4 tables):
```
public schema
├── stations
├── invoices
├── paid_events
└── snacks
```

### multivendor (5 tables):
```
public schema
├── customers ← Extra table from production
├── invoices
├── paid_events
├── snacks
└── stations
```

---

## 💾 Backup & Restore

### Backup gamersspot:
```bash
docker exec gamersspot-db pg_dump -U postgres gamersspot > backup_gamersspot.sql
```

### Backup multivendor:
```bash
docker exec gamersspot-db pg_dump -U postgres multivendor > backup_multivendor.sql
```

### Restore:
```bash
docker exec -i gamersspot-db psql -U postgres -d [database_name] < backup_file.sql
```

---

## 🎉 Summary

You have **3 databases** in your local PostgreSQL:

1. **gamersspot** - Original local database (4 tables, 4 snacks)
2. **multivendor** - Production structure (5 tables, empty)
3. **postgres** - System database (don't use)

**Recommendation:** Use **multivendor** if you want to match your production structure exactly, especially since it has the `customers` table.

---

**Generated:** January 1, 2026  
**Container:** gamersspot-db  
**PostgreSQL Version:** 15.15
