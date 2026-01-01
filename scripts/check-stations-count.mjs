/**
 * Check Stations Count in Database
 * Quick script to verify how many stations exist in the database
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

async function checkStationsCount() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    });

    try {
        console.log('🔍 Checking stations in database...\n');

        // Wait a bit for database to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        const result = await pool.query('SELECT COUNT(*) as count FROM stations');
        const count = parseInt(result.rows[0].count);

        console.log(`📊 Total stations in database: ${count}\n`);

        if (count === 0) {
            console.log('✅ Perfect! Database is empty.');
            console.log('🎮 All stations must be created through "Manage Stations".');
        } else {
            console.log(`⚠️  Found ${count} station(s) in database.`);

            // Show the stations
            const stations = await pool.query('SELECT id, name, game_type FROM stations ORDER BY id');
            console.log('\nStations found:');
            stations.rows.forEach(s => {
                console.log(`  • ID ${s.id}: ${s.name} (${s.game_type})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('\n💡 Database is still initializing. Please wait a few seconds and try again.');
        }
    } finally {
        await pool.end();
    }
}

checkStationsCount();
