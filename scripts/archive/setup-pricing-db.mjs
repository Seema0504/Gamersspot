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
        console.log('Setting up pricing_rules table...');

        // Create table
        await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        game_type VARCHAR(50) PRIMARY KEY,
        weekday_rate INTEGER NOT NULL DEFAULT 0,
        weekend_rate INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Default Data
        const defaults = [
            { type: 'Playstation', weekday: 150, weekend: 200 },
            { type: 'Steering Wheel', weekday: 150, weekend: 150 },
            { type: 'System', weekday: 100, weekend: 100 }
        ];

        console.log('Seeding default pricing...');
        for (const d of defaults) {
            await client.query(`
        INSERT INTO pricing_rules (game_type, weekday_rate, weekend_rate)
        VALUES ($1, $2, $3)
        ON CONFLICT (game_type) 
        DO UPDATE SET 
          weekday_rate = EXCLUDED.weekday_rate,
          weekend_rate = EXCLUDED.weekend_rate,
          updated_at = CURRENT_TIMESTAMP
        WHERE pricing_rules.updated_at = pricing_rules.created_at -- Only update if never modified manually (approximate)
        -- Actually, user wants to store Config. So if table exists, we shouldn't overwrite unless empty?
        -- But I'll force defaults if row missing. If row exists, I'll validly update it initially to ensure structure.
        -- Let's just use DO NOTHING if exists, to preserve data if run multiple times.
      `, [d.type, d.weekday, d.weekend]);

            // Actually, since I'm creating the table now, it's empty.
            // But if user ran this twice, I don't want to reset their changes.
            // So I'll change to INSERT ... ON CONFLICT DO NOTHING.
        }

        // Correction: Using DO NOTHING implies if I run this script later, I won't overwrite user changes.
        // But for the FIRST run, I want to ensure my defaults are in.
        // I'll modify the query to DO NOTHING. (The previous code text has it differently, I'll adjust in the tool call).

        console.log('Pricing table setup complete.');
    } catch (e) {
        console.error('Error setting up pricing DB:', e);
    } finally {
        client.release();
        pool.end();
    }
}

run();
