import { getDbClient, closeDbClient } from '../../api/db.js';

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

    const { fromStationId, toStationId } = req.body;

    if (!fromStationId || !toStationId) {
        return res.status(400).json({ error: 'Source and target station IDs are required' });
    }

    let db = null;
    try {
        db = await getDbClient();
        const client = db.client;

        // Start Transaction
        await client.query('BEGIN');

        // 1. Fetch both stations with LOCK to prevent race conditions
        // casting IDs to integer to be safe
        const stationsResult = await client.query(
            `SELECT * FROM stations WHERE id IN ($1, $2) FOR UPDATE`,
            [fromStationId, toStationId]
        );

        const fromStation = stationsResult.rows.find(s => s.id == fromStationId);
        const toStation = stationsResult.rows.find(s => s.id == toStationId);

        if (!fromStation) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Source station not found' });
        }
        if (!toStation) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Target station not found' });
        }

        // 2. Validate
        if (!fromStation.is_running) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Source station is not running' });
        }

        if (toStation.is_running || toStation.elapsed_time > 0 || toStation.is_paused) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Target station is not idle' });
        }

        if (fromStation.game_type !== toStation.game_type) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Game type mismatch: ${fromStation.game_type} vs ${toStation.game_type}`
            });
        }

        // 3. Move Session Data to Target Station
        // Copy all session related fields
        await client.query(
            `UPDATE stations SET
        is_running = $1,
        is_done = $2,
        is_paused = $3,
        paused_time = $4,
        pause_start_time = $5,
        elapsed_time = $6,
        start_time = $7,
        end_time = $8,
        snacks = $9,
        snacks_enabled = $10,
        extra_controllers = $11,
        customer_name = $12,
        customer_phone = $13
       WHERE id = $14`,
            [
                fromStation.is_running,
                fromStation.is_done,
                fromStation.is_paused,
                fromStation.paused_time,
                fromStation.pause_start_time,
                fromStation.elapsed_time,
                fromStation.start_time,
                fromStation.end_time,
                fromStation.snacks,
                fromStation.snacks_enabled,
                fromStation.extra_controllers,
                fromStation.customer_name,
                fromStation.customer_phone,
                toStationId
            ]
        );

        // 4. Reset Source Station
        await client.query(
            `UPDATE stations SET
          is_running = false,
          is_done = false,
          is_paused = false,
          paused_time = 0,
          pause_start_time = NULL,
          elapsed_time = 0,
          start_time = NULL,
          end_time = NULL,
          snacks = '{"cokeBottle": 0, "cokeCan": 0}'::jsonb,
          snacks_enabled = false,
          extra_controllers = 0,
          customer_name = '',
          customer_phone = ''
         WHERE id = $1`,
            [fromStationId]
        );

        // Commit Transaction
        await client.query('COMMIT');

        await closeDbClient(db);

        return res.status(200).json({
            success: true,
            message: 'Session transferred successfully',
            from: fromStationId,
            to: toStationId
        });

    } catch (error) {
        if (db) {
            try {
                await db.client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
            await closeDbClient(db);
        }
        console.error('Transfer error:', error);
        return res.status(500).json({ error: 'Transfer failed', details: error.message });
    }
}
