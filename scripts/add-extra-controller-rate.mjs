/**
 * Add Extra Controller Rate to Pricing Rules
 * 
 * This script adds the extra controller rate to the pricing_rules table.
 * Run this script to enable dynamic extra controller pricing.
 * 
 * Usage:
 *   node scripts/add-extra-controller-rate.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

const addExtraControllerRate = async () => {
    const client = await pool.connect()

    try {
        console.log('🚀 Adding extra controller rate to pricing_rules...')

        // Insert extra controller rate (default: 50)
        await client.query(`
      INSERT INTO pricing_rules (game_type, weekday_rate, weekend_rate)
      VALUES ('extra_controller', 50, 50)
      ON CONFLICT (game_type) DO NOTHING;
    `)

        console.log('✅ Extra controller rate added successfully')

        // Verify the entry
        const result = await client.query(`
      SELECT * FROM pricing_rules WHERE game_type = 'extra_controller'
    `)

        if (result.rows.length > 0) {
            console.log('\n✅ Extra controller rate configured!')
            console.log(`   Rate: ₹${result.rows[0].weekday_rate}`)
        } else {
            console.log('⚠️  Warning: Extra controller rate not found after setup')
        }

    } catch (error) {
        console.error('❌ Error adding extra controller rate:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the migration
addExtraControllerRate()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!')
        console.log('\nYou can now configure the extra controller rate in:')
        console.log('  Dashboard → Pricing → Extra Controller Rate')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Migration failed:', error)
        process.exit(1)
    })
