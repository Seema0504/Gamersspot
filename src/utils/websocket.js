/**
 * WebSocket Client for Real-Time Multi-Device Synchronization
 * Replaces 3-second polling with instant push notifications
 */

let ws = null
let reconnectTimeout = null
let messageHandlers = []
const RECONNECT_DELAY = 3000 // 3 seconds

/**
 * Check if WebSocket is available (not in serverless/Vercel environment)
 */
const isWebSocketAvailable = () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        return false
    }

    // Check if we're on Vercel (serverless environment doesn't support WebSockets)
    const hostname = window.location.hostname
    if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
        return false
    }

    // Only allow WebSocket on localhost for development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true
    }

    // For other environments, disable WebSocket (can be enabled later if needed)
    return false
}

/**
 * Connect to WebSocket server
 */
export const connectWebSocket = (onMessage) => {
    // Add message handler
    if (onMessage && !messageHandlers.includes(onMessage)) {
        messageHandlers.push(onMessage)
    }

    // Check if WebSocket is available (skip in serverless/Vercel environments)
    if (!isWebSocketAvailable()) {
        console.log('[WebSocket] WebSocket not available in serverless environment, using polling fallback')
        return null
    }

    // Don't create multiple connections
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        // Removed verbose log - already connected
        return ws
    }

    // Connect to API server on port 3001, not the Vite dev server port
    const apiPort = import.meta.env.VITE_API_PORT || '3002'
    const wsUrl = `ws://localhost:${apiPort}`
    // Removed verbose connection log - only log on success

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
        // Clear any reconnect timeout
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout)
            reconnectTimeout = null
        }
    }

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data)

            // Handle ping/pong
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
                return
            }

            // Handle connected message
            if (data.type === 'connected') {
                // Removed verbose connected message log
                return
            }

            // Notify all message handlers
            messageHandlers.forEach(handler => {
                try {
                    handler(data)
                } catch (error) {
                    console.error('[WebSocket] Error in message handler:', error)
                }
            })
        } catch (error) {
            console.error('[WebSocket] Error parsing message:', error)
        }
    }

    ws.onerror = (error) => {
        // Only log WebSocket errors once to reduce spam
        // Errors are expected during initial connection attempts
        // console.error('[WebSocket] Error:', error) // Removed to reduce log spam
    }

    ws.onclose = () => {
        // Removed verbose disconnect log - only reconnect silently
        ws = null

        // Attempt to reconnect after delay (only if WebSocket is available)
        if (!reconnectTimeout && isWebSocketAvailable()) {
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null
                connectWebSocket()
            }, RECONNECT_DELAY)
        }
    }

    return ws
}

/**
 * Disconnect from WebSocket server
 */
export const disconnectWebSocket = () => {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
    }

    if (ws) {
        ws.close()
        ws = null
    }

    messageHandlers = []
    // Removed verbose disconnect log
}

/**
 * Send message to WebSocket server
 */
export const sendWebSocketMessage = (data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
        return true
    } else {
        console.warn('[WebSocket] Not connected, cannot send message')
        return false
    }
}

/**
 * Check if WebSocket is connected
 */
export const isWebSocketConnected = () => {
    return ws && ws.readyState === WebSocket.OPEN
}

/**
 * Remove message handler
 */
export const removeMessageHandler = (handler) => {
    const index = messageHandlers.indexOf(handler)
    if (index > -1) {
        messageHandlers.splice(index, 1)
    }
}
