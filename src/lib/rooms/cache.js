class RoomCache {
    constructor(adapter, { ttlMs = 60_000, now = Date.now } = {}) {
        this.adapter = adapter;
        this.ttlMs = ttlMs;
        this.now = now;
        this.rooms = [];
        this.lastUpdated = null;
        this.stale = false;
        this.refreshPromise = null;
    }

    async get() {
        if (this.lastUpdated === null || this.now() - this.lastUpdated >= this.ttlMs) {
            try {
                await this.refresh();
            } catch (error) {
                this.stale = true;
                console.error('Room directory refresh failed:', error.message);
            }
        }

        return {
            rooms: this.rooms,
            lastUpdated: this.lastUpdated === null ? null : new Date(this.lastUpdated).toISOString(),
            stale: this.stale,
            source: this.adapter.name
        };
    }

    refresh() {
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = this.adapter.fetchRooms()
            .then((rooms) => {
                if (!Array.isArray(rooms)) throw new Error('Room adapter must return an array.');
                this.rooms = rooms;
                this.lastUpdated = this.now();
                this.stale = false;
            })
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    }
}

module.exports = { RoomCache };
