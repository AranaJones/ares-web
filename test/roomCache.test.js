const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const { createRoomCache } = require('../lib/roomCache');
const { createRoomsRouter } = require('../lib/roomsRouter');
const { createAdapter } = require('../lib/index-adapters');

const quiet = { error() {} };
const room = { name: 'a', users: 1, ip: '1.2.3.4', port: 1 };

test('empty before first refresh', () => {
    const c = createRoomCache({ name: 'x', fetchRooms: async () => [room] }, { logger: quiet });
    assert.deepStrictEqual(c.getSnapshot(), { rooms: [], lastUpdated: null, stale: false, source: 'x' });
});

test('refresh stores rooms and TTL expiry marks stale', async () => {
    const c = createRoomCache({ name: 'x', fetchRooms: async () => [room] }, { ttlMs: 20, logger: quiet });
    await c.refresh();
    let s = c.getSnapshot();
    assert.deepStrictEqual(s.rooms, [room]);
    assert.strictEqual(s.stale, false);
    assert.ok(!Number.isNaN(Date.parse(s.lastUpdated)));
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(c.getSnapshot().stale, true);
});

test('adapter failure keeps last data and marks stale', async () => {
    let fail = false;
    const c = createRoomCache({ name: 'x', fetchRooms: async () => { if (fail) throw new Error('boom'); return [room]; } }, { logger: quiet });
    await c.refresh();
    fail = true;
    await c.refresh();
    const s = c.getSnapshot();
    assert.deepStrictEqual(s.rooms, [room]);
    assert.strictEqual(s.stale, true);
});

test('no overlapping refreshes', async () => {
    let calls = 0;
    const c = createRoomCache({ name: 'x', fetchRooms: async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return []; } }, { logger: quiet });
    await Promise.all([c.refresh(), c.refresh(), c.refresh()]);
    assert.strictEqual(calls, 1);
});

test('GET /api/rooms response shape and CORS', async () => {
    const cache = createRoomCache(createAdapter({}), { logger: quiet });
    const app = express();
    app.use('/api/rooms', createRoomsRouter(cache));
    const srv = http.createServer(app).listen(0);
    const get = () => new Promise((resolve, reject) => http.get({ port: srv.address().port, path: '/api/rooms' }, (res) => {
        let b = ''; res.on('data', (d) => b += d); res.on('end', () => resolve({ res, body: JSON.parse(b) }));
    }).on('error', reject));
    try {
        let { body } = await get();
        assert.deepStrictEqual(body, { rooms: [], lastUpdated: null, stale: false, source: 'mock' });
        await cache.refresh();
        const r = await get();
        assert.strictEqual(r.res.headers['access-control-allow-origin'], '*');
        assert.ok(r.body.rooms.length > 0);
        assert.strictEqual(typeof r.body.lastUpdated, 'string');
        assert.strictEqual(r.body.stale, false);
        assert.strictEqual(r.body.source, 'mock');
    } finally { srv.close(); }
});
