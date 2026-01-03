// Create "Game Management System" database and copy schema from Supabase
import pg from 'pg';
const { Client } = pg;

const supabaseUrl = 'postgresql://postgres.dcxvojarhfujdhwnunrs:gamersspot13195@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const localUrl = 'postgresql://postgres:postgres@localhost:5434/gamersspot';

async function setupDatabase() {
    try {
        // Connect to Supabase and new local database
        const supabase = new Client({ connectionString: supabaseUrl });
        const localDb = new Client({ connectionString: localUrl });

        await supabase.connect();
        await localDb.connect();
        console.log('✅ Connected to both Supabase and new local database');

        // 3a. Install common extensions
        console.error('\n📦 Installing extensions...');
        const extensions = ['uuid-ossp', 'pgcrypto', 'citext'];
        for (const ext of extensions) {
            try {
                await localDb.query(`CREATE EXTENSION IF NOT EXISTS "${ext}";`);
                console.error(`✅ Extension installed: ${ext}`);
            } catch (err) {
                console.error(`⚠️ Extension error: ${err.message}`);
            }
        }

        // 3b. Fetch and create types (ENUMs)
        console.error('\n📦 Fetching types...');
        const typesQuery = `
            SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ') as enum_values
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            GROUP BY t.typname
        `;
        const typesResult = await supabase.query(typesQuery);
        for (const type of typesResult.rows) {
            try {
                const typeSQL = `CREATE TYPE ${type.typname} AS ENUM (${type.enum_values});`;
                console.error(`    SQL: ${typeSQL.substring(0, 60)}...`);
                await localDb.query(typeSQL);
                console.error(`✅ Type created: ${type.typname}`);
            } catch (err) {
                if (err.code !== '42710') { // Ignore if already exists
                    console.log(`⚠️ Type error: ${err.message}`);
                }
            }
        }



        // 3c. Fetch and create sequences
        console.error('\n📦 Fetching sequences...');
        const sequencesQuery = `
            SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment, cycle_option
            FROM information_schema.sequences
            WHERE sequence_schema = 'public'
        `;
        const sequencesResult = await supabase.query(sequencesQuery);
        for (const seq of sequencesResult.rows) {
            try {
                const createSeqSQL = `
                    CREATE SEQUENCE IF NOT EXISTS ${seq.sequence_name}
                    AS ${seq.data_type}
                    INCREMENT BY ${seq.increment}
                    MINVALUE ${seq.minimum_value}
                    MAXVALUE ${seq.maximum_value}
                    START WITH ${seq.start_value}
                    ${seq.cycle_option === 'YES' ? 'CYCLE' : 'NO CYCLE'}
                `;
                await localDb.query(createSeqSQL);
                console.error(`✅ Sequence created: ${seq.sequence_name}`);
            } catch (err) {
                console.error(`⚠️ Sequence error: ${err.message}`);
            }
        }

        // 4. Get all tables from Supabase
        console.error('\n📋 Fetching tables from Supabase...');
        const tablesResult = await supabase.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const tables = tablesResult.rows.map(r => r.table_name);
        console.error(`Found ${tables.length} tables:`, tables.join(', '));

        // Pass 1: Create all tables (structure only)
        console.error('\n🔹 PASS 1: Creating tables...');
        for (const tableName of tables) {
            console.error(`  Processing table: ${tableName}`);
            const schemaQuery = `
                SELECT 
                    'CREATE TABLE ' || quote_ident('${tableName}') || ' (' ||
                    string_agg(
                        quote_ident(column_name) || ' ' || 
                        CASE 
                            WHEN data_type = 'ARRAY' THEN udt_name
                            WHEN data_type = 'USER-DEFINED' THEN udt_name
                            WHEN data_type = 'character varying' THEN 'VARCHAR(' || COALESCE(character_maximum_length::text, '255') || ')'
                            ELSE UPPER(data_type)
                        END ||
                        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END ||
                        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
                        ', '
                        ORDER BY ordinal_position
                    ) || ');' as create_statement
                FROM information_schema.columns
                WHERE table_name = '${tableName}'
                AND table_schema = 'public'
                GROUP BY table_name;
            `;

            const schemaResult = await supabase.query(schemaQuery);
            let createSQL = schemaResult.rows[0]?.create_statement;

            if (createSQL) {
                try {
                    console.error(`    SQL: ${createSQL.substring(0, 60)}...`);
                    await localDb.query(createSQL);
                    console.error(`    ✅ Created table structure`);
                } catch (err) {
                    if (err.code === '42P07') { // Relation exists
                        console.error(`    ⚠️ Table already exists`);
                    } else {
                        throw err;
                    }
                }
            }
        }

        // Pass 2: Add constraints (PKs, FKs, Unique)
        console.log('\n🔹 PASS 2: Adding constraints...');
        for (const tableName of tables) {
            console.log(`  Processing constraints for: ${tableName}`);
            const constraintsResult = await supabase.query(`
                SELECT
                    conname as constraint_name,
                    pg_get_constraintdef(oid) as constraint_def
                FROM pg_constraint
                WHERE conrelid = 'public.${tableName}'::regclass
                AND contype IN ('p', 'u', 'f', 'c')
                ORDER BY contype; -- PKs first usually
            `);

            for (const constraint of constraintsResult.rows) {
                try {
                    const alterSQL = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraint.constraint_name} ${constraint.constraint_def};`;
                    await localDb.query(alterSQL);
                    console.log(`    ✅ Added constraint: ${constraint.constraint_name}`);
                } catch (err) {
                    if (err.code !== '42710' && err.code !== '42P07') {
                        console.log(`    ⚠️  Constraint warning: ${err.message}`);
                    }
                }
            }
        }

        // 6. Get and create indexes
        console.log('\n📊 Creating indexes...');
        const indexesResult = await supabase.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
            AND indexname NOT LIKE '%_key'
            ORDER BY indexname;
        `);

        for (const idx of indexesResult.rows) {
            try {
                await localDb.query(idx.indexdef);
                console.log(`✅ Index created: ${idx.indexname}`);
            } catch (err) {
                if (err.code !== '42P07') {
                    console.log(`⚠️  Index warning: ${err.message}`);
                }
            }
        }

        // 7. Copy sample data from first shop
        console.log('\n📥 Copying sample data...');

        // Copy first shop
        const shopData = await supabase.query('SELECT * FROM shops LIMIT 1');
        if (shopData.rows.length > 0) {
            const shop = shopData.rows[0];
            await localDb.query(`
                INSERT INTO shops (id, name, address, phone, email, upi_id, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            `, [shop.id, shop.name || 'Local Dev Shop', shop.address, shop.phone, shop.email, shop.upi_id, true, new Date()]);
            console.log(`✅ Sample shop created (ID: ${shop.id})`);

            // Copy admin users for this shop
            const usersData = await supabase.query('SELECT * FROM admin_users WHERE shop_id = $1 OR shop_id IS NULL LIMIT 5', [shop.id]);
            for (const user of usersData.rows) {
                await localDb.query(`
                    INSERT INTO admin_users (username, password_hash, role, shop_id, is_active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (username) DO NOTHING
                `, [user.username, user.password_hash, user.role, user.shop_id, user.is_active, new Date()]);
            }
            console.log(`✅ ${usersData.rows.length} admin users copied`);

            // Copy subscriptions
            const subsData = await supabase.query('SELECT * FROM subscriptions WHERE shop_id = $1 LIMIT 1', [shop.id]);
            if (subsData.rows.length > 0) {
                const sub = subsData.rows[0];
                await localDb.query(`
                    INSERT INTO subscriptions (shop_id, plan_name, status, start_date, end_date, monthly_amount, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [sub.shop_id, sub.plan_name, sub.status, sub.start_date, sub.end_date, sub.monthly_amount, new Date()]);
                console.log(`✅ Subscription copied`);
            }

            // Copy snacks
            const snacksData = await supabase.query('SELECT * FROM snacks WHERE shop_id = $1', [shop.id]);
            for (const snack of snacksData.rows) {
                await localDb.query(`
                    INSERT INTO snacks (shop_id, name, price, active, display_order, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (shop_id, name) DO NOTHING
                `, [snack.shop_id, snack.name, snack.price, snack.active, snack.display_order, new Date()]);
            }
            console.log(`✅ ${snacksData.rows.length} snacks copied`);

            // Copy pricing rules
            const pricingData = await supabase.query('SELECT * FROM pricing_rules WHERE shop_id = $1', [shop.id]);
            for (const rule of pricingData.rows) {
                await localDb.query(`
                    INSERT INTO pricing_rules (shop_id, game_type, weekday_rate, weekend_rate, created_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (shop_id, game_type) DO NOTHING
                `, [rule.shop_id, rule.game_type, rule.weekday_rate, rule.weekend_rate, new Date()]);
            }
            console.log(`✅ ${pricingData.rows.length} pricing rules copied`);

            // Copy bonus config
            const bonusData = await supabase.query('SELECT * FROM bonus_config WHERE shop_id = $1', [shop.id]);
            if (bonusData.rows.length > 0) {
                const bonus = bonusData.rows[0];
                await localDb.query(`
                    INSERT INTO bonus_config (shop_id, config_data, created_at)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (shop_id) DO NOTHING
                `, [bonus.shop_id, bonus.config_data, new Date()]);
                console.log(`✅ Bonus config copied`);
            }
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\n📝 Database Details:');
        console.log(`   Name: gamersspot`);
        console.log(`   Connection: postgresql://postgres:postgres@localhost:5434/gamersspot`);
        console.log('\n🔑 Update your .env file:');
        console.log(`   POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/gamersspot`);

        await supabase.end();
        await localDb.end();

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

setupDatabase();
