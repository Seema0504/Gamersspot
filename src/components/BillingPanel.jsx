import { useState, useEffect, useRef } from 'react'
import { formatTime } from '../utils/timer'
import { calculateCost, getRate, GAME_TYPES, getDayType, calculatePaidHours, getExtraControllerRate, getBonusTime, getExtraTimePlayed, getCokeBottleRate, getCokeCanRate } from '../utils/pricing'
import { snacksAPI, customersAPI } from '../utils/api'

const BillingPanel = ({ stations, onGenerateInvoice, snacksList: propsSnacksList = [] }) => {
  const [selectedStation, setSelectedStation] = useState(null) // Single selection only
  const [highlightedStation, setHighlightedStation] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [billingSnacks, setBillingSnacks] = useState({}) // Snacks selected in billing section
  const [snacksList, setSnacksList] = useState(propsSnacksList) // Local snacks list
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [allCustomers, setAllCustomers] = useState([])
  const [showPhoneAutocomplete, setShowPhoneAutocomplete] = useState(false)
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false)
  const phoneInputRef = useRef(null)
  const nameInputRef = useRef(null)
  const previousDoneStations = useRef(new Set())

  // Load snacks if not provided
  useEffect(() => {
    if (propsSnacksList.length === 0) {
      snacksAPI.getAll(true).then(setSnacksList).catch(console.error)
    } else {
      setSnacksList(propsSnacksList)
    }
  }, [propsSnacksList])

  // Load all customers for autocomplete
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const result = await customersAPI.getAll()
        setAllCustomers(result.customers || [])
      } catch (error) {
        console.error('Error loading customers:', error)
        setAllCustomers([])
      }
    }
    loadCustomers()
  }, [])

  // Handle phone number change with autocomplete lookup
  const handlePhoneChange = async (value) => {
    const trimmedPhone = value.trim().replace(/\D/g, '')
    setCustomerPhone(value)

    if (trimmedPhone.length >= 10) {
      setIsLookingUpCustomer(true)
      try {
        const result = await customersAPI.lookupByPhone(trimmedPhone)
        if (result.found) {
          setCustomerName(result.customerName)
        } else {
          setCustomerName('')
        }
      } catch (error) {
        console.error('Error looking up customer:', error)
        setCustomerName('')
      } finally {
        setIsLookingUpCustomer(false)
      }
    } else {
      setCustomerName('')
    }
  }

  // Get autocomplete suggestions for phone number
  const getPhoneAutocompleteSuggestions = () => {
    if (!customerPhone.trim() || !showPhoneAutocomplete) return []
    const query = customerPhone.toLowerCase().trim()
    return allCustomers
      .filter(customer =>
        customer.phoneNumber.includes(query) ||
        customer.customerName.toLowerCase().includes(query)
      )
      .slice(0, 10)
  }

  // Auto-select station when it is marked as done (only one at a time)
  useEffect(() => {
    const doneStations = stations
      .filter(s => s.isDone === true && (s.elapsedTime || 0) > 0)
      .map(s => s.id)

    const currentDoneSet = new Set(doneStations)
    const previousDoneSet = previousDoneStations.current

    // Find newly done stations
    const newlyDone = doneStations.filter(id => !previousDoneSet.has(id))

    if (newlyDone.length > 0) {
      // Automatically select the first newly done station (single selection)
      const newStationId = newlyDone[0]
      setSelectedStation(newStationId)

      // Highlight it with animation
      setHighlightedStation(newStationId)

      // Scroll to the newly done station
      setTimeout(() => {
        const stationElement = document.getElementById(`billing-station-${newStationId}`)
        if (stationElement) {
          stationElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 100)

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedStation(null)
      }, 2000)
    }

    // Update previous done stations
    previousDoneStations.current = currentDoneSet
  }, [stations])

  // Clear selected station if it's no longer done (e.g., when Continue is clicked)
  useEffect(() => {
    if (selectedStation) {
      const station = stations.find(s => s.id === selectedStation)
      // If station is no longer done or doesn't exist, clear selection
      if (!station || !station.isDone || (station.elapsedTime || 0) === 0) {
        setSelectedStation(null)
        setDiscount(0)
        // Also clear billing snacks for this station
        setBillingSnacks(prev => {
          const updated = { ...prev }
          delete updated[selectedStation]
          return updated
        })
      }
    }
  }, [stations, selectedStation])

  const selectStation = (stationId) => {
    // Single selection: if clicking the same station, deselect it; otherwise select the new one
    const newSelection = selectedStation === stationId ? null : stationId
    setSelectedStation(newSelection)

    // Initialize billing snacks with station's existing snacks when selecting
    if (newSelection) {
      const station = stations.find(s => s.id === newSelection)
      if (station && station.snacks && !billingSnacks[newSelection]) {
        setBillingSnacks(prev => ({
          ...prev,
          [newSelection]: { ...station.snacks }
        }))
      }
    }
  }

  const getSubtotal = () => {
    if (!selectedStation) return 0
    const station = stations.find((s) => s.id === selectedStation)
    if (!station) return 0
    const elapsed = station.elapsedTime || 0
    const gameType = station.gameType || 'PlayStation'
    // Use billing snacks if snacksEnabled is true, otherwise use station snacks
    const snacks = (station.snacksEnabled && billingSnacks[selectedStation])
      ? billingSnacks[selectedStation]
      : (station.snacks || {})
    return calculateCost(
      elapsed,
      gameType,
      station.extraControllers || 0,
      snacks,
      snacksList.length > 0 ? snacksList : null
    )
  }

  const getTotalCost = () => {
    const subtotal = getSubtotal()
    const adjustmentAmount = parseFloat(discount) || 0
    // Negative values = discount (subtract from subtotal)
    // Positive values = price increase (add to subtotal)
    // Formula: total = subtotal + adjustmentAmount
    // Example: subtotal=100, adjustment=-50 → total=50 (discount)
    // Example: subtotal=100, adjustment=+50 → total=150 (increase)
    return Math.max(0, subtotal + adjustmentAmount)
  }

  const handleGenerateInvoice = async () => {
    if (!selectedStation) return
    const station = stations.find((s) => s.id === selectedStation)
    if (!station) return

    // If snacksEnabled, use billing snacks; otherwise use station snacks
    let snacks = (station.snacksEnabled && billingSnacks[station.id])
      ? billingSnacks[station.id]
      : (station.snacks || {})

    // Convert snacks to include full snack details (name, price, quantity) for faster invoice rendering
    // This ensures all snacks are properly captured with their details
    let snacksWithDetails = snacks
    const snacksDetailsArray = []

    if (snacksList.length > 0) {
      const normalizedSnacks = {}

      snacksList.forEach(snack => {
        if (snack.active) {
          // Try to find the snack in billingSnacks using normalized key
          const snackKey = snack.name.toLowerCase()
            .replace(/\s+/g, '')
            .replace('cokebottle', 'cokeBottle')
            .replace('cokecan', 'cokeCan')
            .replace('layschips', 'laysChips')

          const quantity = snacks[snackKey] || snacks[snack.name] || 0
          if (quantity > 0) {
            // Store with snack name as key for better readability
            normalizedSnacks[snack.name] = quantity
            // Also create array format with full details for faster invoice rendering
            snacksDetailsArray.push({
              snackId: snack.id,
              snackName: snack.name,
              snackPrice: parseFloat(snack.price),
              quantity: quantity
            })
          }
        }
      })

      // If we found snacks with names, use that; otherwise keep original
      if (Object.keys(normalizedSnacks).length > 0) {
        snacksWithDetails = normalizedSnacks
      }
    }

    // Create snacks object with both normalized format and pre-calculated details
    const snacksForInvoice = {
      ...snacksWithDetails,
      _details: snacksDetailsArray // Include full details for quick access in invoice
    }

    // Validate phone number if provided
    const cleanPhone = customerPhone.trim().replace(/\D/g, '')
    if (customerPhone.trim() && cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number')
      return
    }

    // Save customer to database if provided
    if (cleanPhone && customerName.trim()) {
      try {
        await customersAPI.saveCustomer(cleanPhone, customerName.trim())
      } catch (error) {
        console.error('Error saving customer:', error)
        // Continue even if save fails
      }
    }

    // Create invoice station with correct snacks and snack details
    const invoiceStation = {
      ...station,
      snacks: snacksForInvoice,
      snacksDetails: snacksList.length > 0 ? snacksList : null, // Include full snacks list for reference
      customerPhone: cleanPhone || '',
      customerName: customerName.trim() || ''
    }

    // Pass subtotal separately to avoid recalculation discrepancies
    const subtotal = getSubtotal()
    onGenerateInvoice([invoiceStation], getTotalCost(), parseFloat(discount) || 0, subtotal)
    setSelectedStation(null)
    setDiscount(0)
    setCustomerPhone('')
    setCustomerName('')
    // Clear billing snacks for this station
    setBillingSnacks(prev => {
      const updated = { ...prev }
      delete updated[station.id]
      return updated
    })
  }

  const handleBillingSnackChange = (stationId, snackKey, value) => {
    setBillingSnacks(prev => {
      // Find the station to get its initial snacks
      const station = stations.find(s => s.id === stationId)
      const initialSnacks = station?.snacks || {}

      // Merge with existing billing snacks or start with initial station snacks
      const currentStationSnacks = prev[stationId] || initialSnacks

      return {
        ...prev,
        [stationId]: {
          ...currentStationSnacks,
          [snackKey]: parseInt(value) || 0
        }
      }
    })
  }

  return (
    <div className="bg-white rounded-lg p-4 lg:p-5 sticky top-4 border border-gray-200 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
        <p className="text-xs text-gray-600 mt-1">Select completed sessions to generate invoice</p>
      </div>

      <div className="space-y-2 mb-3 max-h-60 sm:max-h-80 overflow-y-auto">
        {stations.filter(station => (station.isDone === true) && (station.elapsedTime || 0) > 0).length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm font-semibold">
            No completed sessions yet.<br />
            Click "Done" on a station to add it here.
          </div>
        ) : (
          stations
            .filter(station => (station.isDone === true) && (station.elapsedTime || 0) > 0) // Only show done stations with time
            .map((station) => {
              const elapsed = station.elapsedTime || 0
              const gameType = station.gameType || 'PlayStation'
              const extraControllers = station.extraControllers || 0
              const snacks = station.snacks || {}
              const cokeBottleCount = snacks.cokeBottle || 0
              const cokeCanCount = snacks.cokeCan || 0
              const baseRate = getRate(gameType)
              const paidHours = calculatePaidHours(elapsed, gameType)
              const bonusTime = getBonusTime(elapsed, gameType)
              const extraTimePlayed = getExtraTimePlayed(elapsed, gameType)
              const baseCost = paidHours * baseRate
              const extraControllerCost = extraControllers * getExtraControllerRate()
              // Calculate snacks cost - use database prices if available
              let snacksCost = 0
              if (snacksList.length > 0) {
                snacksList.forEach(snack => {
                  if (snack.active) {
                    const snackKey = snack.name.toLowerCase()
                      .replace(/\s+/g, '')
                      .replace('cokebottle', 'cokeBottle')
                      .replace('cokecan', 'cokeCan')
                      .replace('layschips', 'laysChips')
                      .replace('kurkure', 'kurkure')
                    const quantity = snacks[snackKey] || snacks[snack.name] || 0
                    snacksCost += quantity * parseFloat(snack.price)
                  }
                })
              } else {
                // Fallback to hardcoded rates
                snacksCost = (cokeBottleCount * getCokeBottleRate()) + (cokeCanCount * getCokeCanRate())
              }
              const totalCost = baseCost + extraControllerCost + snacksCost
              const isSelected = selectedStation === station.id

              const isHighlighted = highlightedStation === station.id

              return (
                <div
                  id={`billing-station-${station.id}`}
                  key={station.id}
                  className={`bg-white rounded-md cursor-pointer transition-all duration-300 border shadow-sm ${isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : isHighlighted
                      ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <label className="flex items-center gap-2 p-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billing-station"
                      checked={isSelected}
                      onChange={() => selectStation(station.id)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2 flex-shrink-0 bg-white border-gray-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="font-semibold text-xs text-gray-900 truncate">{station.name}</div>
                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider border border-green-200">Done</span>
                      </div>
                      {station.customerName && (
                        <div className="text-[10px] text-gray-600 font-medium mt-0.5 flex flex-wrap gap-2">
                          <span>{station.customerName}</span>
                          {station.startTime && (
                            <span className="text-gray-500">
                              Start: {station.startTime}
                            </span>
                          )}
                          {station.endTime && (
                            <span className="text-gray-500">
                              End: {station.endTime}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-600 font-medium">
                        {formatTime(elapsed)}
                      </div>
                    </div>
                    <div className="font-semibold text-xs text-gray-900 ml-2 shrink-0">₹{totalCost}</div>
                  </label>

                  {/* Detailed Billing Breakdown */}
                  <div className="px-3 pb-3 pt-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between text-gray-700">
                        <span className="font-semibold text-[10px]">Base ({paidHours} hr x ₹{baseRate}):</span>
                        <span className="font-semibold text-gray-900">₹{baseCost}</span>
                      </div>
                      {bonusTime > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span className="font-semibold text-[10px]">Bonus Time ({formatTime(bonusTime)}):</span>
                          <span className="font-semibold">Free</span>
                        </div>
                      )}
                      {extraTimePlayed > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span className="font-semibold text-[10px]">Extra Time ({formatTime(extraTimePlayed)}):</span>
                          <span className="font-semibold">Included</span>
                        </div>
                      )}
                      {extraControllers > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span className="font-semibold text-[10px]">Extra Controllers ({extraControllers} x ₹{getExtraControllerRate()}):</span>
                          <span className="font-semibold text-gray-900">₹{extraControllerCost}</span>
                        </div>
                      )}
                      {snacksCost > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span className="font-semibold text-[10px]">
                            Snacks: {snacksList.length > 0 ? (
                              snacksList.filter(s => {
                                const snackKey = s.name.toLowerCase()
                                  .replace(/\s+/g, '')
                                  .replace('cokebottle', 'cokeBottle')
                                  .replace('cokecan', 'cokeCan')
                                  .replace('layschips', 'laysChips')
                                  .replace('kurkure', 'kurkure')
                                return (snacks[snackKey] || snacks[s.name] || 0) > 0
                              }).map(s => {
                                const snackKey = s.name.toLowerCase()
                                  .replace(/\s+/g, '')
                                  .replace('cokebottle', 'cokeBottle')
                                  .replace('cokecan', 'cokeCan')
                                  .replace('layschips', 'laysChips')
                                  .replace('kurkure', 'kurkure')
                                const qty = snacks[snackKey] || snacks[s.name] || 0
                                return qty > 0 ? `${qty} ${s.name}${qty > 1 ? 's' : ''}` : null
                              }).filter(Boolean).join(', ')
                            ) : (
                              `${cokeBottleCount > 0 ? `${cokeBottleCount} Bottle${cokeBottleCount > 1 ? 's' : ''}` : ''}${cokeBottleCount > 0 && cokeCanCount > 0 ? ', ' : ''}${cokeCanCount > 0 ? `${cokeCanCount} Can${cokeCanCount > 1 ? 's' : ''}` : ''}`
                            )}
                          </span>
                          <span className="font-semibold text-gray-900">₹{snacksCost}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-900 font-semibold pt-1.5 border-t border-gray-200">
                        <span className="text-[10px]">Total:</span>
                        <span className="text-sm">₹{totalCost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
        )}
      </div>

      <div className="border-t border-gray-200 pt-5 mt-5">
        {/* Snack Selection Section - Show when station is selected and snacksEnabled is true */}
        {selectedStation && (() => {
          const selectedStationData = stations.find(s => s.id === selectedStation)
          if (!selectedStationData || !selectedStationData.snacksEnabled) return null

          const stationSnacks = billingSnacks[selectedStation] || selectedStationData.snacks || {}

          return (
            <div className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="text-sm font-semibold text-gray-900 mb-4">
                Select Snacks
              </div>
              {snacksList.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="w-full border-collapse table-fixed">
                    <colgroup>
                      <col className="w-1/2" />
                      <col className="w-1/2" />
                    </colgroup>
                    <tbody>
                      {Array.from({ length: Math.ceil(snacksList.length / 2) }).map((_, rowIndex) => (
                        <tr key={rowIndex}>
                          {[0, 1].map((colIndex) => {
                            const snackIndex = rowIndex * 2 + colIndex
                            const snack = snacksList[snackIndex]
                            if (!snack) return <td key={colIndex} className="p-2"></td>

                            const snackKey = snack.name.toLowerCase()
                              .replace(/\s+/g, '')
                              .replace('cokebottle', 'cokeBottle')
                              .replace('cokecan', 'cokeCan')
                              .replace('layschips', 'laysChips')
                              .replace('kurkure', 'kurkure')

                            return (
                              <td key={colIndex} className="p-2 align-top">
                                <div className="flex items-center gap-1.5 w-full">
                                  <label className="text-gray-700 text-xs font-medium flex-1 break-words min-w-0" style={{ wordWrap: 'break-word', lineHeight: '1.4' }}>
                                    {snack.name}:
                                  </label>
                                  <select
                                    value={stationSnacks[snackKey] || stationSnacks[snack.name] || 0}
                                    onChange={(e) => handleBillingSnackChange(selectedStation, snackKey, e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-center cursor-pointer flex-shrink-0"
                                  >
                                    {Array.from({ length: 21 }, (_, i) => (
                                      <option key={i} value={i} className="bg-white">{i}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-gray-600 text-center py-2">
                  No snacks available. Configure snacks in Snacks Config.
                </div>
              )}
            </div>
          )
        })()}

        <div className="space-y-3 mb-5">
          {/* Show snack breakdown if snacks are selected in billing */}
          {selectedStation && (() => {
            const selectedStationData = stations.find(s => s.id === selectedStation)
            if (!selectedStationData || !selectedStationData.snacksEnabled) return null

            const stationSnacks = billingSnacks[selectedStation] || selectedStationData.snacks || {}
            let snackCost = 0
            const snackItems = []

            if (snacksList.length > 0) {
              snacksList.forEach(snack => {
                if (snack.active) {
                  const snackKey = snack.name.toLowerCase()
                    .replace(/\s+/g, '')
                    .replace('cokebottle', 'cokeBottle')
                    .replace('cokecan', 'cokeCan')
                    .replace('layschips', 'laysChips')
                    .replace('kurkure', 'kurkure')
                  const quantity = stationSnacks[snackKey] || stationSnacks[snack.name] || 0
                  if (quantity > 0) {
                    const cost = quantity * parseFloat(snack.price)
                    snackCost += cost
                    snackItems.push({ name: snack.name, quantity, cost })
                  }
                }
              })
            }

            if (snackItems.length === 0) return null

            return (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">
                  Selected Snacks:
                </div>
                <div className="space-y-1">
                  {snackItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-700 text-[10px]">
                      <span>
                        {item.quantity} × {item.name}
                      </span>
                      <span className="font-semibold text-gray-900">
                        ₹{item.cost}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-gray-900 text-xs font-bold pt-1 border-t border-gray-200 mt-1">
                    <span>Snacks Total:</span>
                    <span className="text-gray-900">
                      ₹{snackCost}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
            <span className="text-xl font-semibold text-gray-900">
              ₹{getSubtotal()}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Discount / Adjustment
            </label>
            <div className="mb-1">
              <p className="text-[10px] text-gray-500 italic">
                Enter negative value for discount (-₹) or positive for price increase (+₹)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                step="0.01"
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-sm transition-all"
              />
              <span className="text-sm font-semibold text-gray-600">₹</span>
            </div>
            {discount && parseFloat(discount) !== 0 && (
              <div className={`mt-2 text-xs font-semibold ${parseFloat(discount) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(discount) < 0
                  ? `-₹${Math.abs(parseFloat(discount))} discount applied`
                  : `+₹${parseFloat(discount)} price increase applied`
                }
              </div>
            )}
          </div>

          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-md border border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Final Total:</span>
            <span className="text-3xl font-semibold text-gray-900">
              ₹{getTotalCost()}
            </span>
          </div>
        </div>

        {/* Customer Details */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Customer Details</h3>

          {/* Phone Number Input with Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Customer Phone Number
            </label>
            <input
              ref={phoneInputRef}
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '') // Only allow digits
                if (value.length <= 10) { // Max 10 digits
                  handlePhoneChange(value)
                }
              }}
              onFocus={() => setShowPhoneAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowPhoneAutocomplete(false), 200)}
              placeholder="Enter 10-digit phone number"
              maxLength="10"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {showPhoneAutocomplete && getPhoneAutocompleteSuggestions().length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {getPhoneAutocompleteSuggestions().map((customer, idx) => (
                  <div
                    key={idx}
                    onMouseDown={() => {
                      setCustomerPhone(customer.phoneNumber)
                      setCustomerName(customer.customerName)
                      setShowPhoneAutocomplete(false)
                    }}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900 text-sm">{customer.customerName}</div>
                    <div className="text-xs text-gray-600">{customer.phoneNumber}</div>
                  </div>
                ))}
              </div>
            )}
            {isLookingUpCustomer && (
              <p className="text-xs text-gray-500 mt-1">Looking up customer...</p>
            )}
          </div>

          {/* Customer Name Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
              placeholder="Enter customer name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm uppercase"
            />
          </div>
        </div>

        <button
          onClick={handleGenerateInvoice}
          disabled={!selectedStation}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors shadow-sm mt-4"
        >
          Generate Invoice
        </button>
      </div>
    </div>
  )
}

export default BillingPanel

