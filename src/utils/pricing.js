import { getIndianDayOfWeek } from './timezone'
import { pricingAPI, bonusAPI } from './api'

export const GAME_TYPES = {
  PLAYSTATION: 'Playstation',
  STEERING_WHEEL: 'Steering Wheel',
  SYSTEM: 'System'
}

const PRICING_STORAGE_KEY = 'gamers-spot-pricing'

// Default pricing configuration
const defaultPricing = {
  [GAME_TYPES.PLAYSTATION]: {
    weekday: 150,
    weekend: 200
  },
  [GAME_TYPES.STEERING_WHEEL]: {
    weekday: 150,
    weekend: 150
  },
  [GAME_TYPES.SYSTEM]: {
    weekday: 100,
    weekend: 100
  }
}

// Default bonus configuration
const defaultBonusConfig = {
  [GAME_TYPES.PLAYSTATION]: {
    weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
    weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
  },
  [GAME_TYPES.STEERING_WHEEL]: {
    weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
    weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
  },
  [GAME_TYPES.SYSTEM]: {
    weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
    weekend: { oneHour: 900, twoHours: 1800, threeHours: 3600 }
  }
}

// Cache configuration locally to avoid sync issues in components
let cachedPricing = { ...defaultPricing }
let cachedBonusConfig = { ...defaultBonusConfig }
let isInitialized = false

// Initialize pricing from API (call this in App.jsx on mount)
export const initPricing = async () => {
  try {
    const data = await pricingAPI.get()
    if (data) {
      // Merge with defaults to ensure all keys exist
      cachedPricing = {
        ...defaultPricing,
        ...data
      }

      // Ensure specific structure for each game type is preserved if API returns partial data
      Object.keys(defaultPricing).forEach(key => {
        if (!cachedPricing[key]) {
          cachedPricing[key] = defaultPricing[key]
        }
      })
    }

    // Also initialize bonus configuration
    const bonusData = await bonusAPI.get()
    if (bonusData) {
      cachedBonusConfig = {
        ...defaultBonusConfig,
        ...bonusData
      }

      // Ensure structure is preserved
      Object.keys(defaultBonusConfig).forEach(key => {
        if (!cachedBonusConfig[key]) {
          cachedBonusConfig[key] = defaultBonusConfig[key]
        }
      })
    }

    isInitialized = true
    return { pricing: cachedPricing, bonus: cachedBonusConfig }
  } catch (error) {
    console.error('Error initializing pricing:', error)
    return { pricing: cachedPricing, bonus: cachedBonusConfig }
  }
}

// Synchronous getter for components (uses cached value)
export const loadPricing = () => {
  return cachedPricing
}

// Async save
export const savePricing = async (pricing) => {
  try {
    // Optimistic update of cache
    cachedPricing = { ...pricing }

    // Persist to DB
    await pricingAPI.update(pricing)
  } catch (error) {
    console.error('Error saving pricing:', error)
    throw error // Let component handle error
  }
}

export const getDayType = () => {
  const day = getIndianDayOfWeek()
  // 0 = Sunday, 6 = Saturday
  return (day === 0 || day === 6) ? 'weekend' : 'weekday'
}

export const getRate = (gameType) => {
  const pricing = loadPricing()
  const dayType = getDayType()

  // Handle legacy game type names (all PlayStation consoles → Playstation)
  let normalizedGameType = gameType
  if (gameType === 'PlayStation' || gameType === 'PS4' || gameType === 'PS5' || gameType === 'Playstation') {
    normalizedGameType = GAME_TYPES.PLAYSTATION
  } else if (gameType === 'System' || gameType === 'Desktop') {
    normalizedGameType = GAME_TYPES.SYSTEM
  }

  // Get pricing for the game type, fallback to default
  const gamePricing = pricing[normalizedGameType] || defaultPricing[normalizedGameType] || defaultPricing[GAME_TYPES.SYSTEM]

  // Ensure we have valid pricing
  if (!gamePricing || typeof gamePricing.weekday === 'undefined' || typeof gamePricing.weekend === 'undefined') {
    console.warn(`Invalid pricing for gameType: ${gameType}, using default`)
    const defaultPricingForType = defaultPricing[normalizedGameType] || defaultPricing[GAME_TYPES.SYSTEM]
    return dayType === 'weekend' ? defaultPricingForType.weekend : defaultPricingForType.weekday
  }

  return dayType === 'weekend' ? gamePricing.weekend : gamePricing.weekday
}

export const getPlayStationRate = () => {
  return getRate(GAME_TYPES.PLAYSTATION)
}

export const getSystemRate = () => {
  return getRate(GAME_TYPES.SYSTEM)
}

export const getSteeringWheelGameRate = () => {
  return getRate(GAME_TYPES.STEERING_WHEEL)
}

