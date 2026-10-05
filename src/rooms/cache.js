'use strict';

/**
 * Caches the room list from an adapter with a TTL. If a refresh fails the
 * last good data is kept and reported as stale.
 */
class RoomCache {
    constructor(adapter, { ttlMs = 45000, refreshIntervalMs = 30000, logger = console } = {}) {
        this.adapter = adapter;
        this.ttlMs = ttlMs;
        this.refreshIntervalMs = refreshIntervalMs;
        this.logger = logger;
        this.rooms = [];
        this.lastUpdated = null;
        this.stale = false;
        this.lastError = null;
        this.timer = null;
        this.inflight = null;
    }

    isFresh() {
        return this.lastUpdated !== null && Date.now() - this.lastUpdated < this.ttlMs;
    }

    refresh() {
        if (this.inflight) return this.inflight;
        this.inflight = (async () => {
            try {
                const rooms = await this.adapter.fetchRooms();
                if (!Array.isArray(rooms)) throw new Error('adapter did not return an array');
                this.rooms = rooms;
                this.lastUpdated = Date.now();
                this.stale = false;
                this.lastError = null;
            } catch (err) {
                this.stale = true;
                this.lastError = err.message;
                this.logger.error('[ROOM DIRECTORY] Index fetch failed:', err.message);
            } finally {
                this.inflight = null;
            }
        })();
        return this.inflight;
    }

    async get() {
        if (!this.isFresh()) await this.refresh();
        return this.snapshot();
    }

    snapshot() {
        return {
            rooms: this.rooms,
            lastUpdated: this.lastUpdated ? new Date(this.lastUpdated).toISOString() : null,
            stale: this.stale || (this.lastUpdated !== null && !this.isFresh())
        };
    }

    start() {
        if (this.timer || !(this.refreshIntervalMs > 0)) return;
        this.refresh();
        this.timer = setInterval(() => this.refresh(), this.refreshIntervalMs);
        if (this.timer.unref) this.timer.unref();
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }
}

module.exports = { RoomCache };
