import { getDbClient, closeDbClient } from './db.js';
import { withAuth } from './middleware/authMiddleware.js';

async function handler(req, res) {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = req.user.shopId;
  let db = null;

  try {
    db = await getDbClient();
    const client = db.client;

    if (req.method === 'GET') {
      const { invoiceNumber } = req.query;

      if (invoiceNumber) {
        // Fetch specific invoice (Scoped to Shop)
        const { rows } = await client.query(
          `SELECT invoice_number, stations, subtotal, discount, total, created_at
           FROM invoices 
           WHERE invoice_number = $1 AND shop_id = $2
           ORDER BY created_at DESC`,
          [invoiceNumber, shopId]
        );

        if (rows.length === 0) {
          await closeDbClient(db);
          return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = rows[0];
        await closeDbClient(db);
        return res.status(200).json({
          invoiceNumber: invoice.invoice_number,
          stations: typeof invoice.stations === 'string' ? JSON.parse(invoice.stations) : invoice.stations,
          subtotal: parseFloat(invoice.subtotal),
          discount: parseFloat(invoice.discount || 0),
          total: parseFloat(invoice.total),
          createdAt: invoice.created_at
        });
      }

      // Get all invoices for shop
      const { rows } = await client.query(`
        SELECT 
          invoice_number as "invoiceNumber",
          subtotal,
          discount,
          total,
          created_at as "createdAt"
        FROM invoices
        WHERE shop_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [shopId]);

      await closeDbClient(db);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      // Create Invoice
      const { stations, subtotal, discount, total } = req.body;

      // We ignore client-provided invoiceNumber to enforce SaaS format
      // Format: INV-{SHOPID}-{YYYYMMDD}-{SEQUENCE}

      // Generate components
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`; // 20260101

      // Get Sequence (Count for today + 1)
      const countRes = await client.query(
        `SELECT COUNT(*) FROM invoices WHERE shop_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        [shopId]
      );
      const seq = parseInt(countRes.rows[0].count) + 1;
      const seqStr = String(seq).padStart(4, '0'); // 0001

      const invoiceNumber = `INV-${shopId}-${dateStr}-${seqStr}`;

      if (!stations || total === undefined) {
        await closeDbClient(db);
        return res.status(400).json({ error: 'Missing stations or total' });
      }

      await client.query(
        `INSERT INTO invoices (shop_id, invoice_number, stations, subtotal, discount, total, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          shopId,
          invoiceNumber,
          JSON.stringify(stations),
          subtotal || total,
          discount || 0,
          total
        ]
      );

      await closeDbClient(db);
      return res.status(201).json({ success: true, invoiceNumber });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Invoice API Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (db) await closeDbClient(db);
  }
}

export default withAuth(handler);
