/**
 * CLEANUP SCRIPT: Remove All Stations from Database
 * 
 * This script connects to your local PostgreSQL database and removes all stations.
 * After running this, the application will start with an empty dashboard.
 * All stations must then be created through the "Manage Stations" interface.
 * 
 * Usage:
 *   node scripts/cleanup-all-stations.mjs
 * 
 * IMPORTANT:
 * - This will delete ALL stations, including any running timers
 * - Make sure to complete any active sessions before running this
 * - After running, refresh your browser to see the empty dashboard
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

async function cleanupAllStations() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    });

    try {
        console.log('🔄 Connecting to database...');

        // Delete all stations
        const result = await pool.query('DELETE FROM stations RETURNING id, name');

        console.log(`\n✅ Successfully deleted ${result.rowCount} station(s)!\n`);

        if (result.rows.length > 0) {
            console.log('Deleted stations:');
            result.rows.forEach(row => {
                console.log(`  • ${row.name} (ID: ${row.id})`);
            });
        }

        // Verify deletion
        const verifyResult = await pool.query('SELECT COUNT(*) as count FROM stations');
        const remainingCount = parseInt(verifyResult.rows[0].count);

        console.log(`\n📊 Remaining stations in database: ${remainingCount}`);

        if (remainingCount === 0) {
            console.log('\n✨ Database is now clean! The stations table is empty.');
            console.log('🎮 All future stations must be created through "Manage Stations" in the UI.');
            console.log('🔄 Refresh your browser to see the empty dashboard.');
        } else {
            console.warn(`\n⚠️  Warning: ${remainingCount} station(s) still remain in the database.`);
        }

    } catch (error) {
        console.error('❌ Error cleaning up stations:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Database connection closed.');
    }
}

// Run the cleanup
cleanupAllStations();
