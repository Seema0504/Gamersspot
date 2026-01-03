import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getDbClient, closeDbClient } from '../api/_lib/db.js';

async function migrate() {
    console.log('Starting migration...');
    const db = await getDbClient();
    const client = db.client;

    try {
        await client.query('BEGIN');

        // 1. Create subscription_plans
        console.log('Creating subscription_plans...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id SERIAL PRIMARY KEY,
                plan_code VARCHAR(50) UNIQUE NOT NULL,
                plan_name VARCHAR(100) NOT NULL,
                duration_days INTEGER NOT NULL,
                price_inr NUMERIC(10, 2) NOT NULL DEFAULT 0,
                features JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        // Insert defaults
        await client.query(`
            INSERT INTO subscription_plans (plan_code, plan_name, duration_days, price_inr, display_order, features) VALUES
            ('FREE_TRIAL', 'Free Trial', 14, 0, 1, '{"max_stations": 10, "max_invoices_per_month": 100}'),
            ('MONTHLY', 'Monthly Premium', 30, 999, 2, '{"max_stations": -1, "max_invoices_per_month": -1}'),
            ('QUARTERLY', 'Quarterly Premium', 90, 2499, 3, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 17}'),
            ('SEMI_ANNUAL', '6 Months Premium', 180, 4499, 4, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 25}'),
            ('YEARLY', 'Yearly Premium', 365, 7999, 5, '{"max_stations": -1, "max_invoices_per_month": -1, "discount_percent": 33}')
            ON CONFLICT (plan_code) DO NOTHING;
        `);

        // 2. Handle subscriptions table
        // Check if table exists
        const checkTable = await client.query(`SELECT to_regclass('public.subscriptions')`);
        if (checkTable.rows[0].to_regclass) {
            // Backup
            console.log('Backing up subscriptions...');
            await client.query(`CREATE TABLE IF NOT EXISTS subscriptions_backup_v2 AS SELECT * FROM subscriptions`);

            // Drop old table
            console.log('Dropping old subscriptions table...');
            await client.query(`DROP TABLE IF EXISTS subscriptions CASCADE`);
        }

        // Create new table
        console.log('Creating new subscriptions table...');
        await client.query(`
            CREATE TABLE subscriptions (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
                current_plan_code VARCHAR(50) NOT NULL REFERENCES subscription_plans(plan_code),
                started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                grace_ends_at TIMESTAMP WITH TIME ZONE,
                computed_status VARCHAR(20) NOT NULL DEFAULT 'trial',
                last_status_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                auto_renew BOOLEAN DEFAULT false,
                next_billing_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT valid_status CHECK (computed_status IN ('trial', 'active', 'grace', 'expired'))
            );
        `);

        // Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions(shop_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(computed_status)`);

        // Restore data (Best effort)
        const checkBackup = await client.query(`SELECT to_regclass('public.subscriptions_backup_v2')`);
        if (checkBackup.rows[0].to_regclass) {
            console.log('Restoring data from backup...');
            // Need to handle potential missing columns in backup if it was weird
            // But we know it has start_date, end_date, etc.
            await client.query(`
                INSERT INTO subscriptions (shop_id, current_plan_code, started_at, expires_at, computed_status)
                SELECT 
                    shop_id, 
                    CASE 
                        WHEN plan_name ILIKE '%monthly%' THEN 'MONTHLY' 
                        WHEN plan_name ILIKE '%yearly%' THEN 'YEARLY'
                        ELSE 'FREE_TRIAL' 
                    END,
                    COALESCE(start_date, NOW()),
                    COALESCE(end_date, NOW() + INTERVAL '14 days'),
                    CASE 
                        WHEN status ILIKE 'active' THEN 'active'
                        ELSE 'trial' -- Default
                    END
                FROM subscriptions_backup_v2
                ON CONFLICT (shop_id) DO NOTHING;
            `);
        }

        // 3. Create other tables
        console.log('Creating events and config tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscription_events (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL,
                old_plan_code VARCHAR(50),
                new_plan_code VARCHAR(50),
                old_status VARCHAR(20),
                new_status VARCHAR(20),
                old_expires_at TIMESTAMP WITH TIME ZONE,
                new_expires_at TIMESTAMP WITH TIME ZONE,
                triggered_by VARCHAR(50),
                triggered_by_user_id INTEGER,
                payment_id INTEGER,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS subscription_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
             INSERT INTO subscription_config (key, value, description) VALUES
            ('grace_period_days', '3', 'Number of days of grace period after subscription expires'),
            ('status_check_interval_minutes', '60', 'How often to recompute subscription status'),
            ('default_trial_plan', 'FREE_TRIAL', 'Default plan for new shops'),
            ('allow_trial_after_paid', 'false', 'Whether shops can go back to trial after having a paid plan')
            ON CONFLICT (key) DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await closeDbClient(db);
        process.exit(0);
    }
}
migrate();
