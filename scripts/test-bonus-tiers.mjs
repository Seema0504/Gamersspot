// Test to verify the bonus tier logic is correct
console.log('=== Testing Bonus Tier Logic ===\n')

// Simulate the fixed getBonusTime logic
function getBonusTime(totalSeconds) {
    const totalHours = totalSeconds / 3600

    // Bonus configuration (weekday)
    const bonusConfig = {
        oneHour: 900,    // 15 minutes
        twoHours: 1800,  // 30 minutes
        threeHours: 3600 // 1 hour
    }

    // Tier 3: 3+ hours → 1 hour bonus
    if (totalHours >= 3) {
        return bonusConfig.threeHours
    }

    // Tier 2: 2+ hours (but < 3) → 30 min bonus
    if (totalHours >= 2) {
        return bonusConfig.twoHours
    }

    // Tier 1: 1+ hour (but < 2) → 15 min bonus
    if (totalHours >= 1) {
        return bonusConfig.oneHour
    }

    // Less than 1 hour → No bonus
    return 0
}

const testCases = [
    { time: '0h 59m', seconds: 59 * 60, expectedBonus: 0, expectedBonusMin: 0 },
    { time: '1h 0m', seconds: 1 * 3600, expectedBonus: 900, expectedBonusMin: 15 },
    { time: '1h 16m', seconds: (1 * 3600) + (16 * 60), expectedBonus: 900, expectedBonusMin: 15 },
    { time: '1h 30m', seconds: (1 * 3600) + (30 * 60), expectedBonus: 900, expectedBonusMin: 15 },
    { time: '1h 59m', seconds: (1 * 3600) + (59 * 60), expectedBonus: 900, expectedBonusMin: 15 },
    { time: '2h 0m', seconds: 2 * 3600, expectedBonus: 1800, expectedBonusMin: 30 },
    { time: '2h 30m', seconds: (2 * 3600) + (30 * 60), expectedBonus: 1800, expectedBonusMin: 30 },
    { time: '2h 59m', seconds: (2 * 3600) + (59 * 60), expectedBonus: 1800, expectedBonusMin: 30 },
    { time: '3h 0m', seconds: 3 * 3600, expectedBonus: 3600, expectedBonusMin: 60 },
    { time: '4h 0m', seconds: 4 * 3600, expectedBonus: 3600, expectedBonusMin: 60 },
    { time: '5h 8m', seconds: (5 * 3600) + (8 * 60), expectedBonus: 3600, expectedBonusMin: 60 },
]

console.log('Testing bonus tier boundaries:\n')

let passed = 0
let failed = 0

testCases.forEach(test => {
    const bonus = getBonusTime(test.seconds)
    const bonusMin = bonus / 60
    const status = bonus === test.expectedBonus ? '✅' : '❌'

    console.log(`${status} ${test.time.padEnd(8)} → Bonus: ${bonusMin} min (expected: ${test.expectedBonusMin} min)`)

    if (bonus === test.expectedBonus) {
        passed++
    } else {
        failed++
        console.log(`   ERROR: Got ${bonus}s, expected ${test.expectedBonus}s`)
    }
})

console.log(`\n=== Summary ===`)
console.log(`Passed: ${passed}/${testCases.length}`)
console.log(`Failed: ${failed}/${testCases.length}`)

if (failed === 0) {
    console.log('\n🎉 All tests passed! Bonus tier logic is correct.')
} else {
    console.log('\n⚠️  Some tests failed. Please review the logic.')
}
