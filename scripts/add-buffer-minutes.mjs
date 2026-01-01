/**
 * Add Billing Buffer Minutes to Pricing Rules
 * 
 * This script adds the billing buffer time (in minutes) to the pricing_rules table.
 * This configures the grace period for PlayStation weekend billing.
 * 
 * Usage:
 *   node scripts/add-buffer-minutes.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

const addBufferMinutes = async () => {
    const client = await pool.connect()

    try {
        console.log('🚀 Adding billing buffer minutes to pricing_rules...')

        // Insert buffer minutes (default: 10 minutes)
        await client.query(`
      INSERT INTO pricing_rules (game_type, weekday_rate, weekend_rate)
      VALUES ('buffer_minutes', 10, 10)
      ON CONFLICT (game_type) DO NOTHING;
    `)

        console.log('✅ Billing buffer minutes added successfully')

        // Verify the entry
        const result = await client.query(`
      SELECT * FROM pricing_rules WHERE game_type = 'buffer_minutes'
    `)

        if (result.rows.length > 0) {
            console.log('\n✅ Billing buffer configured!')
            console.log(`   Buffer Time: ${result.rows[0].weekday_rate} minutes`)
            console.log('\n📝 What this means:')
            console.log('   - PlayStation weekend billing grace period')
            console.log('   - If time exceeds full hours by less than buffer, charge only for full hours')
            console.log('   - Example with 10 min buffer:')
            console.log('     • 1hr 8min → charge 1hr')
            console.log('     • 1hr 12min → charge 2hr')
        } else {
            console.log('⚠️  Warning: Buffer minutes not found after setup')
        }

    } catch (error) {
        console.error('❌ Error adding buffer minutes:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the migration
addBufferMinutes()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!')
        console.log('\nYou can now configure the buffer time in:')
        console.log('  Dashboard → Pricing → Billing Buffer Time')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Migration failed:', error)
        process.exit(1)
    })
