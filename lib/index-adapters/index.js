/**
 * Index adapter interface
 * -----------------------
 * An adapter is an object:
 *   {
 *     name: string,
 *     async fetchRooms(): Promise<Array<{
 *       name: string, topic?: string, users: number,
 *       language?: string, ip: string, port: number
 *     }>>
 *   }
 * fetchRooms() must reject on failure; the cache handles stale fallback.
 *
 * Selected with ARES_INDEX_ADAPTER (`mock` | `aresChat`, default `mock`).
 * aresChat reads ARES_INDEX_URL, or ARES_INDEX_HOST + ARES_INDEX_PORT.
 */
const { createMockAdapter } = require('./mockAdapter');
const { createAresChatAdapter } = require('./aresChatAdapter');

function createAdapter(env = process.env) {
    const choice = env.ARES_INDEX_ADAPTER || 'mock';
    switch (choice) {
        case 'mock':
            return createMockAdapter();
        case 'aresChat':
            return createAresChatAdapter({
                url: env.ARES_INDEX_URL,
                host: env.ARES_INDEX_HOST,
                port: env.ARES_INDEX_PORT
            });
        default:
            throw new Error(`Unknown ARES_INDEX_ADAPTER "${choice}" (expected "mock" or "aresChat")`);
    }
}

module.exports = { createAdapter };
