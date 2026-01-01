/**
 * WhatsApp API utility for sending invoice messages
 * Uses WhatsApp Desktop/Web link method (opens WhatsApp with pre-filled message)
 */

/**
 * Send invoice via WhatsApp API (background, non-blocking)
 * @param {Object} invoice - Invoice object with stations, total, etc.
 * @param {string} phoneNumber - Customer phone number (with country code, e.g., +919876543210)
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendInvoiceViaWhatsApp(invoice, phoneNumber) {
  if (!phoneNumber) {
    console.warn('[WhatsApp] No phone number provided, skipping WhatsApp send');
    return { success: false, error: 'No phone number provided' };
  }

  // Format phone number (remove spaces, dashes, and other special characters)
  let formattedPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
  
  // Auto-detect and add country code for Indian numbers
  // Indian mobile numbers are 10 digits and start with 6, 7, 8, or 9
  if (!formattedPhone.startsWith('+')) {
    // Check if it's a 10-digit Indian number
    if (/^[6-9]\d{9}$/.test(formattedPhone)) {
      console.log(`[WhatsApp] Detected Indian number, adding +91 prefix: ${formattedPhone}`);
      formattedPhone = `+91${formattedPhone}`;
    } else if (/^91[6-9]\d{9}$/.test(formattedPhone)) {
      // Already has 91 but missing +
      console.log(`[WhatsApp] Adding + prefix to Indian number: ${formattedPhone}`);
      formattedPhone = `+${formattedPhone}`;
    } else {
      console.warn('[WhatsApp] Phone number should include country code (e.g., +91 for India)');
      console.warn(`[WhatsApp] Provided number: ${phoneNumber}, formatted: ${formattedPhone}`);
      return { success: false, error: 'Invalid phone number format. Please include country code (e.g., +91 for India)' };
    }
  }
  
  // Validate the final format
  if (!/^\+\d{10,15}$/.test(formattedPhone)) {
    console.warn(`[WhatsApp] Invalid phone number format after processing: ${formattedPhone}`);
    return { success: false, error: 'Invalid phone number format' };
  }

  // Format invoice message
  const message = formatInvoiceMessage(invoice);

  try {
    console.log('[WhatsApp] Sending invoice via API:', {
      phoneNumber: formattedPhone,
      invoiceNumber: invoice.invoiceNumber,
      messageLength: message.length,
    });

    // Send via API endpoint (non-blocking)
    const response = await fetch('/api/whatsapp/send', {
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

    console.log('[WhatsApp] API Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[WhatsApp] API Error response:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('[WhatsApp] ✅ Invoice sent successfully:', result);
    
    // Wait a bit to check if async sending succeeded or failed
    // The API returns 202 immediately, but actual sending happens async
    // We'll check the server logs for errors
    return { success: true, ...result };
  } catch (error) {
    console.error('[WhatsApp] ❌ Failed to send invoice via API:', error);
    console.error('[WhatsApp] Error details:', {
      message: error.message,
      stack: error.stack,
    });
    // Return failure so frontend can fall back to WhatsApp Web link
    return { success: false, error: error.message };
  }
}

/**
 * Format invoice details as WhatsApp message
 * @param {Object} invoice - Invoice object
 * @returns {string} - Formatted message
 */
function formatInvoiceMessage(invoice) {
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
    month: 'long',
    day: 'numeric',
  });

  let message = `*Gamers Spot - Invoice*\n\n`;
  message += `📄 Invoice #: *${invoice.invoiceNumber}*\n`;
  message += `📅 Date: ${invoiceDate}\n\n`;

  // Customer info
  const firstStation = invoice.stations?.[0];
  if (firstStation?.customerName) {
    message += `👤 Customer: *${firstStation.customerName}*\n\n`;
  }

  // Items
  message += `*Items:*\n`;
  invoice.stations.forEach((station) => {
    const elapsed = station.elapsedTime || 0;
    const timeStr = formatTime(elapsed);
    message += `• ${station.name} - ${timeStr}\n`;
  });

  // Pricing breakdown
  message += `\n*Pricing:*\n`;
  message += `Subtotal: ₹${invoice.subtotal || invoice.total}\n`;
  if (invoice.discount > 0) {
    message += `Discount: -₹${invoice.discount}\n`;
  }
  message += `*Total: ₹${invoice.total}*\n\n`;

  message += `Thank you for gaming with us! 🎮\n`;
  message += `Visit us again soon!`;

  return message;
}

