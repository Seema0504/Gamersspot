import dotenv from 'dotenv'
import pg from 'pg'

// Load environment variables
const isProd = process.argv.includes('--prod');
const envFile = isProd ? '.env.prod' : '.env.local';
console.log(`🔌 Loading configuration from ${envFile}`);
dotenv.config({ path: [envFile, '.env'] })

const { Pool } = pg

async function fixTimezoneDefaults() {
    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
    })

    try {
        console.log('\n🔧 Fixing timezone defaults in database...\n')

        // Fix invoices table
        await pool.query(`ALTER TABLE invoices ALTER COLUMN created_at SET DEFAULT NOW()`)
        console.log('✅ Fixed invoices.created_at')

        // Fix customers table
        await pool.query(`ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT NOW()`)
        console.log('✅ Fixed customers.created_at')

        // Fix snacks table
        await pool.query(`ALTER TABLE snacks ALTER COLUMN created_at SET DEFAULT NOW()`)
        await pool.query(`ALTER TABLE snacks ALTER COLUMN updated_at SET DEFAULT NOW()`)
        console.log('✅ Fixed snacks.created_at and updated_at')

        // Fix paid_events table
        await pool.query(`ALTER TABLE paid_events ALTER COLUMN created_at SET DEFAULT NOW()`)
        console.log('✅ Fixed paid_events.created_at')

        // Fix stations table
        await pool.query(`ALTER TABLE stations ALTER COLUMN created_at SET DEFAULT NOW()`)
        await pool.query(`ALTER TABLE stations ALTER COLUMN updated_at SET DEFAULT NOW()`)
        console.log('✅ Fixed stations.created_at and updated_at')

        // Try to fix other tables (may not exist)
        try {
            await pool.query(`ALTER TABLE admin_users ALTER COLUMN created_at SET DEFAULT NOW()`)
            console.log('✅ Fixed admin_users.created_at')
        } catch (e) {
            console.log('⚠️  admin_users table not found (skipping)')
        }

        try {
            await pool.query(`ALTER TABLE pricing_rules ALTER COLUMN created_at SET DEFAULT NOW()`)
            await pool.query(`ALTER TABLE pricing_rules ALTER COLUMN updated_at SET DEFAULT NOW()`)
            console.log('✅ Fixed pricing_rules.created_at and updated_at')
        } catch (e) {
            console.log('⚠️  pricing_rules table not found (skipping)')
        }

        try {
            await pool.query(`ALTER TABLE bonus_config ALTER COLUMN created_at SET DEFAULT NOW()`)
            await pool.query(`ALTER TABLE bonus_config ALTER COLUMN updated_at SET DEFAULT NOW()`)
            console.log('✅ Fixed bonus_config.created_at and updated_at')
        } catch (e) {
            console.log('⚠️  bonus_config table not found (skipping)')
        }

        console.log('\n✅ All timezone defaults fixed!')
        console.log('\n📝 Note: This only affects NEW records. Existing records are unchanged.')
        console.log('   Existing invoices will still show incorrect dates.')
        console.log('   New invoices created after this fix will have correct UTC timestamps.\n')

    } catch (error) {
        console.error('❌ Error:', error.message)
        console.error(error)
    } finally {
        await pool.end()
    }
}

fixTimezoneDefaults()
