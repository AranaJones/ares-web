const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('./lib/index-adapters');
const { createRoomCache } = require('./lib/roomCache');
const { createRoomsRouter } = require('./lib/roomsRouter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // Allows your frontend browser to connect safely
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files (HTML/JS) from a folder named 'public'
app.use(express.static('public'));

const roomCache = createRoomCache(createAdapter(), {
    ttlMs: Number(process.env.ROOM_CACHE_TTL_MS) || 60000
});

app.use('/api/rooms', createRoomsRouter(roomCache));

/**
 * 2. WEBSOCKET REAL-TIME CLIENT CONNECTIONS
 * Handles browser users connecting to your web client platform.
 */
io.on('connection', (socket) => {
    console.log(`[CLIENT CONNECTED] User attached to webchat backend (ID: ${socket.id})`);

    // When a browser requests fresh, verified network entry nodes
    socket.on('request_nodes', async () => {
        await roomCache.refresh();
        const nodes = roomCache.getSnapshot().rooms.map(({ ip, port }) => ({ ip, port }));
        socket.emit('node_list_update', nodes);
    });

    // Answer the room list from the same cache as GET /api/rooms
    socket.on('get_live_channels', () => {
        socket.emit('live_channels_data', roomCache.getSnapshot().rooms);
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

    roomCache.start();
});
}

module.exports = { app, server, roomCache };
