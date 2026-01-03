import { getDbClient } from './_lib/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireActiveSubscription } from './_lib/middleware/authMiddleware.js';

const ENV_SECRET = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !ENV_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined. Application cannot start securely.');
}

if (!ENV_SECRET) {
    console.warn('WARNING: Using insecure default JWT secret. Please set JWT_SECRET in your environment variables.');
}

const JWT_SECRET = ENV_SECRET || 'your-secret-key-change-this-in-prod';
const JWT_EXPIRES_IN = '24h';

// Helper: Legacy Hash Check (SHA256)
function hashPasswordLegacy(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query; // ?action=login or ?action=logout or ?action=check
    if (!action) {
        return res.status(400).json({ error: 'Action parameter is required' });
    }

    // --------------------------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------------------------
    if (action === 'login' && req.method === 'POST') {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        let db = null;
        try {
            db = await getDbClient();

            // Fetch user with role and shop_id, ensuring user and linked shop are valid
            const result = await db.client.query(
                `SELECT u.id, u.username, u.password_hash, u.role, u.shop_id 
                 FROM admin_users u
                 LEFT JOIN shops s ON u.shop_id = s.id
                 WHERE u.username = $1 
                 AND u.is_active = true
                 AND u.deleted_at IS NULL
                 AND (u.shop_id IS NULL OR (s.deleted_at IS NULL AND s.is_active = true))`,
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = result.rows[0];
            let isValid = false;

            // 1. Try bcrypt compare (New standard)
            if (user.password_hash.startsWith('$2')) {
                isValid = await bcrypt.compare(password, user.password_hash);
            }
            // 2. Try legacy SHA256 (Migration support)
            else {
                const legacyHash = hashPasswordLegacy(password);
                if (legacyHash === user.password_hash) {
                    isValid = true;
                    // TODO: Upgrade hash to bcrypt automatically here if desired behavior
                }
            }

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate JWT
            const payload = {
                userId: user.id,
                username: user.username,
                role: user.role || 'STAFF', // Default fallback
                shopId: user.shop_id
            };

            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

            await db.client.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [user.id]);

            return res.status(200).json({
                success: true,
                token,
                user: {
                    username: user.username,
                    role: user.role,
                    shopId: user.shop_id
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        } finally {
            if (db) db.release();
        }
    }



    // --------------------------------------------------------------------------
    // CHECK AUTH (Verify Token)
    // --------------------------------------------------------------------------
    if (action === 'check') {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.status(401).json({ authenticated: false });

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            // Validate Subscription before confirming auth
            req.user = decoded; // Attach user to req for middleware

            // We use a flag because the middleware uses next() or sends response
            let subscriptionValid = false;
            await requireActiveSubscription(req, res, () => {
                subscriptionValid = true;
            });

            // If subscription check failed, response is already sent (402/403/500)
            if (!subscriptionValid) {
                return;
            }

            return res.status(200).json({
                authenticated: true,
                user: decoded
            });
        } catch (e) {
            return res.status(401).json({ authenticated: false, error: e.message });
        }
    }

    // --------------------------------------------------------------------------
    // LOGOUT (Stateless JWT, client handles removal)
    // --------------------------------------------------------------------------
    if (action === 'logout' && req.method === 'POST') {
        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    }

    return res.status(404).json({ error: 'Unknown action' });
}
