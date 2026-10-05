'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { RoomCache, createRoomsRouter } = require('../src/rooms');
const { MockAdapter } = require('../src/rooms/mockAdapter');

const silent = { error() {} };

test('cache serves fixture and reuses it within TTL', async () => {
    let calls = 0;
    const adapter = { async fetchRooms() { calls++; return [{ name: 'a' }]; } };
    const cache = new RoomCache(adapter, { ttlMs: 60000, logger: silent });
    const first = await cache.get();
    await cache.get();
    assert.strictEqual(calls, 1);
    assert.strictEqual(first.stale, false);
    assert.ok(first.lastUpdated);
});

test('cache refetches after TTL expires', async () => {
    let calls = 0;
    const adapter = { async fetchRooms() { calls++; return []; } };
    const cache = new RoomCache(adapter, { ttlMs: 0, logger: silent });
    await cache.get();
    await cache.get();
    assert.strictEqual(calls, 2);
});

test('cache serves stale data when index fails', async () => {
    let fail = false;
    const adapter = { async fetchRooms() { if (fail) throw new Error('down'); return [{ name: 'a' }]; } };
    const cache = new RoomCache(adapter, { ttlMs: 0, logger: silent });
    await cache.get();
    fail = true;
    const snap = await cache.get();
    assert.strictEqual(snap.stale, true);
    assert.strictEqual(snap.rooms[0].name, 'a');
});

test('GET /api/rooms returns JSON with CORS', async () => {
    const cache = new RoomCache(new MockAdapter(), { logger: silent });
    const app = express();
    app.use('/api', createRoomsRouter(cache));
    const server = app.listen(0);
    try {
        const { port } = server.address();
        const res = await new Promise((resolve, reject) => {
            http.get({ port, path: '/api/rooms' }, (r) => {
                let body = '';
                r.on('data', (c) => (body += c));
                r.on('end', () => resolve({ headers: r.headers, body: JSON.parse(body) }));
            }).on('error', reject);
        });
        assert.strictEqual(res.headers['access-control-allow-origin'], '*');
        assert.ok(Array.isArray(res.body.rooms) && res.body.rooms.length > 0);
        assert.ok(res.body.lastUpdated);
        assert.strictEqual(res.body.stale, false);
    } finally {
        server.close();
    }
});
