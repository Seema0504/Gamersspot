// Script to set up test scenarios for bonus calculation testing
// This simulates hours of gameplay without waiting

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

async function setupTestScenario() {
    const client = await pool.connect()

    try {
        console.log('=== Setting Up Test Scenario ===\n')

        // Get current IST time
        const now = new Date()
        const istOffset = 5.5 * 60 * 60 * 1000
        const istTime = new Date(now.getTime() + istOffset)

        // Format start time (5 hours ago)
        const startTime = new Date(istTime.getTime() - (5 * 60 * 60 * 1000) - (8 * 60 * 1000) - (53 * 1000))
        const startTimeStr = startTime.toISOString().slice(0, 19).replace('T', ' ')

        // Test Scenario: Seat 2 - Playstation
        // Simulates: 5 hours 8 minutes 53 seconds of gameplay
        const elapsedSeconds = (5 * 3600) + (8 * 60) + 53 // 18,533 seconds

        console.log('Test Scenario: Seat 2 - Playstation')
        console.log(`  Simulated play time: 5h 8m 53s (${elapsedSeconds} seconds)`)
        console.log(`  Start time: ${startTimeStr}`)
        console.log(`  Extra controllers: 1`)
        console.log(`  Snacks purchased: YES`)
        console.log('')

        // Update Seat 2 with test data
        const updateQuery = `
      UPDATE stations 
      SET 
        elapsed_time = $1,
        is_running = true,
        is_done = false,
        start_time = $2,
        end_time = NULL,
        extra_controllers = 1,
        snacks_enabled = true,
        customer_name = 'Test Customer',
        customer_phone = '9876543210',
        updated_at = NOW()
      WHERE id = 2
      RETURNING *
    `

        const result = await client.query(updateQuery, [elapsedSeconds, startTimeStr])

        if (result.rows.length > 0) {
            console.log('✅ Test scenario created successfully!')
            console.log('')
            console.log('Updated Seat 2:')
            console.log(`  ID: ${result.rows[0].id}`)
            console.log(`  Name: ${result.rows[0].name}`)
            console.log(`  Elapsed time: ${result.rows[0].elapsed_time}s`)
            console.log(`  Is running: ${result.rows[0].is_running}`)
            console.log(`  Start time: ${result.rows[0].start_time}`)
            console.log(`  Extra controllers: ${result.rows[0].extra_controllers}`)
            console.log(`  Snacks enabled: ${result.rows[0].snacks_enabled}`)
            console.log('')
            console.log('Expected Results in Browser:')
            console.log('  Timer display: 05:08:53')
            console.log('  Bonus: +01:00:00 (1 hour)')
            console.log('  Paid hours: 5 hours')
            console.log('  Cost: 5 × ₹200 + ₹50 = ₹1050')
            console.log('')
            console.log('🌐 Refresh your browser to see the updated data!')
            console.log('   URL: http://localhost:5173')
        } else {
            console.log('❌ Failed to update station')
        }

    } catch (error) {
        console.error('Error setting up test scenario:', error)
    } finally {
        client.release()
        await pool.end()
    }
}

setupTestScenario()
