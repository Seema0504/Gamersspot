
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL is missing in .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL
});

function hashPasswordLegacy(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function resetPassword() {
    const client = await pool.connect();
    try {
        console.log("🔐 Generating Legacy SHA256 hash for 'admin123'...");
        const hash = hashPasswordLegacy('admin123');
        console.log("Hash:", hash);

        console.log("🔄 Updating password for user 'admin'...");
        const res = await client.query(
            `UPDATE admin_users 
         SET password_hash = $1, is_active = true, role = 'SUPER_ADMIN' 
         WHERE username = 'admin'`,
            [hash]
        );

        if (res.rowCount === 0) {
            console.log("⚠️ User 'admin' not found. Creating it...");
            await client.query(
                `INSERT INTO admin_users (username, password_hash, role, shop_id, is_active)
             VALUES ('admin', $1, 'SUPER_ADMIN', 1, true)`,
                [hash]
            );
            console.log("✅ User 'admin' created.");
        } else {
            console.log("✅ User 'admin' password updated.");
        }

    } catch (err) {
        console.error('❌ Error resetting password:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

resetPassword();
