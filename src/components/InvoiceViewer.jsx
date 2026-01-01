import { useState, useEffect } from 'react'
import { formatTime } from '../utils/timer'
import { calculateCost, calculatePaidHours, getRate, getExtraControllerRate, getBonusTime, getExtraTimePlayed, getCokeBottleRate, getCokeCanRate, calculateSnackCost } from '../utils/pricing'
import { generateInvoicePDF } from '../utils/pdf'
import { formatIndianDate } from '../utils/timezone'
import { snacksAPI } from '../utils/api'
import { playAlarm } from '../utils/alarm'

const InvoiceViewer = ({ invoice, onClose, onPaid, snacksList: propsSnacksList = [], readOnly = false, shopName = 'Gamers Spot' }) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [snacksList, setSnacksList] = useState(propsSnacksList)
  const [sendSMS, setSendSMS] = useState(!!invoice?.stations?.[0]?.customerPhone)

  // OPTIMIZATION: Load snacks list only once on mount, not on every prop change
  // This prevents excessive database calls when parent re-renders
  useEffect(() => {
    if (propsSnacksList.length === 0 && snacksList.length === 0) {
      snacksAPI.getAll(true).then(setSnacksList).catch(console.error)
    } else if (propsSnacksList.length > 0 && snacksList.length === 0) {
      setSnacksList(propsSnacksList)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  if (!invoice) return null

  const handlePaid = async () => {
    if (onPaid) {
      // COMMENTED OUT: SMS messaging functionality
      // Pass sendSMS flag to onPaid handler
      // SMS will be sent in background via API (non-blocking)
      // await onPaid(invoice.stations, sendSMS)
      await onPaid(invoice.stations, false) // Always pass false to disable messaging
    }
    // Announce transaction completion with station names
    const stationNames = invoice.stations?.map(s => s.name).join(', ') || 'stations'
    playAlarm(`Transaction completed for ${stationNames}`, false)
    onClose()
  }

  const handleDownloadPDF = async () => {
    setIsGenerating(true)
    try {
      await generateInvoicePDF(invoice, 'invoice-content')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const invoiceDate = formatIndianDate(
    invoice.createdAt || invoice.created_at || invoice.date || new Date(),
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  )

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-1 sm:p-2">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-[95vw] sm:max-w-[900px] w-full h-[98vh] sm:h-[97vh] overflow-hidden border border-gray-200 flex flex-col">
        <div className="p-2 sm:p-3 border-b border-gray-200 flex justify-between items-center bg-white flex-shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-light text-gray-900" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Invoice</h2>
            <p className="text-gray-500 text-[10px] font-light hidden sm:block">{readOnly ? 'Invoice details' : 'Review and download invoice'}</p>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            {!readOnly && (
              <>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGenerating}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900 text-white rounded-lg sm:rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-xs sm:text-sm shadow-sm hover:shadow-md transition-all duration-200 disabled:transform-none"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                >
                  {isGenerating ? 'Generating...' : 'Download PDF'}
                </button>

                {/* SMS Checkbox - COMMENTED OUT */}
                {/* {invoice?.stations?.[0]?.customerPhone && (
                  <div className="flex items-center gap-2 px-2">
                    <input
                      type="checkbox"
                      id="sendSMS"
                      checked={sendSMS}
                      onChange={(e) => setSendSMS(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="sendSMS" className="text-xs sm:text-sm text-gray-700 font-medium cursor-pointer select-none">
                      SMS
                    </label>
                  </div>
                )} */}

                <button
                  onClick={handlePaid}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg sm:rounded-xl hover:bg-green-700 font-medium text-xs sm:text-sm shadow-sm hover:shadow-md transition-all duration-200"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                >
                  Mark as Paid
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-gray-700 rounded-lg sm:rounded-xl hover:bg-gray-50 font-medium text-xs sm:text-sm transition-all duration-200 border border-gray-200 shadow-sm hover:shadow-md"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div id="invoice-content" className="p-4 sm:p-6 bg-white overflow-hidden flex-1 flex flex-col min-h-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          {/* Header Section */}
          <div className="mb-6 pb-6 border-b-2 border-gray-300 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', letterSpacing: '-0.5px' }}>{shopName}</h1>
                <p className="text-gray-600 text-sm font-medium">Gaming Station Management System</p>
              </div>
              <div className="text-left bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 min-w-[250px]">
                <p className="text-gray-900 text-sm font-bold mb-3 whitespace-nowrap" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                  <span className="text-gray-500 text-xs font-semibold tracking-wider uppercase inline-block w-20">Invoice #</span>
                  <span className="ml-2">{invoice.invoiceNumber}</span>
                </p>
                <p className="text-gray-700 text-sm font-medium whitespace-nowrap">
                  <span className="text-gray-500 text-xs font-semibold tracking-wider uppercase inline-block w-20">Date</span>
                  <span className="ml-2">{invoiceDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6 flex-shrink-0 max-w-3xl mx-auto">
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wider uppercase">Station</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wider uppercase">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wider uppercase">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 text-xs tracking-wider uppercase">Time Period</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 text-xs tracking-wider uppercase">Time Played</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.stations.map((station, index) => {
                    const elapsed = station.elapsedTime || 0
                    const gameType = station.gameType || 'PlayStation'
                    const extraControllers = station.extraControllers || 0
                    const snacks = station.snacks || {}
                    const baseRate = getRate(gameType)
                    const paidHours = calculatePaidHours(elapsed, gameType)
                    const bonusTime = getBonusTime(elapsed, gameType)
                    const extraTimePlayed = getExtraTimePlayed(elapsed, gameType)
                    const baseCost = paidHours * baseRate
                    const extraControllerCost = extraControllers * getExtraControllerRate()

                    // Calculate snacks cost dynamically - use pre-calculated details if available
                    let snacksCost = 0
                    if (snacks && snacks._details && Array.isArray(snacks._details)) {
                      // Use pre-calculated snack details for instant rendering
                      snacks._details.forEach(snackDetail => {
                        const quantity = parseInt(snackDetail.quantity) || 0
                        if (quantity > 0) {
                          snacksCost += quantity * parseFloat(snackDetail.snackPrice)
                        }
                      })
                    } else if (snacksList.length > 0 && snacks) {
                      if (Array.isArray(snacks)) {
                        snacks.forEach(snackItem => {
                          if (snackItem.snackId && snackItem.quantity) {
                            const snack = snacksList.find(s => s.id === snackItem.snackId)
                            if (snack && snack.active) {
                              snacksCost += (parseInt(snackItem.quantity) || 0) * parseFloat(snack.price)
                            }
                          }
                        })
                      } else {
                        snacksList.forEach(snack => {
                          if (snack.active) {
                            const snackKey = snack.name.toLowerCase()
                              .replace(/\s+/g, '')
                              .replace('cokebottle', 'cokeBottle')
                              .replace('cokecan', 'cokeCan')
                              .replace('layschips', 'laysChips')
                            const quantity = snacks[snackKey] || snacks[snack.name] || 0
                            snacksCost += quantity * parseFloat(snack.price)
                          }
                        })
                      }
                    } else {
                      const cokeBottleCount = snacks.cokeBottle || 0
                      const cokeCanCount = snacks.cokeCan || 0
                      snacksCost = (cokeBottleCount * getCokeBottleRate()) + (cokeCanCount * getCokeCanRate())
                    }

                    const totalCost = baseCost + extraControllerCost + snacksCost

                    return (
                      <tr key={index} className={`border-b border-gray-200 ${index === invoice.stations.length - 1 ? '' : 'border-b'} hover:bg-gray-50 transition-colors`}>
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-gray-900 text-sm">{station.name}</div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-gray-700 text-sm">{station.customerName || '-'}</div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded whitespace-nowrap">{gameType}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-gray-700 text-xs">
                            {station.startTime && (
                              <div className="flex items-center gap-1 mb-1 whitespace-nowrap">
                                <span className="text-gray-500">🕐</span>
                                <span>{station.startTime}</span>
                              </div>
                            )}
                            {station.endTime && (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <span className="text-gray-500">🕐</span>
                                <span>{station.endTime}</span>
                              </div>
                            )}
                            {!station.startTime && !station.endTime && (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right align-top">
                          <div className="font-medium text-gray-700 text-sm whitespace-nowrap">{formatTime(elapsed)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Breakdown Section */}
          <div className="pt-4 border-t-2 border-gray-300 flex-shrink-0">
            {invoice.stations.length <= 3 && (
              <div className="max-w-xl mx-auto">
                <h2 className="text-lg font-bold text-gray-900 mb-2 tracking-tight text-center" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Detailed Breakdown</h2>
                <div className="space-y-2">
                  {invoice.stations.map((station, index) => {
                    const elapsed = station.elapsedTime || 0
                    const gameType = station.gameType || 'PlayStation'
                    const extraControllers = station.extraControllers || 0
                    const snacks = station.snacks || {}

                    // REMOVED: Debug logging that caused excessive console output

                    const baseRate = getRate(gameType)
                    const paidHours = calculatePaidHours(elapsed, gameType)
                    const bonusTime = getBonusTime(elapsed, gameType)
                    const extraTimePlayed = getExtraTimePlayed(elapsed, gameType)
                    const baseCost = paidHours * baseRate
                    const extraControllerCost = extraControllers * getExtraControllerRate()

                    // Calculate snacks cost dynamically - use pre-calculated details if available
                    let snacksCost = 0
                    const snackItems = []

                    // Check if snacks have pre-calculated details (from invoice generation)
                    if (snacks && snacks._details && Array.isArray(snacks._details)) {
                      // Use pre-calculated snack details for instant rendering
                      snacks._details.forEach(snackDetail => {
                        const quantity = parseInt(snackDetail.quantity) || 0
                        if (quantity > 0) {
                          const cost = quantity * parseFloat(snackDetail.snackPrice)
                          snacksCost += cost
                          snackItems.push({
                            name: snackDetail.snackName,
                            quantity,
                            cost
                          })
                        }
                      })
                    } else if (snacksList.length > 0 && snacks) {
                      // Handle new format: snacks is an array of {snackId, quantity}
                      if (Array.isArray(snacks)) {
                        snacks.forEach(snackItem => {
                          if (snackItem.snackId && snackItem.quantity) {
                            const snack = snacksList.find(s => s.id === snackItem.snackId)
                            if (snack && snack.active) {
                              const quantity = parseInt(snackItem.quantity) || 0
                              if (quantity > 0) {
                                const cost = quantity * parseFloat(snack.price)
                                snacksCost += cost
                                snackItems.push({ name: snack.name, quantity, cost })
                              }
                            }
                          }
                        })
                      } else {
                        // Handle legacy format: snacks is an object with keys like {cokeBottle: 2, cokeCan: 1}
                        // or {snackName: quantity}
                        snacksList.forEach(snack => {
                          if (snack.active) {
                            // Try to match snack name to keys in snacks object
                            const snackKey = snack.name.toLowerCase()
                              .replace(/\s+/g, '')
                              .replace('cokebottle', 'cokeBottle')
                              .replace('cokecan', 'cokeCan')
                              .replace('layschips', 'laysChips')

                            const quantity = snacks[snackKey] || snacks[snack.name] || 0
                            if (quantity > 0) {
                              const cost = quantity * parseFloat(snack.price)
                              snacksCost += cost
                              snackItems.push({ name: snack.name, quantity, cost })
                            }
                          }
                        })
                      }
                    } else {
                      // Fallback to old hardcoded format if snacksList not available
                      const cokeBottleCount = snacks.cokeBottle || 0
                      const cokeCanCount = snacks.cokeCan || 0
                      snacksCost = (cokeBottleCount * getCokeBottleRate()) + (cokeCanCount * getCokeCanRate())
                      if (cokeBottleCount > 0) snackItems.push({ name: 'Coke Bottle', quantity: cokeBottleCount, cost: cokeBottleCount * getCokeBottleRate() })
                      if (cokeCanCount > 0) snackItems.push({ name: 'Coke Can', quantity: cokeCanCount, cost: cokeCanCount * getCokeCanRate() })
                    }

                    const totalCost = baseCost + extraControllerCost + snacksCost

                    return (
                      <div key={index} className="p-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 pb-1 border-b border-gray-300 text-center">{station.name}</h3>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-gray-700 text-xs">Base: {paidHours}hr × {baseRate}Rs</p>
                            <p className="font-semibold text-gray-900 text-xs">{baseCost}Rs</p>
                          </div>

                          {bonusTime > 0 && (
                            <div className="flex justify-between items-center bg-green-50 px-2 py-1.5 rounded border border-green-200">
                              <p className="font-medium text-green-700 text-xs">Bonus: {formatTime(bonusTime)}</p>
                              <p className="font-semibold text-green-700 text-xs">Free</p>
                            </div>
                          )}

                          {extraControllers > 0 && (
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-gray-700 text-xs">Extra Controllers: {extraControllers} × {getExtraControllerRate()}Rs</p>
                              <p className="font-semibold text-gray-900 text-xs">{extraControllerCost}Rs</p>
                            </div>
                          )}

                          {snacksCost > 0 && snackItems.length > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <p className="font-medium text-gray-700 text-xs">Snacks:</p>
                                <p className="font-semibold text-gray-900 text-xs">{snacksCost.toFixed(2)}Rs</p>
                              </div>
                              {snackItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center pl-3 text-xs text-gray-600">
                                  <p>{item.name}: {item.quantity}x</p>
                                  <p>{item.cost.toFixed(2)}Rs</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t-2 border-gray-300">
                            <p className="font-bold text-gray-900 text-sm">Subtotal</p>
                            <p className="font-bold text-gray-900 text-sm">{totalCost}Rs</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Invoice Summary - Subtotal, Discount/Adjustment, Final Total */}
          <div className="mt-6 pt-4 border-t-2 border-gray-300 flex-shrink-0">
            <div className="max-w-md mx-auto space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Subtotal:</span>
                <span className="text-sm font-semibold text-gray-900">₹{parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
              </div>
              {invoice.discount && parseFloat(invoice.discount) !== 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    {parseFloat(invoice.discount) < 0 ? 'Discount:' : 'Price Increase:'}
                  </span>
                  <span className={`text-sm font-semibold ${parseFloat(invoice.discount) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(invoice.discount) < 0
                      ? `-₹${Math.abs(parseFloat(invoice.discount)).toFixed(2)}`
                      : `+₹${parseFloat(invoice.discount).toFixed(2)}`
                    }
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                <span className="text-lg font-bold text-gray-900">Final Total:</span>
                <span className="text-lg font-bold text-gray-900">₹{parseFloat(invoice.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t-2 border-gray-300 text-center flex-shrink-0">
            <p className="text-gray-600 text-sm font-medium">Thank you for choosing {shopName}</p>
            <p className="text-gray-500 text-xs mt-1">Gaming Station Management System</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoiceViewer

