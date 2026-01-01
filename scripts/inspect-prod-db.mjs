
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.prod') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    const client = await pool.connect();
    try {
        console.log('🔍 Inspecting recent invoices (Last 3 days)...');

        // Get invoices from last 3 days
        const { rows } = await client.query(`
      SELECT 
        id, 
        invoice_number, 
        created_at,
        created_at AT TIME ZONE 'Asia/Kolkata' as created_at_ist
      FROM invoices 
      WHERE created_at > NOW() - INTERVAL '3 days'
      ORDER BY created_at DESC
    `);

        console.log(`Found ${rows.length} invoices.`);

        rows.forEach(inv => {
            const idTimestamp = parseInt(inv.invoice_number.replace('INV-', ''));
            const dbDate = new Date(inv.created_at); // UTC
            const dbTimestamp = dbDate.getTime();

            const diffValid = !isNaN(idTimestamp);
            const diff = diffValid ? dbTimestamp - idTimestamp : 0;
            const diffHours = diff / 1000 / 60 / 60;

            console.log('------------------------------------------------');
            console.log(`Invoice: ${inv.invoice_number}`);
            console.log(`  DB Time (UTC): ${inv.created_at.toISOString()}`);
            console.log(`  DB Time (IST): ${new Date(inv.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            if (diffValid) {
                console.log(`  ID Time (EST): ${new Date(idTimestamp).toISOString()}`);
                console.log(`  Diff: ${diffHours.toFixed(4)} hours`);
            }
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

inspect();
