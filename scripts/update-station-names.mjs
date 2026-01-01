import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function run() {
    const client = await pool.connect();
    try {
        const mappings = [
            { id: 1, name: 'Seat 1 - PS5 Station' },
            { id: 2, name: 'Seat 2 - PS5 Station' },
            { id: 3, name: 'Seat 3 - PS5 Station' },
            { id: 4, name: 'Seat 4 - PS5 Station' },
            { id: 5, name: 'Seat 5 - PS5 Station' },
            { id: 6, name: 'Seat 6 - Steering Wheel' },
            { id: 7, name: 'Seat 7 - System Game' }
        ];

        console.log('Updating station names...');
        for (const m of mappings) {
            const res = await client.query('UPDATE stations SET name = $1 WHERE id = $2 RETURNING *', [m.name, m.id]);
            if (res.rowCount > 0) {
                console.log(`Updated ID ${m.id} to "${m.name}"`);
            } else {
                console.log(`ID ${m.id} not found.`);
            }
        }
        console.log('Update complete.');
    } catch (e) {
        console.error('Error updating stations:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
