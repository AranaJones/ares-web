'use strict';

const FIXTURE = [
    { name: 'General Chat', topic: 'Welcome, say hello', users: 42, language: 'en', ip: '127.0.0.1', port: 5000 },
    { name: 'Musica Latina', topic: 'Musica en espanol', users: 17, language: 'es', ip: '127.0.0.1', port: 5001 },
    { name: 'Retro Games', topic: 'Classic games talk', users: 8, language: 'en', ip: '127.0.0.1', port: 5002 }
];

/** Fixture adapter for local development and tests. Returns static, fake data. */
class MockAdapter {
    constructor(rooms = FIXTURE) {
        this.rooms = rooms;
    }

    async fetchRooms() {
        return this.rooms.map((r) => ({ ...r }));
    }
}

module.exports = { MockAdapter, FIXTURE };
