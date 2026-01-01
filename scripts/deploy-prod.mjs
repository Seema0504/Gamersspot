import dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load .env.prod to get production connection string
dotenv.config({ path: '.env.prod' });

const prodUrl = process.env.POSTGRES_URL;

if (!prodUrl) {
    console.error('❌ POSTGRES_URL is not defined in .env.prod. Cannot deploy to production database.');
    console.error('Please ensure .env.prod exists and contains your production credentials.');
    process.exit(1);
}

// Confirmation Prompt
console.log('⚠️  WARNING: You are about to deploy changes to the PRODUCTION database.');
console.log('This will:');
console.log('  1. Create pricing_rules table');
console.log('  2. Setup default pricing');
console.log('  3. Migrate stations from "PS5" to "Playstation"');
console.log('');
console.log('Waiting 5 seconds before starting... (Press Ctrl+C to cancel)');

await new Promise(resolve => setTimeout(resolve, 5000));

console.log('🚀 Starting deployment to PRODUCTION database...');

try {
    console.log('\n--- 1. Setting up Pricing Table ---');
    execSync('node scripts/setup-pricing-db.mjs', {
        env: { ...process.env, POSTGRES_URL: prodUrl },
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
        env: { ...process.env, POSTGRES_URL: prodUrl },
        stdio: 'inherit'
    });
    console.log('✅ Migration Complete.');
} catch (e) {
    console.error('❌ Failed to run migrate-ps5-to-playstation.mjs');
}

console.log('\n✨ Production database deployment finished.');
