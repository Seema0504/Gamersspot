import { getDbClient, closeDbClient } from './db.js';
import { withAuth } from './middleware/authMiddleware.js';

async function handler(req, res) {
  // Set CORS (handled by server.js largely, but good backup)
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = req.user.shopId;
  let db = null;

  try {
    db = await getDbClient();
    const client = db.client;

    // GET /api/stations
    if (req.method === 'GET') {
      let rows;
      try {
        // Check for pause_start_time column (schema check)
        // Optimization: In SaaS, we assume schema is uniform. But keep check for safety.
        // We can skip checking every time if we are confident, but legacy code kept it.
        const columnCheck = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'stations' AND column_name = 'pause_start_time'
        `);
        const hasPauseStartTime = columnCheck.rows.length > 0;
        const pauseStartTimeSelect = hasPauseStartTime ? 'pause_start_time as "pauseStartTime",' : 'NULL as "pauseStartTime",';

        const result = await client.query(`
          SELECT 
            id, name, game_type as "gameType", elapsed_time as "elapsedTime",
            is_running as "isRunning", is_done as "isDone",
            COALESCE(is_paused, false) as "isPaused",
            COALESCE(paused_time, 0) as "pausedTime",
            ${pauseStartTimeSelect}
            extra_controllers as "extraControllers",
            snacks,
            COALESCE(snacks_enabled, false) as "snacksEnabled",
            customer_name as "customerName",
            COALESCE(customer_phone, '') as "customerPhone",
            start_time as "startTime", end_time as "endTime", updated_at as "updatedAt"
          FROM stations
          WHERE shop_id = $1
          ORDER BY id ASC
        `, [shopId]);

        rows = result.rows;
      } catch (err) {
        console.error('Query Error:', err);
        throw err;
      }

      // Parse JSONB snacks
      const stations = rows.map(row => ({
        ...row,
        snacks: typeof row.snacks === 'string' ? JSON.parse(row.snacks) : (row.snacks || {})
      }));

      return res.status(200).json(stations);
    }

    // POST /api/stations (Bulk Update/Sync)
    if (req.method === 'POST') {
      const stations = Array.isArray(req.body.stations) ? req.body.stations : [];
      if (!Array.isArray(stations) || stations.length === 0) return res.status(200).json({ success: true, count: 0 });

      // Get existing state for this shop only
      const existingRes = await client.query('SELECT id, start_time, end_time, is_running, is_done FROM stations WHERE shop_id = $1', [shopId]);
      const existingMap = new Map();
      existingRes.rows.forEach(row => existingMap.set(row.id, row));

      for (const station of stations) {
        // Preservation Logic
        let startTime = station.startTime;
        let endTime = station.endTime;

        // If not provided, try to preserve
        if (!startTime) {
          const ex = existingMap.get(station.id);
          if (ex && ex.start_time && (station.isRunning || ex.is_running)) startTime = ex.start_time;
        }
        if (!endTime) {
          const ex = existingMap.get(station.id);
          if (ex && ex.end_time && (station.isDone || ex.is_done)) endTime = ex.end_time;
        }

        const snacks = JSON.stringify(station.snacks || {});
        // Defaulting values
        const vals = [
          station.id, // 1
          shopId,     // 2
          station.name,
          station.gameType || 'Playstation',
          station.elapsedTime || 0,
          station.isRunning || false,
          station.isDone || false,
          station.isPaused || false,
          station.pausedTime || 0,
          station.pauseStartTime || null,
          station.extraControllers || 0,
          snacks,
          station.snacksEnabled || false,
          station.customerName || '',
          station.customerPhone || '',
          startTime || null,
          endTime || null
        ];

        // Upsert with Composite Key (shop_id, id)
        await client.query(`
          INSERT INTO stations (
            id, shop_id, name, game_type, elapsed_time, is_running, is_done, 
            is_paused, paused_time, pause_start_time, extra_controllers, 
            snacks, snacks_enabled, customer_name, customer_phone, start_time, end_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (shop_id, id) DO UPDATE SET
            name = EXCLUDED.name,
            game_type = EXCLUDED.game_type,
            elapsed_time = EXCLUDED.elapsed_time,
            is_running = EXCLUDED.is_running,
            is_done = EXCLUDED.is_done,
            is_paused = EXCLUDED.is_paused,
            paused_time = EXCLUDED.paused_time,
            pause_start_time = EXCLUDED.pause_start_time,
            extra_controllers = EXCLUDED.extra_controllers,
            snacks = EXCLUDED.snacks,
            snacks_enabled = EXCLUDED.snacks_enabled,
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time
        `, vals);
      }
      return res.status(200).json({ success: true, count: stations.length });
    }

    // PUT /api/stations (Single Update)
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'Station ID required' });

      // Dynamic Update Builder
      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        if (val === undefined) continue;

        let dbCol = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`); // camelCase to snake_case
        // Manual Overrides
        if (key === 'gameType') dbCol = 'game_type';
        if (key === 'elapsedTime') dbCol = 'elapsed_time';
        if (key === 'isRunning') dbCol = 'is_running';
        if (key === 'isDone') dbCol = 'is_done';
        if (key === 'isPaused') dbCol = 'is_paused';
        if (key === 'pausedTime') dbCol = 'paused_time';
        if (key === 'pauseStartTime') dbCol = 'pause_start_time';
        if (key === 'extraControllers') dbCol = 'extra_controllers';
        if (key === 'snacksEnabled') dbCol = 'snacks_enabled';
        if (key === 'customerName') dbCol = 'customer_name';
        if (key === 'customerPhone') dbCol = 'customer_phone';
        if (key === 'startTime') dbCol = 'start_time';
        if (key === 'endTime') dbCol = 'end_time';

        // Handle JSON
        let finalVal = val;
        if (key === 'snacks') finalVal = JSON.stringify(val);

        fields.push(`${dbCol} = $${idx++}`);
        values.push(finalVal);
      }

      if (fields.length === 0) return res.status(400).json({ error: 'No fields' });

      // Add WHERE clause params
      values.push(id);
      values.push(shopId);

      const query = `UPDATE stations SET ${fields.join(', ')} WHERE id = $${idx} AND shop_id = $${idx + 1}`;

      const result = await client.query(query, values);

      if (result.rowCount === 0) return res.status(404).json({ error: 'Station not found or access denied' });
      return res.status(200).json({ success: true });
    }

    // DELETE /api/stations
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Station ID required' });

      await client.query('DELETE FROM stations WHERE id = $1 AND shop_id = $2', [id, shopId]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (db) await closeDbClient(db);
  }
}

export default withAuth(handler);
