# GAMERS SPOT - AUTONOMOUS SUBSCRIPTION SYSTEM
## Complete Implementation Guide

---

## 📋 OVERVIEW

This document describes the fully autonomous subscription management system for Gamers Spot. The system requires **zero manual intervention** and **no cron jobs**, using lazy evaluation to automatically update subscription statuses on-demand.

### Key Features
- ✅ Fully autonomous - no cron jobs required
- ✅ Lazy evaluation - status computed on API requests
- ✅ Race-safe with database transactions
- ✅ Complete audit trail
- ✅ Grace period support
- ✅ Multi-tier pricing (Trial, Monthly, Quarterly, Semi-Annual, Yearly)
- ✅ Automatic status transitions
- ✅ Frontend integration with React Context
- ✅ Blocking UI when expired

---

## 🗄️ DATABASE SCHEMA

### Tables Created

#### 1. `subscription_plans`
Defines available subscription tiers.

```sql
- id (SERIAL PRIMARY KEY)
- plan_code (VARCHAR UNIQUE) - 'FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'
- plan_name (VARCHAR) - Display name
- duration_days (INTEGER) - Plan duration
- price_inr (NUMERIC) - Price in rupees
- features (JSONB) - Feature flags/limits
- is_active (BOOLEAN) - Can be purchased
- display_order (INTEGER) - UI sorting
- created_at, updated_at (TIMESTAMPTZ)
```

**Default Plans:**
- FREE_TRIAL: 14 days, ₹0
- MONTHLY: 30 days, ₹999
- QUARTERLY: 90 days, ₹2,499 (17% discount)
- SEMI_ANNUAL: 180 days, ₹4,499 (25% discount)
- YEARLY: 365 days, ₹7,999 (33% discount)

#### 2. `shop_subscriptions`
One row per shop - current subscription state (SINGLE SOURCE OF TRUTH).

```sql
- id (SERIAL PRIMARY KEY)
- shop_id (INTEGER UNIQUE FK) - References shops(id)
- current_plan_code (VARCHAR FK) - References subscription_plans(plan_code)
- started_at (TIMESTAMPTZ) - When current plan started
- expires_at (TIMESTAMPTZ) - When current plan ends
- grace_ends_at (TIMESTAMPTZ) - When grace period ends (if applicable)
- computed_status (VARCHAR) - 'trial', 'active', 'grace', 'expired'
- last_status_check_at (TIMESTAMPTZ) - Last lazy evaluation
- auto_renew (BOOLEAN) - For future payment gateway
- next_billing_date (TIMESTAMPTZ) - For future billing
- created_at, updated_at (TIMESTAMPTZ)
```

#### 3. `subscription_events`
Immutable audit log of all subscription changes.

```sql
- id (SERIAL PRIMARY KEY)
- shop_id (INTEGER FK)
- event_type (VARCHAR) - 'created', 'renewed', 'upgraded', 'downgraded', 'expired', 'grace_started', 'status_changed'
- old_plan_code, new_plan_code (VARCHAR)
- old_status, new_status (VARCHAR)
- old_expires_at, new_expires_at (TIMESTAMPTZ)
- triggered_by (VARCHAR) - 'system', 'admin', 'user', 'payment_gateway'
- triggered_by_user_id (INTEGER FK)
- payment_id (INTEGER FK)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
```

#### 4. `subscription_config`
System configuration (key-value store).

```sql
- key (VARCHAR PRIMARY KEY)
- value (TEXT)
- description (TEXT)
- updated_at (TIMESTAMPTZ)
```

**Default Config:**
- `grace_period_days`: 3
- `status_check_interval_minutes`: 60
- `default_trial_plan`: FREE_TRIAL
- `allow_trial_after_paid`: false

---

## 🔧 BACKEND IMPLEMENTATION

### Core Service: `subscriptionService.js`

#### Key Functions

**1. `getShopSubscription(shopId)`**
- Fetches subscription with lazy status update
- Uses row-level locking to prevent race conditions
- Automatically recomputes status if stale (> 60 minutes)
- Updates `computed_status` and `grace_ends_at` as needed
- Logs status change events
- Returns enriched subscription object with plan details

**2. `computeSubscriptionStatus(subscription, gracePeriodDays)`**
- Pure function - SINGLE SOURCE OF TRUTH for status
- Logic:
  ```
  IF expires_at > NOW:
      RETURN plan_code === 'FREE_TRIAL' ? 'trial' : 'active'
  ELSE IF NOW < grace_ends_at:
      RETURN 'grace'
  ELSE:
      RETURN 'expired'
  ```

**3. `renewSubscription(shopId, newPlanCode, paymentDetails, triggeredByUserId)`**
- Renews or upgrades subscription
- Extends from current expiry if still valid, otherwise from NOW
- Creates payment record if amount > 0
- Logs event (renewed/upgraded/downgraded)
- Returns updated subscription

