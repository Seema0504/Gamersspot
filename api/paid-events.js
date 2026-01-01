import { getDbClient, closeDbClient } from './_lib/db.js'
import { authenticateToken, requireActiveSubscription } from './_lib/middleware/authMiddleware.js'

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.CORS_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
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

        let db = null

        try {
          db = await getDbClient()

          if (req.method === 'POST') {
            // Create a new paid event (scoped to shop)
            const { invoiceNumber, stationIds, resetData } = req.body

            if (!stationIds || !Array.isArray(stationIds) || stationIds.length === 0) {
              await closeDbClient(db)
              res.status(400).json({ error: 'stationIds array is required' })
              return resolve()
            }

            if (!resetData) {
              await closeDbClient(db)
              res.status(400).json({ error: 'resetData is required' })
              return resolve()
            }

            console.log(`[Paid Events] Creating paid event for shop ${shopId}, invoice ${invoiceNumber || 'N/A'}, stations: ${stationIds.join(', ')}`)

            const result = await db.client.query(
              `INSERT INTO paid_events (shop_id, invoice_number, station_ids, reset_data, processed, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               RETURNING id, created_at`,
              [
                shopId,
                invoiceNumber || null,
                stationIds,
                JSON.stringify(resetData),
                false
              ]
            )

            // OPTIMIZATION: Broadcast paid event via WebSocket for instant multi-device sync
            // This eliminates the need for 3-second polling
            try {
              const { broadcastPaidEvent } = await import('../websocket.js')
              const clientsNotified = broadcastPaidEvent(invoiceNumber, stationIds, resetData)
              console.log(`[Paid Events] ✅ Broadcasted to ${clientsNotified} WebSocket clients`)
            } catch (wsError) {
              console.warn('[Paid Events] WebSocket broadcast failed (server may not be running):', wsError.message)
            }

            await closeDbClient(db)
            res.status(201).json({
              success: true,
              id: result.rows[0].id,
              createdAt: result.rows[0].created_at
            })
            return resolve()
          }

          if (req.method === 'GET') {
            // Get recent unprocessed paid events (last 5 minutes) for this shop only
            const { since } = req.query

            let query
            let params

            if (since) {
              // Get events since a specific timestamp (filtered by shop)
              query = `
                SELECT 
                  id,
                  invoice_number as "invoiceNumber",
                  station_ids as "stationIds",
                  reset_data as "resetData",
                  created_at as "createdAt",
                  processed
                FROM paid_events
                WHERE shop_id = $1 AND created_at > $2
                ORDER BY created_at DESC
                LIMIT 50
              `
              params = [shopId, since]
            } else {
              // Get unprocessed events from last 5 minutes (filtered by shop)
              query = `
                SELECT 
                  id,
                  invoice_number as "invoiceNumber",
                  station_ids as "stationIds",
                  reset_data as "resetData",
                  created_at as "createdAt",
                  processed
                FROM paid_events
                WHERE shop_id = $1 AND processed = false 
                AND created_at > NOW() - INTERVAL '5 minutes'
                ORDER BY created_at DESC
                LIMIT 50
              `
              params = [shopId]
            }

            const { rows } = await db.client.query(query, params)

            // Mark events as processed
            if (rows.length > 0) {
              const eventIds = rows.map(r => r.id)
              await db.client.query(
                `UPDATE paid_events SET processed = true WHERE id = ANY($1) AND shop_id = $2`,
                [eventIds, shopId]
              )
            }

            await closeDbClient(db)
            res.status(200).json(rows)
            return resolve()
          }

          await closeDbClient(db)
          res.status(405).json({ error: 'Method not allowed' })
          return resolve()
        } catch (error) {
          console.error('[Paid Events API] Error:', error)
          if (db) {
            await closeDbClient(db)
          }
          res.status(500).json({
            error: 'Internal server error',
            message: error.message
          })
          return resolve()
        }
      });
    });
  });
}