export const getExtraControllerRate = () => {
  const pricing = loadPricing()
  return pricing.extraControllerRate || 50 // Default to 50 if not configured
}

export const getBufferMinutes = () => {
  const pricing = loadPricing()
  return pricing.bufferMinutes || 10 // Default to 10 minutes if not configured
}

export const getSnackRates = () => {
  return {
    cokeBottle: 20,
    cokeCan: 40
  }
}

export const getCokeBottleRate = () => {
  return 20
}

export const getCokeCanRate = () => {
  return 40
}

export const getSteeringWheelRate = () => {
  return 150
}

export const calculateBonusTime = (paidHours) => {
  if (paidHours >= 3) return 3600 // 1 hour free
  if (paidHours >= 2) return 1800 // 30 minutes free
  if (paidHours >= 1) return 900  // 15 minutes free
  return 0
}

export const calculatePaidHours = (totalSeconds, gameType = null) => {
  // Calculate paid hours based on total time played (excluding bonus)
  // Bonus time is given but not charged
  const totalHours = totalSeconds / 3600

  // Get bonus time for this game type and day
  const bonusTimeSeconds = getBonusTime(totalSeconds, gameType)

  // If there's NO bonus time (0), apply billing buffer to prevent disputes over small overages
  // This applies to all game types when bonus is disabled (configured in Pricing Configuration)
  if (bonusTimeSeconds === 0) {
    const BUFFER_MINUTES = getBufferMinutes() // Get from configuration (default: 10)
    const BUFFER_SECONDS = BUFFER_MINUTES * 60

    if (totalSeconds === 0) return 0

    // Calculate full hours (rounded down)
    const fullHours = Math.floor(totalHours)
    const fullHoursSeconds = fullHours * 3600
    const bufferLimit = fullHoursSeconds + BUFFER_SECONDS

    // If time is within buffer (full hours + buffer mins), charge only for full hours
    if (totalSeconds <= bufferLimit) {
      return fullHours > 0 ? fullHours : 1 // Minimum 1 hour
    }

    // If time exceeds buffer, charge for full hours + 1 extra hour
    return fullHours + 1
  }

  // If there IS bonus time, subtract bonus from total time to get billable time
  // Apply billing buffer to prevent charging full extra hour for small overages
  // Logic: Total played - Bonus earned = Billable time

  if (totalSeconds === 0) return 0

  // Calculate billable time by subtracting the bonus
  const billableSeconds = totalSeconds - bonusTimeSeconds

  // When bonus is active, use a fixed 5-minute buffer (not configurable)
  // This is in addition to the bonus time already given
  const BUFFER_MINUTES = 5 // Fixed 5-minute buffer when bonus is active
  const BUFFER_SECONDS = BUFFER_MINUTES * 60

  // Calculate full hours (rounded down)
  const billableHours = billableSeconds / 3600
  const fullHours = Math.floor(billableHours)
  const fullHoursSeconds = fullHours * 3600
  const bufferLimit = fullHoursSeconds + BUFFER_SECONDS

  // If billable time is within buffer (full hours + buffer mins), charge only for full hours
  if (billableSeconds <= bufferLimit) {
    return fullHours > 0 ? fullHours : 1 // Minimum 1 hour
  }

  // If billable time exceeds buffer, charge for full hours + 1 extra hour
  return fullHours + 1
}

// Calculate snack cost from snacks object (supports both old format and new format)
export const calculateSnackCost = async (snacks, snacksList = null) => {
  // If snacksList is provided, use it (new format: snacks is array of {snackId, quantity})
  if (Array.isArray(snacks) && snacksList) {
    let total = 0
    snacks.forEach(snackItem => {
      const snack = snacksList.find(s => s.id === snackItem.snackId)
      if (snack && snack.active) {
        total += (snackItem.quantity || 0) * parseFloat(snack.price)
      }
    })
    return total
  }

  // Legacy format: snacks is object with keys like {cokeBottle: 2, cokeCan: 1}
  // This is for backward compatibility
  if (snacksList) {
    let total = 0
    snacksList.forEach(snack => {
      if (snack.active) {
        // Try to match snack name to keys in snacks object
        const snackKey = snack.name.toLowerCase()
          .replace(/\s+/g, '')
          .replace('cokebottle', 'cokeBottle')
          .replace('cokecan', 'cokeCan')
          .replace('layschips', 'laysChips')

        const quantity = snacks[snackKey] || snacks[snack.name] || 0
        total += quantity * parseFloat(snack.price)
      }
    })
    return total
  }

  // Fallback to old hardcoded rates if snacksList not available
  const cokeBottleCount = snacks.cokeBottle || 0
  const cokeCanCount = snacks.cokeCan || 0
  return (cokeBottleCount * getCokeBottleRate()) + (cokeCanCount * getCokeCanRate())
}