**4. `checkSubscriptionAccess(shopId, action)`**
- Checks if shop can perform action
- Supports feature limits (e.g., max_stations)
- Returns `{ allowed: boolean, reason: string, subscription }`

### Middleware: `authMiddleware.js`

**Updated `requireActiveSubscription`**
```javascript
export const requireActiveSubscription = async (req, res, next) => {
    // Super Admins bypass
    if (req.user.role === 'SUPER_ADMIN') return next();
    
    // Get subscription (triggers lazy evaluation)
    const subscription = await getShopSubscription(req.user.shopId);
    
    // Attach to request
    req.subscription = subscription;
    
    // Check validity
    if (!subscription.is_valid) {
        return res.status(402).json({
            error: 'Subscription Expired',
            code: 'SUBSCRIPTION_EXPIRED',
            status: subscription.computed_status,
            message: '...',
            expires_at: subscription.expires_at,
            grace_ends_at: subscription.grace_ends_at
        });
    }
    
    next();
};
```

### API Endpoint: `/api/subscriptions`

**GET `/api/subscriptions?action=status`**
- Returns current subscription status
- Response:
  ```json
  {
    "success": true,
    "subscription": {
      "status": "active",
      "plan_code": "MONTHLY",
      "plan_name": "Monthly Premium",
      "price": 999,
      "started_at": "2026-01-01T00:00:00Z",
      "expires_at": "2026-01-31T00:00:00Z",
      "days_remaining": 28,
      "is_valid": true,
      "features": {}
    }
  }
  ```

**GET `/api/subscriptions?action=plans`**
- Returns all available plans
- Sorted by display_order

**POST `/api/subscriptions?action=renew`**
- Renews/upgrades subscription
- Body:
  ```json
  {
    "plan_code": "MONTHLY",
    "payment_method": "UPI",
    "transaction_id": "TXN123456",
    "notes": "Renewal payment"
  }
  ```

**GET `/api/subscriptions?action=events`**
- Returns subscription event history
- Query params: `limit` (default 50)

---

## 🎨 FRONTEND IMPLEMENTATION

### Context: `SubscriptionContext.jsx`

**SubscriptionProvider**
- Wraps entire app
- Fetches subscription on mount
- Auto-refreshes every 5 minutes
- Shows expired modal when needed

**useSubscription() Hook**
```javascript
const {
    subscription,      // Full subscription object
    loading,           // Loading state
    error,             // Error message
    showExpiredModal,  // Modal visibility
    setShowExpiredModal,
    fetchSubscription, // Refresh function
    renewSubscription, // Renew function
    getPlans,          // Get available plans
    // Computed properties
    isValid,           // Boolean
    isTrial,           // Boolean
    isActive,          // Boolean
    isGrace,           // Boolean
    isExpired,         // Boolean
    daysRemaining,     // Number
    planName           // String
} = useSubscription();
```

### Components

**SubscriptionStatusBadge**
- Shows current status with icon
- Displays days remaining warning
- Color-coded (green/blue/orange/red)

**SubscriptionDetailsCard**
- Full subscription information
- Plan details, expiry date, days remaining
- Feature list
- Renew button when expiring/expired

**SubscriptionExpiredModal**
- Blocking modal when expired
- Plan selection UI
- Renew button
- Cannot be dismissed if expired

---

## 🔄 LIFECYCLE & AUTOMATION

### Status Transitions

```
NEW SHOP
   ↓
[TRIAL] (14 days)
   ↓ (expires)
[GRACE] (3 days)
   ↓ (grace ends)
[EXPIRED]
   ↓ (payment)
[ACTIVE] (30/90/180/365 days)
   ↓ (expires)
[GRACE] (3 days)
   ↓ (grace ends)
[EXPIRED]
```

### Lazy Evaluation Flow

1. **API Request** arrives with valid JWT
2. **Middleware** calls `getShopSubscription(shopId)`
3. **Service** locks subscription row (`FOR UPDATE`)
4. **Service** checks `last_status_check_at`:
   - If > 60 minutes ago → recompute status
   - If status changed → update DB and log event
5. **Service** returns subscription
6. **Middleware** checks `is_valid`
   - If false → return 402 error
   - If true → proceed to handler

### Automatic Actions

**On Shop Creation (Trigger)**
```sql
CREATE TRIGGER trigger_auto_create_subscription
    AFTER INSERT ON shops
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_shop_subscription();
```
- Automatically creates FREE_TRIAL subscription
- Logs 'created' event

**On Status Check (Lazy)**
- Computes status from dates
- Updates `computed_status` if changed
- Sets `grace_ends_at` when entering grace
- Logs 'status_changed' event

