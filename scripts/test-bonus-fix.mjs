// Test script to verify bonus calculation fix
// This script tests the pricing logic to ensure customers are charged correctly

import { calculateCost, calculatePaidHours, getBonusTime, getBonusForPaidHours, GAME_TYPES } from '../src/utils/pricing.js'

console.log('=== Testing Bonus Calculation Fix ===\n')

// Test scenario from the screenshot:
// Customer plays for 6 hours on a Playstation (weekday)
// Expected: Pay for 5 hours, get 1 hour bonus
// Cost should be: 5 hours × ₹210/hr = ₹1050 (NOT ₹1260)

const gameType = GAME_TYPES.PLAYSTATION
const totalPlayedSeconds = 6 * 3600 // 6 hours in seconds
const weekdayRate = 210 // ₹210/hr for PlayStation on weekday (based on screenshot showing ₹200/hr)

console.log('Test Case: Customer plays for 6 hours on PlayStation (weekday)')
console.log(`Total time played: ${totalPlayedSeconds / 3600} hours`)
console.log('')

// Test getBonusForPaidHours
console.log('--- Testing getBonusForPaidHours ---')
const bonus1hr = getBonusForPaidHours(1, gameType)
const bonus2hr = getBonusForPaidHours(2, gameType)
const bonus3hr = getBonusForPaidHours(3, gameType)
console.log(`Bonus for 1 hour paid: ${bonus1hr / 60} minutes (${bonus1hr} seconds)`)
console.log(`Bonus for 2 hours paid: ${bonus2hr / 60} minutes (${bonus2hr} seconds)`)
console.log(`Bonus for 3 hours paid: ${bonus3hr / 60} minutes (${bonus3hr} seconds)`)
console.log('')

// Test getBonusTime (works backwards from total played time)
console.log('--- Testing getBonusTime ---')
const bonusTime = getBonusTime(totalPlayedSeconds, gameType)
console.log(`Bonus time for ${totalPlayedSeconds / 3600} hours played: ${bonusTime / 60} minutes (${bonusTime} seconds)`)
console.log('')

// Test calculatePaidHours
console.log('--- Testing calculatePaidHours ---')
const paidHours = calculatePaidHours(totalPlayedSeconds, gameType)
console.log(`Paid hours for ${totalPlayedSeconds / 3600} hours played: ${paidHours} hours`)
console.log('')

// Test calculateCost
console.log('--- Testing calculateCost ---')
const totalCost = calculateCost(totalPlayedSeconds, gameType, 0, {}, null)
console.log(`Total cost: ₹${totalCost}`)
console.log('')

// Verify the fix
console.log('=== Verification ===')
const expectedPaidHours = 5
const expectedBonus = 3600 // 1 hour in seconds
const expectedCost = expectedPaidHours * weekdayRate

console.log(`Expected paid hours: ${expectedPaidHours}`)
console.log(`Expected bonus: ${expectedBonus / 60} minutes`)
console.log(`Expected cost: ₹${expectedCost}`)
console.log('')

if (paidHours === expectedPaidHours) {
    console.log('✅ PASS: Paid hours calculation is correct!')
} else {
    console.log(`❌ FAIL: Expected ${expectedPaidHours} paid hours, got ${paidHours}`)
}

if (bonusTime === expectedBonus) {
    console.log('✅ PASS: Bonus time calculation is correct!')
} else {
    console.log(`❌ FAIL: Expected ${expectedBonus} seconds bonus, got ${bonusTime}`)
}

if (totalCost === expectedCost) {
    console.log('✅ PASS: Total cost calculation is correct!')
} else {
    console.log(`❌ FAIL: Expected ₹${expectedCost}, got ₹${totalCost}`)
}

console.log('\n=== Additional Test Cases ===\n')

// Test case 2: 3 hours played
const test2Seconds = 3 * 3600
const test2PaidHours = calculatePaidHours(test2Seconds, gameType)
const test2Bonus = getBonusTime(test2Seconds, gameType)
const test2Cost = calculateCost(test2Seconds, gameType, 0, {}, null)
console.log(`3 hours played: ${test2PaidHours} hours paid, ${test2Bonus / 60} min bonus, ₹${test2Cost} cost`)

// Test case 3: 2 hours played
const test3Seconds = 2 * 3600
const test3PaidHours = calculatePaidHours(test3Seconds, gameType)
const test3Bonus = getBonusTime(test3Seconds, gameType)
const test3Cost = calculateCost(test3Seconds, gameType, 0, {}, null)
console.log(`2 hours played: ${test3PaidHours} hours paid, ${test3Bonus / 60} min bonus, ₹${test3Cost} cost`)

// Test case 4: 1 hour played
const test4Seconds = 1 * 3600
const test4PaidHours = calculatePaidHours(test4Seconds, gameType)
const test4Bonus = getBonusTime(test4Seconds, gameType)
const test4Cost = calculateCost(test4Seconds, gameType, 0, {}, null)
console.log(`1 hour played: ${test4PaidHours} hours paid, ${test4Bonus / 60} min bonus, ₹${test4Cost} cost`)
