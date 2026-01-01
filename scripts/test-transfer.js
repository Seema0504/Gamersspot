// scripts/test-transfer.js
import { config } from 'dotenv';
import { resolve } from 'path';
import { getDbClient, closeDbClient } from '../api/db.js';

// Load env
config({ path: resolve(process.cwd(), '.env.local') });

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}/api/stations/transfer`;

async function runTest() {
    console.log('Starting Transfer Test...');
    let db;

    try {
        db = await getDbClient();
        const client = db.client;

        // 1. Find two compatible stations
        const res = await client.query("SELECT id, name, game_type, is_running FROM stations ORDER BY id ASC");
        const stations = res.rows;

        // Find a pair of PS5 stations
        const ps5Stations = stations.filter(s => s.game_type === 'PS5');
        if (ps5Stations.length < 2) {
            throw new Error('Need at least 2 PS5 stations to test transfer');
        }

        // Prefer idle stations to avoid disrupting potential real sessions
        let available = ps5Stations.filter(s => !s.is_running);
        if (available.length < 2) {
            console.log("Not enough idle stations, picking from available ones regardless of state.");
            available = ps5Stations;
        }

        const source = available[0];
        const target = available[1];

        console.log(`Using Source: ${source.id} (${source.name})`);
        console.log(`Using Target: ${target.id} (${target.name})`);

        // 2. Setup State
        console.log('Setting up test state (Resetting target, Starting source)...');

        // Reset both to known clean state
        await client.query(`UPDATE stations SET is_running = false, is_paused = false, elapsed_time = 0, start_time = NULL WHERE id IN ($1, $2)`, [source.id, target.id]);

        // Set Source to Running with dummy data
        await client.query(`UPDATE stations SET is_running = true, start_time = '2025-01-01 10:00:00', elapsed_time = 3600 WHERE id = $1`, [source.id]);

        // 3. Perform Transfer via API
        console.log(`Sending Transfer Request to ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromStationId: source.id,
                toStationId: target.id
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`API Request failed: ${response.status} ${txt}`);
        }

        const json = await response.json();
        console.log('Transfer Response:', JSON.stringify(json, null, 2));

        // 4. Verify DB State
        const verifyRes = await client.query("SELECT id, is_running, elapsed_time FROM stations WHERE id IN ($1, $2)", [source.id, target.id]);
        const sourceState = verifyRes.rows.find(s => s.id === source.id);
        const targetState = verifyRes.rows.find(s => s.id === target.id);

        console.log('Verification Results:');
        console.log(`Source (Expected Idle): is_running=${sourceState.is_running}, elapsed=${sourceState.elapsed_time}`);
        console.log(`Target (Expected Running): is_running=${targetState.is_running}, elapsed=${targetState.elapsed_time}`);

        if (!sourceState.is_running && targetState.is_running && targetState.elapsed_time == 3600) {
            console.log('✅ TEST PASSED: Transfer logic verified.');
        } else {
            console.error('❌ TEST FAILED: State mismatch.');
        }

        // 5. Cleanup
        console.log('Cleaning up test data...');
        await client.query(`UPDATE stations SET is_running = false, elapsed_time = 0, start_time = NULL WHERE id IN ($1, $2)`, [source.id, target.id]);

    } catch (error) {
        console.error('Test Process Failed:', error);
        process.exit(1);
    } finally {
        if (db) await closeDbClient(db);
        process.exit(0);
    }
}

runTest();
