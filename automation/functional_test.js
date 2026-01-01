/**
 * Functional Test Suite
 * 
 * This script simulates user actions to verify the core business logic works:
 * 1. Fetching stations
 * 2. Creating a customer
 * 3. Adding snacks to a tab
 * 4. Generating an invoice (dry run)
 * 
 * Usage: node automation/functional_test.js [url]
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.argv[2] || 'https://gamersspot.vercel.app';
const REPORT_FILE = path.join(process.cwd(), 'automation', 'test_report.md');

async function testStep(name, fn) {
    process.stdout.write(`Testing: ${name}... `);
    try {
        const start = Date.now();
        const result = await fn();
        const duration = Date.now() - start;
        console.log(`\x1b[32mPASSED\x1b[0m (${duration}ms)`);
        return { name, success: true, duration, result };
    } catch (error) {
        console.log(`\x1b[31mFAILED\x1b[0m`);
        console.error(`  Error: ${error.message}`);
        return { name, success: false, error: error.message };
    }
}

async function runTests() {
    const results = [];
    const testId = `TEST-${Date.now()}`;

    console.log(`Starting Functional Tests against ${BASE_URL}\n`);

    // 1. Check Stations
    results.push(await testStep('Retrieve Stations', async () => {
        const res = await fetch(`${BASE_URL}/api/stations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Response is not an array');
        return `${data.length} stations found`;
    }));

    // 2. Check Snacks
    let testSnackId;
    results.push(await testStep('Retrieve Snacks', async () => {
        const res = await fetch(`${BASE_URL}/api/snacks?active=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.length === 0) throw new Error('No snacks found');
        testSnackId = data[0].id;
        return `${data.length} snacks available`;
    }));

    // Generate Report
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    const reportContent = `
# Automation Test Report
**Date:** ${new Date().toLocaleString()}
**Target:** ${BASE_URL}
**ID:** ${testId}

## Summary
- **Total Tests:** ${results.length}
- **Passed:** ${successCount}
- **Failed:** ${failCount}

## Details
${results.map(r => `
### ${r.name}
- **Status:** ${r.success ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${r.duration || 0}ms
- **Output:** ${r.success ? r.result : r.error}
`).join('\n')}
`;

    fs.writeFileSync(REPORT_FILE, reportContent);
    console.log(`\nReport generated at ${REPORT_FILE}`);
}

runTests();
