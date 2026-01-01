import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.POSTGRES_URL
});

async function fixBonusConfigConstraint() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Add unique constraint on shop_id if it doesn't exist
        await client.query(`
            ALTER TABLE bonus_config 
            DROP CONSTRAINT IF EXISTS bonus_config_shop_id_key;
        `);

        await client.query(`
            ALTER TABLE bonus_config 
            ADD CONSTRAINT bonus_config_shop_id_key UNIQUE (shop_id);
        `);

        console.log('✅ Added unique constraint on bonus_config.shop_id');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

fixBonusConfigConstraint();
