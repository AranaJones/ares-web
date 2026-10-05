const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allows your frontend browser to connect safely
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files (HTML/JS) from a folder named 'public'
app.use(express.static('public'));

/**
 * 1. NODE PARSER ENGINE
 * Automatically downloads and unpacks live binary nodes from the active network tracker.
 */
let cachedNodes = [];
let cachedAt = null;

async function syncLiveAresNodes() {
    try {
        console.log("[ARES NODE TRACKER] Fetching live bootstrap node list from ares.chat...");

        const response = await axios.get('https://ares.chat', {
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5
        });

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType.includes('text/html') || contentType.includes('json')) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }

        const buffer = Buffer.from(response.data);
        if (buffer.length < 6) {
            throw new Error('Empty or truncated response from tracker');
        }
        const updatedNodes = [];

        // Fixed 6-byte records: 4 bytes IPv4 + 2 bytes big-endian port
        for (let i = 0; i + 6 <= buffer.length; i += 6) {
            const ip = `${buffer[i]}.${buffer[i+1]}.${buffer[i+2]}.${buffer[i+3]}`;
            const port = buffer.readUInt16BE(i + 4);
            updatedNodes.push({ ip, port });
        }

        cachedNodes = updatedNodes;
        cachedAt = Date.now();
        console.log(`[ARES NODE TRACKER] Successfully synced ${updatedNodes.length} active connection targets.`);
        return { nodes: updatedNodes, cached: false, error: null };

    } catch (error) {
        console.error("[ARES NODE TRACKER] Critical error pulling node list:", error.message);
        return { nodes: cachedNodes, cached: cachedNodes.length > 0, cachedAt, error: error.message };
    }
}

/**
 * 2. WEBSOCKET REAL-TIME CLIENT CONNECTIONS
 * Handles browser users connecting to your web client platform.
 */
io.on('connection', (socket) => {
    console.log(`[CLIENT CONNECTED] User attached to webchat backend (ID: ${socket.id})`);

    // When a browser requests fresh, verified network entry nodes
    const handleRoomRequest = async () => {
        const result = await syncLiveAresNodes();
        const rooms = result.nodes.map(n => ({
            name: `${n.ip}:${n.port}`,
            users: '?',
            ip: n.ip,
            port: n.port
        }));
        socket.emit('live_channels_data', {
            rooms,
            cached: result.cached,
            cachedAt: result.cachedAt || null,
            error: result.error
        });
    };
    socket.on('get_live_channels', handleRoomRequest);
    socket.on('request_nodes', handleRoomRequest);

    socket.on('disconnect', () => {
        console.log(`[CLIENT DISCONNECTED] User detached (ID: ${socket.id})`);
    });
});

/**
 * 3. ENGINE INITIALISATION
 */
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Ares Web Client Backend Engine Active!`);
    console.log(` Server running locally at: http://localhost:${PORT}`);
    console.log(`==================================================`);
    
    // Test the tracker pull immediately on server boot
    syncLiveAresNodes();
});
