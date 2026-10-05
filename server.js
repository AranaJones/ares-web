const path = require('node:path');
const express = require('express');
const { createRoomAdapter } = require('./src/lib/rooms/adapters');
const { RoomCache } = require('./src/lib/rooms/cache');

const PORT = Number(process.env.PORT) || 3000;
const cacheTtlMs = positiveNumber(process.env.ROOMS_CACHE_TTL_SECONDS, 60) * 1000;
const roomCache = new RoomCache(createRoomAdapter(process.env), {
    ttlMs: cacheTtlMs
});

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createApp({ cache = roomCache, chat = proxyChat } = {}) {
    const app = express();
    app.use(express.json({ limit: '32kb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/api/rooms', async (req, res) => {
        res.json(await cache.get());
    });

    app.post('/api/chat', async (req, res) => {
        const { messages } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50 ||
            messages.some((message) =>
                !message || typeof message !== 'object' || Array.isArray(message) ||
                !['system', 'user', 'assistant'].includes(message.role) ||
                typeof message.content !== 'string' || message.content.length > 8000)) {
            return res.status(400).json({ error: { message: 'Provide 1–50 valid chat messages.' } });
        }

        try {
            const result = await chat(messages);
            res.status(result.status).json(result.body);
        } catch (error) {
            console.error('Chat proxy request failed:', error.message);
            res.status(502).json({ error: { message: 'The chat service is unavailable.' } });
        }
    });

    return app;
}

async function proxyChat(messages) {
    const baseUrl = process.env.ARES_GALAXY_BASE_URL;
    if (!baseUrl) {
        return {
            status: 503,
            body: { error: { message: 'Chat is not configured on this server.' } }
        };
    }

    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
        throw new Error('ARES_GALAXY_BASE_URL must be an HTTP(S) URL without credentials.');
    }

    const chatPath = process.env.ARES_GALAXY_CHAT_PATH || '/v1/chat/completions';
    const endpoint = new URL(chatPath, base);
    if (endpoint.origin !== base.origin) {
        throw new Error('ARES_GALAXY_CHAT_PATH must stay on the configured origin.');
    }

    const headers = { 'content-type': 'application/json' };
    if (process.env.ARES_GALAXY_API_KEY) {
        headers.authorization = 'Bearer ' + process.env.ARES_GALAXY_API_KEY;
    }

    const configuredTemperature = Number(process.env.ARES_GALAXY_TEMPERATURE);
    const temperature = Number.isFinite(configuredTemperature) &&
        configuredTemperature >= 0 && configuredTemperature <= 2
        ? configuredTemperature
        : 0.7;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: process.env.ARES_GALAXY_MODEL || 'ares-galaxy-default',
            messages,
            temperature
        }),
        signal: AbortSignal.timeout(30_000)
    });

    if (!response.ok) {
        return {
            status: response.status >= 400 && response.status < 500 ? response.status : 502,
            body: { error: { message: 'The chat service returned an error.' } }
        };
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
        return { status: 502, body: { error: { message: 'The chat service returned an invalid response.' } } };
    }
    return { status: 200, body: { reply } };
}

const app = createApp();
let server;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`Ares Web Chat server listening at http://localhost:${PORT}`);
    });
}

module.exports = { app, server, roomCache, createApp, proxyChat };
