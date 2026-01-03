# 🔧 TROUBLESHOOTING: Subscription Plans Not Showing

## Issue
The "Subscription Plans Configuration" modal opens but shows no plans.

## Root Cause
The subscription plans haven't been created in the database yet. The migration script needs to be run.

## Solution

### **Option 1: Run Migration Script (Recommended)**

Execute the subscription migration SQL script to create the default plans:

```bash
# Navigate to scripts directory
cd "c:\Dev\Seema Gamersspot\Version 3\Gamersspot\scripts"

# Run the migration script
psql -h localhost -p 5434 -U postgres -d Gamersspot-local -f subscription-migration.sql
```

Or use Docker:

```bash
docker exec -i game-management-system psql -U postgres -d Gamersspot-local < scripts/subscription-migration.sql
```

### **Option 2: Manual SQL Execution**

Connect to your database and run:

```sql
-- Create subscription plans
INSERT INTO subscription_plans (plan_code, plan_name, duration_days, price_inr, features, is_active, display_order)
VALUES
    ('FREE_TRIAL', 'Free Trial', 14, 0, '{"max_stations": 10, "max_invoices_per_month": 100}'::jsonb, true, 1),
    ('MONTHLY', 'Monthly Premium', 30, 999, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 2),
    ('QUARTERLY', 'Quarterly Premium', 90, 2499, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 3),
    ('SEMI_ANNUAL', '6 Months Premium', 180, 4499, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 4),
    ('YEARLY', 'Yearly Premium', 365, 7999, '{"max_stations": -1, "max_invoices_per_month": -1}'::jsonb, true, 5)
ON CONFLICT (plan_code) DO NOTHING;
```

### **Option 3: Use the Demo Script**

Run the demo script which will create plans if they don't exist:

```bash
node scripts/demo-subscription-system.mjs
```

## Verification

After running the migration, you should see:

1. **In the modal:** 5 subscription plan cards
   - Free Trial (₹0)
   - Monthly Premium (₹999)
   - Quarterly Premium (₹2,499)
   - 6 Months Premium (₹4,499)
   - Yearly Premium (₹7,999)

2. **In browser console:** 
   ```
   Plans API Response: { success: true, plans: [...] }
   ```

## Debugging

### **Check if plans exist:**

```sql
SELECT * FROM subscription_plans ORDER BY display_order;
```

### **Check browser console:**

Open DevTools (F12) and look for:
- `Plans API Response:` - Should show the API data
- Any error messages in red

### **Check API response:**

```bash
# Get auth token from browser localStorage
# Then test API:
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3002/api/subscriptions?action=plans
```

## Expected Behavior

**Before Migration:**
```
┌─────────────────────────────────────┐
│ Subscription Plans Configuration   │
├─────────────────────────────────────┤
│                                     │
│  📦 No Subscription Plans Found     │
│  There are no subscription plans    │
│  configured yet.                    │
│                                     │
│  Run the subscription migration     │
│  script to set up default plans.    │
│                                     │
└─────────────────────────────────────┘
```

**After Migration:**
```
┌─────────────────────────────────────┐
│ Subscription Plans Configuration   │
├─────────────────────────────────────┤
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Free │ │Monthly│ │Qtrly │        │
│  │Trial │ │Premium│ │Prem. │        │
│  │  ₹0  │ │ ₹999 │ │₹2,499│        │
│  │[Edit]│ │[Edit]│ │[Edit]│        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  ┌──────┐ ┌──────┐                 │
│  │6 Mon │ │Yearly│                 │
│  │Prem. │ │Prem. │                 │
│  │₹4,499│ │₹7,999│                 │
│  │[Edit]│ │[Edit]│                 │
│  └──────┘ └──────┘                 │
│                                     │
└─────────────────────────────────────┘
```

## Quick Fix Command

```bash
# One-line fix (Windows PowerShell)
docker exec -i game-management-system psql -U postgres -d Gamersspot-local -c "INSERT INTO subscription_plans (plan_code, plan_name, duration_days, price_inr, features, is_active, display_order) VALUES ('FREE_TRIAL', 'Free Trial', 14, 0, '{\"max_stations\": 10, \"max_invoices_per_month\": 100}'::jsonb, true, 1), ('MONTHLY', 'Monthly Premium', 30, 999, '{\"max_stations\": -1, \"max_invoices_per_month\": -1}'::jsonb, true, 2), ('QUARTERLY', 'Quarterly Premium', 90, 2499, '{\"max_stations\": -1, \"max_invoices_per_month\": -1}'::jsonb, true, 3), ('SEMI_ANNUAL', '6 Months Premium', 180, 4499, '{\"max_stations\": -1, \"max_invoices_per_month\": -1}'::jsonb, true, 4), ('YEARLY', 'Yearly Premium', 365, 7999, '{\"max_stations\": -1, \"max_invoices_per_month\": -1}'::jsonb, true, 5) ON CONFLICT (plan_code) DO NOTHING;"
```

After running this command, refresh the page and open the Configure Plans modal again. You should see all 5 plans!
