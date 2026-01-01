require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function listStations() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, name, game_type FROM stations ORDER BY id ASC');
        console.log('Current Stations:');
        res.rows.forEach(r => {
            console.log(`${r.id}: ${r.name} (${r.game_type})`);
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

listStations();
