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
        console.log('Starting migration: PS5 -> Playstation');

        // 1. Update Stations game_type
        const res1 = await client.query("UPDATE stations SET game_type = 'Playstation' WHERE game_type = 'PS5'");
        console.log(`Updated game_type for ${res1.rowCount} stations.`);

        // 2. Update Stations names
        // 'Seat X - PS5 Station' -> 'Seat X - Playstation'
        // 'PS5 Station X' -> 'Playstation X' (if any left)
        // Generic 'PS5' -> 'Playstation'

        // Most specific replacement first
        const res2 = await client.query("UPDATE stations SET name = REPLACE(name, 'PS5 Station', 'Playstation') WHERE name LIKE '%PS5 Station%'");
        console.log(`Updated names (PS5 Station -> Playstation) for ${res2.rowCount} stations.`);

        const res3 = await client.query("UPDATE stations SET name = REPLACE(name, 'PS5', 'Playstation') WHERE name LIKE '%PS5%' AND name NOT LIKE '%Playstation%'");
        console.log(`Updated names (PS5 -> Playstation) for ${res3.rowCount} stations.`);

        // 3. Update Invoices (game_type)
        try {
            const res4 = await client.query("UPDATE invoices SET game_type = 'Playstation' WHERE game_type = 'PS5'");
            console.log(`Updated game_type for ${res4.rowCount} invoices.`);
        } catch (e) {
            console.log("Skipping invoices game_type update (table/column missing or legacy).");
        }

        // 4. Update Invoices (station_name)
        try {
            const res5 = await client.query("UPDATE invoices SET station_name = REPLACE(station_name, 'PS5 Station', 'Playstation') WHERE station_name LIKE '%PS5 Station%'");
            console.log(`Updated station_name for ${res5.rowCount} invoices.`);
        } catch (e) {
            console.log("Skipping invoices station_name update.");
        }

        console.log('Migration complete.');
    } catch (e) {
        console.error('Error during migration:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
