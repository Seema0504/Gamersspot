import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.POSTGRES_URL
});

async function deleteShopOwners() {
    try {
        await client.connect();
        console.log('Connected to database');

        // First, show what will be deleted
        const usersToDelete = await client.query(`
            SELECT id, username, role, shop_id 
            FROM admin_users 
            WHERE role != 'SUPER_ADMIN'
        `);

        console.log('\n📋 Users to be deleted:');
        console.table(usersToDelete.rows);

        if (usersToDelete.rows.length === 0) {
            console.log('\n✅ No shop owners to delete.');
            return;
        }

        // Delete all users except SUPER_ADMIN
        const result = await client.query(`
            DELETE FROM admin_users 
            WHERE role != 'SUPER_ADMIN'
            RETURNING id, username, role
        `);

        console.log(`\n✅ Deleted ${result.rowCount} shop owner(s)`);
        console.log('\n🔒 Super Admin accounts preserved:');

        const remainingUsers = await client.query(`
            SELECT id, username, role 
            FROM admin_users 
            WHERE role = 'SUPER_ADMIN'
        `);
        console.table(remainingUsers.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

deleteShopOwners();
