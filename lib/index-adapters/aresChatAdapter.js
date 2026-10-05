/**
 * Ares index adapter wrapping the original https://ares.chat fetch/parse logic.
 *
 * UNVERIFIED: the real Ares index protocol and room-list format are NOT
 * confirmed. The 6-byte chunk layout below (4-byte IPv4 + 2-byte big-endian
 * port) is carried over from the earlier guess in server.js and may be wrong.
 * It yields only ip/port endpoints, so room names/user counts are placeholders.
 * Replace this adapter once the real protocol is known.
 */
const http = require('http');
const https = require('https');

const DEFAULT_URL = 'https://ares.chat';

function fetchBuffer(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('http:') ? http : https;
        const req = client.get(url, { timeout: timeoutMs }, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                reject(new Error(`Index responded with HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Index request timed out')));
        req.on('error', reject);
    });
}

// UNVERIFIED parsing of 6-byte chunks into room-shaped entries.
function parseNodeBuffer(buffer) {
    const rooms = [];
    for (let i = 0; i + 6 <= buffer.length; i += 6) {
        const ip = `${buffer[i]}.${buffer[i + 1]}.${buffer[i + 2]}.${buffer[i + 3]}`;
        const port = buffer.readUInt16BE(i + 4);
        rooms.push({ name: `${ip}:${port}`, users: 0, ip, port });
    }
    return rooms;
}

function createAresChatAdapter(options = {}) {
    let url = options.url;
    if (!url && options.host) {
        url = `https://${options.host}${options.port ? ':' + options.port : ''}`;
    }
    url = url || DEFAULT_URL;
    const timeoutMs = options.timeoutMs || 10000;
    return {
        name: 'aresChat',
        async fetchRooms() {
            return parseNodeBuffer(await fetchBuffer(url, timeoutMs));
        }
    };
}

module.exports = { createAresChatAdapter, parseNodeBuffer };
