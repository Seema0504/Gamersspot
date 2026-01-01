/**
 * API Health Check & Latency Monitor
 * 
 * This script periodically pings critical API endpoints to verify availability
 * and measure response times. This is useful for detecting "cold starts"
 * typical of serverless (Vercel) + free tier DB (Supabase) setups.
 * 
 * Usage: node automation/health_check.js [url] [interval_seconds]
 * Example: node automation/health_check.js https://gamersspot.vercel.app 60
 */

import fs from 'fs';
import path from 'path';

// Default configuration
const BASE_URL = process.argv[2] || 'https://gamersspot.vercel.app'; // Allow overriding URL
const INTERVAL_MS = (parseInt(process.argv[3]) || 30) * 1000; // Default 30 seconds
const LOG_FILE = path.join(process.cwd(), 'automation', 'health_log.txt');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

const ENDPOINTS = [
    { name: 'Health', path: '/api/time' },
    { name: 'Snacks', path: '/api/snacks?active=true' }
];

function log(message, type = 'INFO', error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message} ${error ? `| Error: ${error.message}` : ''}`;
    console.log(`${type === 'ERROR' ? colors.red : type === 'SUCCESS' ? colors.green : colors.reset}${logEntry}${colors.reset}`);
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
}

async function checkEndpoint(endpoint) {
    const url = `${BASE_URL}${endpoint.path}`;
    const start = Date.now();

    try {
        const response = await fetch(url);
        const duration = Date.now() - start;

        if (!response.ok) {
            throw new Error(`Status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        return { success: true, duration, size: JSON.stringify(data).length };
    } catch (error) {
        return { success: false, duration: Date.now() - start, error };
    }
}

async function runCheck() {
    console.log(`\n${colors.cyan}--- Starting Health Check against ${BASE_URL} ---${colors.reset}`);

    const results = [];

    for (const endpoint of ENDPOINTS) {
        const result = await checkEndpoint(endpoint);
        results.push({ ...endpoint, ...result });

        if (result.success) {
            const statusColor = result.duration > 1000 ? colors.yellow : colors.green;
            log(`${endpoint.name.padEnd(15)}: UP (${result.duration}ms)`, 'SUCCESS');
        } else {
            log(`${endpoint.name.padEnd(15)}: DOWN (${result.duration}ms) - ${result.error.message}`, 'ERROR');
        }
    }

    // Analyze cold starts
    const slowResponses = results.filter(r => r.success && r.duration > 1500);
    if (slowResponses.length > 0) {
        log(`Warning: Detected slow response(s). Possible serverless cold start.`, 'WARN');
    }
}

console.log(`Initializing Health Monitor...`);
console.log(`Target: ${BASE_URL}`);
console.log(`Interval: ${INTERVAL_MS / 1000} seconds`);
console.log(`Log File: ${LOG_FILE}\n`);

// Create log file if not exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

// Run immediately
runCheck();

// Then run on interval
setInterval(runCheck, INTERVAL_MS);
