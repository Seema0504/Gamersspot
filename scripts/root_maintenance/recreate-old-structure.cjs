/**
 * Recreate Old Database Structure in MultiVendor Database
 * This copies the exact structure from gamersspot to multivendor (public schema)
 */

const { Client } = require('pg');

console.log('='.repeat(70));
console.log('Recreating Old Database Structure in MultiVendor Database');
console.log('='.repeat(70));
console.log('');

async function recreateStructure() {
    // Connect to old database to get structure
    const oldDb = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'gamersspot'
    });

    // Connect to new database
    const newDb = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'multivendor'
    });

    try {
        console.log('Step 1: Connecting to databases...');
        await oldDb.connect();
        await newDb.connect();
        console.log('✓ Connected to both databases');
        console.log('');

        console.log('Step 2: Dropping multivendor schema (if exists)...');
        await newDb.query('DROP SCHEMA IF EXISTS multivendor CASCADE');
        console.log('✓ Dropped multivendor schema');
        console.log('');

        console.log('Step 3: Getting table structures from gamersspot...');

        // Get stations table structure
        const stationsSchema = await oldDb.query(`
      SELECT 
        'CREATE TABLE stations (' ||
        string_agg(
          column_name || ' ' || 
          CASE 
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
            ELSE UPPER(data_type)
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
          ', '
          ORDER BY ordinal_position
        ) || 
        ', PRIMARY KEY (id));' as create_statement
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stations'
    `);

        console.log('✓ Got table structures');
        console.log('');

        console.log('Step 4: Creating tables in multivendor database...');

        // Recreate tables using pg_dump
        const { execSync } = require('child_process');

        // Export schema from old database
        console.log('  Exporting schema from gamersspot...');
        execSync('docker exec gamersspot-db pg_dump -U postgres -d gamersspot --schema-only --no-owner --no-privileges > temp_schema.sql', {
            cwd: process.cwd(),
            stdio: 'inherit'
        });

        // Import to new database
        console.log('  Importing schema to multivendor...');
        execSync('docker exec -i gamersspot-db psql -U postgres -d multivendor < temp_schema.sql', {
            cwd: process.cwd(),
            stdio: 'inherit'
        });

        console.log('✓ Tables created');
        console.log('');

        console.log('Step 5: Verifying tables...');
        const tables = await newDb.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

        console.log('✓ Tables in multivendor database:');
        tables.rows.forEach(row => {
            console.log('  -', row.table_name);
        });
        console.log('');

        console.log('='.repeat(70));
        console.log('✅ SUCCESS! Old structure recreated in multivendor database');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('');
        console.error('❌ ERROR:', error.message);
        console.error('');
    } finally {
        await oldDb.end();
        await newDb.end();
    }
}

recreateStructure();
