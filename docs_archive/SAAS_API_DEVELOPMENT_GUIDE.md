# SaaS API Development Guide - Shop Isolation

**Quick Reference for Adding New APIs with Shop Isolation**

---

## 🎯 Golden Rule

**EVERY API endpoint MUST filter data by `shop_id` to ensure shop isolation.**

---

## 📋 Standard API Template

```javascript
import { getDbClient, closeDbClient } from './db.js';
import { authenticateToken, requireActiveSubscription } from './middleware/authMiddleware.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apply authentication middleware
  return new Promise((resolve) => {
    authenticateToken(req, res, async () => {
      await requireActiveSubscription(req, res, async () => {
        // ✅ STEP 1: Extract shop_id from authenticated user
        const shopId = req.user?.shopId;
        
        if (!shopId) {
          res.status(403).json({ error: 'Shop context missing' });
          return resolve();
        }

        let db = null;
        try {
          db = await getDbClient();
          const client = db.client;

          if (!client) {
            console.error('Database client is null');
            res.status(500).json({ error: 'Database connection failed' });
            return resolve();
          }

          // ✅ STEP 2: Handle your API logic with shop_id filtering
          if (req.method === 'GET') {
            // Example: Get all items for this shop
            const { rows } = await client.query(
              'SELECT * FROM your_table WHERE shop_id = $1',
              [shopId]
            );
            
            await closeDbClient(db);
            res.status(200).json({ items: rows });
            return resolve();
          }

          if (req.method === 'POST') {
            // Example: Create new item for this shop
            const { name, value } = req.body;
            
            const { rows } = await client.query(
              'INSERT INTO your_table (shop_id, name, value) VALUES ($1, $2, $3) RETURNING *',
              [shopId, name, value]
            );
            
            await closeDbClient(db);
            res.status(201).json({ item: rows[0] });
            return resolve();
          }

          if (req.method === 'PUT') {
            // Example: Update item (ensure it belongs to this shop)
            const { id, name, value } = req.body;
            
            const { rows } = await client.query(
              'UPDATE your_table SET name = $1, value = $2 WHERE id = $3 AND shop_id = $4 RETURNING *',
              [name, value, id, shopId]
            );
            
            if (rows.length === 0) {
              await closeDbClient(db);
              res.status(404).json({ error: 'Item not found or access denied' });
              return resolve();
            }
            
            await closeDbClient(db);
            res.status(200).json({ item: rows[0] });
            return resolve();
          }

          if (req.method === 'DELETE') {
            // Example: Delete item (ensure it belongs to this shop)
            const { id } = req.query;
            
            const { rowCount } = await client.query(
              'DELETE FROM your_table WHERE id = $1 AND shop_id = $2',
              [id, shopId]
            );
            
            if (rowCount === 0) {
              await closeDbClient(db);
              res.status(404).json({ error: 'Item not found or access denied' });
              return resolve();
            }
            
            await closeDbClient(db);
            res.status(200).json({ success: true });
            return resolve();
          }

          await closeDbClient(db);
          res.status(405).json({ error: 'Method not allowed' });
          return resolve();
        } catch (error) {
          console.error('API Error:', error);
          if (db) await closeDbClient(db);
          res.status(500).json({ error: error.message || 'Internal server error' });
          return resolve();
        }
      });
    });
  });
}
```

---

## ✅ Checklist for New APIs

### **1. Authentication & Authorization**
- [ ] Import `authenticateToken` and `requireActiveSubscription`
- [ ] Wrap handler in `authenticateToken` middleware
- [ ] Wrap handler in `requireActiveSubscription` middleware
- [ ] Extract `shopId` from `req.user.shopId`
- [ ] Validate `shopId` exists (return 403 if missing)

### **2. Database Queries**
- [ ] **ALL SELECT queries** include `WHERE shop_id = $1`
- [ ] **ALL INSERT queries** include `shop_id` column
- [ ] **ALL UPDATE queries** include `WHERE ... AND shop_id = $X`
- [ ] **ALL DELETE queries** include `WHERE ... AND shop_id = $X`

### **3. CORS Headers**
- [ ] Include `Authorization` in `Access-Control-Allow-Headers`

### **4. Error Handling**
- [ ] Return `resolve()` after sending response
- [ ] Close database connection in all code paths
- [ ] Handle missing shop context with 403 error

---

## 🚫 Common Mistakes to Avoid

