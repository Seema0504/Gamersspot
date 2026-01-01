import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.test' }); // Load .env.test on top of .env.local

const testUrl = process.env.TEST_POSTGRES_URL;

if (!testUrl) {
    console.error('❌ TEST_POSTGRES_URL is not defined in .env.local. Cannot deploy to test database.');
    process.exit(1);
}

console.log('🚀 Starting deployment to TEST database...');

try {
    console.log('\n--- 1. Setting up Pricing Table ---');
    execSync('node scripts/setup-pricing-db.mjs', {
        env: { ...process.env, POSTGRES_URL: testUrl },
        stdio: 'inherit'
    });
    console.log('✅ Pricing Table Setup Complete.');
} catch (e) {
    console.error('❌ Failed to run setup-pricing-db.mjs');
    // Don't exit, try next script
}

try {
    console.log('\n--- 2. Migrating PS5 to Playstation ---');
    execSync('node scripts/migrate-ps5-to-playstation.mjs', {
        env: { ...process.env, POSTGRES_URL: testUrl },
        stdio: 'inherit'
    });
    console.log('✅ Migration Complete.');
} catch (e) {
    console.error('❌ Failed to run migrate-ps5-to-playstation.mjs');
}

console.log('\n✨ Test database deployment finished.');
