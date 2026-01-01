/**
 * Get All Tables from Production Database
 */

const { Client } = require('pg');

async function getAllProductionTables() {
    const prodDb = new Client({
        connectionString: 'postgresql://postgres.ejzcfmsxibdanknonuiq:Welcome@13195@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await prodDb.connect();
        console.log('✓ Connected to production');
        console.log('');

        // Get all user tables
        const tables = await prodDb.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'sql_%'
      ORDER BY table_name
    `);

        console.log('📊 ALL TABLES IN PRODUCTION DATABASE:');
        console.log('='.repeat(60));
        console.log('');
        console.log(`Total Tables: ${tables.rows.length}`);
        console.log('');

        tables.rows.forEach((row, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. ${row.table_name}`);
        });

        console.log('');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prodDb.end();
    }
}

getAllProductionTables();