### **❌ WRONG - No shop_id filter**
```javascript
const { rows } = await client.query('SELECT * FROM customers');
// ⚠️ This returns ALL customers from ALL shops!
```

### **✅ CORRECT - With shop_id filter**
```javascript
const { rows } = await client.query(
  'SELECT * FROM customers WHERE shop_id = $1',
  [shopId]
);
// ✅ Only returns customers for the authenticated shop
```

---

### **❌ WRONG - Missing shop_id in INSERT**
```javascript
await client.query(
  'INSERT INTO items (name, price) VALUES ($1, $2)',
  [name, price]
);
// ⚠️ Item not associated with any shop!
```

### **✅ CORRECT - Include shop_id in INSERT**
```javascript
await client.query(
  'INSERT INTO items (shop_id, name, price) VALUES ($1, $2, $3)',
  [shopId, name, price]
);
// ✅ Item correctly associated with shop
```

---

### **❌ WRONG - Update without shop_id check**
```javascript
await client.query(
  'UPDATE items SET price = $1 WHERE id = $2',
  [newPrice, itemId]
);
// ⚠️ Could update another shop's item!
```

### **✅ CORRECT - Update with shop_id check**
```javascript
await client.query(
  'UPDATE items SET price = $1 WHERE id = $2 AND shop_id = $3',
  [newPrice, itemId, shopId]
);
// ✅ Only updates if item belongs to this shop
```

---

## 🔍 Testing Your API

### **Manual Test Steps:**
1. Create two test shops (Shop A and Shop B)
2. Login as Shop A owner, create test data
3. Login as Shop B owner
4. Verify Shop B **cannot see** Shop A's data
5. Verify Shop B **cannot modify** Shop A's data
6. Verify Shop B **cannot delete** Shop A's data

### **SQL Test Query:**
```sql
-- Verify data is properly scoped
SELECT shop_id, COUNT(*) 
FROM your_table 
GROUP BY shop_id;

-- Should show separate counts for each shop
```

---

## 📊 Database Schema Requirements

### **Every table MUST have:**
```sql
CREATE TABLE your_table (
  id SERIAL,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  -- your other columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For tables with composite keys:
  PRIMARY KEY (shop_id, id)
  
  -- OR for simple keys:
  -- PRIMARY KEY (id)
);

-- Always create index on shop_id for performance
CREATE INDEX idx_your_table_shop_id ON your_table(shop_id);
```

---

## 🎓 Examples from Existing APIs

### **Simple Example: Customers API**
```javascript
// GET all customers for shop
const { rows } = await client.query(
  'SELECT * FROM customers WHERE shop_id = $1 ORDER BY customer_name ASC',
  [shopId]
);
```

### **Complex Example: Reports API**
```javascript
// Get invoices for specific date and shop
const { rows } = await client.query(`
  SELECT 
    invoice_number,
    total,
    created_at
  FROM invoices
  WHERE shop_id = $1 
    AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $2
  ORDER BY created_at DESC
`, [shopId, targetDate]);
```

### **Composite Key Example: Stations API**
```javascript
// Update station (composite key: shop_id + id)
await client.query(
  'UPDATE stations SET name = $1 WHERE id = $2 AND shop_id = $3',
  [newName, stationId, shopId]
);
```

---

## 🔐 Security Best Practices

1. **Never trust client input** - Always validate shop_id from JWT token
2. **Always use parameterized queries** - Prevent SQL injection
3. **Check subscription status** - Use `requireActiveSubscription` middleware
4. **Log shop context** - Include shop_id in error logs for debugging
5. **Test cross-shop access** - Verify isolation in tests

---

## 📚 Reference Files

- `api/customers.js` - Simple shop isolation example
- `api/settings.js` - Multiple resource types (pricing, bonus, snacks)
- `api/reports.js` - Complex queries with shop filtering
- `api/stations.js` - Composite key example
- `api/middleware/authMiddleware.js` - Authentication middleware

---

## ⚡ Quick Commands

```bash
# Test API locally
npm run dev:all

# Check for missing shop_id filters
grep -r "FROM customers" api/ | grep -v "shop_id"
grep -r "FROM invoices" api/ | grep -v "shop_id"
grep -r "FROM stations" api/ | grep -v "shop_id"
```

---

**Remember:** When in doubt, check existing APIs like `api/customers.js` or `api/settings.js` for reference!

**Last Updated:** January 1, 2026  
**Version:** 3.1
