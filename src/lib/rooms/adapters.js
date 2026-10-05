const mockRooms = [
    { name: 'English', topic: 'Welcome to Ares chat', users: 0, language: 'en' },
    { name: 'Music', topic: 'Music discussion', users: 0, language: 'en' },
    { name: 'Technology', topic: 'Technology discussion', users: 0, language: 'en' }
];

function createRoomAdapter(env = process.env) {
    if (env.ARES_INDEX_ADAPTER === 'http') {
        if (!env.ARES_INDEX_URL) {
            throw new Error('ARES_INDEX_URL is required for the http room adapter.');
        }
        return httpAdapter(env.ARES_INDEX_URL);
    }
    if (env.ARES_INDEX_ADAPTER && env.ARES_INDEX_ADAPTER !== 'mock') {
        throw new Error('ARES_INDEX_ADAPTER must be "mock" or "http".');
    }
    return {
        name: 'mock',
        async fetchRooms() {
            return mockRooms.map((room) => ({ ...room }));
        }
    };
}

function httpAdapter(url) {
    const endpoint = new URL(url);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
        throw new Error('ARES_INDEX_URL must be an HTTP(S) URL without credentials.');
    }

    return {
        name: 'http',
        async fetchRooms() {
            const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) throw new Error(`Room index returned HTTP ${response.status}.`);
            const data = await response.json();
            const rooms = Array.isArray(data) ? data : data?.rooms;
            if (!Array.isArray(rooms)) throw new Error('Room index response must contain a rooms array.');

            return rooms.filter((room) => room && typeof room.name === 'string').map((room) => ({
                name: room.name.slice(0, 100),
                topic: typeof room.topic === 'string' ? room.topic.slice(0, 300) : '',
                users: Number.isFinite(Number(room.users)) ? Math.max(0, Number(room.users)) : 0,
                language: typeof room.language === 'string' ? room.language.slice(0, 20) : ''
            }));
        }
    };
}

module.exports = { createRoomAdapter };
