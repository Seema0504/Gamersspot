import jwt from 'jsonwebtoken';
import { getDbClient } from '../db.js';

const ENV_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !ENV_SECRET) {
    throw new Error('FATAL: JWT_SECRET missing in production.');
}
const JWT_SECRET = ENV_SECRET || 'your-secret-key-change-this-in-prod';

/**
 * Middleware: Verify Token & Attach User
 * 1. Checks Authorization header (Bearer token)
 * 2. Verifies JWT signature
 * 3. Decodes payload to req.user
 */
export const authenticateToken = (req, res, next) => {
    // Exempt routes (like login)
    if (req.path === '/api/auth' && req.query.action === 'login') {
        return next();
    }
    if (req.path === '/health') {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

/**
 * Middleware: Enforce Role Access
 * Usage: authorizeRoles('SUPER_ADMIN', 'SHOP_OWNER')
 */
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ error: 'Role information missing' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }
        next();
    };
};

/**
 * Middleware: Ensure Active Subscription (NEW AUTONOMOUS SYSTEM)
 * Uses lazy evaluation - status is computed and updated on-demand
 * No cron jobs required - fully autonomous
 */
export const requireActiveSubscription = async (req, res, next) => {
    // Super Admins bypass subscription checks entirely
    if (req.user.role === 'SUPER_ADMIN') {
        // If Super Admin is viewing a specific shop's dashboard, set shopId from query
        if (req.query.shopId) {
            req.user.viewingShopId = parseInt(req.query.shopId);
        }
        return next();
    }

    const shopId = req.user.shopId;
    if (!shopId) {
        return res.status(400).json({ error: 'Shop Context Missing' });
    }

    try {
        // Import subscription service dynamically to avoid circular dependencies
        const { getShopSubscription } = await import('../subscriptionService.js');

        // Get subscription with automatic status update (lazy evaluation)
        const subscription = await getShopSubscription(shopId);

        // Attach subscription to request for use in handlers
        req.subscription = subscription;

        // Check if subscription is valid
        // Valid statuses: 'trial', 'active', 'grace'
        // Invalid status: 'expired'
        if (!subscription.is_valid) {
            const daysExpired = Math.abs(subscription.days_remaining);

            return res.status(402).json({
                error: 'Subscription Expired',
                code: 'SUBSCRIPTION_EXPIRED',
                status: subscription.computed_status,
                message: subscription.computed_status === 'grace'
                    ? `Your subscription is in grace period. Please renew within ${Math.ceil((new Date(subscription.grace_ends_at) - new Date()) / (1000 * 60 * 60 * 24))} days.`
                    : `Your subscription expired ${daysExpired} days ago. Please renew to continue using the service.`,
                plan: subscription.plan?.plan_name,
                expires_at: subscription.expires_at,
                grace_ends_at: subscription.grace_ends_at
            });
        }

        // Subscription is valid - proceed
        next();

    } catch (err) {
        console.error('Subscription Check Error:', err);
        res.status(500).json({
            error: 'Failed to verify subscription',
            details: err.message
        });
    }
};

/**
 * High-Order Function wrapper for Serverless Functions
 * Ensures Auth logic runs before main handler
 */
export const withAuth = (handler) => async (req, res) => {
    return new Promise((resolve, reject) => {
        // Run auth logic typically found in middleware
        authenticateToken(req, res, async () => {
            // Check subscription if validated
            if (req.user) {
                // We can run subscription check here too if needed globally, 
                // but let's keep it simple or allow handler to call it.
                // Actually, requirements say "subscription enforcement mandatory".
                // Best to do it here.
                await requireActiveSubscription(req, res, async () => {
                    try {
                        await handler(req, res);
                        resolve();
                    } catch (e) {
                        console.error(e);
                        if (!res.headersSent) res.status(500).json({ error: e.message });
                        resolve();
                    }
                });
            } else {
                // Should have been handled by authenticateToken error path, 
                // but if next() called without user (exempt route?), allows pass
                await handler(req, res);
                resolve();
            }
        });
    });
};

