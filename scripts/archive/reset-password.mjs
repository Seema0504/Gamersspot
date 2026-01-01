/**
 * Reset Admin Password
 * 
 * This script allows you to reset the admin password if you forgot it.
 * It will prompt you to enter a new password and update it in the database.
 * 
 * Usage:
 *   node scripts/reset-password.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'
import readline from 'readline'

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

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Promisify question
function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve)
    })
}

const resetPassword = async () => {
    console.log('╔════════════════════════════════════════╗')
    console.log('║   ADMIN PASSWORD RESET UTILITY         ║')
    console.log('╚════════════════════════════════════════╝\n')

    try {
        // Ask for new password
        console.log('⚠️  This will reset the admin password.\n')
        const newPassword = await question('Enter new password (min 6 characters): ')

        if (!newPassword || newPassword.length < 6) {
            console.log('\n❌ Error: Password must be at least 6 characters long.')
            rl.close()
            process.exit(1)
        }

        const confirmPassword = await question('Confirm new password: ')

        if (newPassword !== confirmPassword) {
            console.log('\n❌ Error: Passwords do not match.')
            rl.close()
            process.exit(1)
        }

        // Confirm action
        const confirm = await question('\n⚠️  Are you sure you want to reset the password? (yes/no): ')

        if (confirm.toLowerCase() !== 'yes') {
            console.log('\n❌ Password reset cancelled.')
            rl.close()
            process.exit(0)
        }

        console.log('\n🔄 Resetting password...')

        const client = await pool.connect()

        try {
            // Hash the new password
            const passwordHash = hashPassword(newPassword)

            // Update the password
            const result = await client.query(
                'UPDATE admin_users SET password_hash = $1 WHERE username = $2',
                [passwordHash, 'admin']
            )

            if (result.rowCount === 0) {
                console.log('\n❌ Error: Admin user not found in database.')
                console.log('   Run: node scripts/setup-auth.mjs to create the admin user.')
                rl.close()
                process.exit(1)
            }

            console.log('\n✅ Password reset successfully!\n')
            console.log('═══════════════════════════════════════')
            console.log('🔐 NEW LOGIN CREDENTIALS')
            console.log('═══════════════════════════════════════')
            console.log('   Username: admin')
            console.log('   Password: [your new password]')
            console.log('═══════════════════════════════════════\n')
            console.log('✨ You can now login with your new password!')

        } catch (error) {
            console.error('\n❌ Database error:', error.message)
            throw error
        } finally {
            client.release()
            await pool.end()
            rl.close()
        }

    } catch (error) {
        console.error('\n💥 Error:', error.message)
        rl.close()
        process.exit(1)
    }
}

// Run the reset
resetPassword()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Reset failed:', error)
        process.exit(1)
    })
