/**
 * Multi-Vendor Database Setup Script (Node.js)
 * This script sets up the multivendor schema in your local PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

console.log('='.repeat(60));
console.log('Gamers Spot - Multi-Vendor Database Setup');
console.log('='.repeat(60));
console.log('');

// Get database connection string
const connectionString = process.env.POSTGRES_URL ||
    'postgresql://postgres:postgres@localhost:5432/gamersspot';

console.log('Database Connection:', connectionString.replace(/:[^:@]+@/, ':****@'));
console.log('');

// Create database pool
const pool = new Pool({
    connectionString,
    max: 1
});

async function runSetup() {
    let client;

    try {
        console.log('Connecting to database...');
        client = await pool.connect();
        console.log('✓ Connected successfully');
        console.log('');

        // Read SQL file
        const sqlFile = path.join(__dirname, 'database', 'multivendor_setup.sql');
        console.log('Reading SQL file:', sqlFile);
        const sql = fs.readFileSync(sqlFile, 'utf8');
        console.log('✓ SQL file loaded');
        console.log('');

        // Execute SQL
        console.log('Executing multi-vendor schema setup...');
        console.log('This may take a few moments...');
        console.log('');

        await client.query(sql);

        console.log('✓ Multi-vendor schema setup completed successfully!');
        console.log('');
        console.log('Summary:');
        console.log('  • Schema: multivendor');
        console.log('  • Tables: 7 (tenants, stations, invoices, paid_events, snacks, customers, settings)');
        console.log('  • Default tenant: "default" (Gamers Spot - Main Branch)');
        console.log('');

        // Verify setup
        console.log('Verifying setup...');
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'multivendor' 
      ORDER BY table_name
    `);

        console.log('✓ Tables created:');
        result.rows.forEach(row => {
            console.log('  -', row.table_name);
        });
        console.log('');

        // Check default tenant
        const tenantResult = await client.query(`
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

        console.log('='.repeat(60));
        console.log('Setup Complete!');
        console.log('='.repeat(60));
        console.log('');
        console.log('Next Steps:');
        console.log('  1. Update your application code to use the multivendor schema');
        console.log('  2. Test the multi-vendor functionality');
        console.log('  3. Add more tenants as needed');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('ERROR: Setup failed!');
        console.error('');
        console.error('Error details:');
        console.error(error.message);
        console.error('');

        if (error.code === 'ECONNREFUSED') {
            console.error('Troubleshooting:');
            console.error('  • Make sure PostgreSQL is running');
            console.error('  • Check your connection string in .env.local');
            console.error('  • For Docker: docker-compose up -d');
            console.error('');
        }

        process.exit(1);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
    }
}

// Run setup
runSetup().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
