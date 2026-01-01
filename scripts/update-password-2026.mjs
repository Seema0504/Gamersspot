/**
 * Quick Password Update to admin2026
 * 
 * This script updates the admin password to admin2026
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

const updatePassword = async () => {
    const client = await pool.connect()

    try {
        console.log('🔄 Updating admin password to admin2026...')

        const newPassword = 'admin2026'
        const passwordHash = hashPassword(newPassword)

        // Update the password
        const result = await client.query(
            'UPDATE admin_users SET password_hash = $1 WHERE username = $2',
            [passwordHash, 'admin']
        )

        if (result.rowCount === 0) {
            console.log('❌ Error: Admin user not found')
            process.exit(1)
        }

        console.log('✅ Password updated successfully!\n')
        console.log('═══════════════════════════════════════')
        console.log('🔐 LOGIN CREDENTIALS')
        console.log('═══════════════════════════════════════')
        console.log('   Username: admin')
        console.log('   Password: admin2026')
        console.log('═══════════════════════════════════════\n')

    } catch (error) {
        console.error('❌ Error:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

updatePassword()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
