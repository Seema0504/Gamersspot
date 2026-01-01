import { useState, useEffect, useRef } from 'react'
import TimerDisplay from './TimerDisplay'
import { formatTime } from '../utils/timer'
import { calculateCost, calculatePaidHours, getBonusTime, GAME_TYPES, getRate, getDayType, getCokeBottleRate, getCokeCanRate, getExtraControllerRate } from '../utils/pricing'
import { playAlarm } from '../utils/alarm'
import { timeAPI, stationsAPI, snacksAPI } from '../utils/api'
import { saveTimerState } from '../utils/storage'

const StationCard = ({ station, onUpdate, onDelete, snacksList = [], onTransfer }) => {
  const [elapsedTime, setElapsedTime] = useState(station.elapsedTime || 0)
  const [isRunning, setIsRunning] = useState(station.isRunning || false)
  const [isDone, setIsDone] = useState(station.isDone || false)
  const [isPaused, setIsPaused] = useState(station.isPaused || false)
  const [displayStartTime, setDisplayStartTime] = useState(null)
  const [displayEndTime, setDisplayEndTime] = useState(null)
  const [showSnacksList, setShowSnacksList] = useState(false)
  const [localSnacks, setLocalSnacks] = useState([])
  const updateIntervalRef = useRef(null)
  const localStartTimeRef = useRef(null) // Store startTime locally for immediate use
  const serverStartTimestampRef = useRef(null) // Store server's start timestamp (IST-adjusted)
  const serverSyncIntervalRef = useRef(null) // Interval for periodic server time sync
  const lastServerTimeRef = useRef(null) // Last server time we got (for calculating elapsed)
  const lastServerSyncTimeRef = useRef(null) // Client time when we last synced with server
  const serverTimeOffsetRef = useRef(0) // Offset between server time and client time
  const latestStationRef = useRef(station) // Track latest station state to avoid stale prop issues
  const pausedTimeRef = useRef(station.pausedTime || 0) // Total paused time in seconds
  const pauseStartTimeRef = useRef(null) // Server timestamp when pause started
  const pauseStartTimeStringRef = useRef(station.pauseStartTime || null) // Pause start time string from DB (persists across refresh)
  const isInitializedRef = useRef(false) // CRITICAL: Track if refs are initialized from DB to prevent race conditions
  const startLockRef = useRef(false)

  const gameType = station.gameType || GAME_TYPES.PLAYSTATION

  // Helper function to extract time portion (HH:MM:SS) from full date-time string in 24-hour format
  const extractTimeOnly = (dateTimeString) => {
    if (!dateTimeString) return null

    let timePart = dateTimeString
    if (dateTimeString.includes(' ')) {
      timePart = dateTimeString.split(' ')[1] // Return HH:MM:SS in 24-hour format
    }

    return timePart
  }

  // Calculate elapsed time using server time (accurate and efficient)
  // Uses server time as the source of truth, with client time as fallback
  // Subtracts paused time to get actual running time
  // CRITICAL FIX: When paused, use the stored elapsedTime from database instead of recalculating
  const calculateElapsedTime = () => {
    // CRITICAL FIX: Don't calculate until refs are initialized from database
    // This prevents race condition where pausedTimeRef might be 0 on first render
    if (!isInitializedRef.current && isRunning) {
      // Return the stored elapsed time from database until initialization completes
      const storedElapsed = station.elapsedTime || 0
      // Removed verbose initialization log
      return storedElapsed
    }

    // CRITICAL FIX: If paused, return the stored elapsed time from database
    // This prevents the timer from continuing to calculate when paused after page refresh
    if (isPaused) {
      // Use the elapsedTime from the database (stored when pause was clicked)
      const storedElapsed = station.elapsedTime || elapsedTime || 0
      // Removed verbose paused log
      return storedElapsed
    }

    // CRITICAL FIX: If done (not running but has elapsed time), return the stored elapsed time
    // This shows the final played time instead of 00:00:00
    if (!isRunning && (station.elapsedTime || elapsedTime)) {
      const storedElapsed = station.elapsedTime || elapsedTime || 0
      return storedElapsed
    }

    if (!serverStartTimestampRef.current || !isRunning) {
      return 0
    }

    try {
      let currentServerTime

      // If we have a last known server time, estimate current server time
      // by adding the elapsed client time since last sync
      if (lastServerTimeRef.current && lastServerSyncTimeRef.current) {
        const clientTimeSinceSync = Date.now() - lastServerSyncTimeRef.current
        // Estimate current server time = last server time + elapsed client time
        // (assuming client and server clocks run at similar rates)
        currentServerTime = lastServerTimeRef.current + clientTimeSinceSync
      } else {
        // Fallback: estimate using client time + server offset
        const currentClientTime = Date.now()
        currentServerTime = currentClientTime + serverTimeOffsetRef.current
      }

      // Calculate total elapsed time using server time
      const totalElapsedMs = currentServerTime - serverStartTimestampRef.current
      const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000)

      // Subtract total paused time (accumulated from all pause/resume cycles)
      // CRITICAL: Use the ref value which should be initialized by now
      let currentPausedTime = pausedTimeRef.current || 0

      // Calculate actual running time = total elapsed - paused time
      const runningTimeSeconds = totalElapsedSeconds - currentPausedTime

      // Cap at 24 hours (86400 seconds) to prevent absurd values
      const MAX_ELAPSED_SECONDS = 86400
      return Math.max(0, Math.min(runningTimeSeconds, MAX_ELAPSED_SECONDS))
    } catch (error) {
      console.error(`[${station.name}] Error calculating elapsed time:`, error)
      return 0
    }
  }

  // Sync with server time periodically to get accurate current time (every 30 seconds)
  const syncWithServerTime = async () => {
    const startTimeToUse = localStartTimeRef.current || station.startTime
    if (!startTimeToUse || !isRunning) {
      return
    }

    try {
      // Get current server time
      const serverTime = await timeAPI.getServerTime()
      const serverTimestamp = serverTime.timestamp // IST-adjusted timestamp
      const clientTime = Date.now()

      // Update server time offset: difference between server and client time
      serverTimeOffsetRef.current = serverTimestamp - clientTime

      // Store current server time and client time for accurate elapsed calculation
      lastServerTimeRef.current = serverTimestamp
      lastServerSyncTimeRef.current = clientTime

      // Parse start_time from database to ensure we have the correct start timestamp
      const [startDatePart, startTimePart] = startTimeToUse.split(' ')

      if (startDatePart && startTimePart) {
        const [startYear, startMonth, startDay] = startDatePart.split('-').map(Number)
        const [startHour, startMinute, startSecond] = startTimePart.split(':').map(Number)
        const istOffset = 5.5 * 60 * 60 * 1000
        const startDateAsUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHour, startMinute, startSecond))
        const startUTCTimestamp = startDateAsUTC.getTime() - istOffset
        const startISTTimestamp = startUTCTimestamp + istOffset

        // Ensure serverStartTimestampRef is set correctly
        if (!serverStartTimestampRef.current) {
          serverStartTimestampRef.current = startISTTimestamp
        }
      }
    } catch (error) {
      console.error(`[${station.name}] Error syncing with server time:`, error)
    }
  }

  // Update elapsed time (called every second when running and not paused)
  const updateElapsedTime = () => {
    if (!isRunning || isDone || isPaused) {
      return
    }

    try {
      const calculatedElapsed = calculateElapsedTime()
      if (calculatedElapsed >= 0) {
        setElapsedTime(calculatedElapsed)

        // Use latest station ref to avoid stale prop issues
        // This ensures extraControllers, snacks, snacksEnabled, etc. are preserved
        const currentStation = latestStationRef.current
        const updatedStation = {
          ...currentStation,
          elapsedTime: calculatedElapsed,
          isRunning: true,
          isPaused: false,
          pausedTime: pausedTimeRef.current
        }

        // Update ref immediately to keep it in sync
        latestStationRef.current = updatedStation

        // Update parent state
        onUpdate(updatedStation)

        // OPTIMIZATION: Save to LocalStorage every second (instant, no network)
        saveTimerState(station.id, {
          elapsedTime: calculatedElapsed,
          isRunning: true,
          isPaused: false,
          pausedTime: pausedTimeRef.current,
          startTime: station.startTime,
          endTime: station.endTime
        })


      }
    } catch (error) {
      console.error(`[${station.name}] Error updating elapsed time:`, error)
    }
  }

  // Initialize display times from station props and sync local ref
  useEffect(() => {
    if (station.startTime) {
      setDisplayStartTime(extractTimeOnly(station.startTime))
      localStartTimeRef.current = station.startTime // Sync local ref with prop

      // Force update of server start timestamp if startTime changes
      // This is crucial for Transfer capability where a running timer is moved to this station
      if (isRunning && station.startTime) {
        // Parse start time to get server timestamp
        const [startDatePart, startTimePart] = station.startTime.split(' ')
        if (startDatePart && startTimePart) {
          const [startYear, startMonth, startDay] = startDatePart.split('-').map(Number)
          const [startHour, startMinute, startSecond] = startTimePart.split(':').map(Number)
          const istOffset = 5.5 * 60 * 60 * 1000
          const startDateAsUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHour, startMinute, startSecond))
          const startUTCTimestamp = startDateAsUTC.getTime() - istOffset
          const startISTTimestamp = startUTCTimestamp + istOffset

          // Only update if different to avoid unnecessary writes
          if (serverStartTimestampRef.current !== startISTTimestamp) {
            serverStartTimestampRef.current = startISTTimestamp
          }
        }
      }
    } else {
      // Clear display if startTime is null/undefined
      setDisplayStartTime(null)
      localStartTimeRef.current = null
    }
    if (station.endTime) {
      setDisplayEndTime(extractTimeOnly(station.endTime))
    } else {
      // Clear display if endTime is null/undefined
      setDisplayEndTime(null)
    }
  }, [station.startTime, station.endTime, isRunning, station.elapsedTime])

  // Sync state from parent station prop and update ref
  useEffect(() => {
    setElapsedTime(station.elapsedTime || 0)
    setIsRunning(station.isRunning || false)
    setIsDone(station.isDone || false)
    setIsPaused(station.isPaused || false)
    pausedTimeRef.current = station.pausedTime || 0
    pauseStartTimeStringRef.current = station.pauseStartTime || null

    // CRITICAL FIX: Restore pauseStartTimeRef from database on page load
    // This is essential for accurate pause duration calculation after refresh
    if (station.isPaused && station.pauseStartTime && !pauseStartTimeRef.current) {
      // Parse the pause start time string to get timestamp
      try {
        const [datePart, timePart] = station.pauseStartTime.split(' ')
        if (datePart && timePart) {
          const [year, month, day] = datePart.split('-').map(Number)
          const [hour, minute, second] = timePart.split(':').map(Number)
          const istOffset = 5.5 * 60 * 60 * 1000
          const dateAsUTC = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
          const utcTimestamp = dateAsUTC.getTime() - istOffset
          const istTimestamp = utcTimestamp + istOffset
          pauseStartTimeRef.current = istTimestamp
          // Removed verbose restore log
        }
      } catch (error) {
        console.error(`[${station.name}] Error parsing pauseStartTime:`, error)
      }
    } else if (!station.isPaused) {
      // Clear pause start time if not paused
      pauseStartTimeRef.current = null
    }

    // Update ref with latest station data to avoid stale prop issues
    latestStationRef.current = station

    // CRITICAL: Mark as initialized after all refs are loaded from database
    // This prevents race condition in calculateElapsedTime
    isInitializedRef.current = true
  }, [station])

  // Timer update interval: Update elapsed time locally every second when running and not paused
  useEffect(() => {
    // Use local state for isRunning, but check both local ref, station prop, and displayStartTime for startTime
    const hasStartTime = localStartTimeRef.current || station.startTime || displayStartTime
    if (isRunning && !isDone && !isPaused && hasStartTime) {
      // Update immediately
      updateElapsedTime()

      // Then update every second (local calculation - no API calls)
      updateIntervalRef.current = setInterval(() => {
        updateElapsedTime()
      }, 1000)

      // Sync with server time periodically (every 30 seconds) to correct clock drift
      syncWithServerTime() // Sync immediately
      serverSyncIntervalRef.current = setInterval(() => {
        syncWithServerTime()
      }, 30000) // Every 30 seconds
    } else {
      // Clear intervals when not running or paused
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
      if (serverSyncIntervalRef.current) {
        clearInterval(serverSyncIntervalRef.current)
        serverSyncIntervalRef.current = null
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
      if (serverSyncIntervalRef.current) {
        clearInterval(serverSyncIntervalRef.current)
        serverSyncIntervalRef.current = null
      }
    }
  }, [isRunning, isDone, isPaused, station.startTime, displayStartTime])

  // CRITICAL FIX: Handle Page Visibility API to prevent browser tab throttling issues
  // This fixes ALL buttons (Start, Pause, Done, Reset) not working after 10+ minutes idle
  useEffect(() => {
    // const handleVisibilityChange = async () => {

    //   const freshStations = await stationsAPI.getAll()
    //   const freshStation = freshStations.find(s => s.id === station.id)

    //   if (freshStation) {
    //     latestStationRef.current = freshStation
    //     onUpdate(freshStation)
    //   }

    const handleVisibilityChange = async () => {
      try {
        if (!document.hidden) {
          const freshStations = await stationsAPI.getAll()
          const freshStation = freshStations.find(s => s.id === station.id)
          if (freshStation) {
            latestStationRef.current = freshStation
            onUpdate(freshStation)
          }
        }
      } catch (err) {
        console.error('Visibility sync failed', err)
      }
    }

      // Run initialization on mount (wrapped in async IIFE to handle await)
      // When page becomes visible again (user returns to the tab)
      ; (async () => {
        if (!document.hidden) {
          try {
            // ALWAYS sync with server time when tab becomes visible
            // This ensures accurate time calculations for ALL button operations:
            // - Start: Needs accurate start time
            // - Pause: Needs to calculate current elapsed time before pausing
            // - Done: Needs to calculate final elapsed time
            // - Reset: Ensures fresh state
            await syncWithServerTime()

            // Force update elapsed time for ANY state (running, paused, or done)
            // This ensures the UI shows the correct time when user interacts
            if (isRunning || isPaused || isDone) {
              updateElapsedTime()
            }
          } catch (error) {
            console.error(`[${station.name}] ❌ Error resyncing after visibility change:`, error)
          }
        }
      })()

    // Add visibility change event listener
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRunning, isDone, isPaused, station.name])

  // Handle Start button
  const handleStart = async () => {

    if (startLockRef.current) return
    startLockRef.current = true

    const latest = await stationsAPI.getAll().then(list => list.find(s => s.id === station.id))
    if (latest?.isRunning) return

    try {
      // Get accurate server time
      const serverTime = await timeAPI.getServerTime()
      const dateTimeString = serverTime.dateTimeString // "YYYY-MM-DD HH:MM:SS"
      const timeString = serverTime.timeString // "HH:MM:SS"
      const serverTimestamp = serverTime.timestamp // IST-adjusted timestamp

      // Timer started - removed verbose log

      // Store startTime in local ref for immediate use
      localStartTimeRef.current = dateTimeString

      // Calculate start timestamp to match server's calculation
      // This ensures local calculation starts from the same baseline as server
      const [startDatePart, startTimePart] = dateTimeString.split(' ')
      if (startDatePart && startTimePart) {
        const [startYear, startMonth, startDay] = startDatePart.split('-').map(Number)
        const [startHour, startMinute, startSecond] = startTimePart.split(':').map(Number)
        const istOffset = 5.5 * 60 * 60 * 1000
        const startDateAsUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHour, startMinute, startSecond))
        const startUTCTimestamp = startDateAsUTC.getTime() - istOffset
        const startISTTimestamp = startUTCTimestamp + istOffset // Server's IST timestamp format

        // Store server's start timestamp (this is what we'll use for calculations)
        serverStartTimestampRef.current = startISTTimestamp

        // Calculate and store server-client time offset
        const clientTime = Date.now()
        serverTimeOffsetRef.current = serverTimestamp - clientTime

        // Store current server time for immediate accurate calculation
        lastServerTimeRef.current = serverTimestamp
        lastServerSyncTimeRef.current = Date.now()
      }

      // Update local state immediately
      setElapsedTime(0)
      setIsRunning(true)
      setIsDone(false)
      setIsPaused(false)
      setDisplayStartTime(timeString)
      setDisplayEndTime(null)
      pausedTimeRef.current = 0 // Reset paused time on new start
      pauseStartTimeRef.current = null
      isInitializedRef.current = true // Mark as initialized when starting fresh

      // Prepare updated station
      const updatedStation = {
        ...station,
        elapsedTime: 0,
        isRunning: true,
        isDone: false,
        startTime: dateTimeString,
        endTime: null
      }

      // Save to database IMMEDIATELY via PUT request
      try {
        const putResponse = await stationsAPI.update({
          id: station.id,
          startTime: dateTimeString,
          isRunning: true,
          isDone: false,
          isPaused: false,
          elapsedTime: 0,
          pausedTime: 0,
          endTime: null
        })
        // Start time saved - removed verbose log

        // Delay to ensure PUT completes and database is updated before bulk save
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`[${station.name}] Failed to save start time via PUT:`, error)
        // Continue anyway - the onUpdate will sync via bulk save
      }

      // Update parent state AFTER PUT completes to ensure database has startTime
      // This will trigger bulk save, but startTime is already in database and will be preserved
      onUpdate(updatedStation)

      // Do an immediate sync to establish correct baseline
      // This ensures the timer starts with accurate timing from the beginning
      syncWithServerTime()

      // Announce
      playAlarm(`${station.name} timer started`, false)
    } catch (error) {
      console.error(`[${station.name}] Error starting timer:`, error)
      playAlarm(`Failed to start ${station.name} timer`, true)
    } finally {
      // 🔓 ALWAYS release lock
      startLockRef.current = false
    }
  }

  // Handle Pause button
  const handlePause = async () => {
    const latest = await stationsAPI.getAll().then(list => list.find(s => s.id === station.id))
    if (!latest?.isRunning || latest?.isPaused) return

    try {
      // Get current server time to mark when pause started
      const serverTime = await timeAPI.getServerTime()
      const serverTimestamp = serverTime.timestamp
      const pauseStartTimeString = serverTime.dateTimeString // "YYYY-MM-DD HH:MM:SS"

      // Calculate current elapsed time before pausing
      const currentElapsed = calculateElapsedTime()

      // Mark pause start time (both timestamp and string for DB persistence)
      pauseStartTimeRef.current = serverTimestamp
      pauseStartTimeStringRef.current = pauseStartTimeString

      // Ensure pausedTime is initialized as a number
      if (pausedTimeRef.current === undefined || pausedTimeRef.current === null) {
        pausedTimeRef.current = 0
      }

      // Update local state
      setIsPaused(true)

      // Clear update interval (timer stops)
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }

      // Prepare updated station
      const currentStation = latestStationRef.current
      const pausedTimeValue = pausedTimeRef.current || 0
      const updatedStation = {
        ...currentStation,
        isRunning: true, // Keep isRunning true when paused (timer is active but paused)
        isPaused: true,
        elapsedTime: currentElapsed,
        pausedTime: pausedTimeValue,
        pauseStartTime: pauseStartTimeString // CRITICAL: Store pause start time in DB
      }

      // Update ref
      latestStationRef.current = updatedStation

      // Save to database FIRST - ensure database is updated before UI state
      try {
        const updatePayload = {
          id: station.id,
          isRunning: true, // Keep isRunning true when paused (timer is still active, just paused)
          isPaused: true,
          elapsedTime: currentElapsed,
          pausedTime: pausedTimeValue,
          pauseStartTime: pauseStartTimeString // CRITICAL: Persist pause start time
        }
        // Removed verbose pause logs
        const response = await stationsAPI.update(updatePayload)

        // Verify the update was successful by checking the response
        if (!response || !response.success) {
          console.error(`[${station.name}] ❌ Pause update failed. Response:`, response)
          throw new Error('Pause update failed - API did not return success')
        }
        // Removed verbose success log

        // Small delay to ensure database commit completes
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[${station.name}] ❌ Error saving pause state to database:`, error)
        console.error(`[${station.name}] Error details:`, error.message, error.stack)
        // Still update UI even if database fails, but log the error
      }

      // Update parent state AFTER database update completes
      onUpdate(updatedStation)

      // Announce
      playAlarm(`${station.name} paused`, false)
    } catch (error) {
      console.error(`[${station.name}] Error pausing timer:`, error)
      playAlarm(`Failed to pause ${station.name} timer`, true)
    }
  }

  // Handle Resume button (same as Start but continues from paused state)
  const handleResume = async () => {
    // Only check if paused - isRunning might be false if database is out of sync
    const latest = await stationsAPI.getAll().then(list => list.find(s => s.id === station.id))
    if (!latest?.isPaused) return


    try {
      // Get current server time
      const serverTime = await timeAPI.getServerTime()
      const serverTimestamp = serverTime.timestamp

      // Calculate how long we were paused
      if (pauseStartTimeRef.current) {
        const pauseDurationMs = serverTimestamp - pauseStartTimeRef.current
        const pauseDurationSeconds = Math.floor(pauseDurationMs / 1000)
        // Add to total paused time (ensure it's a number)
        pausedTimeRef.current = (pausedTimeRef.current || 0) + pauseDurationSeconds
        // Removed verbose pause duration log
      } else {
        // If no pause start time, ensure pausedTime is at least 0
        pausedTimeRef.current = pausedTimeRef.current || 0
        // Removed verbose pause time log
      }

      // Clear pause start time (both ref and string)
      pauseStartTimeRef.current = null
      pauseStartTimeStringRef.current = null

      // Update local state - resume means timer is running again
      setIsPaused(false)
      setIsRunning(true) // Ensure isRunning is true when resuming

      // Ensure pausedTime is always a number
      const pausedTimeValue = pausedTimeRef.current || 0

      // Prepare updated station
      const currentStation = latestStationRef.current
      const updatedStation = {
        ...currentStation,
        isRunning: true, // Timer is running again
        isPaused: false,
        pausedTime: pausedTimeValue,
        pauseStartTime: null // Clear pause start time in DB
      }

      // Update ref
      latestStationRef.current = updatedStation

      // Save to database FIRST - ensure database is updated before UI state
      try {
        const updatePayload = {
          id: station.id,
          isRunning: true, // Ensure isRunning is true when resuming
          isPaused: false,
          pausedTime: pausedTimeValue,
          pauseStartTime: null // Clear pause start time in DB
        }
        // Removed verbose resume logs
        const response = await stationsAPI.update(updatePayload)

        // Verify the update was successful
        if (!response || !response.success) {
          console.error(`[${station.name}] ❌ Resume update failed. Response:`, response)
          throw new Error('Resume update failed - API did not return success')
        }
        // Removed verbose success log

        // Small delay to ensure database commit completes
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[${station.name}] ❌ Error saving resume state to database:`, error)
        console.error(`[${station.name}] Error details:`, error.message, error.stack)
        // Still update UI even if database fails, but log the error
      }

      // Update parent state AFTER database update completes
      onUpdate(updatedStation)

      // Announce
      playAlarm(`${station.name} resumed`, false)
    } catch (error) {
      console.error(`[${station.name}] Error resuming timer:`, error)
      playAlarm(`Failed to resume ${station.name} timer`, true)
    }
  }

  // Handle Done button
  const handleDone = async () => {
    const latest = await stationsAPI.getAll().then(list => list.find(s => s.id === station.id))
    if (!latest?.isRunning || latest?.isPaused) return

    try {
      // If paused, resume first to get accurate final elapsed time
      if (isPaused && pauseStartTimeRef.current) {
        const serverTime = await timeAPI.getServerTime()
        const serverTimestamp = serverTime.timestamp
        const pauseDurationMs = serverTimestamp - pauseStartTimeRef.current
        const pauseDurationSeconds = Math.floor(pauseDurationMs / 1000)
        pausedTimeRef.current = pausedTimeRef.current + pauseDurationSeconds
        pauseStartTimeRef.current = null
        setIsPaused(false)
      }

      // Get accurate server time
      const serverTime = await timeAPI.getServerTime()
      const endDateTimeString = serverTime.dateTimeString // "YYYY-MM-DD HH:MM:SS"
      const endTimeString = serverTime.timeString // "HH:MM:SS"

      // Calculate final elapsed time using our accurate calculation method
      const finalElapsedTime = calculateElapsedTime()

      // Timer completed - removed verbose log

      // Update local state
      setIsRunning(false)
      setIsDone(true)
      setElapsedTime(finalElapsedTime)
      setDisplayEndTime(endTimeString)

      // Clear update interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }

      // Prepare updated station
      const currentStation = latestStationRef.current
      const updatedStation = {
        ...currentStation,
        elapsedTime: finalElapsedTime,
        isRunning: false,
        isDone: true,
        isPaused: false,
        pausedTime: pausedTimeRef.current,
        endTime: endDateTimeString
      }

      // Update ref
      latestStationRef.current = updatedStation

      // Save to database IMMEDIATELY via PUT request
      try {
        const putPayload = {
          id: station.id,
          endTime: endDateTimeString,
          elapsedTime: finalElapsedTime,
          isRunning: false,
          isDone: true,
          isPaused: false,
          pausedTime: pausedTimeRef.current
        }
        // Removed verbose done logs
        const putResponse = await stationsAPI.update(putPayload)
        // Done status saved - removed verbose log

        // Delay to ensure PUT completes and database is updated before bulk save
        await new Promise(resolve => setTimeout(resolve, 500))

        // Verify endTime was saved by checking the response or making a quick GET
      } catch (error) {
        console.error(`[${station.name}] Failed to save done status:`, error)
        // Continue anyway - the onUpdate will sync via bulk save
      }

      // Update parent state AFTER PUT completes to ensure database has endTime
      // This will trigger bulk save, but endTime is already in database and will be preserved
      onUpdate(updatedStation)

      // Announce
      playAlarm(`${station.name} completed`, false)
    } catch (error) {
      console.error(`[${station.name}] Error completing timer:`, error)
      playAlarm(`Failed to complete ${station.name} timer`, true)
    }
  }

  // Handle Continue button (resume from done state)
  const handleContinue = async () => {
    const latest = await stationsAPI.getAll().then(list => list.find(s => s.id === station.id))
    if (!latest?.isDone) return

    try {
      // Get current server time to resume from
      const serverTime = await timeAPI.getServerTime()
      const serverTimestamp = serverTime.timestamp

      // We need to recalculate the start time based on current elapsed time
      // This ensures the timer continues accurately from where it stopped
      // Formula: new_start_time = current_time - elapsed_time - paused_time
      const currentElapsed = station.elapsedTime || 0
      const currentPausedTime = pausedTimeRef.current || 0

      // Calculate what the start time should have been to get current elapsed time
      const adjustedStartTimestamp = serverTimestamp - (currentElapsed * 1000)

      // Store the adjusted start timestamp
      serverStartTimestampRef.current = adjustedStartTimestamp

      // Calculate and store server-client time offset
      const clientTime = Date.now()
      serverTimeOffsetRef.current = serverTimestamp - clientTime

      // Store current server time for immediate accurate calculation
      lastServerTimeRef.current = serverTimestamp
      lastServerSyncTimeRef.current = Date.now()

      // Update local state - resume means timer is running again
      setIsRunning(true)
      setIsDone(false)
      setIsPaused(false)
      setDisplayEndTime(null) // Clear end time since we're continuing

      // Prepare updated station
      const currentStation = latestStationRef.current
      const updatedStation = {
        ...currentStation,
        isRunning: true,
        isDone: false,
        isPaused: false,
        endTime: null // Clear end time in database
      }

      // Update ref
      latestStationRef.current = updatedStation

      // Save to database FIRST - ensure database is updated before UI state
      try {
        const updatePayload = {
          id: station.id,
          isRunning: true,
          isDone: false,
          isPaused: false,
          endTime: null // Clear end time
        }
        const response = await stationsAPI.update(updatePayload)

        // Verify the update was successful
        if (!response || !response.success) {
          console.error(`[${station.name}] ❌ Continue update failed. Response:`, response)
          throw new Error('Continue update failed - API did not return success')
        }

        // Small delay to ensure database commit completes
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[${station.name}] ❌ Error saving continue state to database:`, error)
        console.error(`[${station.name}] Error details:`, error.message, error.stack)
        // Still update UI even if database fails, but log the error
      }

      // Update parent state AFTER database update completes
      onUpdate(updatedStation)

      // Do an immediate sync to establish correct baseline
      syncWithServerTime()

      // Announce
      playAlarm(`${station.name} continued`, false)
    } catch (error) {
      console.error(`[${station.name}] Error continuing timer:`, error)
      playAlarm(`Failed to continue ${station.name} timer`, true)
    }
  }

  // Handle Reset button
  const handleReset = async () => {
    // Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to reset ${station.name}?`)
    if (!confirmed) {
      return // User cancelled, don't reset
    }

    try {
      // Clear update intervals
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
      if (serverSyncIntervalRef.current) {
        clearInterval(serverSyncIntervalRef.current)
        serverSyncIntervalRef.current = null
      }

      // Update local state immediately
      setElapsedTime(0)
      setIsRunning(false)
      setIsDone(false)
      setIsPaused(false)
      setDisplayStartTime(null)
      setDisplayEndTime(null)
      localStartTimeRef.current = null // Clear local ref
      serverStartTimestampRef.current = null // Clear server start timestamp
      lastServerTimeRef.current = null // Clear last server time
      lastServerSyncTimeRef.current = null // Clear last sync time
      serverTimeOffsetRef.current = 0 // Reset server time offset
      pausedTimeRef.current = 0 // Reset paused time
      pauseStartTimeRef.current = null // Clear pause start time
      pauseStartTimeStringRef.current = null // Clear pause start time string

      // Prepare updated station - reset to initial/default state
      const updatedStation = {
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
        endTime: null
      }

      // Update ref to keep it in sync
      latestStationRef.current = updatedStation

      // Save to database immediately (no delay)
      try {
        const resetPayload = {
          id: station.id,
          elapsedTime: 0,
          isRunning: false,
          isDone: false,
          isPaused: false,
          pausedTime: 0,
          pauseStartTime: null,
          extraControllers: 0,
          snacks: { cokeBottle: 0, cokeCan: 0 }, // Send as object, API will stringify
          snacksEnabled: false,
          customerName: '',
          customerPhone: '',
          startTime: null,
          endTime: null
        }
        const response = await stationsAPI.update(resetPayload)

        // Reload station from database to ensure UI reflects database state
        try {
          const allStations = await stationsAPI.getAll()
          const reloadedStation = allStations.find(s => s.id === station.id)
          if (reloadedStation) {
            // Verify reset was successful
            if (reloadedStation.isRunning || reloadedStation.elapsedTime > 0 || reloadedStation.isDone || reloadedStation.customerName) {
              console.error(`[${station.name}] ⚠️ Station was NOT properly reset:`, {
                isRunning: reloadedStation.isRunning,
                elapsedTime: reloadedStation.elapsedTime,
                isDone: reloadedStation.isDone,
                customerName: reloadedStation.customerName,
                startTime: reloadedStation.startTime
              })
            }
            // Update parent state with reloaded station data
            onUpdate(reloadedStation)
          } else {
            // Fallback: use updatedStation if reload failed
            onUpdate(updatedStation)
          }
        } catch (reloadError) {
          console.error(`[${station.name}] Error reloading station after reset:`, reloadError)
          // Fallback: use updatedStation if reload failed
          onUpdate(updatedStation)
        }
      } catch (error) {
        console.error(`[${station.name}] ❌ Failed to save reset to database:`, error)
        // Still update parent state even if save fails
        onUpdate(updatedStation)
      }
    } catch (error) {
      console.error(`[${station.name}] Error resetting timer:`, error)
    }
  }

  // Load snacks if needed
  useEffect(() => {
    if (snacksList && snacksList.length > 0) {
      setLocalSnacks(snacksList)
    } else {
      snacksAPI.getAll(true).then(setLocalSnacks).catch(console.error)
    }
  }, [snacksList])

  // Handle snack change
  const handleSnackChange = async (snackName, delta) => {
    // Normalize key
    const snackKey = snackName.toLowerCase()
      .replace(/\s+/g, '')
      .replace('cokebottle', 'cokeBottle')
      .replace('cokecan', 'cokeCan')
      .replace('layschips', 'laysChips')
      .replace('kurkure', 'kurkure')

    const currentStation = latestStationRef.current
    const currentSnacks = currentStation.snacks || {}
    const currentQty = currentSnacks[snackKey] || currentSnacks[snackName] || 0
    const newQty = Math.max(0, currentQty + delta)

    if (currentQty === newQty) return

    const updatedSnacks = {
      ...currentSnacks,
      [snackKey]: newQty
    }

    const updatedStation = {
      ...currentStation,
      snacks: updatedSnacks,
      snacksEnabled: true // Enable snacks flag if interacted (even if qty is 0, keeping enabled doesn't hurt, but good to handle)
    }

    // Update ref immediately
    latestStationRef.current = updatedStation

    // Update parent state
    onUpdate(updatedStation)

    // Save to database immediately
    try {
      await stationsAPI.update({
        id: station.id,
        snacks: updatedSnacks,
        snacksEnabled: true
      })
    } catch (error) {
      console.error(`[${station.name}] Error saving snacks:`, error)
    }
  }

  // Handle extra controller change
  const handleExtraControllerChange = async (e) => {
    const extraControllers = parseInt(e.target.value, 10)
    const currentStation = latestStationRef.current
    const updatedStation = {
      ...currentStation,
      extraControllers
    }

    // Update ref immediately to keep it in sync
    latestStationRef.current = updatedStation

    // Update parent state
    onUpdate(updatedStation)

    // Save to database immediately
    try {
      await stationsAPI.update({
        id: station.id,
        extraControllers
      })
    } catch (error) {
      console.error(`[${station.name}] Error saving extra controllers:`, error)
    }
  }

  // Calculate cost and other derived values
  const effectiveElapsed = calculateElapsedTime()
  const currentRate = getRate(gameType)

  const paidHours = calculatePaidHours(effectiveElapsed, gameType)
  const bonusTime = getBonusTime(effectiveElapsed, gameType)
  const totalCost = calculateCost(
    effectiveElapsed,
    gameType,
    station.extraControllers || 0,
    station.snacks || {},
    snacksList.length > 0 ? snacksList : null
  )


  const getGameTypeColor = () => {
    if (gameType === GAME_TYPES.PLAYSTATION) return 'cyan'
    if (gameType === GAME_TYPES.STEERING_WHEEL) return 'purple'
    return 'pink'
  }

  const gameColor = getGameTypeColor()
  const borderColor = isRunning ? 'green' : isDone ? 'orange' : gameColor

  return (
    <div className={`bg-white rounded-lg p-4 border transition-all duration-300 shadow-sm ${isRunning ? 'border-green-400' :
      isDone ? 'border-orange-400' :
        'border-gray-200'
      }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-orange-500' :
              isRunning ? 'bg-green-500 animate-pulse' :
                'bg-gray-400'
              }`}></div>
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {station.name} - {gameType} - ₹{currentRate}/hr
            </h3>
          </div>
          {displayStartTime && (
            <div className="mt-1">
              <span className="text-gray-600 text-xs">
                Start: {displayStartTime}
              </span>
              {displayEndTime && (
                <span className="ml-2 text-gray-600 text-xs inline-flex items-center gap-1.5">
                  End: {displayEndTime}
                  {isDone && (
                    <span className="text-[10px] bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded font-medium uppercase tracking-wider border border-orange-500/20" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Done</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200 transition-all duration-300">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900 tracking-tight">
            {formatTime(calculateElapsedTime())}
          </div>
          {isRunning && (
            <div className="text-xs text-green-600 font-medium mt-2 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-1 mb-2 transition-all duration-300">
        {!isDone ? (
          <>
            {isPaused ? (
              <button
                onClick={handleResume}
                className="flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors shadow-sm bg-green-600 hover:bg-green-700 text-white border border-green-600"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={isRunning}
                className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors shadow-sm ${isRunning
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600'
                  }`}
              >
                Start
              </button>
            )}
            <button
              onClick={handlePause}
              disabled={!isRunning || isPaused}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors shadow-sm ${!isRunning || isPaused
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                : 'bg-gray-600 hover:bg-gray-700 text-white border border-gray-600'
                }`}
            >
              Pause
            </button>
            <button
              onClick={handleDone}
              disabled={elapsedTime === 0 || isPaused}
              className={`flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors shadow-sm ${elapsedTime === 0 || isPaused
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                : 'bg-orange-600 hover:bg-orange-700 text-white border border-orange-600'
                }`}
            >
              Done
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-2 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors border border-gray-300 hover:border-gray-400 shadow-sm"
            >
              Reset
            </button>

          </>
        ) : (
          <>
            <button
              onClick={handleContinue}
              className="flex-1 px-2 py-2 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors border border-green-600 shadow-sm"
            >
              Continue
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-2 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors border border-gray-300 hover:border-gray-400 shadow-sm"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Extras & Cost */}
      <div className="space-y-2 pt-3 border-t border-gray-200 relative z-10">
        {gameType === GAME_TYPES.PLAYSTATION && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor={`extra-ctrl-${station.id}`} className={`text-gray-600 whitespace-nowrap font-semibold text-[10px]`}>
              Extra Ctrl:
            </label>
            <select
              id={`extra-ctrl-${station.id}`}
              value={station.extraControllers || 0}
              onChange={handleExtraControllerChange}
              className={`flex-1 px-2 py-1 text-xs border border-${gameColor}-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-${gameColor}-500 focus:border-${gameColor}-500 font-semibold`}
            >
              <option value="0" className="bg-white">0 (+0Rs)</option>
              <option value="1" className="bg-white">1 (+{getExtraControllerRate()}Rs)</option>
              <option value="2" className="bg-white">2 (+{getExtraControllerRate() * 2}Rs)</option>
              <option value="3" className="bg-white">3 (+{getExtraControllerRate() * 3}Rs)</option>
            </select>
          </div>
        )}

        {/* Snacks Selection Interface */}
        <div className="space-y-1 pt-1 mt-1 border-t border-gray-100">
          <button
            onClick={() => setShowSnacksList(!showSnacksList)}
            className="w-full flex justify-between items-center py-1.5 px-1 rounded hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[14px]">🍿</span>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900">Snacks</span>
              {Object.values(station.snacks || {}).reduce((a, b) => a + Number(b), 0) > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isRunning ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {Object.values(station.snacks || {}).reduce((a, b) => a + Number(b), 0)}
                </span>
              )}
            </div>
            <span className="text-gray-400 text-[10px] group-hover:text-gray-600">{showSnacksList ? '▲' : '▼'}</span>
          </button>

          {/* Expanded Snack List */}
          {showSnacksList && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                {localSnacks.filter(s => s.active).length > 0 ? (
                  localSnacks.filter(s => s.active).map(snack => {
                    // Match the normalization logic used elsewhere
                    const snackKey = snack.name.toLowerCase()
                      .replace(/\s+/g, '')
                      .replace('cokebottle', 'cokeBottle')
                      .replace('cokecan', 'cokeCan')
                      .replace('layschips', 'laysChips')
                      .replace('kurkure', 'kurkure')

                    const qty = (station.snacks || {})[snackKey] || (station.snacks || {})[snack.name] || 0

                    return (
                      <div key={snack.id} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-medium text-gray-800 truncate" title={snack.name}>{snack.name}</div>
                          <div className="text-[10px] text-gray-500">₹{snack.price}</div>
                        </div>
                        <div className="flex items-center bg-white rounded-md border border-gray-200 shadow-sm h-7">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSnackChange(snack.name, -1) }}
                            className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-l-md transition-colors border-r border-gray-200"
                            disabled={qty <= 0}
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-gray-900 tabular-nums leading-none pt-0.5">{qty}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSnackChange(snack.name, 1) }}
                            className="w-7 h-full flex items-center justify-center text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-r-md transition-colors font-bold border-l border-gray-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-3 text-xs text-gray-400 italic">No active snacks</div>
                )}
              </div>
            </div>
          )}

          {/* Compact Summary when collapsed */}
          {!showSnacksList && Object.values(station.snacks || {}).reduce((a, b) => a + Number(b), 0) > 0 && (
            <div className="px-1.5 pb-1">
              <div className="text-[10px] text-gray-600 leading-relaxed bg-gray-50 p-1.5 rounded border border-gray-100">
                {localSnacks.filter(s => {
                  const k = s.name.toLowerCase().replace(/\s+/g, '').replace('cokebottle', 'cokeBottle').replace('cokecan', 'cokeCan').replace('layschips', 'laysChips').replace('kurkure', 'kurkure')
                  return ((station.snacks || {})[k] || (station.snacks || {})[s.name] || 0) > 0
                }).map(s => {
                  const k = s.name.toLowerCase().replace(/\s+/g, '').replace('cokebottle', 'cokeBottle').replace('cokecan', 'cokeCan').replace('layschips', 'laysChips').replace('kurkure', 'kurkure')
                  const q = (station.snacks || {})[k] || (station.snacks || {})[s.name] || 0
                  return `${q}x ${s.name}`
                }).join(', ')}
              </div>
            </div>
          )}
        </div>

        {elapsedTime > 0 && (
          <div className="text-xs space-y-0.5 pt-1">
            <div className="flex justify-between text-gray-600">
              <span className="font-semibold text-[10px]">Paid:</span>
              <span className="font-semibold text-gray-900">{formatTime(paidHours * 3600)}</span>
            </div>
            {bonusTime > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="font-semibold text-[10px]">Bonus:</span>
                <span className="font-semibold">+{formatTime(bonusTime)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-600 font-medium">Cost:</span>
          <span className="text-base font-semibold text-gray-900">₹{totalCost}</span>
        </div>
      </div>
    </div>
  )
}

export default StationCard
