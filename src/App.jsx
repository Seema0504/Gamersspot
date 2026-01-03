import { useState, useEffect, useRef } from 'react'
import StationCard from './components/StationCard'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
// COMMENTED OUT - Other component imports
import BillingPanel from './components/BillingPanel'
import InvoiceViewer from './components/InvoiceViewer'
import PricingConfig from './components/PricingConfig'
import Reports from './components/Reports'
import Logo from './components/Logo'
import { loadStations, saveStations } from './utils/storage'
import { invoicesAPI, paidEventsAPI, snacksAPI, stationsAPI, reportsAPI, subscriptionAPI } from './utils/api'
import { sendInvoiceViaSMS } from './utils/sms'
import { GAME_TYPES, calculateCost, initPricing } from './utils/pricing'
import SnacksConfig from './components/SnacksConfig'
import BonusConfig from './components/BonusConfig'
import ChangePassword from './components/ChangePassword'
import { getIndianTime, getIndianTimestamp, getIndianTimeISO, getIndianDateString, formatIndianDate, getIndianTimeString, getIndianDateTimeString } from './utils/timezone'
import { timeAPI } from './utils/api'
import ManageStations from './components/ManageStations'

import { playAlarm } from './utils/alarm'
import TransferStations from './components/TransferStations'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import SubscriptionStatusBadge from './components/SubscriptionStatus'

