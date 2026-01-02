import 'dotenv/config';
import { getDbClient, closeDbClient } from '../api/_lib/db.js';
async function run() {
    const db = await getDbClient();
    const res = await db.client.query('SELECT id, name, upi_id FROM shops WHERE id=1');
    console.log(res.rows[0]);
    await closeDbClient(db);
}
run();
