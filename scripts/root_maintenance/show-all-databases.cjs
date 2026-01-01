/**
 * Show All Databases Overview
 * Displays all databases with their tables and row counts
 */

const { Client } = require('pg');

async function showAllDatabases() {
    console.log('='.repeat(80));
    console.log('ALL DATABASES IN YOUR LOCAL POSTGRESQL');
    console.log('='.repeat(80));
    console.log('');

    const databases = ['gamersspot', 'multivendor', 'postgres'];

    for (const dbName of databases) {
        const client = new Client({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'postgres',
            database: dbName
        });

        try {
            await client.connect();

            console.log(`📊 DATABASE: ${dbName}`);
            console.log('-'.repeat(80));

            // Get tables
            const tablesResult = await client.query(`
        SELECT 
          schemaname,
          tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename
      `);

            if (tablesResult.rows.length === 0) {
                console.log('  (No user tables)');
            } else {
                console.log(`  Tables: ${tablesResult.rows.length}`);
                console.log('');

                for (const { schemaname, tablename } of tablesResult.rows) {
                    const fullName = schemaname === 'public' ? tablename : `${schemaname}.${tablename}`;

                    try {
                        const countResult = await client.query(
                            `SELECT COUNT(*) as count FROM ${schemaname}.${tablename}`
                        );
                        const count = countResult.rows[0].count;
                        console.log(`    ${fullName.padEnd(30)} ${count} rows`);
                    } catch (err) {
                        console.log(`    ${fullName.padEnd(30)} (error counting)`);
                    }
                }
            }

            console.log('');
            await client.end();

        } catch (error) {
            console.log(`  ❌ Error accessing database: ${error.message}`);
            console.log('');
        }
    }

    console.log('='.repeat(80));
    console.log('Summary:');
    console.log('  • gamersspot  - Your original database with production data');
    console.log('  • multivendor - New database with production structure (empty)');
    console.log('  • postgres    - System database (PostgreSQL default)');
    console.log('='.repeat(80));
}

showAllDatabases();
