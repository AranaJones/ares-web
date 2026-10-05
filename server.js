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
app.use(express.json({ limit: '1mb' }));

// Ares Galaxy (OpenAI-compatible) chat configuration
const ARES_GALAXY_BASE_URL = (process.env.ARES_GALAXY_BASE_URL || 'https://api.aresgalaxy.ai').replace(/\/+$/, '');
const ARES_GALAXY_CHAT_PATH = process.env.ARES_GALAXY_CHAT_PATH || '/v1/chat/completions';
const ARES_GALAXY_MODEL = process.env.ARES_GALAXY_MODEL || 'ares-galaxy-default';
const ARES_GALAXY_API_KEY = process.env.ARES_GALAXY_API_KEY || '';
const ARES_GALAXY_TEMPERATURE = parseFloat(process.env.ARES_GALAXY_TEMPERATURE || '0.7');

// Server-side proxy keeps the API key out of the browser and avoids CORS issues
app.post('/api/chat', async (req, res) => {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: { message: 'messages array is required' } });
    }
    const headers = { 'Content-Type': 'application/json' };
    if (ARES_GALAXY_API_KEY) headers.Authorization = 'Bearer ' + ARES_GALAXY_API_KEY;
    try {
        const upstream = await axios.post(ARES_GALAXY_BASE_URL + ARES_GALAXY_CHAT_PATH, {
            model: ARES_GALAXY_MODEL,
            messages,
            temperature: Number.isFinite(ARES_GALAXY_TEMPERATURE) ? ARES_GALAXY_TEMPERATURE : 0.7
        }, { headers, timeout: 60000 });
        res.json(upstream.data);
    } catch (error) {
        const status = error.response ? error.response.status : 502;
        const upstreamErr = error.response && error.response.data && error.response.data.error;
        const detail = (upstreamErr && (upstreamErr.message || upstreamErr)) || error.message;
        console.error('[ARES GALAXY] Chat request failed:', detail);
        res.status(status).json({ error: { message: String(detail) } });
    }
});

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
