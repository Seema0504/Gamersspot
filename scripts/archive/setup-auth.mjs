/**
 * Create Admin Users Table and Default Admin
 * 
 * This script creates the admin_users table for authentication
 * and adds a default admin user.
 * 
 * Default Credentials:
 *   Username: admin
 *   Password: admin123
 * 
 * IMPORTANT: Change the password immediately after first login!
 * 
 * Usage:
 *   node scripts/setup-auth.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

// Hash password with SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex')
}

const setupAuth = async () => {
    const client = await pool.connect()

    try {
        console.log('🚀 Setting up authentication system...\n')

        // Create admin_users table
        console.log('📋 Creating admin_users table...')
        await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        last_login TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true
      );
    `)
        console.log('✅ Table created successfully\n')

        // Create default admin user
        const defaultUsername = 'admin'
        const defaultPassword = 'admin2026'
        const passwordHash = hashPassword(defaultPassword)

        console.log('👤 Creating default admin user...')
        await client.query(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING;
    `, [defaultUsername, passwordHash])

        // Check if user was created
        const result = await client.query(
            'SELECT username, created_at, is_active FROM admin_users WHERE username = $1',
            [defaultUsername]
        )

        if (result.rows.length > 0) {
            console.log('✅ Default admin user created!\n')
            console.log('═══════════════════════════════════════')
            console.log('🔐 DEFAULT LOGIN CREDENTIALS')
            console.log('═══════════════════════════════════════')
            console.log(`   Username: ${defaultUsername}`)
            console.log(`   Password: ${defaultPassword}`)
            console.log('═══════════════════════════════════════\n')
            console.log('⚠️  SECURITY WARNING:')
            console.log('   Please change this password immediately!')
            console.log('   This is a default password and should NOT be used in production.\n')
        }

        // Create index for faster lookups
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_username 
      ON admin_users(username);
    `)

        console.log('✅ Authentication system setup complete!\n')

    } catch (error) {
        console.error('❌ Error setting up authentication:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the setup
setupAuth()
    .then(() => {
        console.log('🎉 Setup completed successfully!')
        console.log('\n📝 Next Steps:')
        console.log('   1. Restart your application')
        console.log('   2. You will see a login screen')
        console.log('   3. Login with the default credentials above')
        console.log('   4. Change the password immediately!\n')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Setup failed:', error)
        process.exit(1)
    })
