'use strict';

const express = require('express');
const { RoomCache } = require('./cache');
const { AresIndexAdapter } = require('./adapter');
const { MockAdapter } = require('./mockAdapter');

function createAdapter(env = process.env) {
    const kind = env.ARES_INDEX_ADAPTER || (env.ARES_INDEX_HOST ? 'ares' : 'mock');
    if (kind === 'mock') return new MockAdapter();
    return new AresIndexAdapter({ host: env.ARES_INDEX_HOST, port: Number(env.ARES_INDEX_PORT) || undefined });
}

function createRoomsRouter(cache) {
    const router = express.Router();
    router.use((req, res, next) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });
    router.get('/rooms', async (req, res) => {
        res.json(await cache.get());
    });
    return router;
}

function createRoomDirectory(env = process.env, logger = console) {
    const cache = new RoomCache(createAdapter(env), {
        ttlMs: (Number(env.ROOMS_CACHE_TTL_SECONDS) || 45) * 1000,
        refreshIntervalMs: (Number(env.ROOMS_REFRESH_INTERVAL_SECONDS) || 30) * 1000,
        logger
    });
    return { cache, router: createRoomsRouter(cache) };
}

module.exports = { createAdapter, createRoomsRouter, createRoomDirectory, RoomCache };
