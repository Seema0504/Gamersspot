import { useState, useEffect, useMemo } from 'react'
import { reportsAPI, invoicesAPI } from '../utils/api'
import { formatTime } from '../utils/timer'
import InvoiceViewer from './InvoiceViewer'
import { getIndianDateString, getIndianMonth, getIndianYear, formatIndianDate } from '../utils/timezone'
import * as XLSX from 'xlsx'
import { generateInvoicePDF, generateReportTablePDF } from '../utils/pdf'

const Reports = ({ reportType = 'usage', onClose }) => {
  const [activeTab, setActiveTab] = useState(reportType) // usage, daily-revenue, monthly-revenue, customer-report, snacks-report
  const [selectedDate, setSelectedDate] = useState(getIndianDateString())
  const [selectedMonth, setSelectedMonth] = useState(getIndianMonth())
  const [selectedYear, setSelectedYear] = useState(getIndianYear())

  const [usageReport, setUsageReport] = useState(null)
  const [dailyRevenue, setDailyRevenue] = useState(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState(null)
  const [customerReport, setCustomerReport] = useState(null)
  const [snacksReport, setSnacksReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [snacksReportType, setSnacksReportType] = useState('date') // 'date', 'month', 'range'
  const [snacksStartDate, setSnacksStartDate] = useState('')
  const [snacksEndDate, setSnacksEndDate] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'registrationDate', direction: 'desc' })

  useEffect(() => {
    setActiveTab(reportType)
  }, [reportType])

  useEffect(() => {
    loadReport()
  }, [activeTab, selectedDate, selectedMonth, selectedYear, snacksReportType, snacksStartDate, snacksEndDate])

  const loadReport = async () => {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'usage') {
        const data = await reportsAPI.getUsageReport(selectedDate)
        setUsageReport(data)
      } else if (activeTab === 'daily-revenue') {
        const data = await reportsAPI.getDailyRevenue(selectedDate)
        setDailyRevenue(data)
      } else if (activeTab === 'monthly-revenue') {
        const data = await reportsAPI.getMonthlyRevenue(selectedMonth, selectedYear)
        setMonthlyRevenue(data)
      } else if (activeTab === 'customer-report') {
        const data = await reportsAPI.getCustomerReport()
        setCustomerReport(data)
      } else if (activeTab === 'snacks-report') {
        const date = snacksReportType === 'date' ? selectedDate : null
        const month = snacksReportType === 'month' ? selectedMonth : null
        const year = snacksReportType === 'month' ? selectedYear : null
        const startDate = snacksReportType === 'range' ? snacksStartDate : null
        const endDate = snacksReportType === 'range' ? snacksEndDate : null
        const data = await reportsAPI.getSnacksReport(date, month, year, startDate, endDate)
        setSnacksReport(data)
      }
    } catch (err) {
      setError(err.message)
      console.error('Error loading report:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2)
  }

  const formatHours = (seconds) => {
    const hours = (seconds / 3600).toFixed(2)
    return `${hours} hrs`
  }

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    return dateStr
  }

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!customerReport?.customers) return []

    let result = customerReport.customers
    if (customerSearchQuery.trim()) {
      const query = customerSearchQuery.toLowerCase().trim()
      result = result.filter(customer =>
        customer.customerName.toLowerCase().includes(query) ||
        customer.phoneNumber.includes(query)
      )
    }

    // Sort based on configuration
    return [...result].sort((a, b) => {
      let aValue = a[sortConfig.key]
      let bValue = b[sortConfig.key]

      // Handle null/undefined
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // Parse dates for registrationDate
      if (sortConfig.key === 'registrationDate') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      // String comparison
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [customerReport, customerSearchQuery, sortConfig])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Get autocomplete suggestions
  const autocompleteSuggestions = useMemo(() => {
    if (!customerReport?.customers || !customerSearchQuery.trim() || !showAutocomplete) return []

    const query = customerSearchQuery.toLowerCase().trim()
    const suggestions = customerReport.customers
      .filter(customer =>
        customer.customerName.toLowerCase().includes(query) ||
        customer.phoneNumber.includes(query)
      )
      .slice(0, 10) // Limit to 10 suggestions

    return suggestions
  }, [customerReport, customerSearchQuery, showAutocomplete])

  // Export Usage Report to Excel
  const exportUsageReportToExcel = () => {
    if (!usageReport || !usageReport.stations || usageReport.stations.length === 0) {
      alert('No usage data to export')
      return
    }

    // Prepare data for Excel
    const excelData = usageReport.stations.map(station => ({
      'Station Name': station.name,
      'Game Type': station.game_type || 'Unknown',
      'Elapsed Time (seconds)': station.elapsed_time || 0,
      'Elapsed Time (HH:MM:SS)': formatTime(station.elapsed_time || 0),
      'Start Time': station.start_time || '-',
      'End Time': station.end_time || '-',
      'Extra Controllers': station.extra_controllers || 0,
      'Snacks': JSON.stringify(station.snacks || {})
    }))

    // Add summary sheet
    const summaryData = [{
      'Date': usageReport.date,
      'Total Stations': usageReport.summary?.totalStations || 0,
      'Active Stations': usageReport.summary?.activeStations || 0,
      'Total Time (seconds)': usageReport.summary?.totalTime || 0,
      'Total Time (hours)': formatHours(usageReport.summary?.totalTime || 0)
    }]

    // Create workbook with multiple sheets
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, ws, 'Station Details')

    // Generate filename with report date
    const dateStr = (usageReport.date || selectedDate).replace(/-/g, '_')
    const filename = `Usage_Report_${dateStr}.xlsx`

    // Download
    XLSX.writeFile(wb, filename)
  }

  // Export to Excel (for customer report)
  const exportToExcel = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) {
      alert('No customer data to export')
      return
    }

    // Prepare data for Excel
    const excelData = filteredCustomers.map(customer => ({
      'Customer Name': customer.customerName,
      'Phone Number': customer.phoneNumber,
      'Registration Date': formatIndianDate(customer.registrationDate, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      'Times Played': customer.timesPlayed,
      'Total Spent (₹)': customer.totalSpent.toFixed(2)
    }))

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Report')

    // Generate filename with current date
    const dateStr = getIndianDateString().replace(/-/g, '_')
    const filename = `Customer_Report_${dateStr}.xlsx`

    // Download
    XLSX.writeFile(wb, filename)
  }


  // Export Daily Revenue to Excel
  const exportDailyRevenueToExcel = () => {
    if (!dailyRevenue || !dailyRevenue.invoices) {
      alert('No data to export')
      return
    }

    const excelData = dailyRevenue.invoices.map(invoice => {
      // Calculate times
      let totalGameTime = 0
      let startTimes = []
      let endTimes = []
      let stations = invoice.stations
      let stationNames = []

      if (stations) {
        if (typeof stations === 'string') {
          try { stations = JSON.parse(stations) } catch (e) { stations = [] }
        }
        if (Array.isArray(stations)) {
          totalGameTime = stations.reduce((sum, s) => {
            const elapsed = parseInt(s?.elapsedTime || s?.elapsed_time || 0)
            if (s?.startTime) startTimes.push(formatTimeOnly(s.startTime))
            if (s?.endTime) endTimes.push(formatTimeOnly(s.endTime))
            if (s?.name) stationNames.push(s.name)
            return sum + elapsed
          }, 0)
        } else if (typeof stations === 'object') {
          totalGameTime = parseInt(stations?.elapsedTime || stations?.elapsed_time || 0)
          if (stations?.startTime) startTimes.push(formatTimeOnly(stations.startTime))
          if (stations?.endTime) endTimes.push(formatTimeOnly(stations.endTime))
          if (stations?.name) stationNames.push(stations.name)
        }
      }

      return {
        'Invoice #': invoice.invoice_number,
        'Customer': invoice.customer_names || 'N/A',
        'Stations': stationNames.join(', '),
        'Start Time': startTimes.join(', '),
        'End Time': endTimes.join(', '),
        'Total played time': formatTime(totalGameTime),
        'Bill Amount': parseFloat(invoice.subtotal).toFixed(2),
        'Discount': parseFloat(invoice.discount).toFixed(2),
        'Total Profits': parseFloat(invoice.total).toFixed(2)
      }
    })

    // Summary Data
    const summaryData = [{
      'Date': selectedDate,
      'Total Profits': dailyRevenue.summary.totalRevenue,
      'Bill Amount': dailyRevenue.summary.totalSubtotal,
      'Discount': dailyRevenue.summary.totalDiscount,
      'Invoices': dailyRevenue.summary.invoiceCount
    }]

    const wb = XLSX.utils.book_new()
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    const wsInvoices = XLSX.utils.json_to_sheet(excelData)

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices')

    XLSX.writeFile(wb, `Daily_Revenue_${selectedDate}.xlsx`)
  }

  // Export Daily Revenue to PDF
  const exportDailyRevenueToPDF = async () => {
    if (!dailyRevenue || !dailyRevenue.invoices) return
    try {
      const tableData = dailyRevenue.invoices.map(invoice => {
        let totalGameTime = 0
        let startTimes = []
        let endTimes = []
        let stations = invoice.stations
        let stationNames = []

        if (stations) {
          if (typeof stations === 'string') {
            try { stations = JSON.parse(stations) } catch (e) { stations = [] }
          }
          if (Array.isArray(stations)) {
            totalGameTime = stations.reduce((sum, s) => {
              const elapsed = parseInt(s?.elapsedTime || s?.elapsed_time || 0)
              if (s?.startTime) startTimes.push(formatTimeOnly(s.startTime))
              if (s?.endTime) endTimes.push(formatTimeOnly(s.endTime))
              if (s?.name) stationNames.push(s.name)
              return sum + elapsed
            }, 0)
          } else if (typeof stations === 'object') {
            totalGameTime = parseInt(stations?.elapsedTime || stations?.elapsed_time || 0)
            if (stations?.startTime) startTimes.push(formatTimeOnly(stations.startTime))
            if (stations?.endTime) endTimes.push(formatTimeOnly(stations.endTime))
            if (stations?.name) stationNames.push(stations.name)
          }
        }

        return {
          invoice_number: invoice.invoice_number,
          customer: invoice.customer_names || 'N/A',
          stations: stationNames.join(', '),
          start: startTimes.join(', '),
          end: endTimes.join(', '),
          time: formatTime(totalGameTime),
          bill: parseFloat(invoice.subtotal).toFixed(2),
          discount: parseFloat(invoice.discount).toFixed(2),
          total: parseFloat(invoice.total).toFixed(2)
        }
      })

      const columns = [
        { header: 'Invoice #', dataKey: 'invoice_number', width: 30 },
        { header: 'Customer', dataKey: 'customer', width: 30 },
        { header: 'Stations', dataKey: 'stations', width: 40 },
        { header: 'Start', dataKey: 'start', width: 20 },
        { header: 'End', dataKey: 'end', width: 20 },
        { header: 'Time', dataKey: 'time', width: 25 },
        { header: 'Bill', dataKey: 'bill', width: 20 },
        { header: 'Disc', dataKey: 'discount', width: 20 },
        { header: 'Total', dataKey: 'total', width: 20 }
      ]

      const summary = [
        { label: 'Total Profits', value: formatCurrency(dailyRevenue.summary.totalRevenue) },
        { label: 'Bill Amount', value: formatCurrency(dailyRevenue.summary.totalSubtotal) },
        { label: 'Discount', value: formatCurrency(dailyRevenue.summary.totalDiscount) },
        { label: 'Invoices', value: dailyRevenue.summary.invoiceCount }
      ]

      await generateReportTablePDF(`Daily Revenue Report - ${selectedDate}`, summary, columns, tableData, `Daily_Revenue_${selectedDate}.pdf`)
    } catch (e) {
      console.error('PDF Export Error:', e)
      alert('Failed to generate PDF: ' + (e.message || 'Unknown error'))
    }
  }

  // Export Monthly Revenue to Excel
  const exportMonthlyRevenueToExcel = () => {
    if (!monthlyRevenue) {
      alert('No data to export')
      return
    }

    // Sheet 1: Invoices
    const invoiceData = monthlyRevenue.invoices ? monthlyRevenue.invoices.map(invoice => {
      let stationNames = 'N/A'
      try {
        let s = invoice.stations
        if (typeof s === 'string') s = JSON.parse(s)
        if (Array.isArray(s)) stationNames = s.map(i => i.name).join(', ')
        else if (s && s.name) stationNames = s.name
      } catch (e) { }

      return {
        'Invoice #': invoice.invoice_number,
        'Date': formatIndianDate(invoice.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }),
        'Customer': invoice.customer_names || 'N/A',
        'Stations': stationNames,
        'Subtotal': parseFloat(invoice.subtotal).toFixed(2),
        'Discount': parseFloat(invoice.discount).toFixed(2),
        'Total': parseFloat(invoice.total).toFixed(2)
      }
    }) : []

    // Sheet 2: Daily Breakdown
    const dayData = monthlyRevenue.dailyBreakdown ? monthlyRevenue.dailyBreakdown.map(day => ({
      'Day': day.day,
      'Revenue': parseFloat(day.revenue).toFixed(2),
      'Invoices': day.invoiceCount
    })) : []

    // Sheet 3: Summary
    const summaryData = [{
      'Month': selectedMonth,
      'Year': selectedYear,
      'Total Revenue': parseFloat(monthlyRevenue.summary.totalRevenue).toFixed(2),
      'Subtotal': parseFloat(monthlyRevenue.summary.totalSubtotal).toFixed(2),
      'Discount': parseFloat(monthlyRevenue.summary.totalDiscount).toFixed(2),
      'Total Invoices': monthlyRevenue.summary.invoiceCount
    }]

    const wb = XLSX.utils.book_new()
    if (invoiceData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceData), 'Invoices')
    if (dayData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayData), 'Daily Breakdown')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary')

    XLSX.writeFile(wb, `Monthly_Revenue_${selectedMonth}_${selectedYear}.xlsx`)
  }

  // Export Monthly Revenue to PDF
  const exportMonthlyRevenueToPDF = async () => {
    if (!monthlyRevenue || !monthlyRevenue.invoices) return
    try {
      const tableData = monthlyRevenue.invoices.map(invoice => {
        return {
          invoice_number: invoice.invoice_number,
          date: formatIndianDate(invoice.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' }),
          customer: invoice.customer_names || 'N/A',
          subtotal: parseFloat(invoice.subtotal).toFixed(2),
          discount: parseFloat(invoice.discount).toFixed(2),
          total: parseFloat(invoice.total).toFixed(2)
        }
      })

      const columns = [
        { header: 'Invoice #', dataKey: 'invoice_number', width: 40 },
        { header: 'Date', dataKey: 'date', width: 30 },
        { header: 'Customer', dataKey: 'customer', width: 50 },
        { header: 'Subtotal', dataKey: 'subtotal', width: 30 },
        { header: 'Disc', dataKey: 'discount', width: 30 },
        { header: 'Total', dataKey: 'total', width: 30 }
      ]

      const summary = [
        { label: 'Month', value: `${selectedMonth}/${selectedYear}` },
        { label: 'Total Profits', value: formatCurrency(monthlyRevenue.summary.totalRevenue) },
        { label: 'Subtotal', value: formatCurrency(monthlyRevenue.summary.totalSubtotal) },
        { label: 'Discount', value: formatCurrency(monthlyRevenue.summary.totalDiscount) },
        { label: 'Invoices', value: monthlyRevenue.summary.invoiceCount }
      ]

      await generateReportTablePDF(`Monthly Revenue Report - ${selectedMonth}/${selectedYear}`, summary, columns, tableData, `Monthly_Revenue_${selectedMonth}_${selectedYear}.pdf`)
    } catch (e) {
      console.error('PDF Export Error:', e)
      alert('Failed to generate PDF: ' + (e.message || 'Unknown error'))
    }
  }

  // Export Customer Report to PDF
  const exportCustomerReportToPDF = async () => {
    if (!filteredCustomers || filteredCustomers.length === 0) return
    try {
      const tableData = filteredCustomers.map(customer => ({
        name: customer.customerName,
        phone: customer.phoneNumber,
        regDate: formatIndianDate(customer.registrationDate, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        played: customer.timesPlayed,
        spent: parseFloat(customer.totalSpent || 0).toFixed(2)
      }))

      const columns = [
        { header: 'Customer Name', dataKey: 'name', width: 60 },
        { header: 'Phone Number', dataKey: 'phone', width: 40 },
        { header: 'Registration Date', dataKey: 'regDate', width: 50 },
        { header: 'Times Played', dataKey: 'played', width: 30 },
        { header: 'Total Spent', dataKey: 'spent', width: 40 }
      ]

      const summary = [
        { label: 'Report Date', value: getIndianDateString() },
        { label: 'Total Customers', value: filteredCustomers.length }
      ]

      await generateReportTablePDF(
        `Customer Report`,
        summary,
        columns,
        tableData,
        `Customer_Report_${getIndianDateString()}.pdf`
      )
    } catch (e) {
      console.error('PDF Export Error:', e)
      alert('Failed to generate PDF: ' + (e.message || 'Unknown error'))
    }
  }

  // Export Snacks Report to Excel
  const exportSnacksReportToExcel = () => {
    if (!snacksReport || !snacksReport.snacks || snacksReport.snacks.length === 0) {
      alert('No data to export')
      return
    }

    const data = snacksReport.snacks.map(s => ({
      'Snack Name': s.name,
      'Unit Price': parseFloat(s.price).toFixed(2),
      'Quantity Sold': s.quantity,
      'Total Revenue': parseFloat(s.totalRevenue).toFixed(2)
    }))

    const summary = [{
      'Report Type': snacksReportType,
      'Date Reference': snacksReportType === 'date' ? selectedDate : (snacksReportType === 'month' ? `${selectedMonth}/${selectedYear}` : `${snacksStartDate} to ${snacksEndDate}`),
      'Total Revenue': parseFloat(snacksReport.totalRevenue).toFixed(2),
      'Total Invoices': snacksReport.totalInvoices
    }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Snacks Sales')
    XLSX.writeFile(wb, `Snacks_Report_${Date.now()}.xlsx`)
  }

  // Export Snacks Report to PDF
  const exportSnacksReportToPDF = async () => {
    if (!snacksReport || !snacksReport.snacks || snacksReport.snacks.length === 0) return
    try {
      const tableData = snacksReport.snacks.map(s => ({
        name: s.name,
        price: parseFloat(s.price).toFixed(2),
        quantity: s.quantity,
        total: parseFloat(s.totalRevenue).toFixed(2)
      }))

      const columns = [
        { header: 'Snack Name', dataKey: 'name', width: 60 },
        { header: 'Unit Price', dataKey: 'price', width: 40 },
        { header: 'Quantity Sold', dataKey: 'quantity', width: 40 },
        { header: 'Total Revenue', dataKey: 'total', width: 40 }
      ]

      const summary = [
        { label: 'Total Invoices', value: snacksReport.totalInvoices },
        { label: 'Total Revenue', value: formatCurrency(snacksReport.totalRevenue) },
        { label: 'Snacks Sold', value: snacksReport.snacks.reduce((sum, s) => sum + s.quantity, 0) }
      ]

      let reportTitle = 'Snacks Report'
      if (snacksReportType === 'date') reportTitle += ` - ${selectedDate}`
      else if (snacksReportType === 'month') reportTitle += ` - ${selectedMonth}/${selectedYear}`
      else reportTitle += ` - ${snacksStartDate} to ${snacksEndDate}`

      await generateReportTablePDF(
        reportTitle,
        summary,
        columns,
        tableData,
        `Snacks_Report_${Date.now()}.pdf`
      )
    } catch (e) {
      console.error('PDF Export Error:', e)
      alert('Failed to generate PDF: ' + (e.message || 'Unknown error'))
    }
  }

  const handleInvoiceClick = async (invoiceNumber) => {
    try {
      const invoice = await invoicesAPI.getByNumber(invoiceNumber)
      setSelectedInvoice(invoice)
    } catch (err) {
      console.error('Error loading invoice:', err)
      setError('Failed to load invoice details')
    }
  }

  const getCustomerNames = (invoice) => {
    if (!invoice.stations || !Array.isArray(invoice.stations)) {
      return 'N/A'
    }
    const names = invoice.stations
      .map(station => station.customerName)
      .filter(name => name && name.trim() !== '')
      .filter((name, index, self) => self.indexOf(name) === index) // Remove duplicates
    return names.length > 0 ? names.join(', ') : 'N/A'
  }

  return (
    <div className="fixed inset-0 bg-white z-[60] overflow-y-auto lg:left-64">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-lg border-b border-gray-200 z-[70] shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                Reports & Analytics
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {activeTab === 'usage' && 'System Usage Report'}
                {activeTab === 'daily-revenue' && 'Daily Revenue Report'}
                {activeTab === 'monthly-revenue' && 'Monthly Revenue Report'}
                {activeTab === 'customer-report' && 'Customer Report'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 text-3xl sm:text-4xl font-bold transition-colors p-2 hover:bg-gray-100 rounded-lg"
              title="Close Reports"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 py-6 lg:max-w-full">
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600 text-lg">Loading report...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {/* System Usage Report */}
        {activeTab === 'usage' && !loading && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
                />
              </div>
              {usageReport && usageReport.stations && usageReport.stations.length > 0 && (
                <button
                  onClick={exportUsageReportToExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
              )}
            </div>

            {usageReport ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Stations</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {usageReport.summary?.totalStations || 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Active Stations</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {usageReport.summary?.activeStations || 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Total Time</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatHours(usageReport.summary?.totalTime || 0)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Date</div>
                    <div className="text-lg font-bold text-gray-900">
                      {usageReport.date ? formatIndianDate(usageReport.date, { year: 'numeric', month: '2-digit', day: '2-digit' }) : selectedDate}
                    </div>
                  </div>
                </div>

                {usageReport.summary?.byGameType && Object.keys(usageReport.summary.byGameType).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">By Game Type</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(usageReport.summary.byGameType).map(([type, data]) => (
                        <div key={type} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="text-sm font-semibold text-gray-700 mb-2 uppercase">{type}</div>
                          <div className="text-lg font-bold text-gray-900 mb-1">
                            {data.count || 0} {data.count === 1 ? 'station' : 'stations'}
                          </div>
                          <div className="text-sm text-gray-700">
                            {formatHours(data.totalTime || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {usageReport.stations && usageReport.stations.length > 0 ? (
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Station Details</h3>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full text-xs sm:text-sm min-w-[600px]">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Station</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Time</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Start</th>
                            <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">End</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageReport.stations.map((station) => (
                            <tr key={station.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 text-xs sm:text-sm font-semibold">{station.name}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 text-xs sm:text-sm font-bold">{formatTime(station.elapsed_time || 0)}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">{station.start_time || '-'}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">{station.end_time || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-600">
                    No stations found for this date
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <div className="text-gray-600 text-lg mb-2">No data available</div>
                <div className="text-gray-500 text-sm">
                  No station usage data found for the selected date: {formatIndianDate(selectedDate, { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Daily Revenue Report */}
        {activeTab === 'daily-revenue' && !loading && dailyRevenue && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Date
              </label>
              <div className="flex items-center gap-2">
                {/* Previous Date Button */}
                <button
                  onClick={() => {
                    const currentDate = new Date(selectedDate)
                    currentDate.setDate(currentDate.getDate() - 1)
                    setSelectedDate(currentDate.toISOString().split('T')[0])
                  }}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  title="Previous Day"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Date Picker */}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                {/* Next Date Button */}
                <button
                  onClick={() => {
                    const currentDate = new Date(selectedDate)
                    currentDate.setDate(currentDate.getDate() + 1)
                    setSelectedDate(currentDate.toISOString().split('T')[0])
                  }}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  title="Next Day"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Today Button */}
                <button
                  onClick={() => setSelectedDate(getIndianDateString())}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                  title="Go to Today"
                >
                  Today
                </button>

                <div className="h-6 w-px bg-gray-300 mx-1"></div>

                <button
                  onClick={exportDailyRevenueToExcel}
                  className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                  title="Export to Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={exportDailyRevenueToPDF}
                  className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                  title="Export to PDF"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>


            </div>

            <div id="daily-revenue-report">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Profits</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{formatCurrency(dailyRevenue.summary.totalRevenue)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Bill Amount</div>
                  <div className="text-xl font-bold text-gray-900">
                    ₹{formatCurrency(dailyRevenue.summary.totalSubtotal)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Discount</div>
                  <div className="text-xl font-bold text-gray-700">
                    ₹{formatCurrency(dailyRevenue.summary.totalDiscount)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Invoices</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {dailyRevenue.summary.invoiceCount}
                  </div>
                </div>
              </div>

              {dailyRevenue.summary.gameTypeBreakdown && (
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Game Type Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(dailyRevenue.summary.gameTypeBreakdown).map(([type, data]) => (
                      data.stationCount > 0 && (
                        <div key={type} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="text-sm font-semibold text-gray-700 mb-2 uppercase">{type}</div>
                          <div className="text-lg font-bold text-gray-900 mb-1">
                            {data.stationCount} sessions
                          </div>
                          <div className="text-sm text-gray-700 mb-1">
                            {formatHours(data.totalTime)}
                          </div>
                          <div className="text-sm text-gray-900 font-semibold mb-2">
                            ₹{formatCurrency(data.totalRevenue)}
                          </div>
                          {data.customers && data.customers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">Players:</div>
                              <div className="text-xs text-gray-700">
                                {data.customers.join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {dailyRevenue.invoices && dailyRevenue.invoices.length > 0 ? (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Invoice Details</h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-xs sm:text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Invoice #</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Customer</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Stations</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Start Time</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">End Time</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Total played time</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Bill Amount</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Discount</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Total Profits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyRevenue.invoices.map((invoice) => {
                          // Calculate total game played time and gather start/end times
                          let totalGameTime = 0
                          let startTimes = []
                          let endTimes = []

                          try {
                            // Stations data should be in invoice.stations
                            // If not directly available, we may need to fetch the full invoice
                            let stations = invoice.stations

                            // Handle JSONB - could be object, string, or array
                            if (stations) {
                              if (typeof stations === 'string') {
                                try {
                                  stations = JSON.parse(stations)
                                } catch (e) {
                                  console.error('Error parsing stations JSON:', e)
                                  stations = []
                                }
                              }

                              if (Array.isArray(stations)) {
                                totalGameTime = stations.reduce((sum, station) => {
                                  const elapsedTime = parseInt(station?.elapsedTime || station?.elapsed_time || 0)
                                  if (station?.startTime) startTimes.push(station.startTime)
                                  if (station?.endTime) endTimes.push(station.endTime)
                                  return sum + elapsedTime
                                }, 0)
                              } else if (stations && typeof stations === 'object') {
                                // Single station object
                                const elapsedTime = parseInt(stations?.elapsedTime || stations?.elapsed_time || 0)
                                if (stations?.startTime) startTimes.push(stations.startTime)
                                if (stations?.endTime) endTimes.push(stations.endTime)
                                totalGameTime = elapsedTime
                              }
                            }
                          } catch (error) {
                            console.error('Error calculating game time for invoice:', invoice.invoice_number, error)
                            totalGameTime = 0
                          }

                          // Get station names
                          let stationNames = 'N/A'
                          try {
                            let s = invoice.stations
                            if (typeof s === 'string') s = JSON.parse(s)
                            if (Array.isArray(s)) stationNames = s.map(i => i.name).join(', ')
                            else if (s && s.name) stationNames = s.name
                          } catch (e) { }

                          return (
                            <tr key={invoice.invoice_number} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="py-2 sm:py-3 px-2 sm:px-4">
                                <button
                                  onClick={() => handleInvoiceClick(invoice.invoice_number)}
                                  className="text-blue-600 hover:text-blue-700 underline decoration-dotted cursor-pointer font-semibold transition-colors text-xs sm:text-sm"
                                >
                                  {invoice.invoice_number}
                                </button>
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">{invoice.customer_names || 'N/A'}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">{stationNames}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                                {startTimes.length > 0 ? startTimes.map(t => formatTimeOnly(t)).join(', ') : '-'}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                                {endTimes.length > 0 ? endTimes.map(t => formatTimeOnly(t)).join(', ') : '-'}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm font-medium">
                                {formatTime(totalGameTime)}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 text-xs sm:text-sm">₹{formatCurrency(invoice.subtotal)}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">₹{formatCurrency(invoice.discount)}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 font-bold text-xs sm:text-sm">₹{formatCurrency(invoice.total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  No invoices found for this date
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Revenue Report */}
        {activeTab === 'monthly-revenue' && !loading && monthlyRevenue && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Month & Year
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Previous Month Button */}
                <button
                  onClick={() => {
                    let newMonth = selectedMonth - 1
                    let newYear = selectedYear
                    if (newMonth < 1) {
                      newMonth = 12
                      newYear -= 1
                    }
                    setSelectedMonth(newMonth)
                    setSelectedYear(newYear)
                  }}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  title="Previous Month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Month Selector */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {formatIndianDate(new Date(2000, month - 1), { month: 'long' })}
                    </option>
                  ))}
                </select>

                {/* Year Input */}
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  min="2020"
                  max="2100"
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-24"
                />

                {/* Next Month Button */}
                <button
                  onClick={() => {
                    let newMonth = selectedMonth + 1
                    let newYear = selectedYear
                    if (newMonth > 12) {
                      newMonth = 1
                      newYear += 1
                    }
                    setSelectedMonth(newMonth)
                    setSelectedYear(newYear)
                  }}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  title="Next Month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Current Month Button */}
                <button
                  onClick={() => {
                    setSelectedMonth(getIndianMonth())
                    setSelectedYear(getIndianYear())
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                  title="Go to Current Month"
                >
                  Current Month
                </button>

                <div className="h-6 w-px bg-gray-300 mx-1"></div>

                <button
                  onClick={exportMonthlyRevenueToExcel}
                  className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                  title="Export to Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={exportMonthlyRevenueToPDF}
                  className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                  title="Export to PDF"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>

            <div id="monthly-revenue-report">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Revenue</div>
                  <div className="text-3xl font-bold text-gray-900">
                    ₹{formatCurrency(monthlyRevenue.summary.totalRevenue)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Subtotal</div>
                  <div className="text-xl font-bold text-gray-900">
                    ₹{formatCurrency(monthlyRevenue.summary.totalSubtotal)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Discount</div>
                  <div className="text-xl font-bold text-gray-700">
                    ₹{formatCurrency(monthlyRevenue.summary.totalDiscount)}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Invoices</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {monthlyRevenue.summary.invoiceCount}
                  </div>
                </div>
              </div>

              {monthlyRevenue.dailyBreakdown && monthlyRevenue.dailyBreakdown.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Daily Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                    {monthlyRevenue.dailyBreakdown.map((day) => (
                      <div key={day.day} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Day {day.day}</div>
                        <div className="text-lg font-bold text-gray-900">
                          ₹{formatCurrency(day.revenue)}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">
                          {day.invoiceCount} invoices
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {monthlyRevenue.summary.gameTypeBreakdown && (
                <div className="mb-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Game Type Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(monthlyRevenue.summary.gameTypeBreakdown).map(([type, data]) => (
                      data.stationCount > 0 && (
                        <div key={type} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="text-sm font-semibold text-gray-700 mb-2 uppercase">{type}</div>
                          <div className="text-lg font-bold text-gray-900 mb-1">
                            {data.stationCount} sessions
                          </div>
                          <div className="text-sm text-gray-700 mb-1">
                            {formatHours(data.totalTime)}
                          </div>
                          <div className="text-sm text-gray-900 font-semibold mb-2">
                            ₹{formatCurrency(data.totalRevenue)}
                          </div>
                          {data.customers && data.customers.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-600 mb-1">Players:</div>
                              <div className="text-xs text-gray-700">
                                {data.customers.join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {monthlyRevenue.invoices && monthlyRevenue.invoices.length > 0 ? (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">All Invoices</h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0 max-h-96">
                    <table className="w-full text-xs sm:text-sm min-w-[600px]">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Invoice #</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Customer</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Subtotal</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Discount</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Total</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-700 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyRevenue.invoices.map((invoice) => (
                          <tr key={invoice.invoice_number} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <button
                                onClick={() => handleInvoiceClick(invoice.invoice_number)}
                                className="text-blue-600 hover:text-blue-700 underline decoration-dotted cursor-pointer font-semibold transition-colors text-xs sm:text-sm"
                              >
                                {invoice.invoice_number}
                              </button>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">{invoice.customer_names || 'N/A'}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 text-xs sm:text-sm">₹{formatCurrency(invoice.subtotal)}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-700 text-xs sm:text-sm">₹{formatCurrency(invoice.discount)}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-900 font-bold text-xs sm:text-sm">₹{formatCurrency(invoice.total)}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm">
                              {formatIndianDate(invoice.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  No invoices found for this month
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Report */}
        {activeTab === 'customer-report' && !loading && customerReport && (
          <div>
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Customers</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {customerReport.customers?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Export Controls */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md w-full">
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value)
                    setShowAutocomplete(true)
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                  onBlur={() => {
                    // Delay hiding to allow click on suggestion
                    setTimeout(() => setShowAutocomplete(false), 200)
                  }}
                  placeholder="Search by customer name or phone number..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {showAutocomplete && autocompleteSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {autocompleteSuggestions.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => {
                          setCustomerSearchQuery(customer.customerName)
                          setShowAutocomplete(false)
                        }}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{customer.customerName}</div>
                        <div className="text-sm text-gray-600">{customer.phoneNumber}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  disabled={!filteredCustomers || filteredCustomers.length === 0}
                  className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export to Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={exportCustomerReportToPDF}
                  disabled={!filteredCustomers || filteredCustomers.length === 0}
                  className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export to PDF"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>

            {filteredCustomers && filteredCustomers.length > 0 ? (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  Customer Details {customerSearchQuery && `(${filteredCustomers.length} found)`}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th
                          className="text-left py-3 px-4 text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('customerName')}
                        >
                          <div className="flex items-center gap-1">
                            Customer Name
                            {sortConfig.key === 'customerName' && (
                              <span className="text-gray-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('phoneNumber')}
                        >
                          <div className="flex items-center gap-1">
                            Phone Number
                            {sortConfig.key === 'phoneNumber' && (
                              <span className="text-gray-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('registrationDate')}
                        >
                          <div className="flex items-center gap-1">
                            Registration Date
                            {sortConfig.key === 'registrationDate' && (
                              <span className="text-gray-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('timesPlayed')}
                        >
                          <div className="flex items-center gap-1">
                            Times Played
                            {sortConfig.key === 'timesPlayed' && (
                              <span className="text-gray-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="text-left py-3 px-4 text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('totalSpent')}
                        >
                          <div className="flex items-center gap-1">
                            Total Spent
                            {sortConfig.key === 'totalSpent' && (
                              <span className="text-gray-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-900 font-medium">{customer.customerName}</td>
                          <td className="py-3 px-4 text-gray-700">{customer.phoneNumber}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {formatIndianDate(customer.registrationDate, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                          </td>
                          <td className="py-3 px-4 text-gray-900 font-medium">{customer.timesPlayed}</td>
                          <td className="py-3 px-4 text-gray-900 font-semibold">₹{customer.totalSpent.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                {customerSearchQuery ? 'No customers found matching your search' : 'No customers found'}
              </div>
            )}
          </div>
        )}

        {/* Snacks Report */}
        {activeTab === 'snacks-report' && !loading && snacksReport && (
          <div>
            {/* Report Type Selection */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => setSnacksReportType('date')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${snacksReportType === 'date'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  By Date
                </button>
                <button
                  onClick={() => setSnacksReportType('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${snacksReportType === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  By Month
                </button>
                <button
                  onClick={() => setSnacksReportType('range')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${snacksReportType === 'range'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Date Range
                </button>
              </div>

              {/* Date Selection Controls */}
              <div className="flex flex-wrap gap-4 items-end">
                {snacksReportType === 'date' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                    <div className="flex items-center gap-2">
                      {/* Previous Date Button */}
                      <button
                        onClick={() => {
                          const currentDate = new Date(selectedDate)
                          currentDate.setDate(currentDate.getDate() - 1)
                          setSelectedDate(currentDate.toISOString().split('T')[0])
                        }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title="Previous Day"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />

                      {/* Next Date Button */}
                      <button
                        onClick={() => {
                          const currentDate = new Date(selectedDate)
                          currentDate.setDate(currentDate.getDate() + 1)
                          setSelectedDate(currentDate.toISOString().split('T')[0])
                        }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title="Next Day"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Today Button */}
                      <button
                        onClick={() => setSelectedDate(getIndianDateString())}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                        title="Go to Today"
                      >
                        Today
                      </button>
                    </div>
                  </div>
                )}

                {snacksReportType === 'month' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Month & Year</label>
                    <div className="flex items-center gap-2">
                      {/* Previous Month Button */}
                      <button
                        onClick={() => {
                          let newMonth = selectedMonth - 1
                          let newYear = selectedYear
                          if (newMonth < 1) {
                            newMonth = 12
                            newYear -= 1
                          }
                          setSelectedMonth(newMonth)
                          setSelectedYear(newYear)
                        }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title="Previous Month"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                          <option key={month} value={month}>
                            {formatIndianDate(new Date(2000, month - 1), { month: 'long' })}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Array.from({ length: 5 }, (_, i) => getIndianYear() - 2 + i).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>

                      {/* Next Month Button */}
                      <button
                        onClick={() => {
                          let newMonth = selectedMonth + 1
                          let newYear = selectedYear
                          if (newMonth > 12) {
                            newMonth = 1
                            newYear += 1
                          }
                          setSelectedMonth(newMonth)
                          setSelectedYear(newYear)
                        }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title="Next Month"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Current Month Button */}
                      <button
                        onClick={() => {
                          setSelectedMonth(getIndianMonth())
                          setSelectedYear(getIndianYear())
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                        title="Go to Current Month"
                      >
                        Current Month
                      </button>
                    </div>
                  </div>
                )}

                {snacksReportType === 'range' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={snacksStartDate}
                        onChange={(e) => setSnacksStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={snacksEndDate}
                        onChange={(e) => setSnacksEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={exportSnacksReportToExcel}
                    disabled={!snacksReport || !snacksReport.snacks || snacksReport.snacks.length === 0}
                    className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export to Excel"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={exportSnacksReportToPDF}
                    disabled={!snacksReport || !snacksReport.snacks || snacksReport.snacks.length === 0}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export to PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Invoices</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {snacksReport.totalInvoices || 0}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Total Snacks Revenue</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{snacksReport.totalRevenue?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Snacks Sold</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {snacksReport.snacks?.reduce((sum, s) => sum + s.quantity, 0) || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Snacks Sales Table */}
            {snacksReport.snacks && snacksReport.snacks.length > 0 ? (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Snacks Sales Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 text-gray-700 font-semibold">Snack Name</th>
                        <th className="text-left py-3 px-4 text-gray-700 font-semibold">Unit Price</th>
                        <th className="text-left py-3 px-4 text-gray-700 font-semibold">Quantity Sold</th>
                        <th className="text-left py-3 px-4 text-gray-700 font-semibold">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snacksReport.snacks.map((snack) => (
                        <tr key={snack.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-900 font-medium">{snack.name}</td>
                          <td className="py-3 px-4 text-gray-700">₹{snack.price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-gray-900 font-medium">{snack.quantity}</td>
                          <td className="py-3 px-4 text-gray-900 font-semibold">₹{snack.totalRevenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                No snacks sales found for the selected period
              </div>
            )}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceViewer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          readOnly={true}
        />
      )}
    </div>
  )
}

export default Reports

