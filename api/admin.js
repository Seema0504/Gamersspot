import { getDbClient, closeDbClient } from './_lib/db.js';
import { withAuth, authorizeRoles } from './_lib/middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const ENV_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !ENV_SECRET) {
    throw new Error('FATAL: JWT_SECRET missing in production.');
}
const JWT_SECRET = ENV_SECRET || 'your-secret-key-change-this-in-prod';

async function handler(req, res) {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Allow getShop action for all authenticated users (to fetch their own shop)
    // All other actions require SUPER_ADMIN
    const { action } = req.query;

    if (action !== 'getShop' && action !== 'get-shop-token' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Admin Access Required' });
    }

    let db = null;

    try {
        db = await getDbClient();
        const client = db.client;

        // POST /api/admin?action=get-shop-token
        // Generate a temporary token for Super Admin to view a specific shop
        if (req.method === 'POST' && action === 'get-shop-token') {
            if (req.user.role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only Super Admin can request shop tokens' });
            }

            const { shopId } = req.body;
            if (!shopId) {
                return res.status(400).json({ error: 'shopId is required' });
            }

            // Generate a new token with the shopId
            const token = jwt.sign(
                {
                    userId: req.user.userId,
                    username: req.user.username,
                    role: 'SUPER_ADMIN',
                    shopId: parseInt(shopId),
                    isTempToken: true
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(200).json({ token });
        }

        // GET /api/admin?action=shops&includeDeleted=true
        if (req.method === 'GET' && action === 'shops') {
            const includeDeleted = req.query.includeDeleted === 'true';

            // Check if deleted_at column exists (backward compatibility)
            const columnCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'shops' AND column_name = 'deleted_at'
                )
            `);
            const hasDeletedAtColumn = columnCheck.rows[0].exists;

            // Only filter by deleted_at if column exists
            const deletedFilter = hasDeletedAtColumn && !includeDeleted ? 'WHERE s.deleted_at IS NULL' : '';
            const deletedAtCheck = hasDeletedAtColumn ? 'AND u.deleted_at IS NULL' : '';
            const orderBy = hasDeletedAtColumn ? 'ORDER BY s.deleted_at NULLS FIRST, s.created_at DESC' : 'ORDER BY s.created_at DESC';

            const result = await client.query(`
                SELECT s.*, 
                       sub.computed_status as plan_status,
                       p.plan_name as plan_name,
                       sub.expires_at as plan_end_date,
                       (SELECT username FROM admin_users u WHERE u.shop_id = s.id AND u.role = 'SHOP_OWNER' ${deletedAtCheck} LIMIT 1) as owner_username,
                       (SELECT id FROM admin_users u WHERE u.shop_id = s.id AND u.role = 'SHOP_OWNER' ${deletedAtCheck} LIMIT 1) as owner_id
                FROM shops s 
                LEFT JOIN subscriptions sub ON s.id = sub.shop_id
                LEFT JOIN subscription_plans p ON sub.current_plan_code = p.plan_code
                ${deletedFilter}
                ${orderBy}
            `);
            return res.status(200).json(result.rows);
        }

        // POST /api/admin?action=create-shop
        if (req.method === 'POST' && action === 'create-shop') {
            const { name, phone, email, address, upiId, ownerUsername, ownerPassword, planCode } = req.body;

            // Validate required fields
            if (!name || !phone || !email || !address) {
                return res.status(400).json({ error: 'Shop name, phone, email, and address are required' });
            }

            // Validate phone number format (Indian mobile: 10 digits starting with 6-9)
            const phoneRegex = /^[6-9]\d{9}$/;
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({ error: 'Invalid phone number. Must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9' });
            }

            // 0. Check for duplicate username
            const userCheck = await client.query(
                `SELECT id FROM admin_users WHERE username = $1`,
                [ownerUsername]
            );

            if (userCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Username already exists. Please choose another.' });
            }

            await client.query('BEGIN');

            // 1. Create Shop (Trigger creates default subscription)
            const shopRes = await client.query(
                `INSERT INTO shops (name, phone, email, address, upi_id, is_active) 
                 VALUES ($1, $2, $3, $4, $5, true) 
                 RETURNING id`,
                [name, phone, email, address, upiId || null]
            );
            const shopId = shopRes.rows[0].id; // Serial ID

            // 2. Update Subscription based on selected plan
            const selectedPlanCode = planCode || 'FREE_TRIAL';

            // Fetch plan details
            const planRes = await client.query('SELECT * FROM subscription_plans WHERE plan_code = $1', [selectedPlanCode]);

            if (planRes.rows.length > 0) {
                const plan = planRes.rows[0];
                const duration = plan.duration_days;
                const status = selectedPlanCode === 'FREE_TRIAL' ? 'trial' : 'active';

                await client.query(
                    `UPDATE subscriptions 
                     SET current_plan_code = $1, 
                         computed_status = $2, 
                         started_at = NOW(),
                         expires_at = NOW() + ($3 || ' days')::INTERVAL,
                         updated_at = NOW()
                     WHERE shop_id = $4`,
                    [selectedPlanCode, status, duration, shopId]
                );

                // Audit Log
                await client.query(
                    `INSERT INTO subscription_events (shop_id, event_type, new_plan_code, new_status, triggered_by, metadata)
                     VALUES ($1, 'plan_change_on_create', $2, $3, 'super_admin', $4)`,
                    [shopId, selectedPlanCode, status, JSON.stringify({ reason: 'Initial selection' })]
                );
            }

            // 3. Create Admin User
            const hash = await bcrypt.hash(ownerPassword, 10);
            await client.query(
                `INSERT INTO admin_users (username, password_hash, role, shop_id, is_active)
                 VALUES ($1, $2, 'SHOP_OWNER', $3, true)`,
                [ownerUsername, hash, shopId]
            );

            // 4. Create Default Configs (Optional)
            // e.g. default pricing...

            await client.query('COMMIT');

            return res.status(201).json({ success: true, shopId, message: 'Shop and Owner Created' });
        }

        // GET /api/admin?action=getShop&shopId=X
        // Allow any authenticated user to get their own shop info
        if (req.method === 'GET' && action === 'getShop') {
            const { shopId } = req.query;

            // Users can only fetch their own shop (except SUPER_ADMIN)
            if (req.user.role !== 'SUPER_ADMIN' && req.user.shopId !== parseInt(shopId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await client.query(
                `SELECT id, name as shop_name, address, phone, email, upi_id, is_active, created_at 
                 FROM shops 
                 WHERE id = $1`,
                [shopId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Shop not found' });
            }

            return res.status(200).json({ shop: result.rows[0] });
        }

        // PUT /api/admin?action=update-shop
        // Update shop details (name, address, phone, email, upi_id)
        if (req.method === 'PUT' && action === 'update-shop') {
            const { id, name, address, phone, email, upi_id } = req.body;

            const result = await client.query(
                `UPDATE shops 
                 SET name = $1, address = $2, phone = $3, email = $4, upi_id = $5, updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [name, address, phone, email, upi_id, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Shop not found' });
            }

            return res.status(200).json({ success: true, shop: result.rows[0] });
        }

        // POST /api/admin?action=update-subscription
        // Create or update subscription for a shop AND log payment
        if (req.method === 'POST' && action === 'update-subscription') {
            const { shop_id, plan_name, monthly_amount, end_date, status, payment_method, transaction_id, notes } = req.body;

            await client.query('BEGIN');

            try {
                // Determine Plan Code
                let planCode = 'MONTHLY'; // Default
                if (plan_name) {
                    const pRes = await client.query('SELECT plan_code FROM subscription_plans WHERE plan_name = $1 OR plan_code = $1', [plan_name]);
                    if (pRes.rows.length > 0) planCode = pRes.rows[0].plan_code;
                    else if (['FREE_TRIAL', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY'].includes(plan_name.toUpperCase())) planCode = plan_name.toUpperCase();
                }

                const newStatus = (status && status.toLowerCase() === 'active') ? 'active' : 'trial';
                const validEndDate = (end_date && end_date !== '') ? new Date(end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                // Update existing subscription
                const subResult = await client.query(
                    `UPDATE subscriptions 
                     SET current_plan_code = $1, 
                         computed_status = $2, 
                         expires_at = $3,
                         updated_at = NOW()
                     WHERE shop_id = $4
                     RETURNING *`,
                    [planCode, newStatus, validEndDate, shop_id]
                );

                const newSub = subResult.rows[0];

                if (monthly_amount > 0) {
                    await client.query(
                        `INSERT INTO payments (shop_id, subscription_id, amount, payment_method, transaction_id, notes, status)
                         VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED')`,
                        [shop_id, newSub ? newSub.id : null, monthly_amount, payment_method || 'CASH', transaction_id || null, notes]
                    );
                }

                // Audit Log
                await client.query(
                    `INSERT INTO subscription_events (shop_id, event_type, new_plan_code, new_status, triggered_by, metadata)
                     VALUES ($1, 'manual_update', $2, $3, 'super_admin', $4)`,
                    [shop_id, planCode, newStatus, JSON.stringify({ amount: monthly_amount, notes })]
                );

                await client.query('COMMIT');

                return res.status(200).json({ success: true, subscription: newSub });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Update subscription error:', err);
                return res.status(500).json({ error: err.message });
            }
        }

        // GET /api/admin?action=get-subscription&shopId=X
        // Get current subscription for a shop
        if (req.method === 'GET' && action === 'get-subscription') {
            const { shopId } = req.query;

            const result = await client.query(
                `SELECT * FROM subscriptions 
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

        // GET /api/admin?action=subscription-history&shopId=X
        if (req.method === 'GET' && action === 'subscription-history') {
            const { shopId } = req.query;
            const result = await client.query(
                `SELECT 
                    e.id,
                    UPPER(e.new_status) as status,
                    p.plan_name,
                    p.price_inr as monthly_amount,
                    e.created_at as start_date,
                    e.new_expires_at as end_date
                 FROM subscription_events e
                 LEFT JOIN subscription_plans p ON e.new_plan_code = p.plan_code
                 WHERE e.shop_id = $1 
                 ORDER BY e.created_at DESC`,
                [shopId]
            );
            return res.status(200).json(result.rows);
        }

        // GET /api/admin?action=payment-history&shopId=X
        if (req.method === 'GET' && action === 'payment-history') {
            const { shopId } = req.query;
            const result = await client.query(
                `SELECT * FROM payments WHERE shop_id = $1 ORDER BY payment_date DESC`,
                [shopId]
            );
            return res.status(200).json(result.rows);
        }

        // GET /api/admin?action=get-shop-credentials&shopId=X
        if (req.method === 'GET' && action === 'get-shop-credentials') {
            const { shopId } = req.query;

            const result = await client.query(
                `SELECT id, username FROM admin_users 
                 WHERE shop_id = $1 AND role = 'SHOP_OWNER'
                 LIMIT 1`,
                [shopId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Shop owner not found' });
            }

            return res.status(200).json({ credentials: result.rows[0] });
        }

        // PUT /api/admin?action=update-shop-credentials
        if (req.method === 'PUT' && action === 'update-shop-credentials') {
            const { shopId, username, password } = req.body;

            // Update Username
            if (username) {
                await client.query(
                    `UPDATE admin_users SET username = $1 WHERE shop_id = $2 AND role = 'SHOP_OWNER'`,
                    [username, shopId]
                );
            }

            // Update Password (if provided)
            if (password) {
                const hash = await bcrypt.hash(password, 10);
                await client.query(
                    `UPDATE admin_users SET password_hash = $1 WHERE shop_id = $2 AND role = 'SHOP_OWNER'`,
                    [hash, shopId]
                );
            }
            return res.status(200).json({ success: true, message: 'Credentials updated' });
        }

        // DELETE /api/admin?action=delete-shop
        // Soft delete shop (only if subscription is EXPIRED or CANCELLED)
        if (req.method === 'DELETE' && action === 'delete-shop') {
            const { shopId } = req.body;

            if (!shopId) {
                return res.status(400).json({ error: 'Shop ID is required' });
            }

            await client.query('BEGIN');

            try {
                // Check subscription status
                const subCheck = await client.query(
                    `SELECT status FROM subscriptions 
                     WHERE shop_id = $1 
                     ORDER BY created_at DESC 
                     LIMIT 1`,
                    [shopId]
                );

                if (subCheck.rows.length > 0) {
                    const status = subCheck.rows[0].status;
                    if (status === 'ACTIVE') {
                        await client.query('ROLLBACK');
                        return res.status(403).json({
                            error: 'Cannot delete shop with active subscription. Please cancel or expire the subscription first.'
                        });
                    }
                }

                // Get shop name before soft deletion
                const shopResult = await client.query(
                    `SELECT name, deleted_at FROM shops WHERE id = $1`,
                    [shopId]
                );

                if (shopResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Shop not found' });
                }

                if (shopResult.rows[0].deleted_at) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Shop is already deleted' });
                }

                const shopName = shopResult.rows[0].name;

                // SOFT DELETE: Set deleted_at timestamp instead of removing records
                // 1. Soft delete the shop
                await client.query(
                    `UPDATE shops SET deleted_at = NOW() WHERE id = $1`,
                    [shopId]
                );

                // 2. Soft delete associated admin users
                await client.query(
                    `UPDATE admin_users SET deleted_at = NOW() WHERE shop_id = $1 AND deleted_at IS NULL`,
                    [shopId]
                );

                await client.query('COMMIT');

                return res.status(200).json({
                    success: true,
                    message: `Shop "${shopName}" has been archived (soft deleted)`,
                    deletedShopId: shopId,
                    note: 'Data preserved for audit trail. Contact support to restore.'
                });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        // POST /api/admin?action=restore-shop
        // Restore a soft-deleted shop
        if (req.method === 'POST' && action === 'restore-shop') {
            const { shopId } = req.body;

            if (!shopId) {
                return res.status(400).json({ error: 'Shop ID is required' });
            }

            await client.query('BEGIN');

            try {
                // Check if shop exists and is deleted
                const shopResult = await client.query(
                    `SELECT name, deleted_at FROM shops WHERE id = $1`,
                    [shopId]
                );

                if (shopResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Shop not found' });
                }

                if (!shopResult.rows[0].deleted_at) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Shop is not deleted' });
                }

                const shopName = shopResult.rows[0].name;

                // Restore the shop
                await client.query(
                    `UPDATE shops SET deleted_at = NULL WHERE id = $1`,
                    [shopId]
                );

                // Restore associated admin users
                await client.query(
                    `UPDATE admin_users SET deleted_at = NULL WHERE shop_id = $1`,
                    [shopId]
                );

                await client.query('COMMIT');

                return res.status(200).json({
                    success: true,
                    message: `Shop "${shopName}" has been restored successfully`,
                    restoredShopId: shopId
                });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        // GET /api/admin?action=get-plans
        // Get all subscription plans (including inactive)
        if (req.method === 'GET' && action === 'get-plans') {
            const result = await client.query('SELECT * FROM subscription_plans ORDER BY display_order');
            return res.status(200).json({ plans: result.rows });
        }

        // POST /api/admin?action=update-plan
        // Update subscription plan configuration
        if (req.method === 'POST' && action === 'update-plan') {
            const { plan_code, plan_name, duration_days, price_inr, features, is_active } = req.body;

            if (!plan_code) {
                return res.status(400).json({ error: 'plan_code is required' });
            }

            // Validate plan exists
            const planCheck = await client.query(
                'SELECT * FROM subscription_plans WHERE plan_code = $1',
                [plan_code]
            );

            if (planCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Plan not found' });
            }

            // Build update query dynamically
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (plan_name !== undefined) {
                updates.push(`plan_name = $${paramCount++}`);
                values.push(plan_name);
            }

            if (duration_days !== undefined) {
                // Allow changing duration for all plans
                updates.push(`duration_days = $${paramCount++}`);
                values.push(duration_days);
            }

            if (price_inr !== undefined) {
                // Don't allow changing FREE_TRIAL price
                if (plan_code !== 'FREE_TRIAL') {
                    updates.push(`price_inr = $${paramCount++}`);
                    values.push(price_inr);
                }
            }

            if (features !== undefined) {
                updates.push(`features = $${paramCount++}`);
                values.push(JSON.stringify(features));
            }

            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(is_active);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No updates provided' });
            }

            // Add plan_code to values for WHERE clause
            values.push(plan_code);

            const updateQuery = `
                UPDATE subscription_plans 
                SET ${updates.join(', ')}, updated_at = NOW()
                WHERE plan_code = $${paramCount}
                RETURNING *
            `;

            const result = await client.query(updateQuery, values);

            return res.status(200).json({
                success: true,
                message: 'Plan updated successfully',
                plan: result.rows[0]
            });
        }

        return res.status(404).json({ error: 'Unknown Action' });

    } catch (error) {
        if (db) await db.client.query('ROLLBACK');
        console.error('Admin API Error:', error);
        return res.status(500).json({ error: error.message });
    } finally {
        if (db) await closeDbClient(db);
    }
}

export default withAuth(handler);
