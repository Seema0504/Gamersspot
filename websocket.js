/**
 * WebSocket Server for Real-Time Multi-Device Synchronization
 * Provides instant push notifications to replace polling
 */

import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Set();

/**
 * Initialize WebSocket server
 */
export const initWebSocketServer = (httpServer) => {
    wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws) => {
        console.log('🔌 New WebSocket client connected');
        clients.add(ws);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to Gamers Spot WebSocket server',
            timestamp: new Date().toISOString()
        }));

        // Handle messages from client
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                // Handle pong responses
                if (data.type === 'pong') {
                    // Client is alive
                    return;
                }

                // Echo other messages to all clients (for multi-device sync)
                broadcast(data, ws);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        // Handle client disconnect
        ws.on('close', () => {
            console.log('🔌 WebSocket client disconnected');
            clients.delete(ws);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            clients.delete(ws);
        });

        // Send periodic ping to keep connection alive
        const pingInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
            } else {
                clearInterval(pingInterval);
            }
        }, 30000); // Every 30 seconds
    });

    return wss;
};

/**
 * Broadcast message to all connected clients
 */
export const broadcast = (data, excludeClient = null) => {
    const message = JSON.stringify(data);

    clients.forEach((client) => {
        // Don't send back to the sender
        if (client !== excludeClient && client.readyState === client.OPEN) {
            client.send(message);
        }
    });
};

/**
 * Broadcast station update to all clients
 */
export const broadcastStationUpdate = (stationData) => {
    broadcast({
        type: 'station_update',
        data: stationData,
        timestamp: new Date().toISOString()
    });
};

/**
 * Broadcast timer update to all clients
 */
export const broadcastTimerUpdate = (timerId, timerData) => {
    broadcast({
        type: 'timer_update',
        timerId,
        data: timerData,
        timestamp: new Date().toISOString()
    });
};

/**
 * Get number of connected clients
 */
export const getConnectedClientsCount = () => {
    return clients.size;
};
