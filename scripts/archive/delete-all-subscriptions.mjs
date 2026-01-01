import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.POSTGRES_URL
});

async function deleteAllSubscriptions() {
    try {
        await client.connect();
        console.log('Connected to database');

        // First, show what will be deleted
        const subscriptionsToDelete = await client.query(`
            SELECT id, shop_id, plan_name, status, end_date 
            FROM subscriptions 
            ORDER BY shop_id, created_at
        `);

        console.log('\n📋 Subscriptions to be deleted:');
        console.table(subscriptionsToDelete.rows);

        if (subscriptionsToDelete.rows.length === 0) {
            console.log('\n✅ No subscriptions to delete.');
            return;
        }

        console.log(`\n⚠️  About to delete ${subscriptionsToDelete.rows.length} subscription(s)...`);

        // Delete all subscriptions
        const result = await client.query(`
            DELETE FROM subscriptions 
            RETURNING id, shop_id, plan_name
        `);

        console.log(`\n✅ Successfully deleted ${result.rowCount} subscription(s)`);

        // Verify deletion
        const remaining = await client.query(`SELECT COUNT(*) FROM subscriptions`);
        console.log(`\n📊 Remaining subscriptions: ${remaining.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

deleteAllSubscriptions();
