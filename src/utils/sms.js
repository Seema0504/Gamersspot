/**
 * SMS utility for sending invoice messages to Indian mobile numbers
 * Uses TextLocal API (free tier: ₹100 credits)
 */

/**
 * Format invoice details as SMS message (plain text, concise)
 * @param {Object} invoice - Invoice object
 * @returns {string} - Formatted SMS message
 */
function formatInvoiceSMS(invoice) {
  // Dynamic import to avoid circular dependencies
  let formatTime;
  try {
    const timerModule = require('./timer');
    formatTime = timerModule.formatTime;
  } catch (error) {
    // Fallback if import fails
    formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
  }
  
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  let message = `Gamers Spot Invoice\n`;
  message += `Invoice #: ${invoice.invoiceNumber}\n`;
  message += `Date: ${invoiceDate}\n\n`;

  // Customer info
  const firstStation = invoice.stations?.[0];
  if (firstStation?.customerName) {
    message += `Customer: ${firstStation.customerName}\n\n`;
  }

  // Items (concise format for SMS)
  invoice.stations.forEach((station) => {
    const elapsed = station.elapsedTime || 0;
    const timeStr = formatTime(elapsed);
    message += `${station.name}: ${timeStr}\n`;
  });

  // Pricing (concise)
  message += `\nSubtotal: ₹${invoice.subtotal || invoice.total}`;
  if (invoice.discount > 0) {
    message += `\nDiscount: -₹${invoice.discount}`;
  }
  message += `\nTotal: ₹${invoice.total}\n\n`;

  message += `Thank you! 🎮`;

  return message;
}

/**
 * Send invoice via SMS API
 * @param {Object} invoice - Invoice object with stations, total, etc.
 * @param {string} phoneNumber - Customer phone number (10-digit Indian number)
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendInvoiceViaSMS(invoice, phoneNumber) {
  if (!phoneNumber) {
    console.warn('[SMS] No phone number provided, skipping SMS send');
    return { success: false, error: 'No phone number provided' };
  }

  // Format phone number (remove spaces, dashes, and other special characters)
  let formattedPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
  
  // Auto-detect and format Indian numbers (10 digits starting with 6-9)
  if (/^[6-9]\d{9}$/.test(formattedPhone)) {
    // Valid 10-digit Indian number - keep as is (API expects 10 digits)
    console.log(`[SMS] Valid Indian number: ${formattedPhone}`);
  } else if (/^91[6-9]\d{9}$/.test(formattedPhone)) {
    // Has 91 prefix, remove it
    formattedPhone = formattedPhone.substring(2);
    console.log(`[SMS] Removed 91 prefix: ${formattedPhone}`);
  } else if (formattedPhone.startsWith('+91')) {
    // Has +91 prefix, remove it
    formattedPhone = formattedPhone.substring(3);
    console.log(`[SMS] Removed +91 prefix: ${formattedPhone}`);
  } else {
    console.warn('[SMS] Invalid phone number format:', phoneNumber);
    return { success: false, error: 'Invalid phone number format. Please provide a 10-digit Indian mobile number.' };
  }

  // Validate final format (10 digits starting with 6-9)
  if (!/^[6-9]\d{9}$/.test(formattedPhone)) {
    console.warn(`[SMS] Invalid phone number format after processing: ${formattedPhone}`);
    return { success: false, error: 'Invalid phone number format. Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.' };
  }

  // Format invoice message
  const message = formatInvoiceSMS(invoice);

  try {
    console.log('[SMS] Sending invoice via SMS:', {
      phoneNumber: formattedPhone,
      invoiceNumber: invoice.invoiceNumber,
      messageLength: message.length,
    });

    // Send via API endpoint
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: formattedPhone,
        message: message,
        invoiceNumber: invoice.invoiceNumber,
      }),
    });

    console.log('[SMS] API Response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, get text response
        const textResponse = await response.text().catch(() => 'Unknown error');
        console.error('[SMS] API Error (non-JSON response):', textResponse);
        throw new Error(`SMS API error: ${response.status} ${response.statusText} - ${textResponse}`);
      }
      console.error('[SMS] API Error response:', errorData);
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[SMS] ✅ Invoice sent successfully via SMS:', result);
    
    return { success: true, ...result };
  } catch (error) {
    console.error('[SMS] ❌ Failed to send invoice via SMS:', error);
    console.error('[SMS] Error details:', {
      message: error.message,
      stack: error.stack,
    });
    return { success: false, error: error.message };
  }
}

