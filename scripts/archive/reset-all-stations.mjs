/**
 * Reset All Stations to Default Values
 * This script resets all stations to their initial state:
 * - Stops all timers
 * - Clears all customer data
 * - Resets elapsed time to 0
 * - Removes extra controllers
 * - Disables snacks
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

async function resetAllStations() {
    const client = await pool.connect()

    try {
        console.log('🔄 Resetting all stations to default values...\n')

        // Reset all stations to default state
        const resetQuery = `
            UPDATE stations 
            SET 
                elapsed_time = 0,
                is_running = false,
                is_done = false,
                start_time = NULL,
                end_time = NULL,
                extra_controllers = 0,
                snacks = '{"cokeBottle":0,"cokeCan":0,"laysChips":0,"kurkure":0}'::jsonb,
                is_paused = false,
                paused_time = 0,
                pause_start_time = NULL,
                customer_name = '',
                customer_phone = '',
                updated_at = NOW()
            RETURNING id, name, game_type
        `

        const result = await client.query(resetQuery)

        if (result.rows.length > 0) {
            console.log(`✅ Successfully reset ${result.rows.length} station(s)!\n`)
            console.log('Reset stations:')
            result.rows.forEach(station => {
                console.log(`  • ${station.name} (${station.game_type}) - ID: ${station.id}`)
            })
            console.log('\nAll stations are now:')
            console.log('  ✓ Stopped (is_running = false)')
            console.log('  ✓ Elapsed time = 0')
            console.log('  ✓ No customer data')
            console.log('  ✓ No extra controllers')
            console.log('  ✓ Snacks reset to 0')
            console.log('  ✓ Not paused')
            console.log('\n🌐 Refresh your browser to see the changes!')
            console.log('   URL: http://localhost:5173')
        } else {
            console.log('⚠️  No stations found to reset')
        }

    } catch (error) {
        console.error('❌ Error resetting stations:', error.message)
        if (error.code) {
            console.error(`   Error code: ${error.code}`)
        }
        if (error.detail) {
            console.error(`   Detail: ${error.detail}`)
        }
    } finally {
        client.release()
        await pool.end()
    }
}

resetAllStations()
