
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check for --prod flag
const isProd = process.argv.includes('--prod');
const envFile = isProd ? '../.env.prod' : '../.env.local';

console.log(`🔌 Loading configuration from ${envFile}`);
dotenv.config({ path: path.join(__dirname, envFile) });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false } // Always use SSL for prod/cloud DBs
});

async function fixTimestamps() {
    const client = await pool.connect();
    try {
        console.log('🔍 Checking for invoices with timezone-shifted timestamps...');

        // Get all invoices
        const { rows } = await client.query('SELECT id, invoice_number, created_at FROM invoices');

        let fixedCount = 0;
        let skippedCount = 0;

        for (const invoice of rows) {
            if (!invoice.invoice_number || !invoice.invoice_number.startsWith('INV-')) {
                continue;
            }

            const timestampStr = invoice.invoice_number.replace('INV-', '');
            const idTimestamp = parseInt(timestampStr, 10);

            if (isNaN(idTimestamp)) {
                continue;
            }

            // Database timestamp (UTC)
            const dbDate = new Date(invoice.created_at);
            const dbTimestamp = dbDate.getTime();

            // Calculate difference in milliseconds
            const diff = dbTimestamp - idTimestamp;

            // 5 hours 30 minutes in milliseconds = 19,800,000
            // We allow a small margin of error (e.g., +/- 5 minutes due to processing time)
            // Processing time usually makes dbTimestamp slightly LARGER than idTimestamp.
            // But here we are looking for a LARGE shift of ~5.5 hours.

            // Relaxed check: If diff is > 1 hour, it's suspicious enough to fix.
            // We align the DB timestamp to the Invoice ID timestamp, which is the source of truth.
            if (Math.abs(diff) > 60 * 60 * 1000) {
                console.log(`⚠️  Found mismatched invoice: ${invoice.invoice_number}`);
                console.log(`   ID Time: ${new Date(idTimestamp).toISOString()} (${idTimestamp})`);
                console.log(`   DB Time: ${dbDate.toISOString()} (${dbTimestamp})`);
                console.log(`   Diff: ${(diff / 1000 / 60 / 60).toFixed(2)} hours`);

                // Fix it: Set created_at to exactly match the ID timestamp
                // This handles any amount of shift (5.5h, 5.2h, 1.8h, etc)
                const targetDate = new Date(idTimestamp).toISOString();

                await client.query(`
                  UPDATE invoices 
                  SET created_at = $1
                  WHERE id = $2
                `, [targetDate, invoice.id]);

                console.log('   ✅ Fixed!');
                fixedCount++;
            } else {
                skippedCount++;
                // console.log(`OK: ${invoice.invoice_number} (Diff: ${(diff/1000).toFixed(1)}s)`);
            }
        }

        console.log('\n==================================================');
        console.log(`🎉 Cleanup Complete!`);
        console.log(`✅ Fixed: ${fixedCount} invoices`);
        console.log(`⏭️  Skipped: ${skippedCount} invoices (already correct)`);
        console.log('==================================================');

    } catch (err) {
        console.error('❌ Error fixing timestamps:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixTimestamps();