function App() {
  const [subscriptionExpired, setSubscriptionExpired] = useState({ expired: false, message: '' })
  const [subscriptionInfo, setSubscriptionInfo] = useState(null) // { daysRemaining: number, planName: string }
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [shopName, setShopName] = useState('') // Current shop name for multi-shop identification
  const [shopId, setShopId] = useState(null) // Current shop ID
  const [originalShopId, setOriginalShopId] = useState(null) // User's original shop ID (for Super Admin)
  const [upiId, setUpiId] = useState('') // Configured UPI ID for payments
  const [availableShops, setAvailableShops] = useState([]) // List of all shops (for Super Admin)
  const [viewingShopDashboard, setViewingShopDashboard] = useState(false) // Super Admin viewing a shop's dashboard
  const [stations, setStations] = useState([])
  const [invoice, setInvoice] = useState(null)
  const [showPricingConfig, setShowPricingConfig] = useState(false)
  const [showSnacksConfig, setShowSnacksConfig] = useState(false)
  const [showBonusConfig, setShowBonusConfig] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showManageStations, setShowManageStations] = useState(false)
  const [activeReport, setActiveReport] = useState(null) // null, 'usage', 'daily-revenue', 'monthly-revenue', 'customer-report', 'snacks-report'
  const [showDashboard, setShowDashboard] = useState(true) // Dashboard view state
  const [snacksList, setSnacksList] = useState([]) // Store snacks from database
  const [sidebarOpen, setSidebarOpen] = useState(false) // Sidebar open/close state
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false) // Reports submenu open/close
  const [addSystemsMenuOpen, setAddSystemsMenuOpen] = useState(false) // Add New Systems submenu open/close
  const [istTime, setIstTime] = useState('') // Current IST time display
  const [istDate, setIstDate] = useState('') // Current IST date display
  const [todayRevenue, setTodayRevenue] = useState(0) // Today's total revenue from paid invoices
  const [showRevenue, setShowRevenue] = useState(false) // Toggle to show/hide revenue amount




  // Recalculate elapsed time for running timers based on startTime and current time
  const recalculateElapsedTime = (stations) => {
    const now = getIndianTimestamp()
    const today = getIndianTime()
    let hasUpdates = false

    const updatedStations = stations.map(station => {
      // If timer is running and has a startTime, recalculate elapsed time from startTime
      if (station.isRunning && station.startTime && !station.isDone) {
        try {
          // Normalize start time string
          let startTimeString = station.startTime;

          // Try to parse as Date directly first (handles ISO and standard DB formats)
          let startDate = new Date(startTimeString);
          let isValidDate = !isNaN(startDate.getTime());

          // If standard parsing fails, fallback to manual parsing (e.g., for "HH:MM AM/PM" legacy formats)
          if (!isValidDate) {
            const timeMatch = startTimeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10)
              const minutes = parseInt(timeMatch[2], 10)
              const ampm = timeMatch[3]?.toUpperCase()

              if (ampm === 'PM' && hours !== 12) hours += 12;
              else if (ampm === 'AM' && hours === 12) hours = 0;

              startDate = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
                hours,
                minutes,
                0,
                0
              )

              // Handle day wrapping for time-only strings
              if (startDate.getTime() > now) {
                startDate.setDate(startDate.getDate() - 1)
              }
              isValidDate = true;
            }
          }

          if (isValidDate) {
            // Calculate elapsed time in seconds
            const elapsedSinceStart = Math.floor((now - startDate.getTime()) / 1000)

            // Only update if the calculated time is different and makes sense
            // (should be >= 0)
            if (elapsedSinceStart >= 0 && elapsedSinceStart !== station.elapsedTime) {
              hasUpdates = true
              return {
                ...station,
                elapsedTime: elapsedSinceStart
              }
            }
          } else {
            console.warn(`Could not parse startTime for station ${station.id}: ${startTimeString}`)
          }
        } catch (error) {
          console.error(`Error recalculating elapsed time for station ${station.id}:`, error)
        }
      }

      return station
    })

    return { stations: updatedStations, hasUpdates }
  }

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const savedStations = await loadStations()

        // Simply load stations from database without creating defaults
        // Recalculate elapsed time for running timers
        const { stations: recalculatedStations, hasUpdates } = recalculateElapsedTime(savedStations)

        setStations(recalculatedStations)

        // If elapsed time was recalculated, save to database
        if (hasUpdates) {
          try {
            await saveStations(recalculatedStations)
          } catch (saveError) {
            console.error('Error saving recalculated elapsed time:', saveError)
          }
        }
      } catch (error) {
        if (error.status === 402) {
          setSubscriptionExpired({ expired: true, message: error.message })
          return
        }
        console.error('Error loading stations:', error)
        // Start with empty array - no default stations
        setStations([])
      }
    }

    fetchStations()

    // Load snacks on mount
    snacksAPI.getAll(true).then(setSnacksList).catch(err => console.error('Error loading snacks:', err))

    // Initialize pricing
    initPricing().catch(err => console.error('Error initializing pricing:', err))

    // Set up polling for paid events (check every 3 seconds)
    const checkPaidEvents = async () => {
      try {
        const since = new Date(lastPaidEventCheckRef.current).toISOString()
        const paidEvents = await paidEventsAPI.getRecent(since)

        if (paidEvents && paidEvents.length > 0) {
          for (const event of paidEvents) {
            const stationIds = event.stationIds || []
            const resetData = event.resetData || []

            if (stationIds.length > 0) {
              // Set flag to prevent interference
              isPaidResetRef.current = true

              // Reset stations based on paid event and save individually
              setStations((prev) => {
                const updated = prev.map((station) => {
                  if (stationIds.includes(station.id)) {
                    // Find the reset data for this station
                    const stationResetData = Array.isArray(resetData)
                      ? resetData.find(r => r.id === station.id)
                      : null

                    const resetStation = stationResetData ? {
                      id: station.id,
                      name: station.name,
                      gameType: station.gameType,
                      elapsedTime: stationResetData.elapsedTime || 0,
                      isRunning: stationResetData.isRunning || false,
                      isDone: stationResetData.isDone || false,
                      extraControllers: stationResetData.extraControllers || 0,
                      snacks: stationResetData.snacks || { cokeBottle: 0, cokeCan: 0 },
                      customerName: stationResetData.customerName || '',
                      startTime: stationResetData.startTime || null,
                      endTime: stationResetData.endTime || null,
                    } : {
                      id: station.id,
                      name: station.name,
                      gameType: station.gameType,
                      elapsedTime: 0,
                      isRunning: false,
                      isDone: false,
                      extraControllers: 0,
                      snacks: { cokeBottle: 0, cokeCan: 0 },
                      customerName: '',
                      startTime: null,
                      endTime: null,
                    }

                    // Save each station individually via PUT
                    stationsAPI.update(resetStation).catch(error => {
                      console.error(`❌ Error saving station ${station.id} from paid event:`, error)
                    })

                    return resetStation
                  }
                  return station
                })

                // Clear flag after a delay
                setTimeout(() => {
                  isPaidResetRef.current = false
                }, 300)

                return updated
              })
            }
          }
        }

        // Update last check time
        lastPaidEventCheckRef.current = getIndianTimestamp()
      } catch (error) {
        console.error('[Paid Events] Error checking paid events:', error)
      }
    }

    // OPTIMIZATION: Use WebSocket for real-time updates instead of polling
    // This eliminates 20 API requests per minute (3-second polling)
    import('./utils/websocket.js').then(({ connectWebSocket, disconnectWebSocket }) => {
      const handleWebSocketMessage = (data) => {
        if (data.type === 'paid_event') {
          // Removed verbose WebSocket event log

          // Process the paid event immediately (no polling delay!)
          const { stationIds, resetData } = data

          if (stationIds && stationIds.length > 0) {
            isPaidResetRef.current = true

            setStations(prev => {
              const updated = prev.map((station, index) => {
                if (stationIds.includes(station.id)) {
                  // Removed verbose WebSocket reset log

                  // resetData is an array, find the matching station data
                  const stationResetData = Array.isArray(resetData)
                    ? resetData.find(r => r.id === station.id)
                    : (resetData && resetData.id === station.id ? resetData : null)

                  const resetStation = stationResetData ? {
                    ...station,
                    ...stationResetData,
                    id: station.id,
                    name: station.name,
                    gameType: station.gameType
                  } : {
                    ...station,
                    elapsedTime: 0,
                    isRunning: false,
                    isDone: false,
                    isPaused: false,
                    pausedTime: 0,
                    extraControllers: 0,
                    snacks: { cokeBottle: 0, cokeCan: 0 },
                    snacksEnabled: false,
                    customerName: '',
                    startTime: null,
                    endTime: null,
                  }

                  // Add small delay to prevent connection pool exhaustion
                  setTimeout(() => {
                    stationsAPI.update(resetStation).catch(error => {
                      console.error(`❌ Error saving station ${station.id} from WebSocket event:`, error)
                    })
                  }, 100 * index) // Stagger requests by 100ms each

                  return resetStation
                }
                return station
              })

              setTimeout(() => {
                isPaidResetRef.current = false
              }, 300)

              return updated
            })
          }
        }
      }

      // Connect to WebSocket server
      connectWebSocket(handleWebSocketMessage)
      // Removed verbose WebSocket enabled log

      // Cleanup on unmount
      return () => {
        disconnectWebSocket()
      }
    }).catch(error => {
      console.warn('[WebSocket] Failed to load WebSocket client, falling back to polling:', error)

      // Fallback to polling if WebSocket fails
      checkPaidEvents()
      paidEventCheckIntervalRef.current = setInterval(checkPaidEvents, 3000)

      return () => {
        if (paidEventCheckIntervalRef.current) {
          clearInterval(paidEventCheckIntervalRef.current)
          paidEventCheckIntervalRef.current = null
        }
      }
    })
  }, [isAuthenticated, shopId])

  // Fetch subscription info when authenticated or shopId changes
  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      if (!isAuthenticated || !shopId) return;

      try {
        const info = await subscriptionAPI.getInfo(shopId)
        if (info) {
          setSubscriptionInfo(info)
        }
      } catch (error) {
        console.error('Error fetching subscription info:', error)
      }
    }

    fetchSubscriptionInfo()
  }, [isAuthenticated, shopId])

  // Update IST time display every second
  useEffect(() => {
    const updateIstTime = async () => {
      try {
        // Try to get server time first (most accurate)
        const serverTime = await timeAPI.getServerTime()
        // Server returns time in 24-hour format (e.g., "20:03:46")
        setIstTime(serverTime.timeString)

        // Format date using the dateString from server
        const dateParts = serverTime.dateString.split('-')
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
        setIstDate(formatIndianDate(date, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }))
      } catch (error) {
        console.warn('Failed to get server time, using client IST:', error)
        // Fallback to client time using IST utilities in 24-hour format
        const now = new Date()
        const formatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false // Use 24-hour format
        })
        setIstTime(formatter.format(now))
        setIstDate(formatIndianDate(now, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }))
      }
    }

    // Update immediately
    updateIstTime()

    // Update every second
    const interval = setInterval(updateIstTime, 1000)

    return () => clearInterval(interval)
  }, [])

  // CRITICAL FIX: Handle Page Visibility API at App level to reload stations after long idle
  // This complements the StationCard-level fix and ensures UI state is fresh after extended idle
  useEffect(() => {
    let lastVisibilityChange = Date.now()

    const handleAppVisibilityChange = async () => {
      // When page becomes visible again after being hidden
      if (!document.hidden) {
        const idleDuration = Date.now() - lastVisibilityChange
        const idleMinutes = Math.floor(idleDuration / 60000)

        // If idle for more than 5 minutes, reload stations from database
        if (idleMinutes >= 5) {
          console.log(`[App] 🔄 Tab was idle for ${idleMinutes} minutes - reloading stations...`)

          try {
            // Reload stations from database to ensure UI is in sync
            const reloadedStations = await loadStations()

            if (reloadedStations && reloadedStations.length > 0) {
              // Recalculate elapsed time for running timers
              const { stations: freshStations, hasUpdates } = recalculateElapsedTime(reloadedStations)
              setStations(freshStations)

              // Save recalculated values if needed
              if (hasUpdates) {
                try {
                  await saveStations(freshStations)
                } catch (saveError) {
                  console.error('[App] Error saving recalculated times after visibility change:', saveError)
                }
              }

              console.log(`[App] ✅ Stations reloaded successfully after ${idleMinutes} min idle`)
            }
          } catch (error) {
            console.error('[App] Error reloading stations after visibility change:', error)
          }
        }

        // Update last visibility change time
        lastVisibilityChange = Date.now()
      } else {
        // Page became hidden - record the time
        lastVisibilityChange = Date.now()
      }
    }

    // Add event listener
    document.addEventListener('visibilitychange', handleAppVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleAppVisibilityChange)
    }
  }, [])

  // OPTIMIZATION: Save all running timers to database when user closes browser/tab
  // This ensures no data is lost even if the 5-minute backup hasn't occurred yet
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      // Get all running timers
      const runningTimers = stations.filter(s => s.isRunning && !s.isDone)

      if (runningTimers.length > 0) {
        // Save each running timer to database
        const savePromises = runningTimers.map(station =>
          stationsAPI.update({
            id: station.id,
            elapsedTime: station.elapsedTime,
            isRunning: station.isRunning,
            isPaused: station.isPaused,
            pausedTime: station.pausedTime,
            startTime: station.startTime,
            endTime: station.endTime
          }).catch(err => {
            console.error(`[beforeunload] Failed to save station ${station.id}:`, err)
          })
        )

        // Wait for all saves to complete (browsers give us a few seconds)
        try {
          await Promise.all(savePromises)
        } catch (error) {
          console.error('[beforeunload] Error saving timers:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [stations])

  // Removed bulk save logic - each station saves individually via PUT requests
  const isPaidResetRef = useRef(false) // Flag to prevent useEffect from overwriting paid reset
  const lastPaidEventCheckRef = useRef(getIndianTimestamp()) // Track last paid event check time
  const paidEventCheckIntervalRef = useRef(null) // Interval for checking paid events

  const handleStationUpdate = (updatedStation) => {
    // Simply update the station in state
    // Individual station saves are handled by PUT requests in StationCard component
    setStations((prev) => {
      return prev.map((s) => (s.id === updatedStation.id ? updatedStation : s))
    })
  }

  const handleInvoicePaid = async (invoiceStations, sendSMS = false) => {
    // Save invoice to database ONLY when "Mark as Paid" is clicked
    // This prevents duplicate saves on refresh or close
    if (invoice && !invoice._saved) {
      try {
        await invoicesAPI.create({
          stations: invoice.stations,
          subtotal: invoice.subtotal,
          discount: invoice.discount,
          total: invoice.total
        })

        // Mark invoice as saved to prevent duplicate saves
        invoice._saved = true
      } catch (error) {
        console.error('Failed to save invoice to database:', error)
        alert('Failed to save invoice. Please check your connection and try again.')
        return // Stop the reset process if saving fails
      }
    }


    // Reset all stations that were in the invoice to their initial state
    // This clears completed sessions and resets stations completely

    // Send invoice via SMS in background (non-blocking)
    // Use invoiceStations parameter instead of invoice state (which might be stale)
    const customerPhone = invoiceStations?.[0]?.customerPhone
    const invoiceNumber = invoiceStations?.[0]?.invoiceNumber || invoice?.invoiceNumber || `PAID-${getIndianTimestamp()}`

    // COMMENTED OUT: All SMS messaging functionality

    // Set flag to prevent useEffect from overwriting this reset
    isPaidResetRef.current = true

    // Use functional setState to ensure we get the latest state
    let updatedStations = null

    // Reset stations in state
    setStations((prev) => {
      updatedStations = prev.map((station) => {
        const invoiceStation = invoiceStations.find((is) => is.id === station.id)
        if (invoiceStation) {
          // Reset this station completely to initial state
          // This clears it from "Completed Sessions" (isDone: false, elapsedTime: 0)
          // and from "Active Sessions" (isRunning: false)
          // Create a clean reset object with only the properties we want
          const resetStation = {
            id: station.id,
            name: station.name,
            gameType: station.gameType,
            elapsedTime: 0, // Explicitly set to 0
            isRunning: false, // Explicitly set to false
            isDone: false, // Explicitly set to false - Clear completed session status
            isPaused: false, // Explicitly set to false
            pausedTime: 0, // Explicitly reset pausedTime to 0
            extraControllers: 0, // Explicitly set to 0
            snacks: { cokeBottle: 0, cokeCan: 0 }, // Explicitly reset snacks
            snacksEnabled: false, // Reset snacks purchased checkbox
            customerName: '', // Explicitly set to empty string
            startTime: null, // Explicitly set to null
            endTime: null, // Explicitly set to null
          }

          return resetStation
        }
        return station
      })


      return updatedStations
    })

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 10))

    // Save each reset station individually via PUT request
    try {
      if (updatedStations) {
        const resetStationIds = invoiceStations.map(s => s.id)
        const stationsToSave = updatedStations.filter(s => resetStationIds.includes(s.id))

        // Save each station individually via PUT
        await Promise.all(
          stationsToSave.map(station =>
            stationsAPI.update({
              id: station.id,
              elapsedTime: station.elapsedTime,
              isRunning: station.isRunning,
              isDone: station.isDone,
              isPaused: station.isPaused,
              pausedTime: station.pausedTime,
              extraControllers: station.extraControllers,
              snacks: station.snacks,
              snacksEnabled: station.snacksEnabled,
              customerName: station.customerName,
              startTime: station.startTime,
              endTime: station.endTime
            }).catch(error => {
              console.error(`❌ Error saving station ${station.id}:`, error)
            })
          )
        )

        // Save paid event to intermediate table for multi-browser sync
        try {
          const resetData = updatedStations
            .filter(s => resetStationIds.includes(s.id))
            .map(s => ({
              id: s.id,
              name: s.name,
              elapsedTime: s.elapsedTime,
              isRunning: s.isRunning,
              isDone: s.isDone,
              isPaused: s.isPaused,
              pausedTime: s.pausedTime,
              extraControllers: s.extraControllers,
              snacks: s.snacks,
              snacksEnabled: s.snacksEnabled,
              customerName: s.customerName,
              startTime: s.startTime,
              endTime: s.endTime
            }))

          // Try to get invoice number from invoiceStations or generate one
          const invoiceNumber = invoiceStations[0]?.invoiceNumber || invoice?.invoiceNumber || `PAID-${getIndianTimestamp()}`
          await paidEventsAPI.create(invoiceNumber, resetStationIds, resetData)
        } catch (paidEventError) {
          console.error('❌ Error saving paid event (non-critical):', paidEventError)
          // Don't fail the whole operation if paid event save fails
        }

        // Reload stations from database to ensure UI is in sync
        try {
          const reloadedStations = await loadStations()
          if (reloadedStations && reloadedStations.length > 0) {
            // Update state with reloaded stations to ensure UI reflects database
            setStations(reloadedStations)

            // Verify each reset station
            reloadedStations
              .filter(s => resetStationIds.includes(s.id))
              .forEach(s => {
                if (s.isDone || s.elapsedTime > 0 || s.isRunning) {
                  console.error(`❌ Station ${s.name} (ID: ${s.id}) was NOT properly reset:`, {
                    isDone: s.isDone,
                    elapsedTime: s.elapsedTime,
                    isRunning: s.isRunning,
                    customerName: s.customerName,
                    startTime: s.startTime
                  })
                }
              })
          }
        } catch (reloadError) {
          console.error('Error reloading stations after reset:', reloadError)
        }

        // Clear the flag after a delay
        setTimeout(() => {
          isPaidResetRef.current = false
        }, 300)
      } else {
        console.error('❌ No updated stations to save')
        isPaidResetRef.current = false
      }
    } catch (error) {
      console.error('❌ Error saving reset stations to database:', error)
      isPaidResetRef.current = false
      // Still update local state even if save fails
    }
  }

  const handleStationDelete = (stationId) => {
    // Prevent deletion of default 7 game slots (IDs 1-7)
    if (stationId >= 1 && stationId <= 7) {
      alert('Cannot delete default game slots. These are required for the gaming zone.')
      return
    }
    setStations((prev) => prev.filter((s) => s.id !== stationId))
  }

  const handleAddStation = (gameType = GAME_TYPES.PLAYSTATION) => {
    const newId = Math.max(...stations.map((s) => s.id), 0) + 1
    const existingCount = stations.filter(s => s.gameType === gameType).length

    let name
    if (gameType === GAME_TYPES.PLAYSTATION) {
      name = `Playstation ${existingCount + 1}`
    } else if (gameType === GAME_TYPES.STEERING_WHEEL) {
      name = `Steering Wheel ${existingCount + 1}`
    } else {
      name = `System Game ${existingCount + 1}`
    }

    const newStation = {
      id: newId,
      name,
      gameType,
      elapsedTime: 0,
      isRunning: false,
      extraControllers: 0,
      snacks: { cokeBottle: 0, cokeCan: 0 },
      customerName: '',
    }
    setStations((prev) => [...prev, newStation])
  }

  const handleResetAll = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to reset all?')
    if (!confirmed) {
      return // User cancelled, don't reset
    }

    try {
      // Reset all stations to initial state
      const resetStations = stations.map((station) => {
        return {
          ...station,
          elapsedTime: 0,
          isRunning: false,
          isDone: false,
          isPaused: false,
          pausedTime: 0,
          pauseStartTime: null,
          extraControllers: 0,
          snacks: { cokeBottle: 0, cokeCan: 0 },
          snacksEnabled: false,
          customerName: '',
          customerPhone: '',
          startTime: null,
          endTime: null,
        }
      })

      // Update UI immediately
      setStations(resetStations)

      // Save all stations to database SEQUENTIALLY with delays to prevent race conditions
      // This ensures each station is properly reset without overwhelming the server
      const errors = []

      for (const station of resetStations) {
        try {
          await stationsAPI.update({
            id: station.id,
            elapsedTime: 0,
            isRunning: false,
            isDone: false,
            isPaused: false,
            pausedTime: 0,
            pauseStartTime: null,
            extraControllers: 0,
            snacks: { cokeBottle: 0, cokeCan: 0 },
            snacksEnabled: false,
            customerName: '',
            customerPhone: '',
            startTime: null,
            endTime: null,
          })

          // Small delay between requests to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`[Reset All] Error resetting station ${station.id} (${station.name}):`, error)
          errors.push({ error: true, stationId: station.id, errorDetails: error })
        }
      }

      // Check for any errors
      if (errors.length > 0) {
        console.error(`[Reset All] ${errors.length} station(s) failed to reset:`, errors)
        alert(`Warning: ${errors.length} station(s) may not have been reset properly. Please check the console for details.`)
      } else {
        playAlarm('All stations reset', false)
      }

      // Reload stations from database to ensure UI reflects database state
      try {
        const reloadedStations = await loadStations()
        if (reloadedStations && reloadedStations.length > 0) {
          setStations(reloadedStations)
        }
      } catch (reloadError) {
        console.error('[Reset All] Error reloading stations:', reloadError)
      }

    } catch (error) {
      console.error('[Reset All] ❌ Error resetting all stations:', error)
      alert('Error resetting stations. Please try again.')
    }
  }

  // Transfer Session Handlers


  const handleConfirmTransfer = async (fromId, toId) => {
    try {
      // OPTIMISTIC UPDATE: Reset source station immediately to ensure UI responsiveness
      setStations(prev => prev.map(s => {
        if (s.id === fromId) {
          return {
            ...s,
            isRunning: false,
            elapsedTime: 0,
            startTime: null,
            endTime: null,
            isPaused: false,
            pausedTime: 0,
            extraControllers: 0,
            snacks: { cokeBottle: 0, cokeCan: 0 },
            snacksEnabled: false,
            customerName: '',
            customerPhone: '',
            isDone: false
          }
        }
        return s
      }))

      await stationsAPI.transfer(fromId, toId)

      // Wait briefly to ensure database transaction is fully committed and visible
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reload stations to reflect changes
      const reloadedStations = await loadStations()
      if (reloadedStations && reloadedStations.length > 0) {
        // Recalculate elapsed time for the newly running target station
        const { stations: freshStations } = recalculateElapsedTime(reloadedStations)
        setStations(freshStations)
      }

      playAlarm('Session transferred successfully', false)
    } catch (error) {
      console.error('Error confirming transfer:', error)
      alert(error.message || 'Transfer failed')

      // Reload stations to ensure UI state matches database (reverting optimistic update if needed)
      try {
        const reloaded = await loadStations()
        if (reloaded) {
          const { stations: fresh } = recalculateElapsedTime(reloaded)
          setStations(fresh)
        }
      } catch (reloadError) {
        console.error('Failed to reload stations after transfer error:', reloadError)
      }

      throw error // Re-throw for modal to handle
    }
  }


  const handleGenerateInvoice = async (invoiceStations, total, discount = 0, subtotalFromBilling = null) => {
    const invoiceNumber = `INV-${getIndianTimestamp()}`
    // Use subtotal from BillingPanel if provided to ensure exact match
    // Otherwise recalculate (fallback for backward compatibility)
    let subtotal = subtotalFromBilling
    if (subtotal === null || subtotal === undefined) {
      // Recalculate subtotal if not provided (fallback)
      // IMPORTANT: Use the same snacksList that was used in BillingPanel to ensure consistency
      subtotal = invoiceStations.reduce((sum, station) => {
        const elapsed = station.elapsedTime || 0
        const gameType = station.gameType || GAME_TYPES.PLAYSTATION
        // Use station.snacks which may include billing snacks if snacksEnabled
        // Use snacksDetails (snacksList) from station if available, otherwise use global snacksList
        const snacksListForCalculation = station.snacksDetails || snacksList
        return sum + calculateCost(
          elapsed,
          gameType,
          station.extraControllers || 0,
          station.snacks || {},
          snacksListForCalculation && snacksListForCalculation.length > 0 ? snacksListForCalculation : null
        )
      }, 0)
    }

    // Ensure discount/adjustment is a number
    // Negative values = discount, Positive values = price increase
    const adjustmentAmount = parseFloat(discount) || 0
    // Calculate expected total: subtotal + adjustmentAmount
    // Negative adjustment reduces total, positive adjustment increases total
    const expectedTotal = Math.max(0, subtotal + adjustmentAmount)
    // Use the total from BillingPanel if it matches expected, otherwise use expected
    // This ensures consistency while allowing for any rounding differences
    const finalTotal = Math.abs(total - expectedTotal) < 0.01 ? total : expectedTotal

    // Debug logging to help identify calculation discrepancies
    if (Math.abs(total - expectedTotal) >= 0.01) {
      console.warn('[Invoice] Calculation discrepancy detected:', {
        totalFromBilling: total,
        expectedTotal,
        subtotal,
        adjustment: adjustmentAmount,
        difference: Math.abs(total - expectedTotal)
      })
    }

    const invoice = {
      invoiceNumber,
      stations: invoiceStations,
      subtotal,
      discount: adjustmentAmount, // Can be negative (discount) or positive (increase)
      total: finalTotal,
      date: getIndianTimeISO(),
      _saved: false // Track if invoice has been saved to database
    }

    // Don't save to database yet - only save when "Mark as Paid" is clicked
    // This prevents duplicate saves on refresh or close

    setInvoice(invoice)
  }

  const getCurrentDateAndDay = () => {
    // Always use IST for date/time display
    const istNow = getIndianTime()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const dayName = days[istNow.getDay()]
    const date = istNow.getDate()
    const month = months[istNow.getMonth()]
    const year = istNow.getFullYear()

    return {
      day: dayName,
      date: `${month} ${date}, ${year}`
    }
  }

  const { day, date } = getCurrentDateAndDay()

  const activeStations = stations.filter(s => s.isRunning).length

  // Fetch today's revenue from invoices using the Daily Revenue API
  useEffect(() => {
    const fetchTodayRevenue = async () => {
      try {
        // Get today's date in YYYY-MM-DD format (IST)
        const today = getIndianDateString()

        // Use the Daily Revenue API which has proper timezone handling
        const data = await reportsAPI.getDailyRevenue(today)

        // Extract total revenue from the API response
        const revenue = parseFloat(data.summary?.totalRevenue || 0)

        setTodayRevenue(revenue)
      } catch (error) {
        console.error('Error fetching today\'s revenue:', error)
        setTodayRevenue(0)
      }
    }

    fetchTodayRevenue()

    // Refresh revenue every 30 seconds
    const interval = setInterval(fetchTodayRevenue, 30000)
    return () => clearInterval(interval)
  }, [invoice]) // Re-fetch when invoice changes (new invoice created)

  // Check authentication on mount and fetch shop info
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await import('./utils/api').then(m => m.authAPI.checkAuth())
        if (response.authenticated) {
          setIsAuthenticated(true)
          setUserRole(response.user.role)
          setShopId(response.user.shopId)
          setOriginalShopId(response.user.shopId)

          // Fetch all shops if Super Admin
          if (response.user.role === 'SUPER_ADMIN') {
            try {
              const shopsResponse = await fetch('/api/admin?action=shops', {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
              const shops = await shopsResponse.json()
              setAvailableShops(shops)

              // Set first shop as default if Super Admin has no shop
              if (!response.user.shopId && shops.length > 0) {
                setShopId(shops[0].id)
                setShopName(shops[0].name)
                setUpiId(shops[0].upi_id || '')
              }
            } catch (error) {
              console.error('Error fetching shops:', error)
            }
          }

          // Fetch shop name if user has a shop
          if (response.user.shopId) {
            try {
              const shopResponse = await fetch(`/api/admin?action=getShop&shopId=${response.user.shopId}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
              const shopData = await shopResponse.json()
              if (shopData.shop) {
                setShopName(shopData.shop.shop_name || `Shop #${response.user.shopId}`)
                setUpiId(shopData.shop.upi_id || '')
              }
            } catch (error) {
              console.error('Error fetching shop name:', error)
              setShopName(`Shop #${response.user.shopId}`)
            }

            // Fetch Subscription Info
            try {
              const subData = await subscriptionAPI.getStatus();
              if (subData && subData.subscription) {
                const endDate = new Date(subData.subscription.end_date);
                const now = new Date();
                const diffTime = endDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setSubscriptionInfo({ daysRemaining: diffDays, planName: subData.subscription.plan_name });
              }
            } catch (err) {
              console.warn('Failed to fetch subscription info', err);
            }
          }
        } else {
          setIsAuthenticated(false)
          setUserRole(null)
          setShopName('')
          setShopId(null)
          setOriginalShopId(null)
          setAvailableShops([])
        }
      } catch (error) {
        if (error.status === 402) {
          setSubscriptionExpired({ expired: true, message: error.message })
        }
        console.error('Auth check error:', error)
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  // Handle login
  const handleLogin = async (data) => {
    setIsAuthenticated(true)
    setUserRole(data.user.role)
    setShopId(data.user.shopId)

    // Fetch shop name after login
    if (data.user.shopId) {
      try {
        const shopResponse = await fetch(`/api/admin?action=getShop&shopId=${data.user.shopId}`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        })
        const shopData = await shopResponse.json()
        if (shopData.shop) {
          setShopName(shopData.shop.shop_name || `Shop #${data.user.shopId}`)
          setUpiId(shopData.shop.upi_id || '')
        }
      } catch (error) {
        console.error('Error fetching shop name:', error)
        setShopName(`Shop #${data.user.shopId}`)
      }
    }
  }

  // Handle shop change (for Super Admin)
  const handleShopChange = async (newShopId) => {
    const selectedShop = availableShops.find(shop => shop.id === parseInt(newShopId))
    if (!selectedShop) return;

    try {
      const token = localStorage.getItem('token');

      // Get temporary shop token
      const res = await fetch('/api/admin?action=get-shop-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shopId: selectedShop.id })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
      }
    } catch (error) {
      console.error('Error getting shop token:', error);
      return;
    }

    // Update shop info
    setShopId(selectedShop.id)
    setShopName(selectedShop.name)
    setUpiId(selectedShop.upi_id || '')

    // Reset all UI state to default (like fresh login)
    setShowPricingConfig(false)
    setShowSnacksConfig(false)
    setShowBonusConfig(false)
    setShowChangePassword(false)
    setShowManageStations(false)
    setActiveReport(null)
    setShowDashboard(true)
    setSidebarOpen(false)
    setReportsMenuOpen(false)
    setAddSystemsMenuOpen(false)
    setInvoice(null)

    // Complete reload of all shop data (like a fresh login)
    try {
      // Reset all state
      setStations([])
      setSnacksList([])
      setTodayRevenue(0)
      setSubscriptionInfo(null)

      // Reload stations
      const reloadedStations = await loadStations()
      if (reloadedStations && reloadedStations.length > 0) {
        setStations(reloadedStations)
      }

      // Reload snacks
      const reloadedSnacks = await snacksAPI.getAll(true)
      setSnacksList(reloadedSnacks)

      // Reload pricing and bonus config
      await initPricing()

      // Reload subscription info
      const info = await subscriptionAPI.getInfo(selectedShop.id)
      if (info) {
        setSubscriptionInfo(info)
      }

      // Reload today's revenue
      const today = new Date().toISOString().split('T')[0]
      const revenueData = await reportsAPI.getDailyRevenue(today)
      if (revenueData && revenueData.totalRevenue) {
        setTodayRevenue(revenueData.totalRevenue)
      }
    } catch (error) {
      console.error('Error reloading data for new shop:', error)
    }
  }

  // Handle Super Admin managing a shop
  const handleManageShop = async (shop) => {
    // If Super Admin, request a temporary token with shopId
    if (userRole === 'SUPER_ADMIN') {
      try {
        const token = localStorage.getItem('token');

        // Get temporary shop token
        const res = await fetch('/api/admin?action=get-shop-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ shopId: shop.id })
        });

        if (res.ok) {
          const data = await res.json();
          // Store the temporary token
          localStorage.setItem('token', data.token);
        }

        // Fetch all shops for the dropdown
        const shopsRes = await fetch('/api/admin?action=shops', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (shopsRes.ok) {
          const shopsData = await shopsRes.json();
          // API returns array directly, not { shops: [...] }
          setAvailableShops(Array.isArray(shopsData) ? shopsData : []);
        }
      } catch (error) {
        console.error('Error getting shop token:', error);
      }
    }

    setShopId(shop.id)
    setShopName(shop.name)
    setUpiId(shop.upi_id || '')
    setViewingShopDashboard(true)

    // Load shop data
    try {
      const reloadedStations = await loadStations()
      if (reloadedStations && reloadedStations.length > 0) {
        setStations(reloadedStations)
      } else {
        setStations([])
      }

      const reloadedSnacks = await snacksAPI.getAll(true)
      setSnacksList(reloadedSnacks)
    } catch (error) {
      console.error('Error loading shop data:', error)
      setStations([])
    }
  }

  // Handle Super Admin returning to Admin Dashboard
  const handleBackToAdminDashboard = async () => {
    // If Super Admin, request a new token without shopId
    if (userRole === 'SUPER_ADMIN') {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/admin?action=get-shop-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ shopId: null })
        });

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('token', data.token);
        }
      } catch (error) {
        console.error('Error restoring admin token:', error);
      }
    }

    setViewingShopDashboard(false)
    setShopId(originalShopId)
    setShopId(originalShopId)
    setShopName('')
    setUpiId('')
    setStations([])
  }

  const handleRenewSubscription = async () => {
    try {
      const confirmed = window.confirm("Your subscription will be renewed for 30 days. Proceed with payment?");
      if (!confirmed) return;

      const data = await subscriptionAPI.renew('MONTHLY');

      if (data.success) {
        alert("Payment Successful! Your subscription has been activated.");
        setSubscriptionExpired({ expired: false, message: '' });
        window.location.reload();
      } else {
        alert("Renewal Failed: " + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert("Payment Error: " + e.message);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth?action=logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setUserRole(null)
    setShopName('')
    setShopId(null)
    setOriginalShopId(null)
    setAvailableShops([])
    setViewingShopDashboard(false)
  }

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <SubscriptionProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </SubscriptionProvider>
    )
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <SubscriptionProvider>
        <Login onLogin={handleLogin} />
      </SubscriptionProvider>
    )
  }

  // Show Subscription Expired Message
  if (subscriptionExpired.expired) {
    return (
      <SubscriptionProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Subscription Expired</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {subscriptionExpired.message || 'Your subscription plan has expired. Please make a payment to continue using the service.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRenewSubscription}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium py-3 px-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Renew Subscription
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200"
              >
                Check Status Again
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200"
              >
                Logout
              </button>
            </div>
            <p className="mt-6 text-xs text-gray-400">
              Contact support if you believe this is an error.
            </p>
          </div>
        </div>
      </SubscriptionProvider>
    )
  }

  // Show Super Admin Dashboard (unless viewing a shop)
  if (userRole === 'SUPER_ADMIN' && !viewingShopDashboard) {
    return (
      <SubscriptionProvider>
        <AdminDashboard onLogout={handleLogout} onManageShop={handleManageShop} />
      </SubscriptionProvider>
    )
  }

  return (
    <SubscriptionProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Left Sidebar - Professional Design - Hidden by default, toggle to open */}
        <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 ease-in-out shadow-lg ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          <div className="flex flex-col h-full">
            {/* Sidebar Header with Logo */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
              {/* Logo at Top */}
              <div className="mb-6 flex justify-center">
                <Logo showText={true} textSize="text-xl sm:text-2xl" className="flex-col items-center" shopName={shopName || 'GAMERS SPOT'} />
              </div>

              {/* Shop Selector for Super Admin */}
              {userRole === 'SUPER_ADMIN' && availableShops.length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                    Select Shop
                  </label>
                  <select
                    value={shopId || ''}
                    onChange={(e) => handleShopChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    {availableShops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name} (ID: {shop.id})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-500 italic">
                    Viewing: <span className="font-semibold text-blue-600">{shopName}</span>
                  </p>
                </div>
              )}

              {/* Navigation Title */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Navigation
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-3 pt-6 space-y-1 overflow-y-auto">
              {/* Dashboard - First Menu Item */}
              <button
                onClick={() => {
                  setShowDashboard(true)
                  setActiveReport(null)
                  setSidebarOpen(false)
                }}
                className={`w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all flex items-center gap-3 ${showDashboard && !activeReport
                  ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Dashboard</span>
              </button>

              {/* Pricing Menu */}
              <button
                onClick={() => {
                  setShowPricingConfig(true)
                  setActiveReport(null)
                  setShowDashboard(true)
                  setSidebarOpen(false)
                }}
                className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Pricing</span>
              </button>

              {/* Add New Systems Menu with Sub-options (HIDDEN)
            <div>
              <button onClick={() => { setAddSystemsMenuOpen(!addSystemsMenuOpen); setShowDashboard(true); setActiveReport(null); }} className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add New Systems</span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${addSystemsMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {addSystemsMenuOpen && (
                <div className="mt-1 ml-7 space-y-0.5">
                  <button onClick={() => { handleAddStation(GAME_TYPES.PLAYSTATION); setSidebarOpen(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>Playstation</span>
                  </button>
                  <button onClick={() => { handleAddStation(GAME_TYPES.STEERING_WHEEL); setSidebarOpen(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    <span>Wheel Station</span>
                  </button>
                  <button onClick={() => { handleAddStation(GAME_TYPES.SYSTEM); setSidebarOpen(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                    <span>System Station</span>
                  </button>
                </div>
              )}
            </div>
            */}

              {/* Snacks Menu */}
              <button
                onClick={() => {
                  setShowSnacksConfig(true)
                  setActiveReport(null)
                  setShowDashboard(true)
                  setSidebarOpen(false)
                }}
                className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <span>Snacks</span>
              </button>

              {/* Manage Stations Menu */}
              <button
                onClick={() => {
                  setShowManageStations(true)
                  setActiveReport(null)
                  setShowDashboard(true)
                  setSidebarOpen(false)
                }}
                className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span>Manage Stations</span>
              </button>

              {/* Reports Menu with Sub-options */}
              <div>
                <button onClick={() => setReportsMenuOpen(!reportsMenuOpen)} className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Reports</span>
                  </div>
                  <svg className={`w-4 h-4 transition-transform ${reportsMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {reportsMenuOpen && (
                  <div className="mt-1 ml-7 space-y-0.5">
                    <button onClick={() => { setActiveReport('usage'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>System Usage</span>
                    </button>
                    <button onClick={() => { setActiveReport('daily-revenue'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>Daily Revenue</span>
                    </button>
                    <button onClick={() => { setActiveReport('monthly-revenue'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>Monthly Revenue</span>
                    </button>
                    <button onClick={() => { setActiveReport('customer-report'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>Customer Report</span>
                    </button>
                    <button onClick={() => { setActiveReport('snacks-report'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>Snacks Report</span>
                    </button>
                    <button onClick={() => { setActiveReport('transfer-stations'); setShowDashboard(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>Transfer Stations</span>
                    </button>
                    <button onClick={() => { setShowBonusConfig(true); setActiveReport(null); setShowDashboard(true); setSidebarOpen(false); }} className="w-full px-4 py-2 rounded-md text-xs font-medium transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Bonus Time Config</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-200">
              {/* Back to Admin Dashboard button for Super Admin */}
              {userRole === 'SUPER_ADMIN' && viewingShopDashboard && (
                <button
                  onClick={handleBackToAdminDashboard}
                  className="w-full px-4 py-3 mb-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-all flex items-center justify-center gap-2 border border-blue-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Admin</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-all flex items-center justify-center gap-2 border border-red-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>

              {/* User Info */}
              <div className="mt-3 text-center text-xs text-gray-500">
                Logged in as: <span className="font-medium text-gray-700">{localStorage.getItem('username') || 'Admin'}</span>
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-center">
                <Logo showText={true} textSize="text-xs" className="flex-col items-center" shopName={shopName || 'GAMERS SPOT'} />
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar Overlay (Mobile) - Only show when sidebar is open and no report is active */}
        {sidebarOpen && !activeReport && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <header className={`sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'
          } ${activeReport ? 'hidden' : ''}`}>
          <div className="container mx-auto px-4 sm:px-6 py-3">
            <div className="flex justify-between items-center gap-4">
              {/* Left: Hamburger Menu */}
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-md hover:bg-gray-100"
                  aria-label="Open menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              {/* Center: Welcome Message */}
              <div className="flex-1 flex flex-col justify-center items-center gap-2">

                <h1
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-center italic"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #6366f1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    textShadow: '0 2px 10px rgba(139, 92, 246, 0.3)',
                    letterSpacing: '-0.02em',
                    fontStyle: 'italic'
                  }}
                >
                  Welcome to {shopName || 'Gamers Spot'} Control Center
                </h1>
                <p
                  className="text-xs sm:text-sm text-gray-600 text-center italic"
                  style={{
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: '#6b7280',
                    letterSpacing: '0.01em',
                    lineHeight: '1.5',
                    fontStyle: 'italic'
                  }}
                >
                  Monitor sessions, manage stations, and generate invoices seamlessly.
                </p>
                {/* Subscription Status Badge */}
                <div className="mt-2">
                  <SubscriptionStatusBadge />
                </div>
              </div>

              {/* Right: Time Display */}
              <div className="text-right bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">{istTime || getIndianTimeString()}</div>
                <div className="text-xs text-gray-600 font-medium">{istDate || formatIndianDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 font-medium">IST (Asia/Kolkata)</div>
              </div>
            </div>
          </div>
        </header>

        <main className={`container mx-auto px-4 sm:px-6 py-4 sm:py-6 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'
          } ${!showDashboard && activeReport ? 'hidden' : ''}`}>
          {/* Dashboard Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-xs font-medium mb-2 uppercase tracking-wider">Active Sessions</p>
              <p className="text-2xl font-semibold text-gray-900">{activeStations}</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-xs font-medium mb-2 uppercase tracking-wider">Completed Sessions</p>
              <p className="text-2xl font-semibold text-gray-900">{stations.filter(s => s.isDone === true && (s.elapsedTime || 0) > 0).length}</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-xs font-medium mb-2 uppercase tracking-wider">Total Stations</p>
              <p className="text-2xl font-semibold text-gray-900">{stations.length}</p>
            </div>

            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-600 text-xs font-medium uppercase tracking-wider">Revenue</p>
                <button
                  onClick={() => setShowRevenue(!showRevenue)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                  title={showRevenue ? 'Hide revenue' : 'Show revenue'}
                >
                  {showRevenue ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L3 3m3.29 3.29L3 3m6.29 6.29l3.29 3.29m0 0L9.29 9.29m3.29 3.29L9.29 9.29m6.29 6.29l3.29 3.29M12 12l3.29 3.29m0 0L12 12m3.29 3.29L12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-2xl font-semibold text-gray-900">
                {showRevenue ? `₹${todayRevenue.toFixed(2)}` : '₹****'}
              </p>
            </div>
          </div>

          {/* Stats and Reset All Button */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 text-sm font-medium flex-wrap text-gray-600">
              <span>Playstation: <span className="text-gray-900">{stations.filter(s => s.gameType === GAME_TYPES.PLAYSTATION).length}</span></span>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span>Wheel: <span className="text-gray-900">{stations.filter(s => s.gameType === GAME_TYPES.STEERING_WHEEL).length}</span></span>
              <span className="text-gray-300 hidden sm:inline">|</span>
              <span>System: <span className="text-gray-900">{stations.filter(s => s.gameType === GAME_TYPES.SYSTEM).length}</span></span>
            </div>
            <div className="flex gap-2 flex-wrap w-full sm:w-auto items-center">
              {subscriptionInfo && (
                <div className="flex items-center gap-3 animate-fadeIn mr-2">
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${subscriptionInfo.daysRemaining <= 5 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
                    subscriptionInfo.daysRemaining <= 10 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-green-50 text-green-700 border-green-200'
                    }`}>
                    <span className="hidden sm:inline">{subscriptionInfo.plan_name === 'TRIAL' ? 'Trial' : 'Plan'} expires in </span>{subscriptionInfo.daysRemaining} days
                  </span>
                  {subscriptionInfo.daysRemaining <= 7 && (
                    <button
                      onClick={handleRenewSubscription}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors border border-indigo-600 hover:border-indigo-700 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Renew
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={handleResetAll}
                className="px-4 py-2 bg-white text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm transition-all border border-gray-300 hover:border-gray-400 flex items-center gap-2 shadow-sm"
                title="Reset all timers"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset All</span>
              </button>
            </div>
          </div>

          {/* Main Content Grid: Station Cards + Billing Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Station Cards Section - Takes 3 columns on large screens */}
            <div className="lg:col-span-3 order-2 lg:order-1">
              {/* Responsive Station Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {stations.map((station) => (
                  <StationCard
                    key={station.id}
                    station={station}
                    onUpdate={handleStationUpdate}
                    onDelete={handleStationDelete}
                    snacksList={snacksList}
                    allStations={stations}

                  />
                ))}
              </div>

              {/* Empty State */}
              {stations.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-sm font-semibold">No stations yet. Add one to get started.</p>
                </div>
              )}
            </div>

            {/* Billing Panel - Takes 1 column on large screens, full width on mobile */}
            <div className="lg:col-span-1 order-1 lg:order-2">
              <BillingPanel
                stations={stations}
                onGenerateInvoice={handleGenerateInvoice}
                snacksList={snacksList}
              />
            </div>
          </div>
        </main>

        {/* InvoiceViewer */}
        {invoice && (
          <InvoiceViewer
            invoice={invoice}
            onClose={() => setInvoice(null)}
            onPaid={handleInvoicePaid}
            snacksList={snacksList}
            shopName={shopName || 'Gamers Spot'}
            upiId={upiId}
          />
        )}

        {/* PricingConfig */}
        {showPricingConfig && (
          <PricingConfig
            onClose={() => setShowPricingConfig(false)}
          />
        )}

        {/* SnacksConfig */}
        {showSnacksConfig && (
          <SnacksConfig
            onClose={() => {
              setShowSnacksConfig(false)
              // Reload snacks when config is closed
              snacksAPI.getAll(true).then(setSnacksList).catch(console.error)
            }}
          />
        )}

        {/* BonusConfig */}
        {showBonusConfig && (
          <BonusConfig
            onClose={() => setShowBonusConfig(false)}
          />
        )}

        {/* Manage Stations */}
        {showManageStations && (
          <ManageStations
            onClose={() => setShowManageStations(false)}
            stations={stations}
            onStationsUpdate={(updatedStations) => {
              setStations(updatedStations)
            }}
          />
        )}

        {/* Reports */}
        {activeReport && activeReport !== 'transfer-stations' && (
          <Reports
            reportType={activeReport}
            onClose={() => {
              setActiveReport(null)
              setShowDashboard(true)
            }}
          />
        )}
        {/* Transfer Stations Overlay */}
        {activeReport === 'transfer-stations' && (
          <TransferStations
            stations={stations}
            onTransfer={handleConfirmTransfer}
            onClose={() => {
              setActiveReport(null)
              setShowDashboard(true)
            }}
          />
        )}
      </div>
    </SubscriptionProvider>
  )
}

export default App
