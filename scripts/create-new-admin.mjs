import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL or DATABASE_URL not found in environment variables.');
    process.exit(1);
}

async function createAdmin() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const username = 'admin';
        const password = 'admin2026';

        console.log(`Creating/Updating admin user: ${username}`);

        const hashedPassword = await bcrypt.hash(password, 10);

        // Upsert user
        await client.query(
            `INSERT INTO admin_users (username, password_hash, role, shop_id, is_active)
             VALUES ($1, $2, 'SUPER_ADMIN', NULL, true)
             ON CONFLICT (username) 
             DO UPDATE SET password_hash = $2, role = 'SUPER_ADMIN', is_active = true`,
            [username, hashedPassword]
        );

        console.log('✅ Admin user created/updated successfully.');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await client.end();
    }
}

createAdmin();
