// Test script to reproduce the exact issue from the screenshot
import { calculateCost, calculatePaidHours, getBonusTime, GAME_TYPES } from '../src/utils/pricing.js'

console.log('=== Reproducing Screenshot Issue ===\n')

// Seat 2 from screenshot:
// - Running time: 5:08:53 (5 hours 8 minutes 53 seconds)
// - Game type: Playstation (₹200/hr on weekend based on screenshot)
// - Extra controllers: 1 (+₹60)
// - Snacks Purchased: YES (checked)
// - Bonus shown: +01:00:00
// - Cost shown: ₹1260 (WRONG)

const totalSeconds = (5 * 3600) + (8 * 60) + 53 // 5h 8m 53s = 18,533 seconds
const gameType = GAME_TYPES.PLAYSTATION
const extraControllers = 1
const snacks = {} // Empty snacks object
const rate = 200 // Weekend rate

console.log('Input:')
console.log(`  Total time played: 5h 8m 53s (${totalSeconds} seconds)`)
console.log(`  Game type: ${gameType}`)
console.log(`  Rate: ₹${rate}/hr`)
console.log(`  Extra controllers: ${extraControllers}`)
console.log(`  Snacks purchased: YES`)
console.log('')

// Current calculation
const bonusTime = getBonusTime(totalSeconds, gameType)
const paidHours = calculatePaidHours(totalSeconds, gameType)
const totalCost = calculateCost(totalSeconds, gameType, extraControllers, snacks, null)

console.log('Current Calculation (WRONG):')
console.log(`  Bonus time: ${bonusTime / 60} minutes (${bonusTime} seconds)`)
console.log(`  Paid hours: ${paidHours} hours`)
console.log(`  Base cost: ${paidHours} × ₹${rate} = ₹${paidHours * rate}`)
console.log(`  Extra controller: ₹60`)
console.log(`  Total cost: ₹${totalCost}`)
console.log('')

// Expected calculation
console.log('Expected Calculation (CORRECT):')
console.log(`  Total played: 5h 8m`)
console.log(`  Bonus time: 1 hour (for 3+ hours paid)`)
console.log(`  Billable time: 5h 8m - 1h = 4h 8m`)
console.log(`  Paid hours: 4 hours (rounded down with buffer)`)
console.log(`  Base cost: 4 × ₹200 = ₹800`)
console.log(`  Extra controller: ₹60`)
console.log(`  Expected total: ₹860`)
console.log('')

// Verification
if (totalCost === 1260) {
    console.log('❌ CONFIRMED: Bug reproduced! Cost is ₹1260 instead of ₹860')
    console.log('   The bonus time is being DISPLAYED but NOT APPLIED to reduce billing')
} else if (totalCost === 860) {
    console.log('✅ FIXED: Cost is correct at ₹860')
} else {
    console.log(`⚠️  Unexpected cost: ₹${totalCost}`)
}

console.log('\n=== Analysis ===')
console.log('The issue is that calculatePaidHours() is calculating based on tier logic')
console.log('but NOT properly subtracting the bonus time from the billable hours.')
console.log('')
console.log('The tier logic says:')
console.log('  - Tier 3: Pay 3h, get 1h bonus = 4h total allowed')
console.log('  - Customer played 5h 8m (18,533s)')
console.log('  - Excess: 18,533s - 14,400s = 4,133s')
console.log('  - Excess hours: ceil(4,133 / 3600) = 2 hours')
console.log('  - Paid: 3 + 2 = 5 hours')
console.log('')
console.log('But this is WRONG! The customer should only pay for ~4 hours.')
