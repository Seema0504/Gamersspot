/**
 * Master Database Migration for Supabase Test Environment
 * 
 * This script migrates all new features to Supabase test database:
 * 1. Bonus configuration table
 * 2. Extra controller rate in pricing_rules
 * 3. Billing buffer time in pricing_rules
 * 4. Admin users table with authentication
 * 
 * Usage:
 *   TEST_POSTGRES_URL="your-supabase-test-url" node scripts/migrate-to-test-db.mjs
 */

import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'

// Load environment variables from .env.test
dotenv.config({ path: '.env.test' })

const { Pool } = pg

// Use TEST_POSTGRES_URL or POSTGRES_URL from .env.test
const connectionString = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL

if (!connectionString) {
  console.error('❌ Error: No database connection string found!')
  console.error('   Set TEST_POSTGRES_URL environment variable or add it to .env.local')
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

// Hash password with SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

const runMigration = async () => {
  const client = await pool.connect()

  try {
    console.log('╔════════════════════════════════════════════════════╗')
    console.log('║  DATABASE MIGRATION TO SUPABASE TEST ENVIRONMENT   ║')
    console.log('╚════════════════════════════════════════════════════╝\n')

    console.log('🔗 Connecting to database...')
    console.log(`   ${connectionString.substring(0, 50)}...\n`)

    // ========================================
    // 1. CREATE BONUS_CONFIG TABLE
    // ========================================
    console.log('📋 [1/4] Creating bonus_config table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS bonus_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        config_data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        CONSTRAINT single_row_check CHECK (id = 1)
      );
    `)

    // Create index for faster JSONB queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bonus_config_data 
      ON bonus_config USING GIN (config_data);
    `)

    // Insert default bonus configuration
    const defaultBonusConfig = {
      Playstation: {
        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
        weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
      },
      'Steering Wheel': {
        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
        weekend: { oneHour: 0, twoHours: 0, threeHours: 0 }
      },
      System: {
        weekday: { oneHour: 900, twoHours: 1800, threeHours: 3600 },
        weekend: { oneHour: 900, twoHours: 1800, threeHours: 3600 }
      }
    }

    await client.query(`
      INSERT INTO bonus_config (id, config_data)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET
        config_data = EXCLUDED.config_data,
        updated_at = NOW() AT TIME ZONE 'Asia/Kolkata';
    `, [JSON.stringify(defaultBonusConfig)])

    console.log('   ✅ bonus_config table created with default values\n')

    // ========================================
    // 2. ADD EXTRA CONTROLLER RATE
    // ========================================
    console.log('📋 [2/4] Adding extra controller rate to pricing_rules...')
    await client.query(`
      INSERT INTO pricing_rules (game_type, weekday_rate, weekend_rate)
      VALUES ('extra_controller', 50, 50)
      ON CONFLICT (game_type) DO UPDATE SET
        weekday_rate = EXCLUDED.weekday_rate,
        weekend_rate = EXCLUDED.weekend_rate,
        updated_at = CURRENT_TIMESTAMP;
    `)
    console.log('   ✅ Extra controller rate set to ₹50\n')

    // ========================================
    // 3. ADD BILLING BUFFER TIME
    // ========================================
    console.log('📋 [3/4] Adding billing buffer time to pricing_rules...')
    await client.query(`
      INSERT INTO pricing_rules (game_type, weekday_rate, weekend_rate)
      VALUES ('buffer_minutes', 10, 10)
      ON CONFLICT (game_type) DO UPDATE SET
        weekday_rate = EXCLUDED.weekday_rate,
        weekend_rate = EXCLUDED.weekend_rate,
        updated_at = CURRENT_TIMESTAMP;
    `)
    console.log('   ✅ Billing buffer time set to 10 minutes\n')

    // ========================================
    // 4. CREATE ADMIN_USERS TABLE
    // ========================================
    console.log('📋 [4/4] Creating admin_users table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata'),
        last_login TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true
      );
    `)

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_username 
      ON admin_users(username);
    `)

    // Insert default admin user
    const defaultPassword = 'admin2026'
    const passwordHash = hashPassword(defaultPassword)

    await client.query(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash;
    `, ['admin', passwordHash])

    console.log('   ✅ admin_users table created\n')

    // ========================================
    // VERIFICATION
    // ========================================
    console.log('🔍 Verifying migration...\n')

    // Check bonus_config
    const bonusResult = await client.query('SELECT * FROM bonus_config WHERE id = 1')
    console.log(`   ✓ bonus_config: ${bonusResult.rows.length > 0 ? 'OK' : 'MISSING'}`)

    // Check extra_controller
    const extraCtrlResult = await client.query("SELECT * FROM pricing_rules WHERE game_type = 'extra_controller'")
    console.log(`   ✓ extra_controller rate: ${extraCtrlResult.rows.length > 0 ? '₹' + extraCtrlResult.rows[0].weekday_rate : 'MISSING'}`)

    // Check buffer_minutes
    const bufferResult = await client.query("SELECT * FROM pricing_rules WHERE game_type = 'buffer_minutes'")
    console.log(`   ✓ buffer_minutes: ${bufferResult.rows.length > 0 ? bufferResult.rows[0].weekday_rate + ' min' : 'MISSING'}`)

    // Check admin_users
    const adminResult = await client.query("SELECT username FROM admin_users WHERE username = 'admin'")
    console.log(`   ✓ admin user: ${adminResult.rows.length > 0 ? 'Created' : 'MISSING'}`)

    console.log('\n╔════════════════════════════════════════════════════╗')
    console.log('║          MIGRATION COMPLETED SUCCESSFULLY!         ║')
    console.log('╚════════════════════════════════════════════════════╝\n')

    console.log('📝 Summary:')
    console.log('   • Bonus configuration table created')
    console.log('   • Extra controller rate: ₹50')
    console.log('   • Billing buffer time: 10 minutes')
    console.log('   • Admin user created (username: admin, password: admin2026)')
    console.log('\n🚀 Your Supabase test database is ready for deployment!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error('\nError details:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✨ All done! You can now deploy to Vercel.\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration failed. Please check the error above.\n')
    process.exit(1)
  })
