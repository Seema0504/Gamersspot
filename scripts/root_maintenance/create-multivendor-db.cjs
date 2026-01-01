/**
 * Create New Multi-Vendor Database
 * This script creates a new database called 'multivendor' and sets up all tables
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

console.log('='.repeat(60));
console.log('Creating New Multi-Vendor Database');
console.log('='.repeat(60));
console.log('');

async function createDatabase() {
    // First, connect to the default 'postgres' database to create our new database
    const adminClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres' // Connect to default database
    });

    try {
        console.log('Step 1: Connecting to PostgreSQL server...');
        await adminClient.connect();
        console.log('✓ Connected to PostgreSQL server');
        console.log('');

        // Check if database already exists
        console.log('Step 2: Checking if database "multivendor" exists...');
        const checkDb = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = 'multivendor'"
        );

        if (checkDb.rows.length > 0) {
            console.log('⚠ Database "multivendor" already exists');
            console.log('  Dropping existing database...');

            // Terminate existing connections
            await adminClient.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = 'multivendor'
        AND pid <> pg_backend_pid()
      `);

            // Drop the database
            await adminClient.query('DROP DATABASE multivendor');
            console.log('✓ Existing database dropped');
        }

        // Create new database
        console.log('Step 3: Creating new database "multivendor"...');
        await adminClient.query('CREATE DATABASE multivendor');
        console.log('✓ Database "multivendor" created successfully');
        console.log('');

        await adminClient.end();

        // Now connect to the new database and set up schema
        console.log('Step 4: Connecting to new database...');
        const dbClient = new Client({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'postgres',
            database: 'multivendor'
        });

        await dbClient.connect();
        console.log('✓ Connected to "multivendor" database');
        console.log('');

        // Read and execute setup SQL
        console.log('Step 5: Setting up schema and tables...');
        const sqlFile = path.join(__dirname, 'database', 'multivendor_setup.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        await dbClient.query(sql);
        console.log('✓ Schema and tables created successfully');
        console.log('');

        // Verify setup
        console.log('Step 6: Verifying setup...');

        // Check schema
        const schemaCheck = await dbClient.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'multivendor'
    `);
        console.log('✓ Schema "multivendor" exists');

        // Check tables
        const tablesResult = await dbClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'multivendor' 
      ORDER BY table_name
    `);

        console.log('✓ Tables created:');
        tablesResult.rows.forEach(row => {
            console.log('  -', row.table_name);
        });
        console.log('');

        // Check default tenant
        const tenantResult = await dbClient.query(`
      SELECT id, tenant_code, shop_name, is_active 
      FROM multivendor.tenants 
      WHERE tenant_code = 'default'
    `);

        if (tenantResult.rows.length > 0) {
            const tenant = tenantResult.rows[0];
            console.log('✓ Default tenant created:');
            console.log('  - ID:', tenant.id);
            console.log('  - Code:', tenant.tenant_code);
            console.log('  - Name:', tenant.shop_name);
            console.log('  - Active:', tenant.is_active);
            console.log('');
        }

        // Check default snacks
        const snacksResult = await dbClient.query(`
      SELECT COUNT(*) as count FROM multivendor.snacks WHERE tenant_id = 1
    `);
        console.log('✓ Default snacks created:', snacksResult.rows[0].count);

        // Check default settings
        const settingsResult = await dbClient.query(`
      SELECT COUNT(*) as count FROM multivendor.settings WHERE tenant_id = 1
    `);
        console.log('✓ Default settings created:', settingsResult.rows[0].count);
        console.log('');

        await dbClient.end();

        // Update .env.local
        console.log('Step 7: Updating .env.local...');
        const envContent = 'POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/multivendor\n';
        fs.writeFileSync('.env.local', envContent, 'utf8');
        console.log('✓ .env.local updated with new connection string');
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ SUCCESS! Multi-Vendor Database Created');
        console.log('='.repeat(60));
        console.log('');
        console.log('Database Details:');
        console.log('  • Name: multivendor');
        console.log('  • Host: localhost');
        console.log('  • Port: 5432');
        console.log('  • User: postgres');
        console.log('  • Schema: multivendor');
        console.log('  • Tables: 7 (tenants, stations, invoices, paid_events, snacks, customers, settings)');
        console.log('  • Default Tenant: "default" (Gamers Spot - Main Branch)');
        console.log('');
        console.log('Connection String:');
        console.log('  postgresql://postgres:postgres@localhost:5432/multivendor');
        console.log('');
        console.log('Next Steps:');
        console.log('  1. Your .env.local has been updated automatically');
        console.log('  2. Start your application: npm run dev:all');
        console.log('  3. Update API endpoints to use multivendor schema');
        console.log('  4. Test the multi-vendor functionality');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ ERROR: Database creation failed!');
        console.error('');
        console.error('Error details:');
        console.error(error.message);
        console.error('');

        if (error.code === 'ECONNREFUSED') {
            console.error('Troubleshooting:');
            console.error('  • Make sure PostgreSQL is running');
            console.error('  • Check Docker: docker ps');
            console.error('  • Start Docker: docker-compose up -d');
            console.error('');
        } else if (error.code === '28P01') {
            console.error('Troubleshooting:');
            console.error('  • Check PostgreSQL password');
            console.error('  • Default password should be: postgres');
            console.error('');
        }

        process.exit(1);
    }
}

// Run the setup
createDatabase().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