export const calculateCost = (totalSeconds, gameType, extraControllers = 0, snacks = {}, snacksList = null) => {
  const baseRate = getRate(gameType)

  // Calculate paid hours (before bonus) - pass gameType for weekend logic
  const paidHours = calculatePaidHours(totalSeconds, gameType)

  // Base cost for paid hours
  let cost = paidHours * baseRate

  // Add extra controllers for PlayStation (50Rs per controller)
  if (gameType === GAME_TYPES.PLAYSTATION && extraControllers > 0) {
    cost += extraControllers * getExtraControllerRate()
  }

  // Add snacks cost (supports both old and new format)
  // Note: calculateSnackCost is async but we'll make it sync for now
  let snackCost = 0
  if (snacksList && snacksList.length > 0) {
    snacksList.forEach(snack => {
      if (snack.active) {
        const snackKey = snack.name.toLowerCase()
          .replace(/\s+/g, '')
          .replace('cokebottle', 'cokeBottle')
          .replace('cokecan', 'cokeCan')
          .replace('layschips', 'laysChips')
          .replace('kurkure', 'kurkure')
        const quantity = snacks[snackKey] || snacks[snack.name] || 0
        snackCost += quantity * parseFloat(snack.price)
      }
    })
  } else {
    // Fallback to old hardcoded rates
    const cokeBottleCount = snacks.cokeBottle || 0
    const cokeCanCount = snacks.cokeCan || 0
    snackCost = (cokeBottleCount * getCokeBottleRate()) + (cokeCanCount * getCokeCanRate())
  }

  cost += snackCost

  return cost
}

// Helper function: Get bonus time for a given number of PAID hours
// This is used internally by calculatePaidHours to determine tier bonuses
export const getBonusForPaidHours = (paidHours, gameType = null) => {
  const dayType = getDayType()

  // Get bonus configuration for the game type
  const bonusConfig = cachedBonusConfig[gameType] || defaultBonusConfig[GAME_TYPES.SYSTEM]
  const dayConfig = bonusConfig[dayType] || bonusConfig.weekday

  // Return bonus based on paid hours tier
  if (paidHours >= 3) {
    return dayConfig.threeHours || 0
  } else if (paidHours >= 2) {
    return dayConfig.twoHours || 0
  } else if (paidHours >= 1) {
    return dayConfig.oneHour || 0
  }
  return 0
}

export const getBonusTime = (totalSeconds, gameType = null) => {
  // Calculate bonus based on how many hours the customer has actually played
  // NOT based on exceeding tier allowances

  const dayType = getDayType()

  // Get bonus configuration for the game type
  const bonusConfig = cachedBonusConfig[gameType] || defaultBonusConfig[GAME_TYPES.SYSTEM]
  const dayConfig = bonusConfig[dayType] || bonusConfig.weekday

  // If no bonus is configured for this game type/day, return 0
  if (!dayConfig || (dayConfig.oneHour === 0 && dayConfig.twoHours === 0 && dayConfig.threeHours === 0)) {
    return 0
  }

  // Calculate total hours played (not billable hours)
  const totalHours = totalSeconds / 3600

  // Determine bonus tier based on hours played
  // Tier 3: 3+ hours played → Get 1 hour bonus
  if (totalHours >= 3) {
    return dayConfig.threeHours || 0
  }

  // Tier 2: 2+ hours played (but less than 3) → Get 30 min bonus
  if (totalHours >= 2) {
    return dayConfig.twoHours || 0
  }

  // Tier 1: 1+ hour played (but less than 2) → Get 15 min bonus
  if (totalHours >= 1) {
    return dayConfig.oneHour || 0
  }

  // Less than 1 hour → No bonus
  return 0
}

export const getEffectiveTime = (paidHours) => {
  const bonusSeconds = calculateBonusTime(paidHours)
  return (paidHours * 3600) + bonusSeconds
}

// Calculate extra time played beyond buffer for weekend Playstation games
export const getExtraTimePlayed = (totalSeconds, gameType = null) => {
  const dayType = getDayType()

  // Only applies to Playstation games on weekends
  if (gameType !== GAME_TYPES.PLAYSTATION || dayType !== 'weekend') {
    return 0
  }

  const BUFFER_MINUTES = 10
  const BUFFER_SECONDS = BUFFER_MINUTES * 60
  const totalHours = totalSeconds / 3600

  if (totalSeconds === 0) return 0

  // Calculate full hours (rounded down)
  const fullHours = Math.floor(totalHours)
  const fullHoursSeconds = fullHours * 3600
  const bufferLimit = fullHoursSeconds + BUFFER_SECONDS

  // If time is within buffer, no extra time
  if (totalSeconds <= bufferLimit) {
    return 0
  }

  // Calculate extra time beyond buffer
  const extraTime = totalSeconds - bufferLimit
  return extraTime
}
