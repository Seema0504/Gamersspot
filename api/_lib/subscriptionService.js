/**
 * ============================================================================
 * GAMERS SPOT - SUBSCRIPTION SERVICE
 * ============================================================================
 * Purpose: Core business logic for autonomous subscription management
 * Features:
 *  - Lazy evaluation (status computed on-demand)
 *  - Idempotent operations
 *  - Race-safe with database transactions
 *  - No cron jobs required
 *  - Audit trail for all changes
 * ============================================================================
 */

import { getDbClient } from './db.js';

/**
 * Get system configuration value
 */
async function getConfig(client, key, defaultValue) {
    const result = await client.query(
        'SELECT value FROM subscription_config WHERE key = $1',
        [key]
    );
    return result.rows.length > 0 ? result.rows[0].value : defaultValue;
}

/**
 * Compute subscription status based on dates (pure function)
 * This is the SINGLE SOURCE OF TRUTH for status calculation
 * 
 * @param {Object} subscription - Subscription record with dates
 * @param {number} gracePeriodDays - Grace period in days
 * @returns {string} - One of: 'trial', 'active', 'grace', 'expired'
 */
function computeSubscriptionStatus(subscription, gracePeriodDays = 3) {
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    const planCode = subscription.current_plan_code;

    // Not yet expired
    if (expiresAt > now) {
        return planCode === 'FREE_TRIAL' ? 'trial' : 'active';
    }

    // Expired - check grace period
    if (planCode === 'FREE_TRIAL') {
        return 'expired';
    }
    const graceEndsAt = subscription.grace_ends_at
        ? new Date(subscription.grace_ends_at)
        : new Date(expiresAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    if (now < graceEndsAt) {
        return 'grace';
    }

    return 'expired';
}

/**
 * Get subscription for a shop with lazy status update
 * This is called on every authenticated API request
 * 
 * @param {number} shopId - Shop ID
 * @returns {Object} - Subscription object with current status
 */
export async function getShopSubscription(shopId) {
    const db = await getDbClient();

    try {
        await db.client.query('BEGIN');

        // Lock row for update to prevent race conditions
        const result = await db.client.query(
            `SELECT * FROM subscriptions WHERE shop_id = $1 FOR UPDATE`,
            [shopId]
        );

        if (result.rows.length === 0) {
            await db.client.query('ROLLBACK');
            throw new Error(`No subscription found for shop ${shopId}`);
        }

        const subscription = result.rows[0];

        // Get configuration
        const gracePeriodDays = parseInt(await getConfig(db.client, 'grace_period_days', '3'));
        const checkIntervalMinutes = parseInt(await getConfig(db.client, 'status_check_interval_minutes', '60'));

        // Check if status needs recomputation (lazy evaluation)
        const lastCheck = new Date(subscription.last_status_check_at);
        const now = new Date();
        const minutesSinceLastCheck = (now - lastCheck) / (1000 * 60);

        let needsUpdate = minutesSinceLastCheck >= checkIntervalMinutes;

        // Compute fresh status
        const computedStatus = computeSubscriptionStatus(subscription, gracePeriodDays);

        // If status changed, always update
        if (computedStatus !== subscription.computed_status) {
            needsUpdate = true;
        }

        if (needsUpdate) {
            const oldStatus = subscription.computed_status;

            // Update grace_ends_at if entering grace period
            let graceEndsAt = subscription.grace_ends_at;
            if (computedStatus === 'grace' && !graceEndsAt) {
                graceEndsAt = new Date(new Date(subscription.expires_at).getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
            }

            // Update subscription status
            await db.client.query(
                `UPDATE subscriptions 
                 SET computed_status = $1, 
                     last_status_check_at = NOW(),
                     grace_ends_at = $2
                 WHERE shop_id = $3`,
                [computedStatus, graceEndsAt, shopId]
            );

            // Log status change event
            if (oldStatus !== computedStatus) {
                await db.client.query(
                    `INSERT INTO subscription_events (
                        shop_id, event_type, old_status, new_status, 
                        old_expires_at, new_expires_at, triggered_by, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        shopId,
                        'status_changed',
                        oldStatus,
                        computedStatus,
                        subscription.expires_at,
                        subscription.expires_at,
                        'system',
                        JSON.stringify({ reason: 'lazy_evaluation', minutes_since_last_check: minutesSinceLastCheck })
                    ]
                );
            }

            subscription.computed_status = computedStatus;
            subscription.grace_ends_at = graceEndsAt;
        }

        await db.client.query('COMMIT');

        // Enrich with plan details
        const planResult = await db.client.query(
            'SELECT * FROM subscription_plans WHERE plan_code = $1',
            [subscription.current_plan_code]
        );

        return {
            ...subscription,
            plan: planResult.rows[0] || null,
            days_remaining: Math.ceil((new Date(subscription.expires_at) - now) / (1000 * 60 * 60 * 24)),
            is_valid: ['trial', 'active', 'grace'].includes(subscription.computed_status)
        };

    } catch (error) {
        await db.client.query('ROLLBACK');
        throw error;
    } finally {
        db.release();
    }
}

/**
 * Renew or upgrade subscription
 * 
 * @param {number} shopId - Shop ID
 * @param {string} newPlanCode - New plan code
 * @param {Object} paymentDetails - Payment information (optional)
 * @param {number} triggeredByUserId - User who triggered this (optional)
 * @returns {Object} - Updated subscription
 */
export async function renewSubscription(shopId, newPlanCode, paymentDetails = null, triggeredByUserId = null) {
    const db = await getDbClient();

    try {
        await db.client.query('BEGIN');

        // Get current subscription
        const currentResult = await db.client.query(
            'SELECT * FROM subscriptions WHERE shop_id = $1 FOR UPDATE',
            [shopId]
        );

        if (currentResult.rows.length === 0) {
            throw new Error(`No subscription found for shop ${shopId}`);
        }

        const current = currentResult.rows[0];

        // Get new plan details
        const planResult = await db.client.query(
            'SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true',
            [newPlanCode]
        );

        if (planResult.rows.length === 0) {
            throw new Error(`Plan ${newPlanCode} not found or inactive`);
        }

        const newPlan = planResult.rows[0];

        // Calculate new expiry date
        // If current subscription is still valid, extend from current expiry
        // Otherwise, start from now
        const now = new Date();
        const currentExpiry = new Date(current.expires_at);
        const startFrom = currentExpiry > now ? currentExpiry : now;
        const newExpiresAt = new Date(startFrom.getTime() + newPlan.duration_days * 24 * 60 * 60 * 1000);

        // Determine event type
        let eventType = 'renewed';
        if (current.current_plan_code !== newPlanCode) {
            const currentPlan = await db.client.query(
                'SELECT price_inr FROM subscription_plans WHERE plan_code = $1',
                [current.current_plan_code]
            );
            if (currentPlan.rows.length > 0) {
                eventType = newPlan.price_inr > currentPlan.rows[0].price_inr ? 'upgraded' : 'downgraded';
            }
        }

        // Update subscription
        await db.client.query(
            `UPDATE subscriptions 
             SET current_plan_code = $1,
                 started_at = CASE WHEN $2 != current_plan_code THEN NOW() ELSE started_at END,
                 expires_at = $3,
                 grace_ends_at = NULL,
                 computed_status = $4,
                 last_status_check_at = NOW(),
                 next_billing_date = $5
             WHERE shop_id = $6`,
            [
                newPlanCode,
                newPlanCode,
                newExpiresAt,
                newPlanCode === 'FREE_TRIAL' ? 'trial' : 'active',
                newExpiresAt,
                shopId
            ]
        );

        // Create payment record if payment details provided
        let paymentId = null;
        if (paymentDetails && newPlan.price_inr > 0) {
            if (!current || !current.id) {
                throw new Error('Critical: Cannot link payment to subscription (Missing ID)');
            }
            try {
                const paymentResult = await db.client.query(
                    `INSERT INTO payments (
                        shop_id, subscription_id, amount, payment_method, transaction_id, status, notes
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [
                        shopId,
                        current.id,
                        newPlan.price_inr,
                        paymentDetails.method || 'MANUAL',
                        paymentDetails.transactionId || `TXN_${Date.now()}`,
                        'COMPLETED',
                        paymentDetails.notes || `Subscription ${eventType}: ${newPlan.plan_name}`
                    ]
                );
                paymentId = paymentResult.rows[0].id;
            } catch (payErr) {
                console.error('❌ Payment Insertion Error:', payErr);
                throw new Error(`Payment failed: ${payErr.message}`);
            }
        }

        // Log event
        await db.client.query(
            `INSERT INTO subscription_events (
                shop_id, event_type, old_plan_code, new_plan_code,
                old_status, new_status, old_expires_at, new_expires_at,
                triggered_by, triggered_by_user_id, payment_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                shopId,
                eventType,
                current.current_plan_code,
                newPlanCode,
                current.computed_status,
                newPlanCode === 'FREE_TRIAL' ? 'trial' : 'active',
                current.expires_at,
                newExpiresAt,
                triggeredByUserId ? 'user' : 'admin',
                triggeredByUserId,
                paymentId,
                JSON.stringify({
                    payment_amount: newPlan.price_inr,
                    duration_days: newPlan.duration_days
                })
            ]
        );

        await db.client.query('COMMIT');

        // Return updated subscription
        return await getShopSubscription(shopId);

    } catch (error) {
        await db.client.query('ROLLBACK');
        throw error;
    } finally {
        db.release();
    }
}

/**
 * Get all available plans
 */
export async function getAvailablePlans() {
    const db = await getDbClient();

    try {
        const result = await db.client.query(
            'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY display_order'
        );
        return result.rows;
    } finally {
        db.release();
    }
}

/**
 * Get subscription events (audit log) for a shop
 */
export async function getSubscriptionEvents(shopId, limit = 50) {
    const db = await getDbClient();

    try {
        const result = await db.client.query(
            `SELECT * FROM subscription_events 
             WHERE shop_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [shopId, limit]
        );
        return result.rows;
    } finally {
        db.release();
    }
}

/**
 * Check if shop can perform an action based on subscription
 * 
 * @param {number} shopId - Shop ID
 * @param {string} action - Action to check ('write', 'read', 'create_station', etc.)
 * @returns {Object} - { allowed: boolean, reason: string }
 */
export async function checkSubscriptionAccess(shopId, action = 'write') {
    try {
        const subscription = await getShopSubscription(shopId);

        // Read-only actions always allowed
        if (action === 'read') {
            return { allowed: true, subscription };
        }

        // Write actions require valid subscription
        if (!subscription.is_valid) {
            return {
                allowed: false,
                reason: `Subscription ${subscription.computed_status}. Please renew to continue.`,
                subscription
            };
        }

        // Check feature limits (if applicable)
        if (subscription.plan && subscription.plan.features) {
            const features = subscription.plan.features;

            // Example: Check station limit
            if (action === 'create_station' && features.max_stations > 0) {
                const db = await getDbClient();
                try {
                    const countResult = await db.client.query(
                        'SELECT COUNT(*) as count FROM stations WHERE shop_id = $1',
                        [shopId]
                    );
                    const currentCount = parseInt(countResult.rows[0].count);

                    if (currentCount >= features.max_stations) {
                        return {
                            allowed: false,
                            reason: `Station limit reached (${features.max_stations}). Upgrade to add more.`,
                            subscription
                        };
                    }
                } finally {
                    db.release();
                }
            }
        }

        return { allowed: true, subscription };

    } catch (error) {
        console.error('Subscription access check error:', error);
        return {
            allowed: false,
            reason: 'Unable to verify subscription status',
            error: error.message
        };
    }
}
