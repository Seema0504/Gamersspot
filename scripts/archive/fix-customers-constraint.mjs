import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.POSTGRES_URL
});

async function fixCustomersConstraint() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Drop existing constraint if any
        await client.query(`
            ALTER TABLE customers 
            DROP CONSTRAINT IF EXISTS customers_phone_shop_unique;
        `);

        // Add unique constraint on (phone_number, shop_id)
        await client.query(`
            ALTER TABLE customers 
            ADD CONSTRAINT customers_phone_shop_unique UNIQUE (phone_number, shop_id);
        `);

        console.log('✅ Added unique constraint on customers(phone_number, shop_id)');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

fixCustomersConstraint();
