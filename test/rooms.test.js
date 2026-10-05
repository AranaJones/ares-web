const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');
const { RoomCache } = require('../src/lib/rooms/cache');
const { createApp } = require('../server');

async function withServer(app, callback) {
    const server = app.listen(0);
    await once(server, 'listening');
    try {
        await callback(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

test('room cache coalesces concurrent refreshes and serves stale data on failure', async () => {
    let now = 0;
    let calls = 0;
    let shouldFail = false;
    const cache = new RoomCache({
        name: 'test',
        async fetchRooms() {
            calls += 1;
            if (shouldFail) throw new Error('offline');
            return [{ name: 'Lobby', users: 2 }];
        }
    }, { ttlMs: 10, now: () => now });

    const [first, concurrent] = await Promise.all([cache.get(), cache.get()]);
    assert.equal(calls, 1);
    assert.deepEqual(first.rooms, [{ name: 'Lobby', users: 2 }]);
    assert.deepEqual(concurrent, first);

    shouldFail = true;
    now = 11;
    const stale = await cache.get();
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.rooms, [{ name: 'Lobby', users: 2 }]);
});

test('room endpoint returns cached data and the client entry point is served', async () => {
    const cache = new RoomCache({
        name: 'fixture',
        async fetchRooms() {
            return [{ name: '<img src=x onerror=alert(1)>', users: 3 }];
        }
    });

    await withServer(createApp({ cache, chat: async () => ({ status: 200, body: { reply: 'ok' } }) }), async (base) => {
        const rooms = await fetch(`${base}/api/rooms`);
        assert.equal(rooms.status, 200);
        assert.equal((await rooms.json()).rooms[0].name, '<img src=x onerror=alert(1)>');
        const page = await fetch(base);
        assert.equal(page.status, 200);
        assert.match(await page.text(), /Ares Galaxy Web Chat/);
    });
});

test('chat endpoint validates messages before calling the configured proxy', async () => {
    let calls = 0;
    const app = createApp({
        cache: new RoomCache({ name: 'test', async fetchRooms() { return []; } }),
        chat: async (messages) => {
            calls += 1;
            assert.deepEqual(messages, [{ role: 'user', content: 'Hello' }]);
            return { status: 200, body: { reply: 'Hi' } };
        }
    });

    await withServer(app, async (base) => {
        const invalid = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: [null] })
        });
        assert.equal(invalid.status, 400);
        assert.equal(calls, 0);

        const valid = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] })
        });
        assert.equal(valid.status, 200);
        assert.deepEqual(await valid.json(), { reply: 'Hi' });
        assert.equal(calls, 1);
    });
});

test('chat proxy keeps its API key upstream and returns only the reply', async () => {
    const previous = {
        ARES_GALAXY_BASE_URL: process.env.ARES_GALAXY_BASE_URL,
        ARES_GALAXY_API_KEY: process.env.ARES_GALAXY_API_KEY,
        ARES_GALAXY_TEMPERATURE: process.env.ARES_GALAXY_TEMPERATURE
    };
    const upstream = http.createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        assert.ok(request.headers.authorization.startsWith('Bearer '));
        assert.equal(JSON.parse(body).temperature, 0);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ choices: [{ message: { content: 'Hello back' } }] }));
    });

    await new Promise((resolve) => upstream.listen(0, resolve));
    process.env.ARES_GALAXY_BASE_URL = `http://127.0.0.1:${upstream.address().port}`;
    process.env.ARES_GALAXY_API_KEY = 'unit-test-key';
    process.env.ARES_GALAXY_TEMPERATURE = '0';
    try {
        await withServer(createApp(), async (base) => {
            const response = await fetch(`${base}/api/chat`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] })
            });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { reply: 'Hello back' });
        });
    } finally {
        await new Promise((resolve) => upstream.close(resolve));
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});
