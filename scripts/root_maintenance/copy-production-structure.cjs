/**
 * Simple Production to Local Database Copy
 */

const { Client } = require('pg');

async function copyStructure() {
    console.log('Connecting to production database...');

    const prodDb = new Client({
        connectionString: 'postgresql://postgres.ejzcfmsxibdanknonuiq:Welcome@13195@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
        ssl: { rejectUnauthorized: false }
    });

    const localDb = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'multivendor'
    });

    try {
        await prodDb.connect();
        console.log('✓ Connected to production');

        await localDb.connect();
        console.log('✓ Connected to local');

        // Get tables
        const tables = await prodDb.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name IN ('stations', 'invoices', 'paid_events', 'snacks', 'customers')
      ORDER BY table_name
    `);

        console.log('\nTables found:', tables.rows.map(r => r.table_name).join(', '));

        // Drop existing
        console.log('\nDropping existing tables...');
        await localDb.query('DROP TABLE IF EXISTS stations, invoices, paid_events, snacks, customers CASCADE');

        // Copy each table
        for (const { table_name } of tables.rows) {
            console.log(`\nCopying ${table_name}...`);

            const cols = await prodDb.query(`
        SELECT column_name, data_type, character_maximum_length, 
               is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table_name]);

            let sql = `CREATE TABLE ${table_name} (\n`;
            const colDefs = cols.rows.map(c => {
                let def = `  ${c.column_name} `;

                if (c.data_type === 'character varying') {
                    def += `VARCHAR(${c.character_maximum_length || 255})`;
                } else if (c.data_type === 'timestamp with time zone') {
                    def += 'TIMESTAMPTZ';
                } else if (c.data_type === 'ARRAY') {
                    def += 'INTEGER[]';
                } else if (c.data_type === 'integer' && c.column_default && c.column_default.includes('nextval')) {
                    def += 'SERIAL';
                } else {
                    def += c.data_type.toUpperCase();
                }

                if (c.is_nullable === 'NO') def += ' NOT NULL';

                // Skip DEFAULT if it references a sequence (SERIAL handles it)
                if (c.column_default && !c.column_default.includes('nextval')) {
                    def += ` DEFAULT ${c.column_default}`;
                }

                return def;
            });

            sql += colDefs.join(',\n') + '\n);';

            await localDb.query(sql);
            console.log(`  ✓ Created ${table_name}`);
        }

        console.log('\n✅ All tables copied successfully!');
        console.log('\nVerifying...');

        const verify = await localDb.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

        console.log('Tables in local multivendor:');
        verify.rows.forEach(r => console.log('  -', r.table_name));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prodDb.end();
        await localDb.end();
    }
}

copyStructure();
