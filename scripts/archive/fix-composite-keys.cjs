const { Client } = require('pg');
const { resolve } = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const SQL = `
BEGIN;

-- 1. Fix Stations PK (Composite: shop_id + id)
-- -------------------------------------------------------------
ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_pkey;
-- Ensure id is just integer now (not serial/unique globally across shops)
-- Actually, if it was SERIAL, it shares a sequence. We want it to be user-provided per shop.
-- We'll keep it as integer.
ALTER TABLE stations ADD PRIMARY KEY (shop_id, id);


-- 2. Fix Snacks PK (Composite: shop_id + id)
-- -------------------------------------------------------------
ALTER TABLE snacks DROP CONSTRAINT IF EXISTS snacks_pkey;
ALTER TABLE snacks ADD PRIMARY KEY (shop_id, id);

-- 3. Fix Snacks Name Uniqueness (scoped to shop)
-- -------------------------------------------------------------
ALTER TABLE snacks DROP CONSTRAINT IF EXISTS snacks_name_key; -- Drops global unique name
ALTER TABLE snacks ADD CONSTRAINT snacks_name_shop_unique UNIQUE (shop_id, name);

COMMIT;
`;

const client = new Client({ connectionString: process.env.POSTGRES_URL });

async function fixKeys() {
    try {
        console.log('🔧 Fixing Composite Keys...');
        await client.connect();
        await client.query(SQL);
        console.log('✅ Keys Updated for Multi-Tenancy');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await client.end();
    }
}

fixKeys();
