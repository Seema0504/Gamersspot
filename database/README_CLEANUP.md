# Database Cleanup Guide

This guide explains how to clean up all data from your PostgreSQL database.

## ⚠️ WARNING

**These operations will DELETE ALL DATA from your database tables. This action cannot be undone!**

Make sure you have a backup if you need to restore any data later.

## Method 1: Using SQL Scripts (Recommended)

### Option A: Simple Cleanup (`cleanup.sql`)

1. **Open your database SQL editor:**
   - **Supabase**: Go to SQL Editor in your dashboard
   - **Neon**: Go to SQL Editor in your dashboard
   - **pgAdmin**: Connect to your database and open Query Tool
   - **Local PostgreSQL**: Use `psql` or any PostgreSQL client

2. **Copy and paste the contents of `database/cleanup.sql`**

3. **Run the script**

4. **Verify**: The script will show a success message and count of remaining rows (should be 0)

### Option B: Complete Cleanup (`cleanup_all.sql`)

This script uses `TRUNCATE` which is faster and also resets sequences:

1. Open your database SQL editor
2. Copy and paste the contents of `database/cleanup_all.sql`
3. Run the script
4. Verify the results

## Method 2: Using API Endpoint (Programmatic)

You can also clean up the database via an API call:

### Local Development

```bash
curl -X POST http://localhost:3001/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"token": "cleanup-confirm"}'
```

### Production (Vercel)

```bash
curl -X POST https://your-app.vercel.app/api/cleanup \
  -H "Content-Type: application/json" \
  -d '{"token": "cleanup-confirm"}'
```

**Note**: The default token is `cleanup-confirm`. For production, you should set a custom token in your environment variables:

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add: `CLEANUP_TOKEN` = `your-secure-token-here`
3. Use that token in your API call

## What Gets Deleted

- **stations table**: All gaming station data
- **invoices table**: All invoice records
- **Sequences**: Reset to start from 1 again

## What Stays Intact

- Table structure (columns, indexes, constraints)
- Triggers and functions
- Database schema

## After Cleanup

After cleanup, your app will:
- Start with empty tables
- Create new stations when you use the app
- Save new invoices as you generate them

The app will automatically create default stations (7 stations) when it first loads if the database is empty.

## Troubleshooting

**Error: "permission denied"**
- Make sure you're using a database user with DELETE/TRUNCATE permissions
- For Supabase, use the postgres user or a user with admin privileges

**Error: "table does not exist"**
- Run the schema script first (`database/schema.sql`) to create the tables

**Data still showing after cleanup**
- Make sure you committed the transaction (if using transactions)
- Check if you're looking at the correct database
- Refresh your database viewer/editor

## Need Help?

If you encounter any issues:
1. Check the error message in your SQL editor
2. Verify your database connection
3. Make sure you have the correct permissions
4. Check that tables exist before running cleanup

