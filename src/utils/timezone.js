/**
 * Timezone utility for Indian Standard Time (IST) - Asia/Kolkata
 * All date/time operations should use these functions to ensure consistency
 */

const TIMEZONE = 'Asia/Kolkata'

/**
 * Get current date/time in Indian timezone
 * @returns {Date} Date object representing current time in IST
 */
export const getIndianTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }))
}

/**
 * Get current timestamp in milliseconds (UTC, but calculations should use IST)
 * Note: Date.now() returns UTC timestamp, but we'll use IST for display/calculations
 * @returns {number} Current timestamp in milliseconds
 */
export const getIndianTimestamp = () => {
  // Get current time in IST and convert to UTC timestamp
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  return new Date(istString).getTime()
}

/**
 * Get current date as ISO string in Indian timezone
 * @returns {string} ISO string of current time in IST
 */
export const getIndianTimeISO = () => {
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  const istDate = new Date(istString)
  return istDate.toISOString()
}

/**
 * Get date string in YYYY-MM-DD format for Indian timezone
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const getIndianDateString = () => {
  const now = new Date()
  const istString = now.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  // Convert to YYYY-MM-DD format
  const parts = istString.split('/')
  if (parts.length === 3) {
    // US format: MM/DD/YYYY
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  }
  // Fallback: use ISO string and extract date part
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  return istDate.toISOString().split('T')[0]
}

/**
 * Get day of week (0-6) in Indian timezone
 * @returns {number} Day of week (0 = Sunday, 6 = Saturday)
 */
export const getIndianDayOfWeek = () => {
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  const istDate = new Date(istString)
  return istDate.getDay()
}

/**
 * Get month (1-12) in Indian timezone
 * @returns {number} Month (1 = January, 12 = December)
 */
export const getIndianMonth = () => {
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  const istDate = new Date(istString)
  return istDate.getMonth() + 1
}

/**
 * Get year in Indian timezone
 * @returns {number} Year
 */
export const getIndianYear = () => {
  const now = new Date()
  const istString = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  const istDate = new Date(istString)
  return istDate.getFullYear()
}

/**
 * Format date to locale string in Indian timezone
 * @param {Date|string|number} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatIndianDate = (date, options = {}) => {
  const dateObj = date instanceof Date ? date : new Date(date)
  // Default to 24-hour format (hour12: false) if not explicitly set
  const formatOptions = {
    hour12: false, // Default to 24-hour format
    ...options
  }
  // Use Intl.DateTimeFormat for accurate IST conversion
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    ...formatOptions
  })
  return formatter.format(dateObj)
}

/**
 * Convert a date to Indian timezone
 * @param {Date|string|number} date - Date to convert
 * @returns {Date} Date object in Indian timezone
 */
export const toIndianTime = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date)
  const istString = dateObj.toLocaleString('en-US', { timeZone: TIMEZONE })
  return new Date(istString)
}

/**
 * Get time string in HH:MM:SS format for Indian timezone
 * @param {Date|string|number} date - Optional date, defaults to now
 * @returns {string} Time string in HH:MM:SS format
 */
export const getIndianTimeString = (date = null) => {
  const dateObj = date ? (date instanceof Date ? date : new Date(date)) : new Date()
  // Use Intl.DateTimeFormat for accurate IST conversion
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // Use 24-hour format
  })
  return formatter.format(dateObj)
}

/**
 * Get date and time string for Indian timezone
 * @param {Date|string|number} date - Optional date, defaults to now
 * @returns {string} Date and time string
 */
export const getIndianDateTimeString = (date = null) => {
  const dateObj = date ? (date instanceof Date ? date : new Date(date)) : new Date()
  return formatIndianDate(dateObj, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

