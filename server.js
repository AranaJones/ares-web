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
let lastError = null;
let inflight = null;

const TRACKER_URL = process.env.TRACKER_URL || 'https://ares.chat';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 60000;
const TRACKER_TIMEOUT_MS = Number(process.env.TRACKER_TIMEOUT_MS) || 20000;
const TRACKER_RETRIES = 2;

function describeError(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return `Tracker timed out after ${TRACKER_TIMEOUT_MS}ms`;
    }
    if (error.response) return `Tracker returned HTTP ${error.response.status}`;
    if (error.code) return `${error.message} (${error.code})`;
    return error.message;
}

// Fixed 6-byte records: 4 bytes IPv4 + 2 bytes big-endian port
function parseNodes(data) {
    const buffer = Buffer.from(data || []);
    if (buffer.length < 6) {
        throw new Error('Empty or truncated response from tracker');
    }
    const nodes = [];
    for (let i = 0; i + 6 <= buffer.length; i += 6) {
        nodes.push({
            ip: `${buffer[i]}.${buffer[i+1]}.${buffer[i+2]}.${buffer[i+3]}`,
            port: buffer.readUInt16BE(i + 4)
        });
    }
    return nodes;
}

async function fetchTrackerOnce() {
    const response = await axios.get(TRACKER_URL, {
        responseType: 'arraybuffer',
        timeout: TRACKER_TIMEOUT_MS,
        maxRedirects: 5
    });
    const contentType = String((response.headers || {})['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('json')) {
        throw new Error(`Unexpected content type: ${contentType}`);
    }
    return parseNodes(response.data);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTrackerWithRetry() {
    let lastErr;
    for (let attempt = 1; attempt <= TRACKER_RETRIES + 1; attempt++) {
        try {
            return await fetchTrackerOnce();
        } catch (error) {
            lastErr = new Error(describeError(error));
            console.error(`[ARES NODE TRACKER] Attempt ${attempt}/${TRACKER_RETRIES + 1} failed: ${lastErr.message}`);
            if (attempt <= TRACKER_RETRIES) await sleep(1000 * attempt);
        }
    }
    throw lastErr;
}

function currentResult(cached) {
    return { nodes: cachedNodes, cached: cached && cachedNodes.length > 0, cachedAt, error: lastError };
}

async function syncLiveAresNodes({ force = false } = {}) {
    if (!force && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) {
        return currentResult(true);
    }
    if (!inflight) {
        console.log(`[ARES NODE TRACKER] Fetching live bootstrap node list from ${TRACKER_URL}...`);
        inflight = fetchTrackerWithRetry()
            .then(nodes => {
                cachedNodes = nodes;
                cachedAt = Date.now();
                lastError = null;
                console.log(`[ARES NODE TRACKER] Successfully synced ${nodes.length} active connection targets.`);
            })
            .catch(error => {
                lastError = error.message;
                console.error("[ARES NODE TRACKER] Critical error pulling node list:", error.message);
            })
            .finally(() => { inflight = null; });
    }
    if (!force && cachedNodes.length) {
        return currentResult(true);
    }
    await inflight;
    return lastError ? currentResult(true) : currentResult(false);
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
