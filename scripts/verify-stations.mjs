/**
 * Verify Current Station States
 * Check the actual database values after reset
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

async function verifyStations() {
    const client = await pool.connect()

    try {
        console.log('📊 Current Station States:\n')

        const query = `
            SELECT 
                id, 
                name, 
                game_type,
                elapsed_time,
                is_running,
                is_done,
                is_paused,
                extra_controllers,
                customer_name,
                customer_phone
            FROM stations 
            ORDER BY id
        `

        const result = await client.query(query)

        result.rows.forEach(station => {
            console.log(`Station ${station.id}: ${station.name}`)
            console.log(`  Game Type: ${station.game_type}`)
            console.log(`  Elapsed Time: ${station.elapsed_time}s`)
            console.log(`  Is Running: ${station.is_running}`)
            console.log(`  Is Done: ${station.is_done}`)
            console.log(`  Is Paused: ${station.is_paused}`)
            console.log(`  Extra Controllers: ${station.extra_controllers}`)
            console.log(`  Customer: ${station.customer_name || 'None'}`)
            console.log(`  Phone: ${station.customer_phone || 'None'}`)
            console.log('')
        })

    } catch (error) {
        console.error('❌ Error:', error.message)
    } finally {
        client.release()
        await pool.end()
    }
}

verifyStations()
