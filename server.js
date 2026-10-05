const dns = require('node:dns').promises;
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { WebSocket, WebSocketServer } = require('ws');
const { encodeLogin, encodePacket, FrameDecoder, PacketReader } = require('./server/protocol');

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_HOST = process.env.ARES_HOST || '';
const DEFAULT_ARES_PORT = Number(process.env.ARES_PORT || 6566);
const ALLOWED_HOSTS = process.env.ARES_ALLOWED_HOSTS
    ? new Set(process.env.ARES_ALLOWED_HOSTS.split(',').map(host => normalizeHost(host.trim())))
    : null;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_MESSAGE_BYTES = 500;

function normalizeHost(host) {
    return host.toLowerCase().replace(/\.$/, '');
}

function isPublicIPv4(address) {
    if (net.isIP(address) !== 4) return false;
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    return !(
        a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || (b === 168) || (b === 88 && c === 99))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113)
    );
}

async function resolveTarget(hostValue, portValue) {
    const host = typeof hostValue === 'string' ? normalizeHost(hostValue.trim()) : '';
    const port = Number(portValue);
    if (!host || host.length > 253 || /[\s/?#@]/.test(host) || (!net.isIP(host) && !/^[a-z\d.-]+$/i.test(host))) {
        throw new Error('Enter a valid public Ares server host.');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Port must be a number from 1 to 65535.');
    }
    if (ALLOWED_HOSTS && !ALLOWED_HOSTS.has(host)) {
        throw new Error('That Ares host is not in the server allow-list.');
    }

    const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true, verbatim: true });
    const ipv4 = addresses.filter(item => item.family === 4);
    if (!ipv4.length || (!ALLOWED_HOSTS && ipv4.some(item => !isPublicIPv4(item.address)))) {
        throw new Error('Ares hosts must resolve only to public IPv4 addresses (or be explicitly allow-listed).');
    }
    return { address: ipv4[0].address, port };
}

