/**
 * SMS API endpoint
 * Sends SMS messages to Indian mobile numbers using TextLocal API
 * Free tier: ₹100 credits on signup
 */

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phoneNumber, message, invoiceNumber } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'Phone number and message are required' });
  }

  // Validate phone number format (10-digit Indian number)
  const formattedPhone = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!/^[6-9]\d{9}$/.test(formattedPhone)) {
    return res.status(400).json({
      error: 'Invalid phone number format. Must be a 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    });
  }

  console.log('[SMS API] Received request to send SMS');
  console.log('[SMS API] Phone:', formattedPhone);
  console.log('[SMS API] Invoice:', invoiceNumber || 'N/A');
  console.log('[SMS API] Message length:', message.length);

  try {
    const result = await sendViaTextLocal(formattedPhone, message, invoiceNumber);

    console.log('[SMS API] ✅ SMS sent successfully:', result);

    return res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      messageId: result.messageId,
      balance: result.balance,
      phoneNumber: formattedPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$2'), // Mask phone number
    });
  } catch (error) {
    console.error('[SMS API] ❌ Error sending SMS:', error);
    console.error('[SMS API] Error message:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS',
      phoneNumber: formattedPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1***$2'), // Mask phone number
    });
  }
}

/**
 * Send SMS via TextLocal API
 * @param {string} phoneNumber - 10-digit Indian mobile number
 * @param {string} message - SMS message text
 * @param {string} invoiceNumber - Invoice number (optional)
 * @returns {Promise<Object>} - Result with messageId and balance
 */
async function sendViaTextLocal(phoneNumber, message, invoiceNumber = null) {
  // Get TextLocal API credentials from environment variables
  const apiKey = process.env.TEXTLOCAL_API_KEY;
  const sender = process.env.TEXTLOCAL_SENDER || 'TXTLCL'; // Default sender ID (6 characters max)

  console.log('[SMS API] TextLocal config check:', {
    hasApiKey: !!apiKey,
    sender: sender,
  });

  if (!apiKey) {
    console.warn('[SMS API] ⚠️ TextLocal API key not configured.');
    console.warn('[SMS API] To use SMS, set TEXTLOCAL_API_KEY in .env.local');
    console.warn('[SMS API] Get free API key from: https://www.textlocal.in/');
    throw new Error('TextLocal API key not configured. Please set TEXTLOCAL_API_KEY in .env.local');
  }

  // TextLocal API endpoint
  const apiUrl = 'https://api.textlocal.in/send/';

  // Prepare request data
  const formData = new URLSearchParams();
  formData.append('apikey', apiKey);
  formData.append('numbers', `91${phoneNumber}`); // Add 91 country code for India
  formData.append('message', message);
  formData.append('sender', sender.substring(0, 6)); // Sender ID (max 6 characters)
  formData.append('test', process.env.TEXTLOCAL_TEST_MODE === 'true' ? '1' : '0'); // Test mode (optional)

  console.log(`[SMS API] Sending via TextLocal:`);
  console.log(`  To: 91${phoneNumber}`);
  console.log(`  Sender: ${sender}`);
  console.log(`  Message length: ${message.length} characters`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseData = await response.json();

    if (!response.ok || responseData.status !== 'success') {
      console.error(`[SMS API] ❌ TextLocal API error:`);
      console.error(`  Status: ${response.status}`);
      console.error(`  Response:`, responseData);

      const errorMessage = responseData.errors?.[0]?.message ||
        responseData.message ||
        `TextLocal API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    console.log(`[SMS API] ✅ TextLocal SMS sent successfully!`);
    console.log(`  Message ID: ${responseData.batch_id || 'N/A'}`);
    console.log(`  Balance: ${responseData.balance || 'N/A'}`);
    console.log(`  Cost: ${responseData.cost || 'N/A'}`);

    return {
      messageId: responseData.batch_id || responseData.message_id || 'N/A',
      balance: responseData.balance,
      cost: responseData.cost,
      invoiceNumber,
    };
  } catch (error) {
    console.error(`[SMS API] ❌ TextLocal API error:`, error);
    console.error(`  Error message:`, error.message);
    throw error;
  }
}

