/**
 * Mock index adapter: returns fixture rooms for local development and tests.
 * Implements the adapter interface described in ./index.js.
 */
const FIXTURE_ROOMS = [
    { name: 'Lobby', topic: 'Welcome to the mock directory', users: 42, language: 'en', ip: '127.0.0.1', port: 5001 },
    { name: 'Music', topic: 'Share your favourite tracks', users: 17, language: 'en', ip: '127.0.0.1', port: 5002 },
    { name: 'Sala Española', topic: 'Charla en español', users: 8, language: 'es', ip: '127.0.0.1', port: 5003 }
];

function createMockAdapter() {
    return {
        name: 'mock',
        async fetchRooms() {
            return FIXTURE_ROOMS.map((room) => ({ ...room }));
        }
    };
}

module.exports = { createMockAdapter, FIXTURE_ROOMS };
