const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const { decodeHashlink } = require('./lib/hashlink');

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
async function syncLiveAresNodes() {
    try {
        console.log("[ARES NODE TRACKER] Fetching live bootstrap node list from ares.chat...");
        
        // Fetch the raw live server list data stream as a binary buffer
        const response = await axios.get('https://ares.chat', {
            responseType: 'arraybuffer'
        });
        
        const buffer = Buffer.from(response.data);
        const updatedNodes = [];
        
        // Ares Galaxy network servers store data in fixed 6-byte chunks:
        // - First 4 Bytes: The IPv4 Address octets (e.g., 192.168.1.1)
        // - Next 2 Bytes: The Port Number (saved as a Big Endian Unsigned 16-bit Integer)
        for (let i = 0; i < buffer.length; i += 6) {
            if (i + 6 > buffer.length) break; // Safety overflow protection
            
            const ip = `${buffer[i]}.${buffer[i+1]}.${buffer[i+2]}.${buffer[i+3]}`;
            const port = buffer.readUInt16BE(i + 4);
            
            updatedNodes.push({ ip, port });
        }
        
        console.log(`[ARES NODE TRACKER] Successfully synced ${updatedNodes.length} active connection targets.`);
        return updatedNodes;
        
    } catch (error) {
        console.error("[ARES NODE TRACKER] Critical error pulling node list:", error.message);
        return []; // Return empty array on failure to prevent app crashes
    }
}

/**
 * 2. WEBSOCKET REAL-TIME CLIENT CONNECTIONS
 * Handles browser users connecting to your web client platform.
 */
io.on('connection', (socket) => {
    console.log(`[CLIENT CONNECTED] User attached to webchat backend (ID: ${socket.id})`);

    // When a browser requests fresh, verified network entry nodes
    socket.on('request_nodes', async () => {
        const freshNodes = await syncLiveAresNodes();
        // Send clean data directly back to the HTML client interface
        socket.emit('node_list_update', freshNodes);
    });

    socket.on('join_hashlink', (payload) => {
        const room = decodeHashlink(payload && payload.hashlink);
        if (!room) {
            socket.emit('join_hashlink_result', { ok: false, error: 'Invalid hashlink' });
            return;
        }
        socket.emit('join_hashlink_result', { ok: true, room: { name: room.name, ip: room.ip, port: room.port } });
    });

    socket.on('disconnect', () => {
        console.log(`[CLIENT DISCONNECTED] User detached (ID: ${socket.id})`);
    });
});

/**
 * 3. ENGINE INITIALISATION
 */
if (require.main === module) {
server.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(` Ares Web Client Backend Engine Active!`);
        console.log(` Server running locally at: http://localhost:${PORT}`);
        console.log(`==================================================`);
        
        // Test the tracker pull immediately on server boot
        syncLiveAresNodes();
    });
}

module.exports = { app, server };
