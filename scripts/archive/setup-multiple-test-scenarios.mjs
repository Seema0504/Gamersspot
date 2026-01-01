// Script to set up multiple test scenarios for comprehensive bonus calculation testing
// You can easily modify the test scenarios below and run this script

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'] })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

// ============================================================================
// TEST SCENARIOS - MODIFY THESE AS NEEDED
// ============================================================================

const testScenarios = [
    {
        seatId: 1,
        seatName: 'Seat 1 - Playstation',
        description: 'Exactly 1 hour (should get 15min bonus)',
        playedHours: 1,
        playedMinutes: 19,
        playedSeconds: 50,
        extraControllers: 0,
        snacksEnabled: false,
        customerName: 'Test Customer 1',
        customerPhone: '9876543210',
        expectedBonus: '15 minutes',
        expectedPaidHours: 1,
        expectedCost: 200 // 1h × ₹200
    }
    // ,
    // {
    //     seatId: 2,
    //     seatName: 'Seat 2 - Playstation',
    //     description: 'Exactly 2 hours (should get 30min bonus)',
    //     playedHours: 2,
    //     playedMinutes: 0,
    //     playedSeconds: 0,
    //     extraControllers: 1,
    //     snacksEnabled: false,
    //     customerName: 'Test Customer 2',
    //     customerPhone: '9876543211',
    //     expectedBonus: '30 minutes',
    //     expectedPaidHours: 2,
    //     expectedCost: 450 // 2h × ₹200 + ₹50
    // },
    // {
    //     seatId: 3,
    //     seatName: 'Seat 3 - Playstation',
    //     description: 'Exactly 4 hours (3h paid + 1h bonus)',
    //     playedHours: 3,
    //     playedMinutes: 58,
    //     playedSeconds: 0,
    //     extraControllers: 0,
    //     snacksEnabled: true,
    //     customerName: 'Test Customer 3',
    //     customerPhone: '9876543212',
    //     expectedBonus: '1 hour',
    //     expectedPaidHours: 3,
    //     expectedCost: 600 // 3h × ₹200
    // },
    // {
    //     seatId: 4,
    //     seatName: 'Seat 4 - Playstation',
    //     description: 'Original bug scenario: 5h 8m 53s',
    //     playedHours: 5,
    //     playedMinutes: 8,
    //     playedSeconds: 53,
    //     extraControllers: 1,
    //     snacksEnabled: true,
    //     customerName: 'Test Customer 4',
    //     customerPhone: '9876543213',
    //     expectedBonus: '1 hour',
    //     expectedPaidHours: 5,
    //     expectedCost: 1050 // 5h × ₹200 + ₹50
    // },
    // {
    //     seatId: 5,
    //     seatName: 'Seat 5 - Playstation',
    //     description: '6 hours played (should pay for 5h)',
    //     playedHours: 6,
    //     playedMinutes: 0,
    //     playedSeconds: 0,
    //     extraControllers: 2,
    //     snacksEnabled: false,
    //     customerName: 'Test Customer 5',
    //     customerPhone: '9876543214',
    //     expectedBonus: '1 hour',
    //     expectedPaidHours: 5,
    //     expectedCost: 1100 // 5h × ₹200 + 2×₹50
    // },
    // {
    //     seatId: 6,
    //     seatName: 'Seat 6 - Steering Wheel',
    //     description: 'Steering Wheel: 3h 30m',
    //     playedHours: 3,
    //     playedMinutes: 30,
    //     playedSeconds: 0,
    //     extraControllers: 0,
    //     snacksEnabled: false,
    //     customerName: 'Test Customer 6',
    //     customerPhone: '9876543215',
    //     expectedBonus: '1 hour',
    //     expectedPaidHours: 3,
    //     expectedCost: 450 // 3h × ₹150
    // },
    // {
    //     seatId: 7,
    //     seatName: 'Seat 7 - System Game',
    //     description: 'System Game: 2h 15m',
    //     playedHours: 2,
    //     playedMinutes: 15,
    //     playedSeconds: 0,
    //     extraControllers: 0,
    //     snacksEnabled: true,
    //     customerName: 'Test Customer 7',
    //     customerPhone: '9876543216',
    //     expectedBonus: '30 minutes',
    //     expectedPaidHours: 2,
    //     expectedCost: 200 // 2h × ₹100
    // }
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(hours, minutes, seconds) {
    const h = String(hours).padStart(2, '0')
    const m = String(minutes).padStart(2, '0')
    const s = String(seconds).padStart(2, '0')
    return `${h}:${m}:${s}`
}

function calculateElapsedSeconds(hours, minutes, seconds) {
    return (hours * 3600) + (minutes * 60) + seconds
}

function getStartTime(hoursAgo, minutesAgo, secondsAgo) {
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)

    const startTime = new Date(
        istTime.getTime() -
        (hoursAgo * 60 * 60 * 1000) -
        (minutesAgo * 60 * 1000) -
        (secondsAgo * 1000)
    )

    return startTime.toISOString().slice(0, 19).replace('T', ' ')
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function setupMultipleTestScenarios() {
    const client = await pool.connect()

    try {
        console.log('╔════════════════════════════════════════════════════════════════╗')
        console.log('║     SETTING UP MULTIPLE TEST SCENARIOS FOR BONUS TESTING       ║')
        console.log('╚════════════════════════════════════════════════════════════════╝\n')

        let successCount = 0
        let failCount = 0

        for (const scenario of testScenarios) {
            const elapsedSeconds = calculateElapsedSeconds(
                scenario.playedHours,
                scenario.playedMinutes,
                scenario.playedSeconds
            )

            const startTimeStr = getStartTime(
                scenario.playedHours,
                scenario.playedMinutes,
                scenario.playedSeconds
            )

            console.log(`\n┌─────────────────────────────────────────────────────────────┐`)
            console.log(`│ ${scenario.seatName.padEnd(59)} │`)
            console.log(`├─────────────────────────────────────────────────────────────┤`)
            console.log(`│ Description: ${scenario.description.padEnd(46)} │`)
            console.log(`│ Play time:   ${formatTime(scenario.playedHours, scenario.playedMinutes, scenario.playedSeconds)} (${String(elapsedSeconds).padEnd(5)}s)${' '.repeat(32)} │`)
            console.log(`│ Start time:  ${startTimeStr.padEnd(46)} │`)
            console.log(`│ Extra Ctrl:  ${String(scenario.extraControllers).padEnd(46)} │`)
            console.log(`│ Snacks:      ${(scenario.snacksEnabled ? 'YES' : 'NO').padEnd(46)} │`)
            console.log(`│ Customer:    ${scenario.customerName.padEnd(46)} │`)
            console.log(`├─────────────────────────────────────────────────────────────┤`)
            console.log(`│ Expected:                                                   │`)
            console.log(`│   Bonus:      ${scenario.expectedBonus.padEnd(45)} │`)
            console.log(`│   Paid hours: ${String(scenario.expectedPaidHours).padEnd(45)} │`)
            console.log(`│   Cost:       ₹${String(scenario.expectedCost).padEnd(44)} │`)
            console.log(`└─────────────────────────────────────────────────────────────┘`)

            try {
                const updateQuery = `
          UPDATE stations 
          SET 
            elapsed_time = $1,
            is_running = true,
            is_done = false,
            start_time = $2,
            end_time = NULL,
            extra_controllers = $3,
            snacks_enabled = $4,
            customer_name = $5,
            customer_phone = $6,
            updated_at = NOW()
          WHERE id = $7
          RETURNING *
        `

                const result = await client.query(updateQuery, [
                    elapsedSeconds,
                    startTimeStr,
                    scenario.extraControllers,
                    scenario.snacksEnabled,
                    scenario.customerName,
                    scenario.customerPhone,
                    scenario.seatId
                ])

                if (result.rows.length > 0) {
                    console.log(`✅ Successfully updated ${scenario.seatName}`)
                    successCount++
                } else {
                    console.log(`❌ Failed to update ${scenario.seatName}`)
                    failCount++
                }
            } catch (error) {
                console.log(`❌ Error updating ${scenario.seatName}: ${error.message}`)
                failCount++
            }
        }

        console.log('\n╔════════════════════════════════════════════════════════════════╗')
        console.log('║                         SUMMARY                                ║')
        console.log('╚════════════════════════════════════════════════════════════════╝')
        console.log(`\n  Total scenarios:  ${testScenarios.length}`)
        console.log(`  ✅ Successful:    ${successCount}`)
        console.log(`  ❌ Failed:        ${failCount}`)
        console.log('\n╔════════════════════════════════════════════════════════════════╗')
        console.log('║                    NEXT STEPS                                  ║')
        console.log('╚════════════════════════════════════════════════════════════════╝')
        console.log('\n  1. Open your browser: http://localhost:5173')
        console.log('  2. Refresh the page to see all test scenarios')
        console.log('  3. Verify each station shows:')
        console.log('     - Correct timer value')
        console.log('     - Correct bonus time')
        console.log('     - Correct paid hours')
        console.log('     - Correct total cost')
        console.log('\n  💡 TIP: You can modify the testScenarios array at the top')
        console.log('     of this script to test different scenarios!\n')

    } catch (error) {
        console.error('\n❌ Error setting up test scenarios:', error)
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the script
setupMultipleTestScenarios()