**On Renewal**
- Extends `expires_at`
- Resets `grace_ends_at` to NULL
- Sets `computed_status` to 'active' or 'trial'
- Creates payment record
- Logs 'renewed'/'upgraded'/'downgraded' event

---

## 🚀 DEPLOYMENT STEPS

### 1. Run Database Migrations

```bash
# Schema
Get-Content scripts\subscription-system-schema.sql | docker exec -i game-management-system psql -U postgres -d gamersspot

# Migration & Triggers
Get-Content scripts\subscription-migration.sql | docker exec -i game-management-system psql -U postgres -d gamersspot
```

### 2. Verify Tables Created

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%subscription%';
```

Expected:
- subscription_plans
- shop_subscriptions
- subscription_events
- subscription_config

### 3. Verify Migration

```sql
SELECT shop_id, current_plan_code, computed_status, expires_at 
FROM shop_subscriptions;
```

### 4. Update Frontend

Add to `App.jsx`:
```javascript
import { SubscriptionProvider } from './contexts/SubscriptionContext';

function App() {
    return (
        <SubscriptionProvider>
            {/* existing app */}
        </SubscriptionProvider>
    );
}
```

### 5. Test

**Test Subscription Status:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3002/api/subscriptions?action=status
```

**Test Renewal:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"plan_code":"MONTHLY","payment_method":"MANUAL"}' \
     http://localhost:3002/api/subscriptions?action=renew
```

---

## 🔒 ACCESS CONTROL

### API Enforcement

**Protected Endpoints** (require active subscription):
- `/api/stations` (create, update, delete)
- `/api/invoices` (create)
- `/api/customers` (create)
- `/api/paid-events` (create)

**Always Allowed** (even if expired):
- `/api/auth` (login, logout)
- `/api/subscriptions` (status, renew)
- `/api/admin` (super admin only)

### Frontend Enforcement

**Blocking:**
- Show expired modal (cannot dismiss)
- Disable "Start" buttons on stations
- Disable "Create Invoice" button
- Show warning banners

**Read-Only Access:**
- View existing data
- View reports
- View settings

---

## 📊 MONITORING & DEBUGGING

### Check Subscription Status

```sql
SELECT 
    s.id as shop_id,
    s.name as shop_name,
    ss.current_plan_code,
    ss.computed_status,
    ss.expires_at,
    ss.grace_ends_at,
    ss.last_status_check_at,
    EXTRACT(DAY FROM (ss.expires_at - NOW())) as days_remaining
FROM shops s
JOIN shop_subscriptions ss ON s.id = ss.shop_id
ORDER BY ss.expires_at;
```

### View Recent Events

```sql
SELECT 
    shop_id,
    event_type,
    old_status,
    new_status,
    old_plan_code,
    new_plan_code,
    triggered_by,
    created_at
FROM subscription_events
ORDER BY created_at DESC
LIMIT 20;
```

### Force Status Recomputation

```sql
UPDATE shop_subscriptions 
SET last_status_check_at = NOW() - INTERVAL '2 hours'
WHERE shop_id = 1;
```

Then make any API request - status will auto-update.

---

## 🎯 BEST PRACTICES

1. **Never manually update `computed_status`** - it's derived from dates
2. **Always use transactions** when modifying subscriptions
3. **Log all changes** to `subscription_events`
4. **Test grace period** before production
5. **Monitor `last_status_check_at`** - should update regularly
6. **Use `is_valid` flag** for access control, not status string
7. **Keep `expires_at` in UTC** - no timezone conversions

---

## 🐛 TROUBLESHOOTING

**Problem: Status not updating**
- Check `last_status_check_at` - should be recent
- Verify `status_check_interval_minutes` in config
- Make an API request to trigger lazy evaluation

**Problem: Subscription not found**
- Check if shop exists in `shops` table
- Verify trigger is active: `\d shops` in psql
- Manually create: `INSERT INTO shop_subscriptions ...`

**Problem: Grace period not working**
- Check `grace_period_days` in config
- Verify `grace_ends_at` is set correctly
- Check `computeSubscriptionStatus` logic

**Problem: Frontend not showing status**
- Check browser console for errors
- Verify `/api/subscriptions?action=status` returns data
- Ensure `SubscriptionProvider` wraps app

---

## 📝 SUMMARY

This autonomous subscription system:
- ✅ Requires **zero manual intervention**
- ✅ Uses **no cron jobs** or background workers
- ✅ Is **fully race-safe** with database transactions
- ✅ Provides **complete audit trail**
- ✅ Supports **grace periods** and **automatic transitions**
- ✅ Integrates **seamlessly** with existing codebase
- ✅ Is **production-ready** and **scalable**

The system will automatically manage subscriptions for all shops, enforce access control, and provide a smooth user experience with clear warnings and renewal flows.
