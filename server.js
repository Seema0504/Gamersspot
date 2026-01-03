/**
 * Local development server for API routes
 * This allows testing API endpoints locally before deploying to Vercel
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Import API handlers
import stationsHandler from './api/stations.js';

import invoicesHandler from './api/invoices.js';
import reportsHandler from './api/reports.js';
import paidEventsHandler from './api/paid-events.js';
import customersHandler from './api/customers.js';
import timeHandler from './api/time.js';
import smsHandler from './api/sms.js';
import settingsHandler from './api/settings.js';
import authHandler from './api/auth.js';
import adminHandler from './api/admin.js';
import subscriptionsHandler from './api/subscriptions.js';

// Convert Vercel-style handlers to Express middleware
const adaptHandler = (handler) => {
  return async (req, res) => {
    // Convert Express req/res to Vercel-style
    const vercelReq = {
      method: req.method,
      body: req.body,
      query: { ...req.query, ...req.params },
      headers: req.headers,
    };

    let responseSent = false;

    const vercelRes = {
      status: (code) => ({
        json: (data) => {
          if (!responseSent) {
            res.status(code).json(data);
            responseSent = true;
          }
        },
        end: () => {
          if (!responseSent) {
            res.status(code).end();
            responseSent = true;
          }
        },
      }),
      setHeader: (name, value) => {
        res.setHeader(name, value);
      },
      json: (data) => {
        if (!responseSent) {
          res.json(data);
          responseSent = true;
        }
      },
      end: () => {
        if (!responseSent) {
          res.end();
          responseSent = true;
        }
      },
    };

    try {
      await handler(req, res); // We can pass express req/res directly as our handlers are compatible or check for vercel specific props if needed. 
      // Actually, my handlers use `req.query`, `req.body`, `res.status().json()`. Express supports these locally.
      // The only diff is Vercel functions might expect `request` object. But here we imported the handlers.

      // If handler didn't send a response (and wasn't async waiting), send default?
      // No, let's trust the handler sends response.
    } catch (error) {
      console.error('Handler error:', error);
      if (!responseSent) {
        res.status(500).json({
          error: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  };
};

// API Routes

app.all('/api/stations', adaptHandler(stationsHandler));
app.all('/api/stations/:id', adaptHandler(stationsHandler));
app.all('/api/invoices', adaptHandler(invoicesHandler));
app.all('/api/invoices/:invoiceNumber', adaptHandler(invoicesHandler));
app.all('/api/reports', adaptHandler(reportsHandler));
app.all('/api/paid-events', adaptHandler(paidEventsHandler));
app.all('/api/customers', adaptHandler(customersHandler));
app.all('/api/time', adaptHandler(timeHandler));
app.all('/api/sms/send', adaptHandler(smsHandler));

// Consolidated Routes
app.all('/api/settings', adaptHandler(settingsHandler));
app.all('/api/auth', adaptHandler(authHandler));
app.all('/api/admin', adaptHandler(adminHandler));
app.all('/api/subscriptions', adaptHandler(subscriptionsHandler));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Local API server is running' });
});

// Database connection test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const { getDbClient, closeDbClient } = await import('./api/_lib/db.js');
    const db = await getDbClient();
    const client = db.client;

    // Test query
    const result = await client.query('SELECT NOW() as current_time, COUNT(*) as station_count FROM stations');

    await closeDbClient(db);

    res.json({
      status: 'ok',
      message: 'Database connection successful',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
  }
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Local API server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`\nMake sure to set up your .env.local file with your local PostgreSQL connection string.`);
});

// Initialize WebSocket server for real-time multi-device sync
import { initWebSocketServer } from './websocket.js';
initWebSocketServer(server);
console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
console.log(`✨ Real-time multi-device sync enabled!`);

