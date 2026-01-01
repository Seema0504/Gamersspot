# SaaS Implementation Guide

## Overview
The "Gamers Spot" application has been successfully converted into a Multi-Shop SaaS platform. The system now supports:
- **Multiple Shops**: Each shop has isolated data (Stations, Invoices, Customers).
- **Role-Based Access**:
    - `SUPER_ADMIN`: Can manage shops and subscriptions.
    - `SHOP_OWNER`: Can manage their specific shop.
    - `STAFF`: Standard operational access.
- **Subscriptions**: Shops must have an active subscription (or Trial) to access operational features.
- **Data Isolation**: All critical data is scoped by `shop_id`.

## Login Credentials
### Super Admin (System Owner)
- **Username**: `admin`
- **Password**: `admin123` (Change this immediately!)
- **Access**: Full system control, "Super Admin Dashboard".

### Shop Owner (Default Shop)
- **Username**: (You need to create one via Super Admin Dashboard or use direct DB insert if needed).
- **Note**: The legacy user from `admin_users` was migrated. If you had a user `admin` before, it is now `SUPER_ADMIN`. If you had others, they are likely `STAFF`.

## Key Changes
1.  **Database**:
    - Added `shops`, `subscriptions` tables.
    - Added `shop_id` to `stations`, `invoices`, `customers`, etc.
    - Primary Keys for `stations` and `snacks` are now composite `(shop_id, id)`.
2.  **API**:
    - URLs remain the same (e.g., `/api/stations`).
    - **Authentication is now MANDATORY** for all API calls.
    - `Authorization: Bearer <token>` header is required (handled automatically by frontend).
3.  **Frontend**:
    - Login page now authenticates against the SaaS backend.
    - `SUPER_ADMIN` is redirected to the **Super Admin Dashboard** to create new shops.
    - `SHOP_OWNER` / `STAFF` are redirected to the standard **Game Timer Dashboard**.

## How to Create a New Shop
1.  Login as `admin`.
2.  You will see the **Super Admin Dashboard**.
3.  Fill in "Shop Name", "Owner Username", "Owner Password".
4.  Click **Create Shop**.
    - This creates the Shop.
    - Creates a 14-Day Trial Subscription.
    - Creates the Owner User.
5.  Logout.
6.  Login with the new Owner credentials to access the new empty shop.

## Technical Notes
- **Server Port**: `3002` (API), `5173+` (Frontend).
- **Database**: PostgreSQL (Ensure `POSTGRES_URL` is set).
- **Tokens**: JWT Tokens expire in 24 hours.

## Troubleshooting
- **"Unauthorized"**: Your token might be expired. Logout and Login again.
- **"Database Error"**: Ensure PostgreSQL is running.
- **"Station Not Found"**: Stations are now shop-specific. Station 1 in Shop A is different from Station 1 in Shop B.

## ✅ Security Updates - COMPLETE (January 1, 2026)
All APIs have been updated to filter data by `shop_id`. Complete shop-wise isolation is now enforced:

✅ **COMPLETED** - `api/reports.js` - All report types filter by shop_id  
✅ **COMPLETED** - `api/customers.js` - Customer data isolated per shop  
✅ **COMPLETED** - `api/settings.js` - Pricing/Bonuses/Snacks isolated per shop  
✅ **COMPLETED** - `api/paid_events.js` - Events scoped to shop_id  

**See:** `SAAS_SHOP_ISOLATION_COMPLETE.md` for full implementation details.

## Next Steps
1.  **Payment Gateway Integration**: Automate subscription renewals.
2.  **Advanced Reports**: Cross-shop reporting for Super Admin.
