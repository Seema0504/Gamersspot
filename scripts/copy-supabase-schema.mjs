// Script to copy Supabase schema to local database
import pg from 'pg';
const { Client } = pg;

const supabaseUrl = 'postgresql://postgres.dcxvojarhfujdhwnunrs:gamersspot13195@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const localUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';

async function copySchema() {
    const supabase = new Client({ connectionString: supabaseUrl });
    const local = new Client({ connectionString: localUrl });

    try {
        await supabase.connect();
        await local.connect();

        console.log('✅ Connected to both databases');

        // 1. Create database
        console.log('\n📦 Creating "gamersspot" database...');
        try {
            await local.query('CREATE DATABASE gamersspot;');
            console.log('✅ Database created');
        } catch (err) {
            if (err.code === '42P04') {
                console.log('⚠️  Database already exists');
            } else {
                throw err;
            }
        }

        // Reconnect to the new database
        await local.end();
        const localGamersspot = new Client({
            connectionString: 'postgresql://postgres:postgres@localhost:5432/gamersspot'
        });
        await localGamersspot.connect();

        // 2. Get all table definitions from Supabase
        console.log('\n📋 Fetching table structure from Supabase...');
        const tables = await supabase.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE 'pg_%'
            AND table_name NOT LIKE 'sql_%'
            ORDER BY table_name
        `);

        console.log(`Found ${tables.rows.length} tables:`, tables.rows.map(r => r.table_name).join(', '));

        // 3. For each table, get CREATE TABLE statement
        for (const { table_name } of tables.rows) {
            console.log(`\n🔨 Creating table: ${table_name}`);

            // Get columns
            const columns = await supabase.query(`
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    column_default,
                    is_nullable,
                    udt_name
                FROM information_schema.columns
                WHERE table_name = $1
                AND table_schema = 'public'
                ORDER BY ordinal_position
            `, [table_name]);

            // Get constraints
            const constraints = await supabase.query(`
                SELECT
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule
                FROM information_schema.table_constraints AS tc
                LEFT JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                LEFT JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                LEFT JOIN information_schema.referential_constraints AS rc
                    ON rc.constraint_name = tc.constraint_name
                WHERE tc.table_name = $1
                AND tc.table_schema = 'public'
            `, [table_name]);

            // Build CREATE TABLE statement
            let createSQL = `CREATE TABLE IF NOT EXISTS ${table_name} (\n`;

            // Add columns
            const columnDefs = columns.rows.map(col => {
                let def = `    ${col.column_name} `;

                // Data type
                if (col.data_type === 'character varying') {
                    def += `VARCHAR(${col.character_maximum_length || 255})`;
                } else if (col.data_type === 'USER-DEFINED') {
                    def += col.udt_name.toUpperCase();
                } else {
                    def += col.data_type.toUpperCase();
                }

                // Default
                if (col.column_default) {
                    def += ` DEFAULT ${col.column_default}`;
                }

                // Nullable
                if (col.is_nullable === 'NO') {
                    def += ' NOT NULL';
                }

                return def;
            });

            createSQL += columnDefs.join(',\n');

            // Add primary key
            const pk = constraints.rows.find(c => c.constraint_type === 'PRIMARY KEY');
            if (pk) {
                createSQL += `,\n    PRIMARY KEY (${pk.column_name})`;
            }

            // Add unique constraints
            const uniques = constraints.rows.filter(c => c.constraint_type === 'UNIQUE');
            for (const u of uniques) {
                createSQL += `,\n    UNIQUE (${u.column_name})`;
            }

            createSQL += '\n);';

            // Execute CREATE TABLE
            await localGamersspot.query(createSQL);
            console.log(`✅ Table ${table_name} created`);

            // Add foreign keys separately
            const fks = constraints.rows.filter(c => c.constraint_type === 'FOREIGN KEY');
            for (const fk of fks) {
                const deleteRule = fk.delete_rule === 'CASCADE' ? 'ON DELETE CASCADE' : '';
                const alterSQL = `
                    ALTER TABLE ${table_name} 
                    ADD CONSTRAINT ${fk.constraint_name}
                    FOREIGN KEY (${fk.column_name}) 
                    REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})
                    ${deleteRule};
                `;
                try {
                    await localGamersspot.query(alterSQL);
                    console.log(`  ✅ Foreign key added: ${fk.column_name} -> ${fk.foreign_table_name}`);
                } catch (err) {
                    if (err.code !== '42710') { // Ignore if already exists
                        console.log(`  ⚠️  FK error: ${err.message}`);
                    }
                }
            }
        }

        // 4. Get indexes
        console.log('\n📊 Creating indexes...');
        const indexes = await supabase.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
        `);

        for (const idx of indexes.rows) {
            try {
                await localGamersspot.query(idx.indexdef);
                console.log(`✅ Index created: ${idx.indexname}`);
            } catch (err) {
                if (err.code !== '42P07') { // Ignore if already exists
                    console.log(`⚠️  Index error: ${err.message}`);
                }
            }
        }

        console.log('\n🎉 Schema copy completed successfully!');
        console.log('\n📝 Database: gamersspot');
        console.log('🔗 Connection: postgresql://postgres:postgres@localhost:5432/gamersspot');

        await supabase.end();
        await localGamersspot.end();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

copySchema();
