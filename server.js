const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allows your frontend browser to connect safely
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files (HTML/JS) from a folder named 'public'
app.use(express.static(path.join(__dirname, 'public')));

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
    socket.on('get_live_channels', async () => {
        const freshNodes = await syncLiveAresNodes();
        const rooms = freshNodes.map(({ ip, port }) => ({
            name: `${ip}:${port}`,
            users: 0,
            ip,
            port
        }));
        // Send clean data directly back to the HTML client interface
        socket.emit('live_channels_data', rooms);
    });

    socket.on('join_room', (room) => {
        if (typeof room !== 'string') return;
        if (socket.data.room) socket.leave(socket.data.room);
        socket.data.room = room;
        socket.join(room);
    });

    socket.on('chat_message', (msg) => {
        if (!socket.data.room || !msg || typeof msg.text !== 'string') return;
        io.to(socket.data.room).emit('chat_message', {
            username: String(msg.username || 'Anonymous').slice(0, 32),
            text: msg.text.slice(0, 500)
        });
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

module.exports = { app, server, io, syncLiveAresNodes };
