import 'dotenv/config';
import { getDbClient, closeDbClient } from '../api/_lib/db.js';

async function testUpi() {
    let db;
    try {
        db = await getDbClient();
        console.log('Fetching shops...');
        // Check column exist
        const result = await db.client.query("SELECT column_name FROM information_schema.columns WHERE table_name='shops' AND column_name='upi_id'");
        console.log('Column upi_id exists:', result.rows.length > 0);

        const res = await db.client.query('SELECT id, name, upi_id FROM shops');
        console.log('Current Shops:', res.rows);

        if (res.rows.length > 0) {
            const shopId = res.rows[0].id;
            console.log(`Updating shop ${shopId} with test UPI ID 'test@upi'...`);
            await db.client.query('UPDATE shops SET upi_id = $1 WHERE id = $2', ['test@upi', shopId]);

            const res2 = await db.client.query('SELECT id, name, upi_id FROM shops WHERE id = $1', [shopId]);
            console.log('Updated Shop:', res2.rows[0]);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (db) await closeDbClient(db);
    }
}
testUpi();
