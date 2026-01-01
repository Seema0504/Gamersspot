/**
 * Display Multi-Vendor Database Structure
 * Shows all tables with their columns and sample data
 */

const { Client } = require('pg');

const connectionString = 'postgresql://postgres:postgres@localhost:5432/multivendor';

async function showDatabaseStructure() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('='.repeat(80));
        console.log('MULTI-VENDOR DATABASE STRUCTURE');
        console.log('Database: multivendor | Schema: multivendor');
        console.log('='.repeat(80));
        console.log('');

        // Get all tables
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'multivendor' 
      ORDER BY table_name
    `);

        for (const { table_name } of tablesResult.rows) {
            console.log(`📊 TABLE: multivendor.${table_name}`);
            console.log('-'.repeat(80));

            // Get columns
            const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'multivendor' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [table_name]);

            console.log('');
            console.log('Columns:');
            columnsResult.rows.forEach(col => {
                const type = col.character_maximum_length
                    ? `${col.data_type}(${col.character_maximum_length})`
                    : col.data_type;
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                console.log(`  • ${col.column_name.padEnd(25)} ${type.padEnd(20)} ${nullable}${defaultVal}`);
            });

            // Get row count
            const countResult = await client.query(`
        SELECT COUNT(*) as count FROM multivendor.${table_name}
      `);
            console.log('');
            console.log(`Row Count: ${countResult.rows[0].count}`);

            // Show sample data for tables with data
            if (parseInt(countResult.rows[0].count) > 0) {
                const sampleResult = await client.query(`
          SELECT * FROM multivendor.${table_name} LIMIT 3
        `);

                if (sampleResult.rows.length > 0) {
                    console.log('');
                    console.log('Sample Data:');
                    sampleResult.rows.forEach((row, index) => {
                        console.log(`  Row ${index + 1}:`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
                    });
                }
            }

            console.log('');
            console.log('');
        }

        // Show indexes
        console.log('📑 INDEXES');
        console.log('-'.repeat(80));
        const indexResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'multivendor'
      ORDER BY tablename, indexname
    `);

        indexResult.rows.forEach(idx => {
            console.log(`  • ${idx.tablename}.${idx.indexname}`);
        });

        console.log('');
        console.log('');

        // Show functions
        console.log('⚙️  FUNCTIONS');
        console.log('-'.repeat(80));
        const funcResult = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'multivendor'
      ORDER BY routine_name
    `);

        if (funcResult.rows.length > 0) {
            funcResult.rows.forEach(func => {
                console.log(`  • ${func.routine_name} (${func.routine_type})`);
            });
        } else {
            console.log('  No custom functions');
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ Database structure displayed successfully!');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

showDatabaseStructure();
