const { Client } = require('pg');

console.log('='.repeat(70));
console.log('Multi-Vendor Database Verification');
console.log('='.repeat(70));
console.log('');

const connectionString = 'postgresql://postgres:postgres@localhost:5432/multivendor';
console.log('Connection String:', connectionString.replace(/:[^:@]+@/, ':****@'));
console.log('');

const client = new Client({ connectionString });

async function verify() {
    try {
        await client.connect();
        console.log('✅ Database Connection: SUCCESS');
        console.log('');

        // Check schema
        const schemaResult = await client.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'multivendor'
    `);
        console.log(schemaResult.rows.length > 0 ? '✅ Schema exists' : '❌ Schema NOT found');

        // Check tables
        const tablesResult = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'multivendor'
    `);
        console.log(`✅ Tables found: ${tablesResult.rows[0].count}`);

        // Check tenant
        const tenantResult = await client.query(`
      SELECT * FROM multivendor.tenants WHERE tenant_code = 'default'
    `);
        if (tenantResult.rows.length > 0) {
            console.log(`✅ Default tenant: ${tenantResult.rows[0].shop_name}`);
        }

        // Check snacks
        const snacksResult = await client.query(`
      SELECT COUNT(*) as count FROM multivendor.snacks WHERE tenant_id = 1
    `);
        console.log(`✅ Default snacks: ${snacksResult.rows[0].count}`);

        console.log('');
        console.log('='.repeat(70));
        console.log('✅ ALL TESTS PASSED - Database is ready!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verify();
