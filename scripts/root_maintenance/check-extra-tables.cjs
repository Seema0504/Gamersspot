const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/multivendor'
});

async function checkSchema() {
    try {
        await client.connect();

        const tables = ['pricing_rules', 'bonus_config', 'admin_users'];
        for (const t of tables) {
            console.log(`\n--- ${t} ---`);
            const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
            console.log(res.rows);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

checkSchema();
