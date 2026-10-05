'use strict';

/**
 * ARES INDEX ADAPTER (PLACEHOLDER - REPLACE ME)
 *
 * The real Ares index protocol is NOT confirmed, so no wire format is
 * implemented here. An adapter is any object with:
 *
 *   async fetchRooms() -> Array<{ name, topic?, users?, language?, ip?, port?, ... }>
 *
 * To support the real index, implement fetchRooms() below (or write a new
 * module with the same shape and select it in createAdapter()).
 */
class AresIndexAdapter {
    constructor({ host, port } = {}) {
        this.host = host;
        this.port = port;
    }

    async fetchRooms() {
        throw new Error(
            `Ares index protocol not implemented (target ${this.host}:${this.port}); ` +
            'implement src/rooms/adapter.js or use ARES_INDEX_ADAPTER=mock'
        );
    }
}

module.exports = { AresIndexAdapter };
