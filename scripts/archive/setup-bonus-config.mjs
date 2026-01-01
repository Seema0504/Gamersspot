/**
 * Bonus Time Configuration - Database Setup Script
 * 
 * This script creates the bonus_config table and inserts default configuration.
 * Run this script to enable dynamic bonus time configuration in the application.
 * 
 * Usage:
 *   node scripts/setup-bonus-config.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Pool } = pg

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
})

const setupBonusConfig = async () => {
    const client = await pool.connect()

    try {
        console.log('🚀 Setting up bonus_config table...')

        // Create table
        await client.query(`
      CREATE TABLE IF NOT EXISTS bonus_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        CONSTRAINT single_row_check CHECK (id = 1)
      );
    `)

        console.log('✅ Table created successfully')

        // Insert default configuration
        await client.query(`
      INSERT INTO bonus_config (id, config_data)
      VALUES (
        1,
        '{
          "Playstation": {
            "weekday": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600},
            "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
          },
          "Steering Wheel": {
            "weekday": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600},
            "weekend": {"oneHour": 0, "twoHours": 0, "threeHours": 0}
          },
          "System": {
            "weekday": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600},
            "weekend": {"oneHour": 900, "twoHours": 1800, "threeHours": 3600}
          }
        }'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `)

        console.log('✅ Default configuration inserted')

        // Create index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bonus_config_data 
      ON bonus_config USING gin (config_data);
    `)

        console.log('✅ Index created')

        // Add comments
        await client.query(`
      COMMENT ON TABLE bonus_config IS 'Stores bonus time configuration for different game types';
    `)

        await client.query(`
      COMMENT ON COLUMN bonus_config.config_data IS 'JSONB: {gameType: {dayType: {oneHour: seconds, twoHours: seconds, threeHours: seconds}}}';
    `)

        console.log('✅ Comments added')

        // Verify setup
        const result = await client.query('SELECT * FROM bonus_config WHERE id = 1')

        if (result.rows.length > 0) {
            console.log('\n✅ Bonus configuration setup complete!')
            console.log('\nDefault configuration:')
            console.log(JSON.stringify(result.rows[0].config_data, null, 2))
        } else {
            console.log('⚠️  Warning: No configuration found after setup')
        }

    } catch (error) {
        console.error('❌ Error setting up bonus configuration:', error)
        throw error
    } finally {
        client.release()
        await pool.end()
    }
}

// Run the setup
setupBonusConfig()
    .then(() => {
        console.log('\n🎉 Setup completed successfully!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Setup failed:', error)
        process.exit(1)
    })
