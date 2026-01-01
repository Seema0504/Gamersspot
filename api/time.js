/**
 * Server Time API
 * Provides accurate server-side time for client synchronization
 * This ensures time calculations are accurate even when client time is wrong or system goes idle
 */

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Get current UTC time
      const now = new Date();

      // Format time string in IST (24-hour format HH:MM:SS) - CRITICAL: Use Asia/Kolkata timezone
      const timeFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Use 24-hour format
      });
      const timeString = timeFormatter.format(now);

      // Format date string in IST (YYYY-MM-DD)
      const dateFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const dateParts = dateFormatter.formatToParts(now);
      const year = dateParts.find(p => p.type === 'year').value;
      const month = dateParts.find(p => p.type === 'month').value;
      const day = dateParts.find(p => p.type === 'day').value;
      // Ensure proper format: YYYY-MM-DD
      const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Format date-time string
      const dateTimeString = `${dateString} ${timeString}`;

      // Calculate IST timestamp (UTC + 5:30 offset)
      const utcTime = now.getTime();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const istTimestamp = utcTime + istOffset;

      // Removed verbose logging - time API is called every second by frontend
      // Only log errors if needed

      return res.status(200).json({
        timestamp: istTimestamp, // Milliseconds since epoch (IST-adjusted)
        timeString, // HH:MM:SS format in IST
        dateString, // YYYY-MM-DD format in IST
        dateTimeString, // YYYY-MM-DD HH:MM:SS format in IST
        iso: now.toISOString(), // ISO string for database storage (UTC)
        timezone: 'Asia/Kolkata',
        timezoneOffset: '+05:30' // IST offset
      });
    } catch (error) {
      console.error('Server time error:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get server time'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

