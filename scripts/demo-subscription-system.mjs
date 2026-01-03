#!/usr/bin/env node

/**
 * ============================================================================
 * AUTONOMOUS SUBSCRIPTION SYSTEM - LIVE DEMO
 * ============================================================================
 * This demo shows:
 * 1. Current subscription status for all shops
 * 2. Available plans
 * 3. Lazy evaluation in action
 * 4. Subscription renewal
 * 5. Event audit trail
 * ============================================================================
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5434/gamersspot'
});

console.log('\n🎬 AUTONOMOUS SUBSCRIPTION SYSTEM - LIVE DEMO\n');
console.log('='.repeat(80));

async function demo() {
    try {
        // ====================================================================
        // DEMO 1: Show All Shops with Current Subscriptions
        // ====================================================================
        console.log('\n📊 DEMO 1: Current Subscription Status for All Shops\n');

        const shopsResult = await pool.query(`
            SELECT 
                s.id,
                s.name,
                ss.current_plan_code,
                sp.plan_name,
                sp.price_inr,
                ss.computed_status,
                ss.started_at,
                ss.expires_at,
                ss.grace_ends_at,
                ss.last_status_check_at,
                EXTRACT(DAY FROM (ss.expires_at - NOW())) as days_remaining
            FROM shops s
            JOIN shop_subscriptions ss ON s.id = ss.shop_id
            JOIN subscription_plans sp ON ss.current_plan_code = sp.plan_code
            ORDER BY s.id
        `);

        shopsResult.rows.forEach(shop => {
            const daysRemaining = Math.ceil(parseFloat(shop.days_remaining));
            const statusEmoji = {
                'trial': '🎯',
                'active': '✅',
                'grace': '⚠️',
                'expired': '❌'
            }[shop.computed_status] || '❓';

            console.log(`${statusEmoji} Shop #${shop.id}: ${shop.name}`);
            console.log(`   Plan: ${shop.plan_name} (${shop.current_plan_code})`);
            console.log(`   Price: ₹${shop.price_inr}`);
            console.log(`   Status: ${shop.computed_status.toUpperCase()}`);
            console.log(`   Started: ${new Date(shop.started_at).toLocaleDateString()}`);
            console.log(`   Expires: ${new Date(shop.expires_at).toLocaleDateString()}`);
            console.log(`   Days Remaining: ${daysRemaining > 0 ? daysRemaining : `Expired ${Math.abs(daysRemaining)} days ago`}`);
            console.log(`   Last Check: ${new Date(shop.last_status_check_at).toLocaleString()}`);
            console.log('');
        });

        // ====================================================================
        // DEMO 2: Available Plans
        // ====================================================================
        console.log('='.repeat(80));
        console.log('\n💳 DEMO 2: Available Subscription Plans\n');

        const plansResult = await pool.query(`
            SELECT 
                plan_code,
                plan_name,
                duration_days,
                price_inr,
                features
            FROM subscription_plans
            WHERE is_active = true
            ORDER BY display_order
        `);

        plansResult.rows.forEach(plan => {
            const features = plan.features || {};
            const discount = features.discount_percent ? ` (${features.discount_percent}% OFF!)` : '';

            console.log(`📦 ${plan.plan_name}${discount}`);
            console.log(`   Code: ${plan.plan_code}`);
            console.log(`   Duration: ${plan.duration_days} days`);
            console.log(`   Price: ₹${plan.price_inr}`);

            if (features.max_stations === -1) {
                console.log(`   ✓ Unlimited Stations`);
            } else if (features.max_stations > 0) {
                console.log(`   • Up to ${features.max_stations} Stations`);
            }

            if (features.max_invoices_per_month === -1) {
                console.log(`   ✓ Unlimited Invoices`);
            }
            console.log('');
        });

        // ====================================================================
        // DEMO 3: Lazy Evaluation Demo
        // ====================================================================
        console.log('='.repeat(80));
        console.log('\n⏱️  DEMO 3: Lazy Evaluation in Action\n');
        console.log('Simulating what happens when an API request is made...\n');

        const shopId = 1;
        console.log(`1️⃣ API Request received for Shop #${shopId}`);
        console.log(`2️⃣ Middleware calls getShopSubscription(${shopId})`);

        // Get current subscription
        const subBefore = await pool.query(`
            SELECT 
                computed_status,
                last_status_check_at,
                expires_at,
                grace_ends_at
            FROM shop_subscriptions
            WHERE shop_id = $1
        `, [shopId]);

        const lastCheck = new Date(subBefore.rows[0].last_status_check_at);
        const now = new Date();
        const minutesSinceLastCheck = Math.floor((now - lastCheck) / (1000 * 60));

        console.log(`3️⃣ Last status check: ${lastCheck.toLocaleString()}`);
        console.log(`   (${minutesSinceLastCheck} minutes ago)`);

        // Check if recomputation needed
        const checkInterval = 60; // from config
        if (minutesSinceLastCheck >= checkInterval) {
            console.log(`4️⃣ ⚡ Status is STALE (>${checkInterval} min) - RECOMPUTING...`);
        } else {
            console.log(`4️⃣ ✓ Status is FRESH (<${checkInterval} min) - Using cached value`);
        }

        // Compute status
        const expiresAt = new Date(subBefore.rows[0].expires_at);
        const isExpired = expiresAt < now;

        console.log(`5️⃣ Computing status from dates:`);
        console.log(`   Expires At: ${expiresAt.toLocaleString()}`);
        console.log(`   Current Time: ${now.toLocaleString()}`);
        console.log(`   Is Expired: ${isExpired}`);

        if (!isExpired) {
            console.log(`6️⃣ ✅ Status: VALID (trial/active)`);
            console.log(`7️⃣ Request ALLOWED - Proceeding to handler`);
        } else {
            const graceEndsAt = subBefore.rows[0].grace_ends_at ? new Date(subBefore.rows[0].grace_ends_at) : null;
            if (graceEndsAt && now < graceEndsAt) {
                console.log(`6️⃣ ⚠️  Status: GRACE PERIOD`);
                console.log(`   Grace ends: ${graceEndsAt.toLocaleString()}`);
                console.log(`7️⃣ Request ALLOWED - But showing warning`);
            } else {
                console.log(`6️⃣ ❌ Status: EXPIRED`);
                console.log(`7️⃣ Request BLOCKED - HTTP 402 Payment Required`);
            }
        }

        // ====================================================================
        // DEMO 4: Simulate Subscription Renewal
        // ====================================================================
        console.log('\n' + '='.repeat(80));
        console.log('\n💰 DEMO 4: Subscription Renewal Simulation\n');

        console.log(`Scenario: Shop #${shopId} wants to upgrade to MONTHLY plan\n`);

        const currentSub = shopsResult.rows.find(s => s.id === shopId);
        console.log(`Current Plan: ${currentSub.plan_name}`);
        console.log(`Current Expires: ${new Date(currentSub.expires_at).toLocaleDateString()}`);
        console.log(`Current Status: ${currentSub.computed_status}`);

        // Calculate what would happen
        const newPlan = plansResult.rows.find(p => p.plan_code === 'MONTHLY');
        const currentExpiry = new Date(currentSub.expires_at);
        const startFrom = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(startFrom.getTime() + newPlan.duration_days * 24 * 60 * 60 * 1000);

        console.log(`\n📝 Renewal Details:`);
        console.log(`   New Plan: ${newPlan.plan_name}`);
        console.log(`   Price: ₹${newPlan.price_inr}`);
        console.log(`   Duration: ${newPlan.duration_days} days`);
        console.log(`   Start From: ${startFrom.toLocaleDateString()}`);
        console.log(`   New Expiry: ${newExpiry.toLocaleDateString()}`);
        console.log(`   New Status: ACTIVE`);

        console.log(`\n⚙️  What would happen:`);
        console.log(`   1. Update shop_subscriptions:`);
        console.log(`      - current_plan_code = 'MONTHLY'`);
        console.log(`      - expires_at = '${newExpiry.toISOString()}'`);
        console.log(`      - computed_status = 'active'`);
        console.log(`      - grace_ends_at = NULL`);
        console.log(`   2. Create payment record:`);
        console.log(`      - amount = ₹${newPlan.price_inr}`);
        console.log(`      - status = 'COMPLETED'`);
        console.log(`   3. Log event:`);
        console.log(`      - event_type = 'upgraded'`);
        console.log(`      - old_plan = '${currentSub.current_plan_code}'`);
        console.log(`      - new_plan = 'MONTHLY'`);

        console.log(`\n💡 Note: Actual renewal skipped to preserve demo data`);

        // ====================================================================
        // DEMO 5: Event Audit Trail
        // ====================================================================
        console.log('\n' + '='.repeat(80));
        console.log('\n📜 DEMO 5: Subscription Event Audit Trail\n');

        const eventsResult = await pool.query(`
            SELECT 
                id,
                shop_id,
                event_type,
                old_plan_code,
                new_plan_code,
                old_status,
                new_status,
                triggered_by,
                created_at,
                metadata
            FROM subscription_events
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log(`Recent Events (Last ${eventsResult.rows.length}):\n`);

        eventsResult.rows.forEach((event, index) => {
            const eventEmoji = {
                'created': '🆕',
                'migrated': '📦',
                'renewed': '🔄',
                'upgraded': '⬆️',
                'downgraded': '⬇️',
                'status_changed': '🔄',
                'expired': '⏰',
                'grace_started': '⚠️'
            }[event.event_type] || '📝';

            console.log(`${eventEmoji} Event #${event.id} - ${event.event_type.toUpperCase()}`);
            console.log(`   Shop: #${event.shop_id}`);
            console.log(`   Date: ${new Date(event.created_at).toLocaleString()}`);
            console.log(`   Triggered By: ${event.triggered_by}`);

            if (event.old_plan_code || event.new_plan_code) {
                console.log(`   Plan Change: ${event.old_plan_code || 'N/A'} → ${event.new_plan_code || 'N/A'}`);
            }

            if (event.old_status || event.new_status) {
                console.log(`   Status Change: ${event.old_status || 'N/A'} → ${event.new_status || 'N/A'}`);
            }

            if (event.metadata) {
                const meta = event.metadata;
                if (meta.source) console.log(`   Source: ${meta.source}`);
                if (meta.reason) console.log(`   Reason: ${meta.reason}`);
            }

            console.log('');
        });

        // ====================================================================
        // DEMO 6: System Configuration
        // ====================================================================
        console.log('='.repeat(80));
        console.log('\n⚙️  DEMO 6: System Configuration\n');

        const configResult = await pool.query(`
            SELECT key, value, description
            FROM subscription_config
            ORDER BY key
        `);

        configResult.rows.forEach(config => {
            console.log(`🔧 ${config.key}`);
            console.log(`   Value: ${config.value}`);
            console.log(`   Description: ${config.description}`);
            console.log('');
        });

        // ====================================================================
        // Summary
        // ====================================================================
        console.log('='.repeat(80));
        console.log('\n✅ DEMO COMPLETE!\n');
        console.log('Key Takeaways:');
        console.log('  • System is fully autonomous - no cron jobs needed');
        console.log('  • Status updates happen lazily on API requests');
        console.log('  • Complete audit trail of all changes');
        console.log('  • Grace period prevents immediate lockout');
        console.log('  • Multi-tier pricing with discounts');
        console.log('  • Production-ready and scalable');
        console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
        console.error('\n❌ Demo Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

demo();
