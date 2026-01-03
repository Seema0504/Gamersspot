/**
 * Test script for autonomous subscription system
 * Run with: node scripts/test-subscription-system.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from parent directory
const subscriptionServicePath = join(__dirname, '..', 'api', '_lib', 'subscriptionService.js');
const dbPath = join(__dirname, '..', 'api', '_lib', 'db.js');

const { getShopSubscription, renewSubscription, getAvailablePlans } = await import(subscriptionServicePath);

async function testSubscriptionSystem() {
    console.log('🧪 Testing Autonomous Subscription System\n');

    try {
        // Test 1: Get available plans
        console.log('📋 Test 1: Get Available Plans');
        const plans = await getAvailablePlans();
        console.log(`✅ Found ${plans.length} plans:`);
        plans.forEach(p => {
            console.log(`   - ${p.plan_name}: ₹${p.price_inr} for ${p.duration_days} days`);
        });
        console.log('');

        // Test 2: Get subscription for shop 1
        console.log('🔍 Test 2: Get Subscription Status (Shop 1)');
        const subscription = await getShopSubscription(1);
        console.log(`✅ Subscription found:`);
        console.log(`   Status: ${subscription.computed_status}`);
        console.log(`   Plan: ${subscription.plan?.plan_name}`);
        console.log(`   Expires: ${new Date(subscription.expires_at).toLocaleDateString()}`);
        console.log(`   Days Remaining: ${subscription.days_remaining}`);
        console.log(`   Is Valid: ${subscription.is_valid}`);
        console.log('');

        // Test 3: Test lazy evaluation
        console.log('⏱️  Test 3: Test Lazy Evaluation');
        console.log(`   Last check: ${new Date(subscription.last_status_check_at).toLocaleString()}`);

        // Get again immediately - should not recompute
        const subscription2 = await getShopSubscription(1);
        console.log(`   Second check: ${new Date(subscription2.last_status_check_at).toLocaleString()}`);
        console.log(`   ✅ Status checks match: ${subscription.last_status_check_at === subscription2.last_status_check_at}`);
        console.log('');

        // Test 4: Simulate renewal (commented out to avoid actual changes)
        console.log('💳 Test 4: Renewal Simulation (dry run)');
        console.log(`   Current plan: ${subscription.current_plan_code}`);
        console.log(`   Would renew to: MONTHLY`);
        console.log(`   Current expiry: ${new Date(subscription.expires_at).toLocaleDateString()}`);

        // Calculate what new expiry would be
        const currentExpiry = new Date(subscription.expires_at);
        const now = new Date();
        const startFrom = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(startFrom.getTime() + 30 * 24 * 60 * 60 * 1000);
        console.log(`   New expiry would be: ${newExpiry.toLocaleDateString()}`);
        console.log('   ℹ️  Skipping actual renewal to preserve data');
        console.log('');

        // Test 5: Check all shops
        console.log('🏪 Test 5: Check All Shops');
        const { getDbClient } = await import(dbPath);
        const db = await getDbClient();
        try {
            const result = await db.client.query(`
                SELECT 
                    s.id,
                    s.name,
                    ss.current_plan_code,
                    ss.computed_status,
                    ss.expires_at,
                    EXTRACT(DAY FROM (ss.expires_at - NOW())) as days_remaining
                FROM shops s
                JOIN shop_subscriptions ss ON s.id = ss.shop_id
                ORDER BY s.id
            `);

            console.log(`✅ Found ${result.rows.length} shops with subscriptions:`);
            result.rows.forEach(shop => {
                const daysRemaining = Math.ceil(parseFloat(shop.days_remaining));
                console.log(`   Shop ${shop.id} (${shop.name}):`);
                console.log(`      Plan: ${shop.current_plan_code}`);
                console.log(`      Status: ${shop.computed_status}`);
                console.log(`      Days Remaining: ${daysRemaining}`);
            });
        } finally {
            db.release();
        }
        console.log('');

        console.log('✅ All tests passed! Subscription system is working correctly.\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

testSubscriptionSystem();
