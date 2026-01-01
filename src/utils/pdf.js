import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const generateInvoicePDF = async (invoiceData, elementId = 'invoice-content') => {
  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error('Invoice element not found')
  }

  // Get parent container to ensure we capture everything
  const parent = element.parentElement

  // Get computed styles to preserve original appearance BEFORE any modifications
  const computedStyle = window.getComputedStyle(element)
  const computedWidth = computedStyle.width
  const computedMaxWidth = computedStyle.maxWidth

  // Store original styles
  const originalElementStyles = {
    overflow: element.style.overflow,
    maxHeight: element.style.maxHeight,
    height: element.style.height,
    minHeight: element.style.minHeight,
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    position: element.style.position,
  }

  const originalParentStyles = parent ? {
    overflow: parent.style.overflow,
    maxHeight: parent.style.maxHeight,
    height: parent.style.height,
    width: parent.style.width,
    maxWidth: parent.style.maxWidth,
  } : {}

  // Set styles for better PDF rendering - preserve original size
  element.style.overflow = 'visible'
  element.style.maxHeight = 'none'
  element.style.height = 'auto'
  element.style.minHeight = 'auto'
  // Preserve the computed width to maintain size
  if (computedWidth && computedWidth !== 'auto' && computedWidth !== '0px') {
    element.style.width = computedWidth
  } else if (computedMaxWidth && computedMaxWidth !== 'none' && computedMaxWidth !== '0px') {
    element.style.width = computedMaxWidth
  }
  element.style.position = 'relative'

  if (parent) {
    const parentComputedStyle = window.getComputedStyle(parent)
    const parentComputedWidth = parentComputedStyle.width
    const parentComputedMaxWidth = parentComputedStyle.maxWidth

    parent.style.overflow = 'visible'
    parent.style.maxHeight = 'none'
    parent.style.height = 'auto'
    // Preserve parent width to maintain container size
    if (parentComputedWidth && parentComputedWidth !== 'auto' && parentComputedWidth !== '0px') {
      parent.style.width = parentComputedWidth
    } else if (parentComputedMaxWidth && parentComputedMaxWidth !== 'none' && parentComputedMaxWidth !== '0px') {
      parent.style.width = parentComputedMaxWidth
    }
  }

  // Wait for layout to recalculate (shorter wait since we're preserving size)
  await new Promise(resolve => setTimeout(resolve, 50))

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    allowTaint: true,
    removeContainer: false,
    letterRendering: true,
    onclone: (clonedDoc) => {
      // Ensure cloned document matches on-screen layout exactly
      const clonedElement = clonedDoc.getElementById(elementId)
      if (clonedElement) {
        // Remove all constraints
        clonedElement.style.overflow = 'visible'
        clonedElement.style.maxHeight = 'none'
        clonedElement.style.height = 'auto'
        clonedElement.style.minHeight = 'auto'
        // Preserve the original width from computed styles
        const clonedComputedWidth = window.getComputedStyle(clonedElement).width
        if (clonedComputedWidth && clonedComputedWidth !== 'auto') {
          clonedElement.style.width = clonedComputedWidth
        }
        clonedElement.style.position = 'relative'
        clonedElement.style.display = 'flex'
        clonedElement.style.flexDirection = 'column'
        clonedElement.style.padding = '12px'

        // Fix all child elements
        const allChildren = clonedElement.querySelectorAll('*')
        allChildren.forEach((child) => {
          // Remove height constraints
          if (child.style.minHeight === '0px' || child.classList.contains('min-h-0')) {
            child.style.minHeight = 'auto'
          }
          if (child.style.overflow === 'hidden' || child.classList.contains('overflow-hidden')) {
            child.style.overflow = 'visible'
          }
          if (child.style.maxHeight && child.style.maxHeight !== 'none' && child.style.maxHeight !== '100%') {
            const maxHeightValue = child.style.maxHeight
            if (maxHeightValue.includes('vh') || maxHeightValue.includes('px')) {
              child.style.maxHeight = 'none'
            }
          }
        })

        // Fix table alignment and spacing
        const tables = clonedElement.querySelectorAll('table')
        tables.forEach((table) => {
          table.style.width = '100%'
          table.style.borderCollapse = 'separate'
          table.style.borderSpacing = '0'
          table.style.tableLayout = 'auto'

          const cells = table.querySelectorAll('td, th')
          cells.forEach((cell) => {
            // Preserve text alignment
            const isRightAlign = cell.classList.contains('text-right') || cell.style.textAlign === 'right'
            const isLeftAlign = cell.classList.contains('text-left') || cell.style.textAlign === 'left'

            if (isRightAlign) {
              cell.style.textAlign = 'right'
            } else if (isLeftAlign) {
              cell.style.textAlign = 'left'
            }

            // Ensure proper padding
            if (!cell.style.padding || cell.style.padding === '') {
              cell.style.padding = '4px 6px'
            }

            // Ensure proper vertical alignment
            cell.style.verticalAlign = 'top'

            // Fix nested divs in cells
            const cellDivs = cell.querySelectorAll('div')
            cellDivs.forEach((div) => {
              div.style.display = 'block'
              div.style.width = '100%'
            })
          })
        })

        // Fix detailed breakdown grid
        const breakdownGrid = clonedElement.querySelector('.grid')
        if (breakdownGrid) {
          breakdownGrid.style.display = 'grid'
          breakdownGrid.style.gap = '8px'
          breakdownGrid.style.gridAutoRows = 'min-content'
          breakdownGrid.style.width = '100%'
        }

        // Fix flex containers
        const flexContainers = clonedElement.querySelectorAll('.flex')
        flexContainers.forEach((container) => {
          container.style.display = 'flex'
          if (container.classList.contains('justify-between')) {
            container.style.justifyContent = 'space-between'
          }
          if (container.classList.contains('justify-end')) {
            container.style.justifyContent = 'flex-end'
          }
          if (container.classList.contains('items-center')) {
            container.style.alignItems = 'center'
          }
          if (container.classList.contains('items-start')) {
            container.style.alignItems = 'flex-start'
          }
          if (container.classList.contains('flex-col')) {
            container.style.flexDirection = 'column'
          }
        })

        // Ensure text alignment is preserved
        const rightAlignElements = clonedElement.querySelectorAll('.text-right')
        rightAlignElements.forEach((el) => {
          el.style.textAlign = 'right'
        })

        const leftAlignElements = clonedElement.querySelectorAll('.text-left')
        leftAlignElements.forEach((el) => {
          el.style.textAlign = 'left'
        })
      }
    }
  })

  // Remove print class
  element.classList.remove('pdf-export')

  // Restore original styles immediately after capture
  element.style.overflow = originalElementStyles.overflow || ''
  element.style.maxHeight = originalElementStyles.maxHeight || ''
  element.style.height = originalElementStyles.height || ''
  element.style.minHeight = originalElementStyles.minHeight || ''
  element.style.width = originalElementStyles.width || ''
  element.style.maxWidth = originalElementStyles.maxWidth || ''
  element.style.position = originalElementStyles.position || ''

  if (parent) {
    parent.style.overflow = originalParentStyles.overflow || ''
    parent.style.maxHeight = originalParentStyles.maxHeight || ''
    parent.style.height = originalParentStyles.height || ''
    parent.style.width = originalParentStyles.width || ''
    parent.style.maxWidth = originalParentStyles.maxWidth || ''
  }

  const imgData = canvas.toDataURL('image/png', 1.0)
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  // Calculate dimensions with proper DPI conversion
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const dpi = 96 // Standard screen DPI
  const mmToPx = dpi / 25.4 // Convert DPI to mm
  const imgWidthMM = imgWidth / mmToPx
  const imgHeightMM = imgHeight / mmToPx

  // Calculate scaling to fit page width with margins
  const margin = 15 // 15mm margins on each side for better spacing
  const availableWidth = pdfWidth - (margin * 2)
  const availableHeight = pdfHeight - (margin * 2)
  const widthRatio = availableWidth / imgWidthMM
  const heightRatio = availableHeight / imgHeightMM
  const ratio = Math.min(widthRatio, heightRatio, 1) // Don't scale up

  const scaledWidth = imgWidthMM * ratio
  const scaledHeight = imgHeightMM * ratio
  const xOffset = margin + (availableWidth - scaledWidth) / 2
  const yOffset = margin

  // Handle multi-page if content is too tall
  if (scaledHeight > availableHeight) {
    const pageHeight = pdfHeight - (margin * 2)
    let remainingHeight = scaledHeight

    // First page
    const firstPageHeight = Math.min(pageHeight, scaledHeight)
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, firstPageHeight, undefined, 'FAST')

    // Additional pages if needed
    let sourceY = (firstPageHeight / ratio) * mmToPx
    remainingHeight -= firstPageHeight

    while (remainingHeight > 0) {
      pdf.addPage()
      const pageHeightToShow = Math.min(pageHeight, remainingHeight)
      const sourceHeight = (pageHeightToShow / ratio) * mmToPx

      // Create a new canvas for this page section
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = Math.min(sourceHeight, canvas.height - sourceY)
      const ctx = pageCanvas.getContext('2d')

      if (sourceY < canvas.height) {
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, Math.min(sourceHeight, canvas.height - sourceY),
          0, 0, pageCanvas.width, pageCanvas.height
        )

        const pageImgData = pageCanvas.toDataURL('image/png', 1.0)
        pdf.addImage(pageImgData, 'PNG', xOffset, margin, scaledWidth, pageHeightToShow, undefined, 'FAST')
        sourceY += sourceHeight
        remainingHeight -= pageHeightToShow
      } else {
        break
      }
    }
  } else {
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight, undefined, 'FAST')
  }

  const fileName = `invoice-${invoiceData.invoiceNumber}-${Date.now()}.pdf`
  pdf.save(fileName)

  return fileName
}

