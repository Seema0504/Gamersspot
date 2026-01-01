// Script to create a Super Admin user
import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.LOCAL_POSTGRES_URL || process.env.POSTGRES_URL;

async function createSuperAdmin() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Hash the password
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if super admin already exists
        const checkResult = await client.query(
            "SELECT id FROM admin_users WHERE username = 'superadmin'"
        );

        if (checkResult.rows.length > 0) {
            console.log('⚠️  Super Admin user already exists');

            // Update password
            await client.query(
                "UPDATE admin_users SET password_hash = $1, role = 'SUPER_ADMIN' WHERE username = 'superadmin'",
                [hashedPassword]
            );
            console.log('✅ Updated Super Admin password');
        } else {
            // Create super admin user (no shop_id for super admin)
            await client.query(
                `INSERT INTO admin_users (username, password_hash, role, shop_id, is_active)
         VALUES ($1, $2, 'SUPER_ADMIN', NULL, true)`,
                ['superadmin', hashedPassword]
            );
            console.log('✅ Created Super Admin user');
        }

        console.log('\n📋 Super Admin Credentials:');
        console.log('   Username: superadmin');
        console.log('   Password: admin123');
        console.log('   Role: SUPER_ADMIN');
        console.log('\n✅ Super Admin setup complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

createSuperAdmin().catch(console.error);