function sendJSON(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function readNulString(reader) {
    return reader.readString();
}

function readUser(payload) {
    const reader = new PacketReader(payload);
    if (reader.remaining < 16) return null;
    const files = reader.readUInt16();
    reader.skip(4);
    const externalIP = reader.readIP();
    const port = reader.readUInt16();
    reader.skip(4);
    reader.readUInt16();
    reader.skip(1);
    const nickname = readNulString(reader);
    if (reader.remaining < 11) return null;
    const localIP = reader.readIP();
    const hasFiles = reader.readByte() === 1 && files > 0;
    const level = reader.readByte();
    const age = reader.readByte();
    const gender = reader.readByte();
    const country = reader.readByte();
    const region = readNulString(reader);
    const features = reader.remaining ? reader.readByte() : 0;
    if (!nickname) return null;
    return { nickname, externalIP, port, localIP, hasFiles, level, age, gender, country, region, features };
}

function startTcpSession(ws, session, target, nickname) {
    const tcp = net.createConnection(target);
    session.tcp = tcp;
    session.decoder = new FrameDecoder();
    session.users = new Map();
    tcp.setKeepAlive(true, 60000);

    tcp.on('connect', () => {
        tcp.write(encodeLogin(nickname));
        sendJSON(ws, { type: 'status', status: 'logging-in', message: `Connected to ${target.address}:${target.port}; waiting for room login.` });
    });

    tcp.on('data', chunk => {
        try {
            for (const { type, payload } of session.decoder.push(chunk)) {
                const reader = new PacketReader(payload);
                switch (type) {
                    case 0:
                        sendJSON(ws, { type: 'error', message: readNulString(reader) || 'Ares server rejected the connection.' });
                        break;
                    case 3: {
                        const assignedNick = readNulString(reader);
                        const roomName = reader.remaining ? readNulString(reader) : '';
                        sendJSON(ws, { type: 'connected', nickname: assignedNick || nickname, roomName });
                        break;
                    }
                    case 5: {
                        const name = readNulString(reader);
                        if (reader.remaining >= 14) {
                            reader.skip(13);
                            const user = session.users.get(name);
                            if (user) user.level = reader.readByte();
                        }
                        if (session.users.has(name)) sendJSON(ws, { type: 'users', users: [...session.users.values()] });
                        break;
                    }
                    case 8:
                    case 14:
                        tcp.write(encodePacket(type, payload));
                        break;
                    case 10:
                    case 11: {
                        const sender = readNulString(reader);
                        const text = reader.readString();
                        sendJSON(ws, { type: 'message', kind: type === 11 ? 'emote' : 'public', sender, text });
                        break;
                    }
                    case 20:
                    case 30: {
                        const user = readUser(payload);
                        if (user) {
                            session.users.set(user.nickname, user);
                            sendJSON(ws, { type: type === 20 ? 'join' : 'user', user });
                        }
                        break;
                    }
                    case 22: {
                        const name = readNulString(reader);
                        session.users.delete(name);
                        sendJSON(ws, { type: 'part', nickname: name });
                        break;
                    }
                    case 31:
                    case 32:
                        sendJSON(ws, { type: 'topic', topic: readNulString(reader) });
                        break;
                    case 35:
                        sendJSON(ws, { type: 'users', users: [...session.users.values()] });
                        break;
                    case 92:
                        sendJSON(ws, { type: 'server', version: readNulString(reader) });
                        break;
                    default:
                        break;
                }
            }
        } catch (error) {
            sendJSON(ws, { type: 'error', message: `Invalid Ares packet: ${error.message}` });
            tcp.destroy();
        }
    });

    tcp.on('error', error => {
        sendJSON(ws, { type: 'error', message: `Ares connection failed: ${error.message}` });
    });
    tcp.on('close', () => {
        if (session.tcp === tcp) session.tcp = null;
        sendJSON(ws, { type: 'status', status: 'disconnected', message: 'Disconnected from Ares.' });
    });
}

function serveStatic(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const files = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
        '/styles.css': ['styles.css', 'text/css; charset=utf-8']
    };
    if (pathname === '/config.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ host: DEFAULT_HOST, port: DEFAULT_ARES_PORT }));
        return;
    }
    const entry = files[pathname];
    if (!entry || req.method !== 'GET') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    res.writeHead(200, { 'Content-Type': entry[1], 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(PUBLIC_DIR, entry[0])).pipe(res);
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({
    server,
    maxPayload: 4096,
    verifyClient: ({ origin, req }, done) => {
        if (!origin) return done(true);
        try {
            done(new URL(origin).host.toLowerCase() === req.headers.host?.toLowerCase());
        } catch {
            done(false, 403, 'Invalid origin');
        }
    }
});

wss.on('connection', ws => {
    const session = { tcp: null, decoder: null, users: new Map(), messageTimes: [] };
    let connecting = false;
    ws.on('message', async raw => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            sendJSON(ws, { type: 'error', message: 'Invalid WebSocket JSON.' });
            return;
        }
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            sendJSON(ws, { type: 'error', message: 'WebSocket messages must be JSON objects.' });
            return;
        }

        if (message.type === 'connect') {
            if (connecting || session.tcp) {
                sendJSON(ws, { type: 'error', message: 'Disconnect before connecting to another room.' });
                return;
            }
            const host = message.host || DEFAULT_HOST;
            const port = message.port || DEFAULT_ARES_PORT;
            const nickname = typeof message.nickname === 'string' ? message.nickname.trim() : '';
            if (!nickname || Buffer.byteLength(nickname, 'utf8') > 30 || /[\u0000-\u001f\u007f]/.test(nickname)) {
                sendJSON(ws, { type: 'error', message: 'Nickname must be 1–30 UTF-8 bytes and contain no control characters.' });
                return;
            }
            connecting = true;
            sendJSON(ws, { type: 'status', status: 'connecting', message: `Looking up ${host}…` });
            try {
                const target = await resolveTarget(host, port);
                if (ws.readyState !== WebSocket.OPEN) return;
                startTcpSession(ws, session, target, nickname);
            } catch (error) {
                sendJSON(ws, { type: 'error', message: error.message });
            } finally {
                connecting = false;
            }
            return;
        }

        if (message.type === 'disconnect') {
            if (session.tcp) session.tcp.destroy();
            return;
        }
        if ((message.type === 'message' || message.type === 'emote') && session.tcp && !session.tcp.destroyed) {
            const text = typeof message.text === 'string' ? message.text.trim() : '';
            const now = Date.now();
            session.messageTimes = session.messageTimes.filter(time => now - time < 5000);
            if (session.messageTimes.length >= 5) {
                sendJSON(ws, { type: 'error', message: 'Slow down: limit is 5 messages every 5 seconds.' });
                return;
            }
            if (!text || Buffer.byteLength(text, 'utf8') > MAX_MESSAGE_BYTES || /[\u0000]/.test(text)) {
                sendJSON(ws, { type: 'error', message: `Messages must be 1–${MAX_MESSAGE_BYTES} UTF-8 bytes.` });
                return;
            }
            session.messageTimes.push(now);
            session.tcp.write(encodePacket(message.type === 'emote' ? 11 : 10, Buffer.from(text, 'utf8')));
        }
    });

    ws.on('close', () => {
        if (session.tcp) session.tcp.destroy();
    });
    ws.on('error', () => {
        if (session.tcp) session.tcp.destroy();
    });
});

const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
        if (ws.isAlive === false) {
            ws.terminate();
            continue;
        }
        if (ws.readyState !== WebSocket.OPEN) continue;
        ws.isAlive = false;
        ws.ping();
    }
}, 30000);
wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
});

server.listen(PORT, () => {
    console.log(`Ares Web listening on port ${PORT}`);
});

function shutdown() {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { isPublicIPv4, resolveTarget };