/**
 * Open WhatsApp Web with pre-filled message (simplest method, no API needed)
 * @param {Object} invoice - Invoice object
 * @param {string} phoneNumber - Customer phone number
 */
export function openWhatsAppWebLink(invoice, phoneNumber) {
  if (!phoneNumber) {
    console.warn('[WhatsApp] No phone number provided');
    return;
  }

  // Format phone number (remove spaces, ensure it starts with country code)
  let formattedPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
  
  // Auto-detect and add country code for Indian numbers
  if (!formattedPhone.startsWith('+')) {
    if (/^[6-9]\d{9}$/.test(formattedPhone)) {
      formattedPhone = `91${formattedPhone}`; // Add 91 for India (no + for wa.me)
    } else if (/^91[6-9]\d{9}$/.test(formattedPhone)) {
      // Already has 91, keep it
    } else {
      console.warn('[WhatsApp] Phone number should include country code');
      return;
    }
  } else {
    // Remove + for wa.me URL
    formattedPhone = formattedPhone.replace('+', '');
  }

  // Format invoice message
  const message = formatInvoiceMessage(invoice);

  // Create WhatsApp Web URL
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  
  console.log('[WhatsApp] Opening WhatsApp Web with message');
  console.log('[WhatsApp] URL:', whatsappUrl);
  console.log('[WhatsApp] Phone:', formattedPhone);
  console.log('[WhatsApp] Message preview:', message.substring(0, 100) + '...');
  
  // Try to open WhatsApp Web/App in a new tab/window
  // NEVER redirect current window - keep the app open
  try {
    const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    
    // Check if popup was blocked
    if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed === 'undefined') {
      console.warn('[WhatsApp] Popup blocked by browser');
      // Fallback: Create a temporary link and click it programmatically
      // This works better than window.open in some browsers
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      return { success: true, method: 'web-link-programmatic', url: whatsappUrl, popupBlocked: true };
    }
    
    return { success: true, method: 'web-link', url: whatsappUrl, popupBlocked: false };
  } catch (error) {
    console.error('[WhatsApp] Error opening WhatsApp:', error);
    // Last resort: Create a link element and click it
    // This keeps the app open instead of redirecting
    try {
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      return { success: true, method: 'web-link-fallback', url: whatsappUrl, popupBlocked: true };
    } catch (fallbackError) {
      console.error('[WhatsApp] All methods failed:', fallbackError);
      // If everything fails, return the URL so the caller can handle it
      // (e.g., show a message with a clickable link)
      return { success: false, error: 'Could not open WhatsApp. Please enable popups or click the link manually.', url: whatsappUrl };
    }
  }
}

/**
 * Send WhatsApp message (generic)
 * @param {string} phoneNumber - Phone number with country code
 * @param {string} message - Message text
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendWhatsAppMessage(phoneNumber, message) {
  if (!phoneNumber || !message) {
    return { success: false, error: 'Phone number and message are required' };
  }

  // Format phone number (remove spaces, dashes, and other special characters)
  let formattedPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
  
  // Auto-detect and add country code for Indian numbers
  // Indian mobile numbers are 10 digits and start with 6, 7, 8, or 9
  if (!formattedPhone.startsWith('+')) {
    // Check if it's a 10-digit Indian number
    if (/^[6-9]\d{9}$/.test(formattedPhone)) {
      console.log(`[WhatsApp] Detected Indian number, adding +91 prefix: ${formattedPhone}`);
      formattedPhone = `+91${formattedPhone}`;
    } else if (/^91[6-9]\d{9}$/.test(formattedPhone)) {
      // Already has 91 but missing +
      console.log(`[WhatsApp] Adding + prefix to Indian number: ${formattedPhone}`);
      formattedPhone = `+${formattedPhone}`;
    } else {
      return { success: false, error: 'Phone number should include country code (e.g., +91 for India)' };
    }
  }
  
  // Validate the final format
  if (!/^\+\d{10,15}$/.test(formattedPhone)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: formattedPhone,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    return { success: true, ...result };
  } catch (error) {
    console.error('[WhatsApp] Failed to send message:', error);
    return { success: false, error: error.message };
  }
}

