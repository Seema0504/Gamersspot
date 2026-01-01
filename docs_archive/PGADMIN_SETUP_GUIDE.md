# 🔧 Configure Multi-Vendor Database in pgAdmin

**Date:** January 1, 2026  
**Database:** multivendor  
**Container:** gamersspot-db (Docker)

---

## 📋 Connection Details

Use these exact details when configuring pgAdmin:

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `multivendor` |
| **Username** | `postgres` |
| **Password** | `postgres` |
| **Maintenance Database** | `postgres` |

---

## 🚀 Step-by-Step Setup in pgAdmin

### Step 1: Open pgAdmin
1. Launch **pgAdmin 4** on your computer
2. Wait for the pgAdmin interface to load in your browser

### Step 2: Create New Server Connection

1. **Right-click** on "Servers" in the left sidebar
2. Select **Create** → **Server...**

### Step 3: General Tab

In the **General** tab, enter:

```
Name: Gamers Spot - Multi-Vendor (Local)
```

**Tips:**
- This is just a display name, you can name it anything
- Example: "Gamers Spot MV Local" or "MultiVendor DB"

### Step 4: Connection Tab

In the **Connection** tab, enter these exact values:

```
Host name/address:     localhost
Port:                  5432
Maintenance database:  postgres
Username:              postgres
Password:              postgres
```

**Important Settings:**
- ✅ Check "Save password?" (optional, for convenience)
- Leave all other fields as default

### Step 5: Advanced Tab (Optional)

In the **Advanced** tab:

```
DB restriction:        multivendor
```

**What this does:**
- Shows only the `multivendor` database
- Hides `gamersspot` and `postgres` databases
- Makes it cleaner if you only want to work with multi-vendor

**Note:** Leave this blank if you want to see all databases.

### Step 6: Save

1. Click **Save** button
2. pgAdmin will connect to your PostgreSQL server
3. You should see the new server appear in the left sidebar

---

## 🔍 Verify the Connection

After connecting, expand the tree in the left sidebar:

```
Servers
└── Gamers Spot - Multi-Vendor (Local)
    └── Databases (3)
        ├── gamersspot          ← Your original database
        ├── multivendor         ← Your new multi-vendor database ✅
        └── postgres            ← System database
```

### Explore the Multi-Vendor Database

Expand the `multivendor` database:

```
multivendor
├── Schemas (2)
│   ├── public (default, empty)
│   └── multivendor ✅
│       └── Tables (7)
│           ├── customers
│           ├── invoices
│           ├── paid_events
│           ├── settings
│           ├── snacks
│           ├── stations
│           └── tenants ← Master table for all shops
```

---

## 🧪 Test Queries

Once connected, you can run these queries to verify everything:

### Query 1: Check Default Tenant

```sql
SELECT * FROM multivendor.tenants;
```

**Expected Result:**
```
id | tenant_code | shop_name                 | is_active
---+-------------+---------------------------+-----------
1  | default     | Gamers Spot - Main Branch | true
```

### Query 2: Check All Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'multivendor' 
ORDER BY table_name;
```

**Expected Result:**
```
table_name
-----------
customers
invoices
paid_events
settings
snacks
stations
tenants
```

### Query 3: Check Default Snacks

```sql
SELECT id, name, price, active 
FROM multivendor.snacks 
WHERE tenant_id = 1
ORDER BY display_order;
```

**Expected Result:**
```
id | name        | price | active
---+-------------+-------+--------
1  | Coke Bottle | 20.00 | true
2  | Coke Can    | 40.00 | true
3  | Lays Chips  | 5.00  | true
4  | Kurkure     | 5.00  | true
```

### Query 4: Check Settings

```sql
SELECT setting_type, setting_data 
FROM multivendor.settings 
WHERE tenant_id = 1;
```

**Expected Result:**
```
setting_type | setting_data
-------------+--------------
pricing      | {JSON data}
bonus        | {JSON data}
```

---

## 🎨 Optional: Create Separate Connections

You can create separate server connections for each database:

### Connection 1: Original Database
```
Name:     Gamers Spot - Original
Host:     localhost
Port:     5432
Database: gamersspot
Username: postgres
Password: postgres
```

### Connection 2: Multi-Vendor Database
```
Name:     Gamers Spot - Multi-Vendor
Host:     localhost
Port:     5432
Database: multivendor
Username: postgres
Password: postgres
```

**Benefits:**
- Easier to switch between databases
- Prevents accidental queries on wrong database
- Cleaner organization

---

## 🔐 Security Note

**For Production:**
- Change the default password from `postgres`
- Use strong passwords
- Restrict access by IP
- Use SSL connections

**For Local Development:**
- Current setup is fine (localhost only)
- Not accessible from outside your computer

---

## 🛠️ Troubleshooting

### Issue: "Could not connect to server"

**Solution:**
1. Check if Docker is running:
   ```bash
   docker ps
   ```
2. Check if container is running:
   ```bash
   docker ps | grep gamersspot-db
   ```
3. Start container if needed:
   ```bash
   docker-compose up -d
   ```

### Issue: "Database does not exist"

**Solution:**
1. Verify database exists:
   ```bash
   docker exec gamersspot-db psql -U postgres -l
   ```
2. Recreate if needed:
   ```bash
   node create-multivendor-db.cjs
   ```

### Issue: "Password authentication failed"

**Solution:**
- Make sure you're using password: `postgres`
- Check docker-compose.yml for correct password
- Try connecting to `postgres` database first, then switch to `multivendor`

---

## 📊 Useful pgAdmin Features

### 1. Query Tool
- Right-click on `multivendor` database
- Select **Query Tool**
- Run SQL queries directly

### 2. View Data
- Right-click on any table (e.g., `multivendor.tenants`)
- Select **View/Edit Data** → **All Rows**
- See table contents in a grid

### 3. ERD Diagram
- Right-click on `multivendor` schema
- Select **ERD For Schema**
- Visualize table relationships

### 4. Backup Database
- Right-click on `multivendor` database
- Select **Backup...**
- Save a backup file

### 5. Import/Export Data
- Right-click on a table
- Select **Import/Export Data...**
- Import CSV or export to CSV

---

## 🎯 Quick Reference

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/multivendor
```

**Docker Command to Access:**
```bash
docker exec -it gamersspot-db psql -U postgres -d multivendor
```

**Verification Script:**
```bash
node verify-multivendor.cjs
```

---

## ✅ Checklist

After setup, verify:
- [ ] pgAdmin connects successfully
- [ ] You can see the `multivendor` database
- [ ] You can see the `multivendor` schema
- [ ] All 7 tables are visible
- [ ] Default tenant exists
- [ ] Default snacks exist (4 items)
- [ ] Settings exist (pricing, bonus)
- [ ] You can run queries successfully

---

**Setup Complete!** You can now manage your multi-vendor database through pgAdmin. 🎉

**Next Steps:**
1. Explore the database structure
2. Run test queries
3. Add more tenants when ready
4. Update your application to use this database
