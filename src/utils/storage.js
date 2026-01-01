import { stationsAPI } from './api'

const STORAGE_KEY = 'ps-game-timer-stations'

// Import GAME_TYPES for migration
const GAME_TYPES = {
  PLAYSTATION: 'Playstation',
  STEERING_WHEEL: 'Steering Wheel',
  SYSTEM: 'System'
}

const migrateGameType = (gameType) => {
  // Migrate old game type names to new ones
  if (gameType === 'PlayStation' || gameType === 'PS4' || gameType === 'PS5' || gameType === 'Playstation') {
    return GAME_TYPES.PLAYSTATION // All PlayStation consoles map to PS5
  }
  if (gameType === 'Steering Wheel' || gameType === 'Wheel') {
    return GAME_TYPES.STEERING_WHEEL
  }
  if (gameType === 'System' || gameType === 'Desktop') {
    return GAME_TYPES.SYSTEM
  }
  // If it's already a valid new type, return as is
  if (Object.values(GAME_TYPES).includes(gameType)) {
    return gameType
  }
  // Default fallback
  return GAME_TYPES.SYSTEM
}

const migrateStation = (station) => {
  const migrated = {
    ...station,
    gameType: migrateGameType(station.gameType || GAME_TYPES.SYSTEM)
  }
  // Migrate hasExtraController (boolean) to extraControllers (number)
  if (station.hasExtraController !== undefined && station.extraControllers === undefined) {
    migrated.extraControllers = station.hasExtraController ? 1 : 0
    delete migrated.hasExtraController
  } else if (station.extraControllers === undefined) {
    migrated.extraControllers = 0
  }
  // Migrate snacks - ensure snacks object exists with default values
  if (!station.snacks || typeof station.snacks !== 'object') {
    migrated.snacks = { cokeBottle: 0, cokeCan: 0 }
  } else {
    // Preserve all existing snacks while ensuring legacy defaults
    migrated.snacks = {
      cokeBottle: 0,
      cokeCan: 0,
      ...station.snacks
    }
  }
  // Migrate customer name - ensure it exists
  if (station.customerName === undefined) {
    migrated.customerName = ''
  }
  return migrated
}

// Load stations from database, NO fallback to localStorage
export const loadStations = async () => {
  try {
    const stations = await stationsAPI.getAll()
    if (Array.isArray(stations)) {
      return stations.map(migrateStation)
    }
    return []
  } catch (error) {
    // If subscription is expired, propagate the error immediately!
    if (error.status === 402) {
      throw error;
    }
    console.error('Error loading stations from database:', error);
    return [];
  }
}

// Save stations to database
export const saveStations = async (stations) => {
  if (!stations || !Array.isArray(stations)) {
    console.error('saveStations called with invalid data', stations)
    return
  }

  try {
    // Save to database
    await stationsAPI.saveAll(stations)
    // No fallback save to localStorage
  } catch (error) {
    console.error('Error saving stations to database:', error)
  }
}

export const clearStations = async () => {
  try {
    // Clear from database
    await stationsAPI.saveAll([])

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing stations:', error)
    localStorage.removeItem(STORAGE_KEY)
  }
}

// ============================================
// Timer-Specific LocalStorage Functions
// ============================================

/**
 * Save individual timer state to LocalStorage
 * This is used for real-time timer updates without hitting the database
 */
export const saveTimerState = (stationId, timerData) => {
  try {
    const key = `timer_${stationId}`
    const data = {
      ...timerData,
      lastUpdated: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(data))
    return true
  } catch (error) {
    console.error(`Failed to save timer state for station ${stationId}:`, error)
    return false
  }
}

/**
 * Load individual timer state from LocalStorage
 */
export const loadTimerState = (stationId) => {
  try {
    const key = `timer_${stationId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error(`Failed to load timer state for station ${stationId}:`, error)
    return null
  }
}

/**
 * Clear individual timer state from LocalStorage
 */
export const clearTimerState = (stationId) => {
  try {
    const key = `timer_${stationId}`
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Failed to clear timer state for station ${stationId}:`, error)
    return false
  }
}

/**
 * Get all timer states from LocalStorage
 */
export const getAllTimerStates = () => {
  try {
    const timerStates = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('timer_')) {
        const stationId = parseInt(key.replace('timer_', ''))
        const data = localStorage.getItem(key)
        if (data) {
          timerStates[stationId] = JSON.parse(data)
        }
      }
    }
    return timerStates
  } catch (error) {
    console.error('Failed to get all timer states:', error)
    return {}
  }
}

/**
 * Clear all timer states from LocalStorage
 */
export const clearAllTimerStates = () => {
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('timer_')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    return true
  } catch (error) {
    console.error('Failed to clear all timer states:', error)
    return false
  }
}
