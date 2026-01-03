import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getDbClient } from '../api/_lib/db.js';

async function check() {
    try {
        const db = await getDbClient();
        const res = await db.client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'subscriptions';
        `);
        console.log('Columns:', res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
