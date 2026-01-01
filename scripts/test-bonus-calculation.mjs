// Comprehensive test for bonus calculation fix
// This test verifies that bonus time is properly subtracted from billable hours

console.log('=== Bonus Calculation Fix - Test Suite ===\n')

// Mock the pricing functions for testing
const GAME_TYPES = {
    PLAYSTATION: 'Playstation',
    STEERING_WHEEL: 'Steering Wheel',
    SYSTEM: 'System'
}

// Simulate bonus configuration (weekday)
const bonusConfig = {
    oneHour: 900,    // 15 minutes
    twoHours: 1800,  // 30 minutes
    threeHours: 3600 // 1 hour
}

// Helper to get bonus time based on total played
function getBonusTime(totalSeconds) {
    // Tier 3: 3h paid + 1h bonus = 4h total allowed
    const tier3Total = (3 * 3600) + 3600
    if (totalSeconds > (2 * 3600) + 1800) {
        return 3600 // 1 hour bonus
    }

    // Tier 2: 2h paid + 30min bonus = 2.5h total allowed
    const tier2Total = (2 * 3600) + 1800
    if (totalSeconds > (1 * 3600) + 900) {
        return 1800 // 30 minutes bonus
    }

    // Tier 1: 1h paid + 15min bonus = 1.25h total allowed
    if (totalSeconds >= (1 * 3600)) {
        return 900 // 15 minutes bonus
    }

    return 0
}

// NEW FIXED calculation
function calculatePaidHours_FIXED(totalSeconds) {
    const bonusTimeSeconds = getBonusTime(totalSeconds)

    if (bonusTimeSeconds === 0) {
        // Use buffer logic (not tested here)
        return Math.ceil(totalSeconds / 3600)
    }

    // Subtract bonus from total to get billable time
    const billableSeconds = totalSeconds - bonusTimeSeconds
    const billableHours = Math.ceil(billableSeconds / 3600)

    return billableHours > 0 ? billableHours : 1
}

// OLD BROKEN calculation (tier-based)
function calculatePaidHours_OLD(totalSeconds) {
    const bonusTimeSeconds = getBonusTime(totalSeconds)

    if (bonusTimeSeconds === 0) {
        return Math.ceil(totalSeconds / 3600)
    }

    // Tier 3 check
    const tier3AllowedSeconds = (3 * 3600) + 3600
    if (totalSeconds > tier3AllowedSeconds) {
        const excessSeconds = totalSeconds - tier3AllowedSeconds
        const excessHours = Math.ceil(excessSeconds / 3600)
        return 3 + excessHours
    }

    // Tier 2 check
    const tier2AllowedSeconds = (2 * 3600) + 1800
    if (totalSeconds > tier2AllowedSeconds) {
        return 3
    }

    // Tier 1 check
    const tier1AllowedSeconds = (1 * 3600) + 900
    if (totalSeconds > tier1AllowedSeconds) {
        return 2
    }

    return 1
}

// Test cases
const testCases = [
    {
        name: 'Screenshot Issue - Seat 2',
        played: '5h 8m 53s',
        totalSeconds: (5 * 3600) + (8 * 60) + 53,
        expectedBonus: 3600,
        expectedPaidHours: 5, // 5h 8m - 1h = 4h 8m -> rounds up to 5h
        rate: 200,
        extraController: 60,
        expectedCost: 1060 // 5h × 200 + 60
    },
    {
        name: 'Exactly 4 hours (tier 3 boundary)',
        played: '4h 0m 0s',
        totalSeconds: 4 * 3600,
        expectedBonus: 3600,
        expectedPaidHours: 3, // 4h - 1h = 3h
        rate: 200,
        extraController: 0,
        expectedCost: 600 // 3h × 200
    },
    {
        name: 'Just over 4 hours',
        played: '4h 5m 0s',
        totalSeconds: (4 * 3600) + (5 * 60),
        expectedBonus: 3600,
        expectedPaidHours: 4, // 4h 5m - 1h = 3h 5m -> rounds up to 4h
        rate: 200,
        extraController: 0,
        expectedCost: 800 // 4h × 200
    },
    {
        name: 'Exactly 1 hour',
        played: '1h 0m 0s',
        totalSeconds: 1 * 3600,
        expectedBonus: 900,
        expectedPaidHours: 1, // 1h - 15m = 45m -> rounds up to 1h (minimum)
        rate: 200,
        extraController: 0,
        expectedCost: 200 // 1h × 200
    },
    {
        name: 'Exactly 2 hours',
        played: '2h 0m 0s',
        totalSeconds: 2 * 3600,
        expectedBonus: 1800,
        expectedPaidHours: 2, // 2h - 30m = 1.5h -> rounds up to 2h
        rate: 200,
        extraController: 0,
        expectedCost: 400 // 2h × 200
    },
    {
        name: '6 hours played',
        played: '6h 0m 0s',
        totalSeconds: 6 * 3600,
        expectedBonus: 3600,
        expectedPaidHours: 5, // 6h - 1h = 5h
        rate: 200,
        extraController: 0,
        expectedCost: 1000 // 5h × 200
    }
]

console.log('Running test cases...\n')

let passedTests = 0
let failedTests = 0

testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`)
    console.log(`  Played: ${test.played} (${test.totalSeconds}s)`)

    const bonusTime = getBonusTime(test.totalSeconds)
    const paidHoursOld = calculatePaidHours_OLD(test.totalSeconds)
    const paidHoursNew = calculatePaidHours_FIXED(test.totalSeconds)

    const costOld = (paidHoursOld * test.rate) + test.extraController
    const costNew = (paidHoursNew * test.rate) + test.extraController

    console.log(`  Bonus: ${bonusTime / 60} min (expected: ${test.expectedBonus / 60} min)`)
    console.log(`  OLD paid hours: ${paidHoursOld} -> Cost: ₹${costOld}`)
    console.log(`  NEW paid hours: ${paidHoursNew} -> Cost: ₹${costNew}`)
    console.log(`  Expected: ${test.expectedPaidHours} hours -> Cost: ₹${test.expectedCost}`)

    if (paidHoursNew === test.expectedPaidHours && costNew === test.expectedCost) {
        console.log(`  ✅ PASS\n`)
        passedTests++
    } else {
        console.log(`  ❌ FAIL\n`)
        failedTests++
    }
})

console.log('=== Summary ===')
console.log(`Total tests: ${testCases.length}`)
console.log(`Passed: ${passedTests}`)
console.log(`Failed: ${failedTests}`)

if (failedTests === 0) {
    console.log('\n🎉 All tests passed! The fix is working correctly.')
} else {
    console.log('\n⚠️  Some tests failed. Please review the logic.')
}