export const generateReportTablePDF = async (title, summaryData, tableColumns, tableData, filename) => {
  const doc = new jsPDF('l', 'mm', 'a4') // Landscape
  let y = 15
  const pageWidth = 297
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)

  // Title
  doc.setFontSize(18)
  doc.text(title, margin, y)
  y += 10

  // Summary
  if (summaryData) {
    doc.setFontSize(10)
    summaryData.forEach(item => {
      doc.text(`${item.label}: ${item.value}`, margin, y)
      y += 6
    })
    y += 10
  }

  // Draw Table
  const rowHeight = 10
  const headerHeight = 10

  // Columns
  // Calculate default width if not provided
  const definedWidths = tableColumns.reduce((sum, col) => sum + (col.width || 0), 0)
  const undefinedCount = tableColumns.filter(col => !col.width).length
  const defaultWidth = undefinedCount > 0 ? (contentWidth - definedWidths) / undefinedCount : 0

  const drawHeaders = (cursorY) => {
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, cursorY - 6, contentWidth, headerHeight, 'F')
    doc.setFontSize(10)
    doc.setFont(undefined, 'bold')

    let x = margin
    tableColumns.forEach(col => {
      const w = col.width || defaultWidth
      doc.text(col.header, x + 2, cursorY)
      x += w
    })
    doc.setFont(undefined, 'normal')
  }

  // Initial Headers
  drawHeaders(y)
  y += headerHeight

  // Rows
  doc.setFontSize(9)
  tableData.forEach((row, rowIndex) => {
    // Check Page Break
    if (y > 190) {
      doc.addPage()
      y = 15
      drawHeaders(y)
      y += headerHeight
    }

    // Row Background (Alternating)
    if (rowIndex % 2 === 1) {
      doc.setFillColor(250, 250, 250)
      doc.rect(margin, y - 6, contentWidth, rowHeight, 'F')
    }

    let x = margin
    tableColumns.forEach(col => {
      const w = col.width || defaultWidth
      let val = String(row[col.dataKey] || '')

      // Basic truncation
      // For a robust solution we'd use splitTextToSize but keep it simple for now to avoid layout breakage
      if (val.length > 25 && w < 40) {
        val = val.substring(0, 22) + '...'
      }

      doc.text(val, x + 2, y)
      x += w
    })
    y += rowHeight
  })

  doc.save(filename)
}

