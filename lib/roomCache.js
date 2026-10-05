/**
 * Room cache: holds the last good room list from an index adapter.
 * Refreshes in the background; overlapping refreshes share one in-flight call.
 * On failure the previous data is kept and reported with stale: true.
 */
function createRoomCache(adapter, options = {}) {
    const ttlMs = options.ttlMs !== undefined ? options.ttlMs : 60000;
    const logger = options.logger || console;
    let rooms = [];
    let lastUpdated = null; // ms timestamp
    let failed = false;
    let inFlight = null;
    let timer = null;

    function refresh() {
        if (inFlight) return inFlight;
        inFlight = (async () => {
            try {
                const result = await adapter.fetchRooms();
                if (!Array.isArray(result)) throw new Error('Adapter returned a non-array result');
                rooms = result;
                lastUpdated = Date.now();
                failed = false;
            } catch (err) {
                failed = true;
                logger.error(`[ROOM CACHE] Refresh failed: ${err.message}`);
            } finally {
                inFlight = null;
            }
        })();
        return inFlight;
    }

    function isExpired() {
        return lastUpdated !== null && Date.now() - lastUpdated > ttlMs;
    }

    function getSnapshot() {
        return {
            rooms,
            lastUpdated: lastUpdated === null ? null : new Date(lastUpdated).toISOString(),
            stale: failed || isExpired(),
            source: adapter.name
        };
    }

    function start() {
        if (timer) return;
        refresh();
        timer = setInterval(refresh, ttlMs);
        if (timer.unref) timer.unref();
    }

    function stop() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    return { refresh, getSnapshot, start, stop };
}

module.exports = { createRoomCache };
