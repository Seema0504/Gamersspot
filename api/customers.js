import { getDbClient, closeDbClient } from './_lib/db.js';
import { authenticateToken, requireActiveSubscription } from './_lib/middleware/authMiddleware.js';

export default async function handler(req, res) {
  // Set CORS headers
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
            const { phoneNumber, getAll } = req.query;

            // If getAll is true, return all customers for autocomplete (filtered by shop)
            if (getAll === 'true') {
              const { rows } = await client.query(
                'SELECT phone_number as "phoneNumber", customer_name as "customerName" FROM customers WHERE shop_id = $1 ORDER BY customer_name ASC',
                [shopId]
              );

              await closeDbClient(db);
              res.status(200).json({ customers: rows });
              return resolve();
            }

            // Lookup customer by phone number (within shop)
            if (!phoneNumber) {
              await closeDbClient(db);
              res.status(400).json({ error: 'Phone number is required' });
              return resolve();
            }

            const { rows } = await client.query(
              'SELECT phone_number as "phoneNumber", customer_name as "customerName" FROM customers WHERE phone_number = $1 AND shop_id = $2',
              [phoneNumber, shopId]
            );

            await closeDbClient(db);

            if (rows.length === 0) {
              res.status(200).json({ found: false });
              return resolve();
            }

            res.status(200).json({
              found: true,
              phoneNumber: rows[0].phoneNumber,
              customerName: rows[0].customerName
            });
            return resolve();
          }

          if (req.method === 'POST') {
            // Create or update customer (scoped to shop)
            const { phoneNumber, customerName } = req.body;

            if (!phoneNumber || !customerName) {
              await closeDbClient(db);
              res.status(400).json({ error: 'Phone number and customer name are required' });
              return resolve();
            }

            // Insert or update customer with shop_id
            const result = await client.query(`
              INSERT INTO customers (phone_number, customer_name, shop_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (phone_number, shop_id) DO UPDATE SET
                customer_name = EXCLUDED.customer_name,
                updated_at = NOW()
              RETURNING phone_number as "phoneNumber", customer_name as "customerName"
            `, [phoneNumber, customerName, shopId]);

            await closeDbClient(db);

            res.status(200).json({
              phoneNumber: result.rows[0].phoneNumber,
              customerName: result.rows[0].customerName
            });
            return resolve();
          }

          await closeDbClient(db);
          res.status(405).json({ error: 'Method not allowed' });
          return resolve();
        } catch (error) {
          console.error('Error in customers API:', error);
          if (db) await closeDbClient(db);
          res.status(500).json({ error: error.message || 'Internal server error' });
          return resolve();
        }
      });
    });
  });
}

