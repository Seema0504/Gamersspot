/**
 * Test PostgreSQL Connection from Host
 * This will help diagnose the pgAdmin connection issue
 */

const { Client } = require('pg');

console.log('Testing PostgreSQL Connection...');
console.log('='.repeat(60));
console.log('');

async function testConnection() {
    const configs = [
        {
            name: 'Config 1: localhost',
            config: {
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: 'postgres',
                database: 'multivendor'
            }
        },
        {
            name: 'Config 2: 127.0.0.1',
            config: {
                host: '127.0.0.1',
                port: 5432,
                user: 'postgres',
                password: 'postgres',
                database: 'multivendor'
            }
        },
        {
            name: 'Config 3: Connection String',
            config: {
                connectionString: 'postgresql://postgres:postgres@localhost:5432/multivendor'
            }
        }
    ];

    for (const { name, config } of configs) {
        console.log(`Testing ${name}...`);
        const client = new Client(config);

        try {
            await client.connect();
            const result = await client.query('SELECT version()');
            console.log(`  ✅ SUCCESS!`);
            console.log(`  Version: ${result.rows[0].version.substring(0, 50)}...`);
            await client.end();
        } catch (error) {
            console.log(`  ❌ FAILED: ${error.message}`);
        }
        console.log('');
    }

    console.log('='.repeat(60));
    console.log('Diagnosis:');
    console.log('');
    console.log('If all tests passed:');
    console.log('  → The database is accessible from Node.js');
    console.log('  → pgAdmin might have a different issue');
    console.log('  → Try using DBeaver or TablePlus instead');
    console.log('');
    console.log('If all tests failed:');
    console.log('  → There might be a network/firewall issue');
    console.log('  → Check Docker Desktop is running');
    console.log('  → Try: docker-compose restart');
    console.log('');
}

testConnection().catch(console.error);
