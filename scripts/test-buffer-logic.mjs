// Test to verify the updated buffer logic
console.log('=== Testing Updated Buffer Logic ===\n')

// Simulate the fixed buffer logic
function calculatePaidHours(totalSeconds, bonusSeconds) {
    if (bonusSeconds === 0) {
        // No bonus: Use configurable buffer (10 minutes)
        const BUFFER_MINUTES = 10
        const BUFFER_SECONDS = BUFFER_MINUTES * 60

        const totalHours = totalSeconds / 3600
        const fullHours = Math.floor(totalHours)
        const fullHoursSeconds = fullHours * 3600
        const bufferLimit = fullHoursSeconds + BUFFER_SECONDS

        if (totalSeconds <= bufferLimit) {
            return fullHours > 0 ? fullHours : 1
        }
        return fullHours + 1
    } else {
        // Bonus active: Use fixed 5-minute buffer
        const BUFFER_MINUTES = 5
        const BUFFER_SECONDS = BUFFER_MINUTES * 60

        const billableSeconds = totalSeconds - bonusSeconds
        const billableHours = billableSeconds / 3600
        const fullHours = Math.floor(billableHours)
        const fullHoursSeconds = fullHours * 3600
        const bufferLimit = fullHoursSeconds + BUFFER_SECONDS

        if (billableSeconds <= bufferLimit) {
            return fullHours > 0 ? fullHours : 1
        }
        return fullHours + 1
    }
}

const testCases = [
    {
        name: 'Current issue: 1h 21m with 15min bonus',
        totalSeconds: (1 * 3600) + (21 * 60) + 16,
        bonusSeconds: 900,
        expectedPaid: 2,
        expectedCost: 300 // 2h × ₹150
    },
    {
        name: '1h 20m with 15min bonus (within 5min buffer)',
        totalSeconds: (1 * 3600) + (20 * 60),
        bonusSeconds: 900,
        expectedPaid: 2,
        expectedCost: 300
    },
    {
        name: '1h 19m with 15min bonus (within 5min buffer)',
        totalSeconds: (1 * 3600) + (19 * 60),
        bonusSeconds: 900,
        expectedPaid: 1,
        expectedCost: 150
    },
    {
        name: '1h 14m with 15min bonus (well within buffer)',
        totalSeconds: (1 * 3600) + (14 * 60) + 45,
        bonusSeconds: 900,
        expectedPaid: 1,
        expectedCost: 150
    },
    {
        name: 'No bonus: 1h 9m (within 10min buffer)',
        totalSeconds: (1 * 3600) + (9 * 60),
        bonusSeconds: 0,
        expectedPaid: 1,
        expectedCost: 150
    },
    {
        name: 'No bonus: 1h 11m (exceeds 10min buffer)',
        totalSeconds: (1 * 3600) + (11 * 60),
        bonusSeconds: 0,
        expectedPaid: 2,
        expectedCost: 300
    }
]

console.log('Testing with new buffer logic:\n')
console.log('  When BONUS > 0: Use 5-minute buffer')
console.log('  When BONUS = 0: Use 10-minute buffer (configurable)\n')

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
    const paidHours = calculatePaidHours(test.totalSeconds, test.bonusSeconds)
    const cost = paidHours * 150
    const status = paidHours === test.expectedPaid ? '✅' : '❌'

    const totalMin = Math.floor(test.totalSeconds / 60)
    const totalHr = Math.floor(totalMin / 60)
    const totalM = totalMin % 60

    const bonusMin = test.bonusSeconds / 60
    const billableSeconds = test.totalSeconds - test.bonusSeconds
    const billableMin = Math.floor(billableSeconds / 60)
    const billableHr = Math.floor(billableMin / 60)
    const billableM = billableMin % 60

    console.log(`${status} ${test.name}`)
    console.log(`   Total: ${totalHr}h ${totalM}m | Bonus: ${bonusMin}min | Billable: ${billableHr}h ${billableM}m`)
    console.log(`   Paid: ${paidHours}h (expected: ${test.expectedPaid}h) | Cost: ₹${cost} (expected: ₹${test.expectedCost})`)

    if (paidHours === test.expectedPaid) {
        passed++
    } else {
        failed++
        console.log(`   ERROR: Got ${paidHours}h, expected ${test.expectedPaid}h`)
    }
    console.log('')
})

console.log('=== Summary ===')
console.log(`Passed: ${passed}/${testCases.length}`)
console.log(`Failed: ${failed}/${testCases.length}`)

if (failed === 0) {
    console.log('\n🎉 All tests passed! Buffer logic is correct.')
} else {
    console.log('\n⚠️  Some tests failed. Please review the logic.')
}
