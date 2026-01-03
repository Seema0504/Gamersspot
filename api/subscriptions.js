/**
 * ============================================================================
 * SUBSCRIPTION API - Autonomous Subscription Management
 * ============================================================================
 * Endpoints:
 *  GET  /api/subscriptions?action=status - Get current subscription status
 *  GET  /api/subscriptions?action=plans - Get available plans
 *  POST /api/subscriptions?action=renew - Renew/upgrade subscription
 *  GET  /api/subscriptions?action=events - Get subscription history
 * ============================================================================
 */

import { getDbClient } from './_lib/db.js';
import { authenticateToken } from './_lib/middleware/authMiddleware.js';
import {
    getShopSubscription,
    renewSubscription,
    getAvailablePlans,
    getSubscriptionEvents
} from './_lib/subscriptionService.js';

async function handler(req, res) {
    // CORS
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Authenticate (but don't require active subscription for this endpoint)
    await new Promise((resolve) => authenticateToken(req, res, resolve));

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action } = req.query;

    try {
        // ====================================================================
        // GET SUBSCRIPTION STATUS
        // ====================================================================
        if (req.method === 'GET' && action === 'status') {
            const shopId = req.user.role === 'SUPER_ADMIN' && req.query.shopId
                ? parseInt(req.query.shopId)
                : req.user.shopId;

            if (!shopId) {
                return res.status(400).json({ error: 'Shop ID required' });
            }

            const subscription = await getShopSubscription(shopId);

            return res.status(200).json({
                success: true,
                subscription: {
                    status: subscription.computed_status,
                    plan_code: subscription.current_plan_code,
                    plan_name: subscription.plan?.plan_name,
                    price: subscription.plan?.price_inr,
                    started_at: subscription.started_at,
                    expires_at: subscription.expires_at,
                    grace_ends_at: subscription.grace_ends_at,
                    days_remaining: subscription.days_remaining,
                    is_valid: subscription.is_valid,
                    features: subscription.plan?.features || {}
                }
            });
        }

        // ====================================================================
        // GET AVAILABLE PLANS
        // ====================================================================
        if (req.method === 'GET' && action === 'plans') {
            const plans = await getAvailablePlans();

            return res.status(200).json({
                success: true,
                plans: plans.map(p => ({
                    code: p.plan_code,
                    name: p.plan_name,
                    duration_days: p.duration_days,
                    price: p.price_inr,
                    features: p.features,
                    display_order: p.display_order
                }))
            });
        }

        // ====================================================================
        // RENEW/UPGRADE SUBSCRIPTION
        // ====================================================================
        if (req.method === 'POST' && action === 'renew') {
            const shopId = req.user.shopId;
            if (!shopId) {
                return res.status(400).json({ error: 'Shop ID required' });
            }

            const { plan_code, payment_method, transaction_id, notes } = req.body;

            if (!plan_code) {
                return res.status(400).json({ error: 'Plan code required' });
            }

            // Validate plan exists
            const db = await getDbClient();
            try {
                const planCheck = await db.client.query(
                    'SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true',
                    [plan_code]
                );

                if (planCheck.rows.length === 0) {
                    return res.status(404).json({ error: 'Plan not found or inactive' });
                }

                const plan = planCheck.rows[0];

                // Prepare payment details
                const paymentDetails = plan.price_inr > 0 ? {
                    method: payment_method || 'MANUAL',
                    transactionId: transaction_id || `TXN_${Date.now()}`,
                    notes: notes || `Subscription renewal: ${plan.plan_name}`
                } : null;

                // Renew subscription
                const updatedSubscription = await renewSubscription(
                    shopId,
                    plan_code,
                    paymentDetails,
                    req.user.userId
                );

                return res.status(200).json({
                    success: true,
                    message: 'Subscription renewed successfully',
                    subscription: {
                        status: updatedSubscription.computed_status,
                        plan_code: updatedSubscription.current_plan_code,
                        plan_name: updatedSubscription.plan?.plan_name,
                        expires_at: updatedSubscription.expires_at,
                        days_remaining: updatedSubscription.days_remaining
                    }
                });

            } finally {
                db.release();
            }
        }

        // ====================================================================
        // GET SUBSCRIPTION EVENTS (AUDIT LOG)
        // ====================================================================
        if (req.method === 'GET' && action === 'events') {
            const shopId = req.user.role === 'SUPER_ADMIN' && req.query.shopId
                ? parseInt(req.query.shopId)
                : req.user.shopId;

            if (!shopId) {
                return res.status(400).json({ error: 'Shop ID required' });
            }

            const limit = parseInt(req.query.limit) || 50;
            const events = await getSubscriptionEvents(shopId, limit);

            return res.status(200).json({
                success: true,
                events: events.map(e => ({
                    id: e.id,
                    event_type: e.event_type,
                    old_plan: e.old_plan_code,
                    new_plan: e.new_plan_code,
                    old_status: e.old_status,
                    new_status: e.new_status,
                    old_expires_at: e.old_expires_at,
                    new_expires_at: e.new_expires_at,
                    triggered_by: e.triggered_by,
                    created_at: e.created_at,
                    metadata: e.metadata
                }))
            });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Subscription API Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

export default handler;
