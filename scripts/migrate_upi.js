import 'dotenv/config';
import { getDbClient, closeDbClient } from '../api/_lib/db.js';

async function migrate() {
    console.log('Starting migration: Add upi_id to shops table...');
    let db = null;
    try {
        db = await getDbClient();
        await db.client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='upi_id') THEN 
                    ALTER TABLE shops ADD COLUMN upi_id VARCHAR(255); 
                    RAISE NOTICE 'Added upi_id column';
                    RAISE NOTICE 'Added upi_id column successfully';
                ELSE 
                    RAISE NOTICE 'upi_id column already exists';
                END IF; 
            END $$;
        `);
        console.log('Migration command executed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (db) await closeDbClient(db);
    }
}

migrate();
