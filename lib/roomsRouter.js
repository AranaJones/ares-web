const express = require('express');

function createRoomsRouter(cache) {
    const router = express.Router();
    router.use((req, res, next) => {
        res.set('Access-Control-Allow-Origin', '*');
        next();
    });
    router.get('/', (req, res) => {
        res.json(cache.getSnapshot());
    });
    return router;
}

module.exports = { createRoomsRouter };
