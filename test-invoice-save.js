// Test script to debug invoice saving issue
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/multivendor'
});

async function testInvoiceSave() {
    const client = await pool.connect();

    try {
        // Test data
        const shopId = 11; // Shop 3
        const stations = [{ id: 1, name: 'Test Station', elapsedTime: 100 }];
        const subtotal = 100;
        const discount = 0;
        const total = 100;

        // Generate invoice number
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${dd}`;

        // Get sequence
        const countRes = await client.query(
            `SELECT COUNT(*) FROM invoices WHERE shop_id = $1 AND DATE(created_at) = CURRENT_DATE`,
            [shopId]
        );
        const seq = parseInt(countRes.rows[0].count) + 1;
        const seqStr = String(seq).padStart(4, '0');

        const invoiceNumber = `INV-${shopId}-${dateStr}-${seqStr}`;

        console.log('Attempting to insert invoice:', invoiceNumber);
        console.log('Shop ID:', shopId);

        // Try to insert
        const result = await client.query(
            `INSERT INTO invoices (shop_id, invoice_number, stations, subtotal, discount, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, invoice_number`,
            [shopId, invoiceNumber, JSON.stringify(stations), subtotal, discount, total]
        );

        console.log('✅ Success! Invoice created:', result.rows[0]);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error detail:', error.detail);
    } finally {
        client.release();
        await pool.end();
    }
}

testInvoiceSave();
