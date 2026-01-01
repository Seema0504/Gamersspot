# 🔧 Fix pgAdmin Connection Issue

## ❌ Problem
pgAdmin cannot connect with error:
```
password authentication failed for user "postgres"
```

## ✅ Solution

The PostgreSQL container is using `scram-sha-256` authentication. Here are **3 solutions**:

---

## **Solution 1: Use Docker Host IP (Recommended)**

Instead of `localhost`, use Docker's host IP:

### pgAdmin Connection Settings:
```
Name:                  Gamers Spot - Multi-Vendor
Host:                  host.docker.internal
Port:                  5432
Maintenance database:  postgres
Username:              postgres
Password:              postgres
```

**OR** use the actual IP:
```
Host:                  127.0.0.1
```

---

## **Solution 2: Connect via Docker Exec (Alternative)**

If pgAdmin still doesn't work, you can use these alternatives:

### Option A: Use DBeaver (Recommended)
1. Download DBeaver Community Edition (free)
2. Create new connection:
   - Database: PostgreSQL
   - Host: localhost
   - Port: 5432
   - Database: multivendor
   - Username: postgres
   - Password: postgres

### Option B: Use psql Command Line
```bash
# Connect directly
docker exec -it gamersspot-db psql -U postgres -d multivendor

# Once connected, you can run queries:
\dt multivendor.*          # List tables
SELECT * FROM multivendor.tenants;
```

### Option C: Use TablePlus (Modern GUI)
- Download TablePlus (free tier available)
- Connection type: PostgreSQL
- Host: localhost:5432
- User: postgres
- Password: postgres
- Database: multivendor

---

## **Solution 3: Update PostgreSQL Authentication (Advanced)**

If you really need pgAdmin to work with localhost, modify the container:

### Step 1: Create custom pg_hba.conf
Create file: `database/pg_hba.conf`

```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
host    all             all             0.0.0.0/0               md5
```

### Step 2: Update docker-compose.yml
Add volume mount:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./database/local_setup.sql:/docker-entrypoint-initdb.d/01-setup.sql:ro
  - ./database/pg_hba.conf:/var/lib/postgresql/data/pg_hba.conf  # Add this
```

### Step 3: Restart container
```bash
docker-compose down
docker-compose up -d
```

---

## **Quick Test: Verify Connection**

Test if you can connect from command line:

```bash
# Test 1: From inside container (should work)
docker exec gamersspot-db psql -U postgres -d multivendor -c "SELECT 1;"

# Test 2: From host using psql (if installed)
psql -h localhost -p 5432 -U postgres -d multivendor

# Test 3: Using our Node.js script
node verify-multivendor.cjs
```

---

## **Recommended Approach**

**For now, I recommend:**

1. **Use DBeaver** instead of pgAdmin
   - It's free, modern, and easier to use
   - Better support for Docker PostgreSQL
   - Download: https://dbeaver.io/download/

2. **Or use the command line:**
   ```bash
   docker exec -it gamersspot-db psql -U postgres -d multivendor
   ```

3. **Or use our verification script:**
   ```bash
   node verify-multivendor.cjs
   ```

---

## **pgAdmin Specific Fix**

If you must use pgAdmin, try these exact settings:

### Connection Tab:
```
Host name/address:     127.0.0.1  (NOT localhost)
Port:                  5432
Maintenance database:  postgres
Username:              postgres
Password:              postgres
```

### SSL Tab:
```
SSL mode:              Prefer
```

### Advanced Tab:
```
DB restriction:        multivendor
```

---

## **Still Not Working?**

If none of the above work, there might be another PostgreSQL instance running on your system. Check:

```bash
# Check what's using port 5432
netstat -ano | findstr :5432

# Check if PostgreSQL service is running
Get-Service | Where-Object {$_.Name -like "*postgres*"}

# Stop any Windows PostgreSQL service
Stop-Service postgresql-x64-15  # (if exists)
```

---

## **My Recommendation**

**Use DBeaver Community Edition:**
- ✅ Free and open source
- ✅ Modern interface
- ✅ Better Docker support
- ✅ Works with all databases
- ✅ No authentication issues

**Connection Details for DBeaver:**
```
Type:      PostgreSQL
Host:      localhost
Port:      5432
Database:  multivendor
Username:  postgres
Password:  postgres
```

---

**Need Help?** Let me know which solution you'd like to try!
