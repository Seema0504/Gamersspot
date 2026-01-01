import { getDbClient, closeDbClient } from './_lib/db.js'
import { authenticateToken, requireActiveSubscription } from './_lib/middleware/authMiddleware.js'

export default async function handler(req, res) {
    // Set CORS headers
    const allowedOrigin = process.env.CORS_ORIGIN || '*'
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const { type } = req.query
    if (!type) {
        return res.status(400).json({ error: 'Type parameter is required (pricing, bonus, snacks)' })
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
                    const client = db.client

                    // ========================================
                    // PRICING CONFIGURATION
                    // ========================================
                    if (type === 'pricing') {
                        if (req.method === 'GET') {
                            const result = await client.query('SELECT * FROM pricing_rules WHERE shop_id = $1', [shopId])
                            // format: { 'Playstation': { weekday: 150, weekend: 200 }, extraControllerRate: 50, bufferMinutes: 10, ... }
                            const pricing = {}
                            result.rows.forEach(row => {
                                if (row.game_type === 'extra_controller') {
                                    pricing.extraControllerRate = row.weekday_rate
                                } else if (row.game_type === 'buffer_minutes') {
                                    pricing.bufferMinutes = row.weekday_rate
                                } else {
                                    pricing[row.game_type] = {
                                        weekday: row.weekday_rate,
                                        weekend: row.weekend_rate
                                    }
                                }
                            })
                            res.status(200).json(pricing)
                            return resolve()
                        }

                        if (req.method === 'POST') {
                            const newPricing = req.body

                            // Handle extra controller rate
                            if (typeof newPricing.extraControllerRate === 'number') {
                                await client.query(`
                    INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
                    VALUES ($1, 'extra_controller', $2, $2)
                    ON CONFLICT (shop_id, game_type)
                    DO UPDATE SET 
                      weekday_rate = EXCLUDED.weekday_rate,
                      weekend_rate = EXCLUDED.weekend_rate,
                      updated_at = CURRENT_TIMESTAMP
                  `, [shopId, newPricing.extraControllerRate])
                            }

                            // Handle buffer minutes
                            if (typeof newPricing.bufferMinutes === 'number') {
                                await client.query(`
                    INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
                    VALUES ($1, 'buffer_minutes', $2, $2)
                    ON CONFLICT (shop_id, game_type)
                    DO UPDATE SET 
                      weekday_rate = EXCLUDED.weekday_rate,
                      weekend_rate = EXCLUDED.weekend_rate,
                      updated_at = CURRENT_TIMESTAMP
                  `, [shopId, newPricing.bufferMinutes])
                            }

                            // Handle game types
                            const keys = Object.keys(newPricing).filter(k => k !== 'extraControllerRate' && k !== 'bufferMinutes')
                            for (const gameType of keys) {
                                const rates = newPricing[gameType]
                                if (rates && typeof rates.weekday === 'number' && typeof rates.weekend === 'number') {
                                    await client.query(`
                      INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate)
                      VALUES ($1, $2, $3, $4)
                      ON CONFLICT (shop_id, game_type)
                      DO UPDATE SET 
                        weekday_rate = EXCLUDED.weekday_rate,
                        weekend_rate = EXCLUDED.weekend_rate,
                        updated_at = CURRENT_TIMESTAMP
                    `, [shopId, gameType, rates.weekday, rates.weekend])
                                }
                            }
                            res.status(200).json({ success: true })
                            return resolve()
                        }
                    }

                    // ========================================
                    // BONUS CONFIGURATION
                    // ========================================
                    if (type === 'bonus') {
                        if (req.method === 'GET') {
                            const result = await client.query('SELECT config_data FROM bonus_config WHERE shop_id = $1', [shopId])
                            if (result.rows.length > 0) {
                                res.status(200).json(result.rows[0].config_data)
                                return resolve()
                            } else {
                                // Return default
                                const defaultConfig = {
                                    'Playstation': {
                                        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
                                        weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
                                    },
                                    'Steering Wheel': {
                                        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
                                        weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
                                    },
                                    'System': {
                                        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
                                        weekend: { oneHour: 900, twoHours: 1800, threeHours: 3600 }
                                    }
                                }
                                res.status(200).json(defaultConfig)
                                return resolve()
                            }
                        }

                        if (req.method === 'PUT') {
                            const configData = req.body
                            if (!configData || typeof configData !== 'object') {
                                res.status(400).json({ error: 'Invalid configuration data' })
                                return resolve()
                            }
                            await client.query(
                                `INSERT INTO bonus_config (shop_id, config_data, updated_at)
                   VALUES ($1, $2, NOW())
                   ON CONFLICT (shop_id)
                   DO UPDATE SET config_data = $2, updated_at = NOW()`,
                                [shopId, JSON.stringify(configData)]
                            )
                            res.status(200).json({ success: true, message: 'Bonus configuration updated successfully' })
                            return resolve()
                        }
                    }

                    // ========================================
                    // SNACKS MANAGEMENT
                    // ========================================
                    if (type === 'snacks') {
                        if (req.method === 'GET') {
                            const { active } = req.query
                            let query = 'SELECT id, name, price, active, display_order FROM snacks WHERE shop_id = $1'
                            const params = [shopId]
                            if (active !== undefined) {
                                query += ' AND active = $2'
                                params.push(active === 'true')
                            }
                            query += ' ORDER BY display_order ASC, name ASC'
                            const { rows } = await client.query(query, params)
                            res.status(200).json(rows)
                            return resolve()
                        }

                        if (req.method === 'POST') {
                            const { name, price, active = true, display_order = 0 } = req.body
                            if (!name || price === undefined) {
                                res.status(400).json({ error: 'Name and price are required' })
                                return resolve()
                            }
                            const { rows } = await client.query(
                                `INSERT INTO snacks (shop_id, name, price, active, display_order, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                   RETURNING id, name, price, active, display_order`,
                                [shopId, name, parseFloat(price), active, display_order]
                            )
                            res.status(201).json(rows[0])
                            return resolve()
                        }

                        if (req.method === 'PUT') {
                            const { id, name, price, active, display_order } = req.body
                            if (!id) {
                                res.status(400).json({ error: 'ID is required' })
                                return resolve()
                            }

                            const updates = []
                            const params = [shopId]
                            let paramIndex = 2

                            if (name !== undefined) {
                                updates.push(`name = $${paramIndex++}`)
                                params.push(name)
                            }
                            if (price !== undefined) {
                                updates.push(`price = $${paramIndex++}`)
                                params.push(parseFloat(price))
                            }
                            if (active !== undefined) {
                                updates.push(`active = $${paramIndex++}`)
                                params.push(active)
                            }
                            if (display_order !== undefined) {
                                updates.push(`display_order = $${paramIndex++}`)
                                params.push(display_order)
                            }

                            if (updates.length === 0) {
                                res.status(400).json({ error: 'No fields to update' })
                                return resolve()
                            }

                            params.push(id)
                            const { rows } = await client.query(
                                `UPDATE snacks SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                   WHERE shop_id = $1 AND id = $${paramIndex}
                   RETURNING id, name, price, active, display_order`,
                                params
                            )
                            if (rows.length === 0) {
                                res.status(404).json({ error: 'Snack not found' })
                                return resolve()
                            }
                            res.status(200).json(rows[0])
                            return resolve()
                        }

                        if (req.method === 'DELETE') {
                            const { id, hardDelete } = req.query
                            if (!id) {
                                res.status(400).json({ error: 'ID is required' })
                                return resolve()
                            }

                            if (hardDelete === 'true') {
                                const { rowCount } = await client.query('DELETE FROM snacks WHERE shop_id = $1 AND id = $2', [shopId, id])
                                res.status(200).json({ success: true, deleted: rowCount > 0 })
                                return resolve()
                            } else {
                                const { rows } = await client.query(
                                    `UPDATE snacks SET active = false, updated_at = CURRENT_TIMESTAMP
                         WHERE shop_id = $1 AND id = $2 RETURNING id, name, price, active`,
                                    [shopId, id]
                                )
                                res.status(200).json({ success: true, snack: rows[0] })
                                return resolve()
                            }
                        }
                    }

                    res.status(404).json({ error: 'Unknown settings type' })
                    return resolve()

                } catch (error) {
                    console.error(`[Settings API/${type}] Error:`, error)
                    res.status(500).json({ error: 'Internal server error', details: error.message })
                    return resolve()
                } finally {
                    if (db) await closeDbClient(db)
                }
            });
        });
    });
}
