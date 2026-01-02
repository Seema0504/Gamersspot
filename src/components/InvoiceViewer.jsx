import { useState, useEffect } from 'react'
import { formatTime } from '../utils/timer'
import { calculateCost, calculatePaidHours, getRate, getExtraControllerRate, getBonusTime, getExtraTimePlayed, getCokeBottleRate, getCokeCanRate, calculateSnackCost } from '../utils/pricing'
import { generateInvoicePDF } from '../utils/pdf'
import { formatIndianDate } from '../utils/timezone'
import { snacksAPI } from '../utils/api'
import { playAlarm } from '../utils/alarm'

const InvoiceViewer = ({ invoice, onClose, onPaid, snacksList: propsSnacksList = [], readOnly = false, shopName = 'Gamers Spot', upiId = '' }) => {
  const [snacksList, setSnacksList] = useState(propsSnacksList)
  const [sendSMS, setSendSMS] = useState(!!invoice?.stations?.[0]?.customerPhone)
  const [isGenerating, setIsGenerating] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(false) // Default unchecked

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

  // Helper: Sanitize and validate Indian phone number
  const sanitizePhoneNumber = (phone) => {
    if (!phone) return null
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')
    // Validate 10-digit Indian number
    if (digits.length === 10 && digits[0] >= '6') {
      return '91' + digits // Add country code
    }
    return null // Invalid number
  }

  // Helper: Generate WhatsApp click-to-send URL
  const generateWhatsAppURL = (phone, message) => {
    const encodedMessage = encodeURIComponent(message)
    return `https://wa.me/${phone}?text=${encodedMessage}`
  }



  // Helper: Create WhatsApp receipt message - Professional CLEAN TEXT Layout
  const createWhatsAppMessage = () => {
    const invoiceDate = formatIndianDate(new Date(), {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    const total = invoice.total || 0
    const invoiceNumber = invoice.invoiceNumber || 'N/A'

    // Clean Header (No emojis)
    let message = `*INVOICE & RECEIPT*\n` +
      `--------------------------------\n` +
      `*${shopName}*\n` +
      `Date: ${invoiceDate}\n` +
      `Inv #: ${invoiceNumber}\n` +
      `--------------------------------\n`

    const customerName = invoice.stations?.[0]?.customerName
    if (customerName && customerName !== '-' && customerName.toLowerCase() !== 'visitor') {
      message += `Customer: *${customerName}*\n`
    }

    message += `\n*GAME SESSIONS:*\n`

    if (invoice.stations && invoice.stations.length > 0) {
      invoice.stations.forEach((station, index) => {
        if (index > 0) message += `\n`

        message += `*${station.name}* (${station.gameType})\n`

        const getTime = (dtStr) => dtStr ? (dtStr.toString().includes(' ') ? dtStr.toString().split(' ')[1] : dtStr) : '-'
        if (station.startTime) message += `   Start: ${getTime(station.startTime)}\n`
        if (station.endTime) message += `   End:   ${getTime(station.endTime)}\n`
        if (station.elapsedTime) message += `   Duration: ${formatTime(station.elapsedTime)}\n`

        const snacks = station.snacks
        const snackItems = []
        if (snacks) {
          if (snacks._details && Array.isArray(snacks._details)) {
            snacks._details.forEach(s => {
              if (parseInt(s.quantity) > 0) snackItems.push(`${s.snackName} x${s.quantity}`)
            })
          } else if (Array.isArray(snacks) && snacksList.length > 0) {
            snacks.forEach(s => {
              const snack = snacksList.find(item => item.id === s.snackId)
              if (snack && s.quantity > 0) snackItems.push(`${snack.name} x${s.quantity}`)
            })
          } else if (!Array.isArray(snacks)) {
            Object.entries(snacks).forEach(([k, v]) => {
              if (k !== '_details' && v > 0 && !k.includes('coke')) snackItems.push(`${k} x${v}`)
            })
          }
        }
        if (snackItems.length > 0) {
          message += `   Snacks: ${snackItems.join(', ')}\n`
        }
      })
    }

    message += `\n--------------------------------\n` +
      `*TOTAL PAYABLE: ₹${total.toFixed(2)}*\n` +
      `--------------------------------\n`

    if (upiId) {
      // Mandated format: https://upi://...
      const upiLink = `https://upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${total.toFixed(2)}&cu=INR`
      message += `\n*PAYMENT OPTIONS:*\n`
      message += `UPI ID: ${upiId}\n`
      message += `(Copy & pay from any UPI app)\n\n`
      message += `Tap to pay via UPI (Android phones only):\n`
      message += `${upiLink}\n`
    }

    message += `\nThank you for gaming with us!`

    return message
  }

  const whatsappUrl = (() => {
    const customerPhone = invoice?.stations?.[0]?.customerPhone
    const sanitizedPhone = sanitizePhoneNumber(customerPhone)
    if (sanitizedPhone) {
      return generateWhatsAppURL(sanitizedPhone, createWhatsAppMessage())
    }
    return null
  })()

  const handlePaid = async () => {
    if (onPaid) {
      // COMMENTED OUT: SMS messaging functionality
      // Pass sendSMS flag to onPaid handler
      // SMS will be sent in background via API (non-blocking)
      // await onPaid(invoice.stations, sendSMS)
      await onPaid(invoice.stations, false) // Always pass false to disable messaging
    }

    // WhatsApp receipt (optional, non-blocking)
    // WhatsApp receipt (optional, non-blocking)
    // REMOVED: Auto-send functionality (User Request: Manual only via buttons)

    // Print receipt (optional, non-blocking)
    if (printReceipt) {
      try {
        // Small delay to ensure WhatsApp opens first (if enabled)
        setTimeout(() => {
          window.print()
        }, 200) // Increased to 200ms

        // Delay closing modal until after print dialog opens
        // This ensures invoice content is still visible when printing
        setTimeout(() => {
          // Announce transaction completion with station names
          const stationNames = invoice.stations?.map(s => s.name).join(', ') || 'stations'
          playAlarm(`Transaction completed for ${stationNames}`, false)
          onClose()
        }, 1000) // Increased to 1000ms (1 second) for print dialog to fully load

        return // Exit early to prevent immediate close
      } catch (error) {
        // Silently fail - Print is optional, never block payment
        console.log('Print skipped:', error.message)
      }
    }

    // If print is not enabled, close immediately
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

  const handlePrint = () => {
    window.print()
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-[98vw] sm:max-w-[900px] w-full max-h-[98vh] overflow-hidden border border-gray-200 flex flex-col">
        {/* Header - Optimized for Mobile */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex flex-col gap-3">
            {/* Title Row */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Invoice</h2>
                <p className="text-gray-500 text-xs sm:text-sm font-light mt-0.5">{readOnly ? 'Invoice details' : 'Review invoice'}</p>
              </div>

              {/* Right side: PDF, Print, and Close buttons */}
              <div className="flex items-center gap-1.5">
                {/* Download PDF and Print Icons (Read-Only Mode) */}
                {readOnly && (
                  <>
                    {/* WhatsApp Button (Report Mode) */}
                    {/* WhatsApp Button (Report Mode) */}
                    {whatsappUrl && (
                      !whatsappSent ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setWhatsappSent(true)}
                          title="Send WhatsApp Receipt"
                          className="p-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100 active:bg-green-200 transition-all duration-200 border border-green-200 flex items-center justify-center"
                          style={{ display: 'inline-flex' }}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                        </a>
                      ) : (
                        <button
                          disabled
                          title="WhatsApp Receipt Sent"
                          className="p-2 bg-gray-100 text-gray-400 rounded-md border border-gray-200 flex items-center justify-center cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                        </button>
                      )
                    )}
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isGenerating}
                      title="Download PDF"
                      className="p-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 active:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200 border border-blue-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                    </button>
                    <button
                      onClick={handlePrint}
                      title="Print"
                      className="p-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 border border-gray-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Close button - Always on the right */}
                <button
                  onClick={onClose}
                  className="p-2.5 sm:p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200 border border-gray-300 shadow-sm hover:shadow-md flex-shrink-0"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Action Buttons Row */}
            {!readOnly && (
              <div className="flex items-center justify-between gap-4 w-full px-2">

                {/* Left Side: WhatsApp Button (if phone exists) */}
                <div className="flex-1"></div>

                {/* Center: Mark as Paid Button */}
                <div className="flex-none flex items-center gap-6">
                  {!readOnly && (
                    <button
                      onClick={handlePaid}
                      className="px-8 sm:px-10 py-3.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 touch-manipulation"
                      style={{
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        minHeight: '48px',
                        minWidth: '200px'
                      }}
                    >
                      Mark as Paid
                    </button>
                  )}

                  {/* WhatsApp Button - Right after Mark as Paid */}
                  {/* WhatsApp Button - Right after Mark as Paid */}
                  {whatsappUrl && (
                    !whatsappSent ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setWhatsappSent(true)}
                        className="p-3 text-green-600 bg-green-50 hover:bg-green-100 rounded-full transition-colors flex items-center justify-center shadow-sm border border-green-200 hover:border-green-300 transform hover:scale-105 duration-200 cursor-pointer"
                        title="Send Payment Link via WhatsApp Now"
                        style={{ display: 'flex' }}
                      >
                        <svg style={{ width: '32px', height: '32px' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                      </a>
                    ) : (
                      <button
                        disabled
                        title="WhatsApp Link Sent"
                        className="p-3 bg-gray-100 text-gray-400 rounded-full border border-gray-200 flex items-center justify-center cursor-not-allowed"
                        style={{ display: 'flex' }}
                      >
                        <svg style={{ width: '32px', height: '32px' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                      </button>
                    )
                  )}
                </div>

                {/* Right Side: Print Checkbox */}
                <div className="flex-1 flex justify-end">
                  {!readOnly && (
                    <label
                      htmlFor="print-receipt"
                      className="flex items-center gap-2 cursor-pointer group p-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                      title="Print Receipt"
                    >
                      <input
                        type="checkbox"
                        id="print-receipt"
                        checked={printReceipt}
                        onChange={(e) => setPrintReceipt(e.target.checked)}
                        className="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-500 focus:ring-2 cursor-pointer"
                      />
                      <svg className="w-6 h-6 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </label>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        <div id="invoice-content" className="p-4 sm:p-6 bg-white overflow-hidden flex-1 flex flex-col min-h-0" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
          {/* Header Section - Single Row */}
          <div className="mb-6 pb-6 border-b-2 border-gray-300 flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Shop Name */}
              <div className="flex-shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', letterSpacing: '-0.5px' }}>{shopName}</h1>
                <p className="text-gray-600 text-xs sm:text-sm font-medium">Gaming Station Management System</p>
              </div>

              {/* Right: Invoice Details */}
              <div className="text-right bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-200 flex-shrink-0">
                <p className="text-gray-900 text-xs sm:text-sm font-bold mb-2 whitespace-nowrap" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                  <span className="text-gray-500 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">Invoice #</span>
                  <span className="ml-1 sm:ml-2">{invoice.invoiceNumber}</span>
                </p>
                <p className="text-gray-700 text-xs sm:text-sm font-medium whitespace-nowrap">
                  <span className="text-gray-500 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">Date</span>
                  <span className="ml-1 sm:ml-2">{invoiceDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="mb-6 flex-shrink-0 max-w-3xl mx-auto">
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white">
              <table className="w-full table-fixed">
                <colgroup><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[22%]" /><col className="w-[18%]" /></colgroup>
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
    </div >
  )
}

export default InvoiceViewer

