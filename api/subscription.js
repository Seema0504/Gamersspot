import { getDbClient, closeDbClient } from './db.js';
import { authenticateToken } from './middleware/authMiddleware.js';

async function handler(req, res) {
    // CORS
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Authenticate Token (User must be logged in, even if expired)
    // We explicitly DO NOT use requireActiveSubscription here because... they are expired!
    await new Promise((resolve) => authenticateToken(req, res, resolve));

    // If authenticateToken sent an error response, req.user will be missing or we shouldn't proceed?
    // authenticateToken calls next() if success. If fail, it sends res.
    // In this wrapperless context, we need to be careful. 
    // Actually authenticateToken middleware signature is (req, res, next).
    // If it calls next(), we proceed. If it returns res..., we stop.
    // The Promise wrapper above might hang if next() is called? 
    // No, resolve is passed as next. So if next() is called, promise resolves.

    if (!req.user) {
        // Response likely already accepted/sent by middleware if auth failed?
        // But strictly checking:
        if (!res.headersSent) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return;
    }

    const { action } = req.query;

    let db = null;
    try {
        db = await getDbClient();

        // GET /api/subscription?action=status
        if (req.method === 'GET' && action === 'status') {
            const shopId = req.user.shopId;
            if (!shopId) return res.status(400).json({ error: 'No shop associated with user' });

            const result = await db.client.query(
                `SELECT status, end_date, plan_name 
                 FROM subscriptions 
                 WHERE shop_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [shopId]
            );

            if (result.rows.length === 0) {
                return res.status(200).json({ subscription: null });
            }

            return res.status(200).json({ subscription: result.rows[0] });
        }

        // GET /api/subscription?action=info
        if (req.method === 'GET' && action === 'info') {
            // Allow Super Admin to query any shop's subscription via shopId query param
            let shopId = req.user.shopId;

            // If user is Super Admin and shopId is provided in query, use that
            if (req.user.role === 'SUPER_ADMIN' && req.query.shopId) {
                shopId = parseInt(req.query.shopId);
            }

            if (!shopId) return res.status(400).json({ error: 'No shop associated with user' });

            const result = await db.client.query(
                `SELECT status, end_date, plan_name 
                 FROM subscriptions 
                 WHERE shop_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [shopId]
            );

            if (result.rows.length === 0) {
                return res.status(200).json(null);
            }

            const subscription = result.rows[0];
            const endDate = new Date(subscription.end_date);
            const now = new Date();
            const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            return res.status(200).json({
                plan_name: subscription.plan_name,
                status: subscription.status,
                end_date: subscription.end_date,
                daysRemaining: daysRemaining
            });
        }

        // POST /api/subscription?action=renew
        if (req.method === 'POST' && action === 'renew') {
            const { planId = 'MONTHLY', paymentDetails } = req.body; // Mock payment details

            // In a real app, verify paymentDetails with Gateway here.
            // For now, we assume payment was successful on client or this IS the mock charge.

            const shopId = req.user.shopId;
            if (!shopId) return res.status(400).json({ error: 'No shop associated with user' });

            await db.client.query('BEGIN');

            // 1. Expire/Cancel old active subscriptions (safety)
            await db.client.query(
                `UPDATE subscriptions 
                 SET status = 'CANCELLED' 
                 WHERE shop_id = $1 AND status = 'ACTIVE'`,
                [shopId]
            );

            // 2. Create NEW Active Subscription
            // extend for 30 days
            const result = await db.client.query(
                `INSERT INTO subscriptions (shop_id, plan_name, monthly_amount, status, start_date, end_date)
                 VALUES ($1, $2, 999, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days')
                 RETURNING *`,
                [shopId, planId]
            );

            // 3. Log Payment (Optional: Insert into a payments table)
            // await db.client.query('INSERT INTO payments ...');

            await db.client.query('COMMIT');

            return res.status(200).json({
                success: true,
                message: 'Subscription renewed successfully',
                subscription: result.rows[0]
            });
        }

        return res.status(400).json({ error: 'Invalid Action' });

    } catch (error) {
        if (db) await db.client.query('ROLLBACK');
        console.error('Subscription API Error:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        if (db) await closeDbClient(db);
    }
}

export default handler;
