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
 * Middleware: Ensure Active Subscription
 * Checks cache or DB for updated status
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

    // TODO: Implement Caching (Redis/Memory) to avoid DB hit every request
    // For now, we query. 
    const db = await getDbClient();
    try {
        const result = await db.client.query(
            `SELECT status, end_date FROM subscriptions WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [shopId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'No subscription found for this shop' });
        }

        const sub = result.rows[0];

        // Strict Status Check
        if (sub.status !== 'ACTIVE' && sub.status !== 'GRACE_PERIOD') {
            return res.status(402).json({
                error: 'Subscription Expired',
                code: 'SUBSCRIPTION_EXPIRED',
                message: 'Your subscription is ' + sub.status.toLowerCase() + '. Please make a payment to continue the service.'
            });
        }

        // Date Expiry Check (for ACTIVE subscriptions that passed their date)
        if (sub.end_date && new Date(sub.end_date) < new Date()) {
            return res.status(402).json({
                error: 'Subscription Expired',
                code: 'SUBSCRIPTION_EXPIRED',
                message: 'Your subsciption plan has expired. Please renew to continue.'
            });
        }

        next();
    } catch (err) {
        console.error('Subscription Check Error:', err);
        res.status(500).json({ error: 'Failed to verify subscription' });
    } finally {
        db.release();
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

