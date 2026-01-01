import { getDbClient, closeDbClient } from './_lib/db.js';
import { authenticateToken, requireActiveSubscription } from './_lib/middleware/authMiddleware.js';

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apply authentication middleware
  return new Promise((resolve) => {
    authenticateToken(req, res, async () => {
      await requireActiveSubscription(req, res, async () => {
        // Get shop_id from authenticated user
        const shopId = req.user?.shopId;

        if (!shopId) {
          res.status(403).json({ error: 'Shop context missing' });
          return resolve();
        }

        // Get database client (local or Vercel)
        let db = null;
        try {
          db = await getDbClient();
          const client = db.client;

          if (!client) {
            console.error('Database client is null');
            res.status(500).json({ error: 'Database connection failed' });
            return resolve();
          }

          if (req.method === 'GET') {
            const { type, date, month, year, startDate, endDate } = req.query;

            if (type === 'customer-report') {
              try {
                // Customer report with registration date, play count, and total spent
                // First, get all customers
                // Convert created_at from UTC to IST timezone for accurate display
                const customersResult = await client.query(`
            SELECT 
              id,
              phone_number as "phoneNumber",
              customer_name as "customerName",
              created_at AT TIME ZONE 'Asia/Kolkata' as "registrationDate"
            FROM customers
            WHERE shop_id = $1
            ORDER BY created_at DESC
          `, [shopId]);

                // Get all invoices with their stations data (filtered by shop)
                const invoicesResult = await client.query(`
            SELECT 
              id,
              invoice_number,
              stations,
              total
            FROM invoices
            WHERE shop_id = $1
          `, [shopId]);

                // Process the data to calculate times played and total spent per customer
                const customerStats = {};

                customersResult.rows.forEach(customer => {
                  customerStats[customer.phoneNumber] = {
                    id: customer.id,
                    phoneNumber: customer.phoneNumber,
                    customerName: customer.customerName,
                    registrationDate: customer.registrationDate,
                    timesPlayed: 0,
                    totalSpent: 0
                  };
                });

                // Count plays and calculate spending from invoices
                invoicesResult.rows.forEach(invoice => {
                  try {
                    const stations = typeof invoice.stations === 'string'
                      ? JSON.parse(invoice.stations)
                      : invoice.stations;

                    if (Array.isArray(stations)) {
                      stations.forEach(station => {
                        const phone = station.customerPhone || '';
                        if (phone && customerStats[phone]) {
                          customerStats[phone].timesPlayed += 1;
                          // Calculate customer's share of invoice (if multiple stations, divide equally)
                          const customerShare = parseFloat(invoice.total) / stations.length;
                          customerStats[phone].totalSpent += customerShare;
                        }
                      });
                    }
                  } catch (parseError) {
                    console.error('Error parsing invoice stations:', parseError);
                    // Continue with next invoice
                  }
                });

                // Convert to array and format
                const customers = Object.values(customerStats).map(customer => ({
                  id: customer.id,
                  phoneNumber: customer.phoneNumber,
                  customerName: customer.customerName,
                  registrationDate: customer.registrationDate,
                  timesPlayed: customer.timesPlayed,
                  totalSpent: parseFloat(customer.totalSpent.toFixed(2))
                }));

                await closeDbClient(db);
                res.status(200).json({ customers });
                return resolve();
              } catch (customerReportError) {
                console.error('Error generating customer report:', customerReportError);
                await closeDbClient(db);
                res.status(500).json({
                  error: 'Failed to generate customer report',
                  details: customerReportError.message
                });
                return resolve();
              }
            }

            if (type === 'usage') {
              try {
                // System usage report by date
                // Use Indian timezone for date calculations
                const now = new Date()
                const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
                const targetDate = date || istDate.toISOString().split('T')[0];

                console.log(`[Usage Report] Fetching data for date: ${targetDate}`);

                // Query ALL stations for this shop - always return all stations regardless of date
                const { rows: allStations } = await client.query(`
            SELECT 
              id,
              name,
              game_type,
              customer_name,
              elapsed_time,
              is_running,
              start_time,
              end_time,
              extra_controllers,
              snacks,
              created_at,
              updated_at
            FROM stations
            WHERE shop_id = $1
            ORDER BY id ASC
          `, [shopId]);

                console.log(`[Usage Report] Found ${allStations.length} total stations in database`);
                if (allStations.length === 0) {
                  console.warn(`[Usage Report] WARNING: No stations found in database!`);
                }

                // Always return ALL stations regardless of date
                // For stations that were active on the target date, show their actual data
                // For stations not active on that date, show with zero/empty values
                const rows = allStations.map(station => {
                  // Check if station has usage data for the target date
                  // We check if start_time or updated_at date matches the target date
                  let hasDataForDate = false;

                  // Check start_time first (most accurate indicator of activity on that date)
                  if (station.start_time) {
                    try {
                      // start_time might be in format "HH:MM:SS" or ISO string
                      // If it's just time, we need to check updated_at date
                      // If it's a full date-time, extract the date part
                      const startTimeStr = String(station.start_time);
                      if (startTimeStr.includes('T') || startTimeStr.includes('-')) {
                        // It's a date-time string
                        const startDate = new Date(station.start_time);
                        const startDateStr = startDate.toISOString().split('T')[0];
                        hasDataForDate = startDateStr === targetDate;
                      } else {
                        // It's just time, check updated_at date instead
                        if (station.updated_at) {
                          const updatedDate = new Date(station.updated_at);
                          const updatedDateStr = updatedDate.toISOString().split('T')[0];
                          hasDataForDate = updatedDateStr === targetDate;
                        }
                      }
                    } catch (e) {
                      console.warn(`[Usage Report] Error parsing start_time for station ${station.id}:`, e);
                    }
                  }

                  // If start_time check didn't work, check updated_at date
                  if (!hasDataForDate && station.updated_at) {
                    try {
                      const updatedDate = new Date(station.updated_at);
                      const updatedDateStr = updatedDate.toISOString().split('T')[0];
                      hasDataForDate = updatedDateStr === targetDate;
                    } catch (e) {
                      console.warn(`[Usage Report] Error parsing updated_at for station ${station.id}:`, e);
                    }
                  }

                  // Check if target date is today
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = targetDate === today;

                  // Helper function to properly parse is_running from database
                  const parseIsRunning = (value) => {
                    if (value === true || value === 1 || value === 'true' || value === 't' || String(value).toLowerCase() === 'true') {
                      return true;
                    }
                    return false;
                  };

                  // For today's date, ALWAYS preserve the current is_running status
                  // For past dates, only show is_running if it was running on that date
                  const preservedIsRunning = isToday
                    ? parseIsRunning(station.is_running)  // For today, always use current status
                    : (hasDataForDate ? parseIsRunning(station.is_running) : false);  // For past dates, only if has data

                  // If station has data for target date, return as is
                  // Otherwise, return station with zero/empty values for that date
                  if (hasDataForDate) {
                    return {
                      ...station,
                      is_running: preservedIsRunning  // Use preserved value
                    };
                  } else {
                    // Return station with zero/empty values but keep the station info
                    // For today's date, preserve is_running status to show current active stations
                    return {
                      id: station.id,
                      name: station.name,
                      game_type: station.game_type,
                      customer_name: null,
                      elapsed_time: isToday ? (parseInt(station.elapsed_time) || 0) : 0,
                      is_running: preservedIsRunning,  // Use preserved value
                      start_time: isToday ? station.start_time : null,
                      end_time: null,
                      extra_controllers: 0,
                      snacks: station.snacks || {},
                      created_at: station.created_at,
                      updated_at: station.updated_at
                    };
                  }
                });

                console.log(`[Usage Report] Returning ${rows.length} stations for date ${targetDate}`);

                // Debug: Log ALL stations with their status
                console.log(`[Usage Report] === ALL STATIONS DEBUG ===`);
                rows.forEach(station => {
                  console.log(`[Usage Report] Station: ${station.name}`);
                  console.log(`  - is_running: ${station.is_running} (type: ${typeof station.is_running})`);
                  console.log(`  - elapsed_time: ${station.elapsed_time}`);
                  console.log(`  - start_time: ${station.start_time}`);
                  console.log(`  - end_time: ${station.end_time}`);
                  console.log(`  - customer_name: ${station.customer_name}`);
                });
                console.log(`[Usage Report] === END DEBUG ===`);

                // Calculate totals
                const totalStations = rows.length;
                const totalTime = rows.reduce((sum, row) => sum + (parseInt(row.elapsed_time) || 0), 0);
                // Count stations that are currently running (is_running = true)
                // Check if target date is today - if so, show current running stations
                const today = new Date().toISOString().split('T')[0];
                const isToday = targetDate === today;

                console.log(`[Usage Report] Target date: ${targetDate}, Today: ${today}, IsToday: ${isToday}`);

                const activeStations = rows.filter(row => {
                  // For today's date, show stations that are currently running
                  // A station is active if it has started but not ended
                  if (isToday) {
                    // Primary check: has start_time but no end_time (most reliable indicator)
                    const hasStartTime = row.start_time &&
                      row.start_time !== null &&
                      row.start_time !== '' &&
                      String(row.start_time).trim() !== '';
                    const hasNoEndTime = !row.end_time ||
                      row.end_time === null ||
                      row.end_time === '' ||
                      String(row.end_time).trim() === '';

                    // Secondary check: is_running flag (handle different boolean representations)
                    const isRunningFlag = row.is_running === true ||
                      row.is_running === 'true' ||
                      row.is_running === 1 ||
                      row.is_running === 't' ||
                      String(row.is_running).toLowerCase() === 'true';

                    // Tertiary check: has elapsed time (timer has been running)
                    const hasElapsedTime = (parseInt(row.elapsed_time) || 0) > 0;

                    // Station is active if:
                    // 1. Has started but not ended (most reliable), OR
                    // 2. is_running flag is true, OR
                    // 3. Has elapsed time > 0
                    const isActive = (hasStartTime && hasNoEndTime) || isRunningFlag || hasElapsedTime;

                    if (isActive) {
                      console.log(`[Usage Report] ✓ Active: ${row.name} | is_running=${row.is_running} (${typeof row.is_running}) | start=${row.start_time} | end=${row.end_time} | elapsed=${row.elapsed_time}`);
                    } else {
                      console.log(`[Usage Report] ✗ Inactive: ${row.name} | is_running=${row.is_running} (${typeof row.is_running}) | start=${row.start_time} | end=${row.end_time} | elapsed=${row.elapsed_time}`);
                    }

                    return isActive;
                  }

                  // For past dates, count stations that were running on that date
                  // Check is_running flag (handle different boolean representations)
                  const isRunningFlag = row.is_running === true ||
                    row.is_running === 'true' ||
                    row.is_running === 1 ||
                    row.is_running === 't' ||
                    String(row.is_running).toLowerCase() === 'true';

                  // Station was active if it has customer_name, elapsed_time, or is_running flag
                  return isRunningFlag ||
                    (row.customer_name && row.customer_name.trim() !== '') ||
                    (parseInt(row.elapsed_time) || 0) > 0;
                }).length;

                console.log(`[Usage Report] Calculated active stations: ${activeStations}`);

                // Group by game type - count all stations of each type
                const byGameType = rows.reduce((acc, row) => {
                  const type = row.game_type || 'Unknown';
                  if (!acc[type]) {
                    acc[type] = {
                      count: 0,
                      totalTime: 0
                    };
                  }
                  acc[type].count++;
                  // Only count time for stations active on the target date
                  if (row.customer_name && row.customer_name.trim() !== '') {
                    acc[type].totalTime += parseInt(row.elapsed_time) || 0;
                  }
                  return acc;
                }, {});

                const stationsArray = rows.map(row => {
                  try {
                    return {
                      ...row,
                      snacks: typeof row.snacks === 'string' ? JSON.parse(row.snacks) : (row.snacks || {})
                    };
                  } catch (e) {
                    console.warn(`[Usage Report] Error parsing snacks for station ${row.id}:`, e);
                    return {
                      ...row,
                      snacks: {}
                    };
                  }
                });

                const response = {
                  date: targetDate,
                  summary: {
                    totalStations,
                    activeStations,
                    totalTime,
                    totalHours: (totalTime / 3600).toFixed(2),
                    byGameType
                  },
                  stations: stationsArray
                };

                console.log(`[Usage Report] Returning data: ${totalStations} stations, ${totalTime}s total time, ${stationsArray.length} stations in array`);
                console.log(`[Usage Report] Sample station:`, stationsArray[0] || 'No stations');
                await closeDbClient(db);
                res.status(200).json(response);
                return resolve();
              } catch (error) {
                console.error('[Usage Report] Error:', error);
                await closeDbClient(db);
                res.status(500).json({
                  error: 'Failed to fetch usage report',
                  message: error.message
                });
                return resolve();
              }
            }

            if (type === 'daily-revenue') {
              // Daily revenue report
              // Use Indian timezone for date calculations
              const now = new Date()
              const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
              const targetDate = date || istDate.toISOString().split('T')[0];

              console.log(`[Daily Revenue] Target date: ${targetDate}`);

              // Query invoices for the target date
              // The created_at field is stored as TIMESTAMPTZ in UTC
              // We convert it to Asia/Kolkata timezone and then extract the date for comparison
              const { rows } = await client.query(`
          SELECT 
            invoice_number,
            subtotal,
            discount,
            total,
            created_at,
            stations,
            to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as invoice_date_ist
          FROM invoices
          WHERE shop_id = $1 AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $2
          ORDER BY invoice_number DESC  -- Sort by invoice number for consistent ordering
        `, [shopId, targetDate]);

              console.log(`[Daily Revenue] Found ${rows.length} invoices for ${targetDate}`);

              const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
              const totalSubtotal = rows.reduce((sum, row) => sum + parseFloat(row.subtotal || 0), 0);
              const totalDiscount = rows.reduce((sum, row) => sum + parseFloat(row.discount || 0), 0);
              const invoiceCount = rows.length;

              // Calculate game type breakdown from all invoices
              const gameTypeBreakdown = {
                'Playstation': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 },
                'PlayStation': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 }, // Legacy support
                'Steering Wheel': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 },
                'System': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 }
              };

              // Extract customer names and game type info from stations data
              const invoicesWithCustomers = rows.map(row => {
                let customerNames = 'N/A';
                try {
                  // Handle JSONB - PostgreSQL returns it as object or string depending on driver
                  let stations = row.stations;

                  // Debug: Log the raw row structure
                  console.log('=== Daily Revenue - Invoice:', row.invoice_number, '===');
                  console.log('Row keys:', Object.keys(row));
                  console.log('Raw stations type:', typeof stations);
                  console.log('Raw stations is array?', Array.isArray(stations));

                  // Normalize: Convert to array if needed
                  if (!Array.isArray(stations)) {
                    if (typeof stations === 'string') {
                      // If it's a string, parse it
                      stations = JSON.parse(stations);
                    } else if (typeof stations === 'object' && stations !== null) {
                      // If it's an object, check if it's already an array-like structure
                      // or if we need to stringify and parse
                      if (Array.isArray(stations)) {
                        // Already an array, use it
                      } else {
                        // Try to stringify and parse to normalize
                        const str = JSON.stringify(stations);
                        stations = JSON.parse(str);
                      }
                    }
                  }

                  console.log('Normalized stations type:', typeof stations);
                  console.log('Normalized stations is array?', Array.isArray(stations));
                  console.log('Normalized stations:', JSON.stringify(stations, null, 2));

                  if (Array.isArray(stations) && stations.length > 0) {
                    // console.log('Processing', stations.length, 'stations');
                    const names = stations
                      .map((station, index) => {
                        // Debug each station
                        // Debug each station - Logging silenced
                        /*
                        console.log(`Station ${index}:`, {
                          id: station?.id,
                          name: station?.name,
                          hasCustomerName: station && 'customerName' in station,
                          customerName: station?.customerName,
                          customerNameType: typeof station?.customerName,
                          allKeys: station ? Object.keys(station) : []
                        });
                        */

                        // Try multiple possible field names - customerName should be the correct one
                        const name = station?.customerName ||
                          station?.customer_name ||
                          station?.customer ||
                          '';

                        // Track game type breakdown
                        const gameType = station?.gameType || station?.game_type || 'Unknown';
                        const elapsedTime = parseInt(station?.elapsedTime || station?.elapsed_time || 0);
                        const stationRevenue = parseFloat(row.total || 0) / stations.length; // Approximate per station

                        // Update game type breakdown
                        // Normalize game type (PS5 = PlayStation for display)
                        const normalizedGameType = (gameType === 'PS5' || gameType === 'PlayStation' || gameType === 'Playstation') ? 'Playstation' : gameType;
                        if (gameTypeBreakdown[normalizedGameType] || gameTypeBreakdown[gameType]) {
                          const targetType = gameTypeBreakdown[normalizedGameType] || gameTypeBreakdown[gameType];
                          if (targetType) {
                            targetType.totalTime += elapsedTime;
                            targetType.totalRevenue += stationRevenue;
                            targetType.stationCount += 1;
                            if (name && name.trim() !== '' && !targetType.customers.includes(name)) {
                              targetType.customers.push(name);
                            }
                          }
                        }

                        console.log(`  -> Extracted name: "${name}"`);
                        return name;
                      })
                      .filter(name => name && typeof name === 'string' && name.trim() !== '')
                      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

                    console.log('Final extracted customer names array:', names);
                    customerNames = names.length > 0 ? names.join(', ') : 'N/A';
                    console.log('Final customerNames string:', customerNames);
                  } else {
                    console.log('Stations is not an array or is empty. Type:', typeof stations, 'Is array:', Array.isArray(stations), 'Value:', stations);
                  }
                } catch (e) {
                  console.error('Error parsing stations for customer names:', e);
                  console.error('Error stack:', e.stack);
                  console.error('Row data:', JSON.stringify(row, null, 2));
                }
                return {
                  ...row,
                  customer_names: customerNames
                };
              });

              await closeDbClient(db);
              res.status(200).json({
                date: targetDate,
                summary: {
                  invoiceCount,
                  totalRevenue: totalRevenue.toFixed(2),
                  totalSubtotal: totalSubtotal.toFixed(2),
                  totalDiscount: totalDiscount.toFixed(2),
                  gameTypeBreakdown
                },
                invoices: invoicesWithCustomers
              });
              return resolve();
            }

            if (type === 'monthly-revenue') {
              // Monthly revenue report
              // Use Indian timezone for date calculations
              const now = new Date()
              const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
              const targetMonth = month || istDate.getMonth() + 1;
              const targetYear = year || istDate.getFullYear();

              // Convert created_at from UTC to IST timezone for accurate display (filtered by shop)
              const { rows } = await client.query(`
          SELECT 
            invoice_number,
            subtotal,
            discount,
            total,
            created_at,
            stations
          FROM invoices
          WHERE shop_id = $1
            AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = $2 
            AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $3
          ORDER BY created_at DESC
        `, [shopId, targetMonth, targetYear]);

              const totalRevenue = rows.reduce((sum, row) => sum + parseFloat(row.total || 0), 0);
              const totalSubtotal = rows.reduce((sum, row) => sum + parseFloat(row.subtotal || 0), 0);
              const totalDiscount = rows.reduce((sum, row) => sum + parseFloat(row.discount || 0), 0);
              const invoiceCount = rows.length;

              // Calculate game type breakdown from all invoices
              const gameTypeBreakdown = {
                'Playstation': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 },
                'PlayStation': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 }, // Legacy support
                'Steering Wheel': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 },
                'System': { totalTime: 0, totalRevenue: 0, customers: [], stationCount: 0 }
              };

              // Daily breakdown
              const dailyBreakdown = rows.reduce((acc, row) => {
                // Convert to Indian timezone for day extraction
                const createdDate = new Date(row.created_at)
                const istDate = new Date(createdDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
                const day = istDate.getDate();
                if (!acc[day]) {
                  acc[day] = { count: 0, revenue: 0 };
                }
                acc[day].count++;
                acc[day].revenue += parseFloat(row.total || 0);
                return acc;
              }, {});

              // Extract customer names and game type info from stations data
              const invoicesWithCustomers = rows.map(row => {
                let customerNames = 'N/A';
                try {
                  // Handle JSONB - PostgreSQL returns it as object or string depending on driver
                  let stations = row.stations;

                  // Debug: Log the raw row structure
                  console.log('=== Monthly Revenue - Invoice:', row.invoice_number, '===');
                  console.log('Row keys:', Object.keys(row));
                  console.log('Raw stations type:', typeof stations);
                  console.log('Raw stations is array?', Array.isArray(stations));

                  // Normalize: Convert to array if needed
                  if (!Array.isArray(stations)) {
                    if (typeof stations === 'string') {
                      // If it's a string, parse it
                      stations = JSON.parse(stations);
                    } else if (typeof stations === 'object' && stations !== null) {
                      // If it's an object, check if it's already an array-like structure
                      // or if we need to stringify and parse
                      if (Array.isArray(stations)) {
                        // Already an array, use it
                      } else {
                        // Try to stringify and parse to normalize
                        const str = JSON.stringify(stations);
                        stations = JSON.parse(str);
                      }
                    }
                  }

                  console.log('Normalized stations type:', typeof stations);
                  console.log('Normalized stations is array?', Array.isArray(stations));
                  console.log('Normalized stations:', JSON.stringify(stations, null, 2));

                  if (Array.isArray(stations) && stations.length > 0) {
                    console.log('Processing', stations.length, 'stations');
                    const names = stations
                      .map((station, index) => {
                        // Debug each station
                        console.log(`Station ${index}:`, {
                          id: station?.id,
                          name: station?.name,
                          hasCustomerName: station && 'customerName' in station,
                          customerName: station?.customerName,
                          customerNameType: typeof station?.customerName,
                          allKeys: station ? Object.keys(station) : []
                        });

                        // Try multiple possible field names - customerName should be the correct one
                        const name = station?.customerName ||
                          station?.customer_name ||
                          station?.customer ||
                          '';

                        // Track game type breakdown
                        const gameType = station?.gameType || station?.game_type || 'Unknown';
                        const elapsedTime = parseInt(station?.elapsedTime || station?.elapsed_time || 0);
                        const stationRevenue = parseFloat(row.total || 0) / stations.length; // Approximate per station

                        // Update game type breakdown
                        // Normalize game type (PS5 = PlayStation for display)
                        const normalizedGameType = (gameType === 'PS5' || gameType === 'PlayStation' || gameType === 'Playstation') ? 'Playstation' : gameType;
                        if (gameTypeBreakdown[normalizedGameType] || gameTypeBreakdown[gameType]) {
                          const targetType = gameTypeBreakdown[normalizedGameType] || gameTypeBreakdown[gameType];
                          if (targetType) {
                            targetType.totalTime += elapsedTime;
                            targetType.totalRevenue += stationRevenue;
                            targetType.stationCount += 1;
                            if (name && name.trim() !== '' && !targetType.customers.includes(name)) {
                              targetType.customers.push(name);
                            }
                          }
                        }

                        console.log(`  -> Extracted name: "${name}"`);
                        return name;
                      })
                      .filter(name => name && typeof name === 'string' && name.trim() !== '')
                      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

                    console.log('Final extracted customer names array:', names);
                    customerNames = names.length > 0 ? names.join(', ') : 'N/A';
                    console.log('Final customerNames string:', customerNames);
                  } else {
                    console.log('Stations is not an array or is empty. Type:', typeof stations, 'Is array:', Array.isArray(stations), 'Value:', stations);
                  }
                } catch (e) {
                  console.error('Error parsing stations for customer names:', e);
                  console.error('Error stack:', e.stack);
                  console.error('Row data:', JSON.stringify(row, null, 2));
                }
                return {
                  ...row,
                  customer_names: customerNames
                };
              });

              await closeDbClient(db);
              res.status(200).json({
                month: targetMonth,
                year: targetYear,
                summary: {
                  invoiceCount,
                  totalRevenue: totalRevenue.toFixed(2),
                  totalSubtotal: totalSubtotal.toFixed(2),
                  totalDiscount: totalDiscount.toFixed(2)
                },
                dailyBreakdown: Object.entries(dailyBreakdown).map(([day, data]) => ({
                  day: parseInt(day),
                  invoiceCount: data.count,
                  revenue: parseFloat(data.revenue.toFixed(2))
                })).sort((a, b) => a.day - b.day),
                invoices: invoicesWithCustomers
              });
              return resolve();
            }

            if (type === 'snacks-report') {
              try {
                // Snacks sales report with date selection, monthly, or date range
                let query = '';
                let params = [];

                console.log('Snacks report requested:', { type, date, month, year, startDate, endDate });

                if (startDate && endDate) {
                  // Date range report (filtered by shop)
                  query = `
              SELECT 
                invoice_number,
                stations,
                created_at,
                total
              FROM invoices
              WHERE shop_id = $1
                AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') >= $2
                AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= $3
              ORDER BY created_at DESC
            `;
                  params = [shopId, startDate, endDate];
                } else if (month && year) {
                  // Monthly report (filtered by shop)
                  query = `
              SELECT 
                invoice_number,
                stations,
                created_at,
                total
              FROM invoices
              WHERE shop_id = $1
                AND EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = $2 
                AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = $3
              ORDER BY created_at DESC
            `;
                  params = [shopId, parseInt(month), parseInt(year)];
                } else if (date) {
                  // Single date report (filtered by shop)
                  query = `
              SELECT 
                invoice_number,
                stations,
                created_at,
                total
              FROM invoices
              WHERE shop_id = $1
                AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $2
              ORDER BY created_at DESC
            `;
                  params = [shopId, date];
                } else {
                  // Default: today's date (filtered by shop)
                  const now = new Date()
                  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
                  const today = istDate.toISOString().split('T')[0];
                  query = `
              SELECT 
                invoice_number,
                stations,
                created_at,
                total
              FROM invoices
              WHERE shop_id = $1
                AND to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = $2
              ORDER BY created_at DESC
            `;
                  params = [shopId, today];
                }

                console.log('Executing query with params:', params);
                const { rows } = await client.query(query, params);
                console.log('Query returned', rows.length, 'invoices');

                // Get all active snacks from snacks table (filtered by shop)
                const snacksResult = await client.query(`
            SELECT id, name, price, display_order
            FROM snacks
            WHERE shop_id = $1 AND active = true
            ORDER BY display_order ASC, name ASC
          `, [shopId]);

                const allSnacks = snacksResult.rows;

                // Initialize snack sales tracking
                const snackSales = {};
                allSnacks.forEach(snack => {
                  snackSales[snack.name] = {
                    id: snack.id,
                    name: snack.name,
                    price: parseFloat(snack.price),
                    quantity: 0,
                    totalRevenue: 0
                  };
                });

                // Process invoices to calculate snack sales
                let totalInvoices = 0;
                let totalRevenue = 0;

                rows.forEach(row => {
                  totalInvoices++;
                  try {
                    const stations = typeof row.stations === 'string'
                      ? JSON.parse(row.stations)
                      : row.stations;

                    if (Array.isArray(stations)) {
                      stations.forEach(station => {
                        const snacks = station.snacks || {};

                        // Handle new format: snacks is an array of {snackId, quantity}
                        if (Array.isArray(snacks)) {
                          snacks.forEach(snackItem => {
                            if (snackItem.snackId && snackItem.quantity) {
                              const snack = allSnacks.find(s => s.id === snackItem.snackId);
                              if (snack) {
                                const quantity = parseInt(snackItem.quantity) || 0;
                                if (quantity > 0) {
                                  if (!snackSales[snack.name]) {
                                    snackSales[snack.name] = {
                                      id: snack.id,
                                      name: snack.name,
                                      price: parseFloat(snack.price),
                                      quantity: 0,
                                      totalRevenue: 0
                                    };
                                  }
                                  snackSales[snack.name].quantity += quantity;
                                  snackSales[snack.name].totalRevenue += quantity * parseFloat(snack.price);
                                }
                              }
                            }
                          });
                        } else {
                          // Handle legacy format: snacks is an object with keys like {cokeBottle: 2, cokeCan: 1}
                          // or {snackName: quantity}
                          Object.keys(snacks).forEach(snackKey => {
                            const quantity = parseInt(snacks[snackKey]) || 0;
                            if (quantity > 0) {
                              // Try to find snack by name (exact match first)
                              let foundSnack = allSnacks.find(s =>
                                s.name.toLowerCase() === snackKey.toLowerCase()
                              );

                              // If not found, try matching by removing spaces/special chars
                              if (!foundSnack) {
                                foundSnack = allSnacks.find(s =>
                                  s.name.toLowerCase().replace(/\s+/g, '') === snackKey.toLowerCase().replace(/\s+/g, '')
                                );
                              }

                              // If still not found, try matching snack key patterns (legacy: cokeBottle, cokeCan)
                              if (!foundSnack) {
                                const normalizedKey = snackKey.toLowerCase();
                                if (normalizedKey.includes('coke') && normalizedKey.includes('bottle')) {
                                  foundSnack = allSnacks.find(s => s.name.toLowerCase().includes('coke') && s.name.toLowerCase().includes('bottle'));
                                } else if (normalizedKey.includes('coke') && normalizedKey.includes('can')) {
                                  foundSnack = allSnacks.find(s => s.name.toLowerCase().includes('coke') && s.name.toLowerCase().includes('can'));
                                }
                              }

                              if (foundSnack) {
                                if (!snackSales[foundSnack.name]) {
                                  snackSales[foundSnack.name] = {
                                    id: foundSnack.id,
                                    name: foundSnack.name,
                                    price: parseFloat(foundSnack.price),
                                    quantity: 0,
                                    totalRevenue: 0
                                  };
                                }
                                snackSales[foundSnack.name].quantity += quantity;
                                snackSales[foundSnack.name].totalRevenue += quantity * parseFloat(foundSnack.price);
                              }
                            }
                          });
                        }
                      });
                    }
                  } catch (parseError) {
                    console.error('Error parsing invoice stations:', parseError);
                  }
                });

                // Calculate total revenue from snacks
                totalRevenue = Object.values(snackSales).reduce((sum, snack) => sum + snack.totalRevenue, 0);

                // Convert snackSales object to array and filter out snacks with 0 quantity
                const snackSalesArray = Object.values(snackSales)
                  .filter(snack => snack.quantity > 0)
                  .map(snack => ({
                    ...snack,
                    totalRevenue: parseFloat(snack.totalRevenue.toFixed(2))
                  }))
                  .sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by revenue descending

                await closeDbClient(db);
                res.status(200).json({
                  period: startDate && endDate ? `${startDate} to ${endDate}` : (month && year ? `${year}-${String(month).padStart(2, '0')}` : date || 'today'),
                  summary: {
                    totalInvoices,
                    totalRevenue: totalRevenue.toFixed(2)
                  },
                  snacks: Object.values(snackSales).sort((a, b) => b.quantity - a.quantity)
                });
                return resolve();
              } catch (snacksReportError) {
                console.error('Error generating snacks report:', snacksReportError);
                await closeDbClient(db);
                res.status(500).json({
                  error: 'Failed to generate snacks report',
                  details: snacksReportError.message
                });
                return resolve();
              }
            }

            // If we get here, unknown report type
            await closeDbClient(db);
            res.status(400).json({
              error: 'Invalid report type',
              message: 'Valid types are: customer-report, usage, daily-revenue, monthly-revenue, snacks-report'
            });
            return resolve();
          }

          await closeDbClient(db);
          res.status(405).json({ error: 'Method not allowed' });
          return resolve();
        } catch (error) {
          console.error('Error in reports API:', error);
          if (db) await closeDbClient(db);
          res.status(500).json({
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
          return resolve();
        }
      });
    });
  });
}

// Helper function to properly parse is_running from database
handler.parseIsRunning = function (value) {
  if (value === true || value === 1 || value === 'true' || value === 't' || String(value).toLowerCase() === 'true') {
    return true;
  }
  return false;
};

// Helper function to format time in HH:MM:SS
handler.formatTime = function (seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Helper function to calculate time difference in seconds
handler.calculateTimeDiff = function (startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.floor((end - start) / 1000);
};

// Helper function to get IST date string
handler.getISTDateString = function (date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString().split('T')[0];
};

// Helper function to parse JSON safely
handler.safeJSONParse = function (str, fallback = {}) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return fallback;
  }
};
