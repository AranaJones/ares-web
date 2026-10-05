# ares-web

Web chat client with a room-directory backend.

    npm install
    npm start      # http://localhost:3000
    npm test

## Room directory

`GET /api/rooms` returns `{ rooms, lastUpdated, stale, source }` (CORS enabled). Rooms are `{ name, topic?, users, language?, ip, port }`. Before the first load `rooms` is empty and `lastUpdated` is `null`. If a refresh fails the last good data is served with `stale: true`. The Socket.IO event `get_live_channels` is answered from the same cache.

### Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `ARES_INDEX_ADAPTER` | `mock` | `mock` or `aresChat` |
| `ARES_INDEX_URL` | `https://ares.chat` | Index URL (aresChat adapter) |
| `ARES_INDEX_HOST` / `ARES_INDEX_PORT` | – | Alternative to the URL (used when `ARES_INDEX_URL` is unset) |
| `ROOM_CACHE_TTL_MS` | `60000` | Cache TTL and background refresh interval |

Switch adapters, e.g. `ARES_INDEX_ADAPTER=aresChat npm start`.

### Writing an adapter

Add a module in `lib/index-adapters/` exporting a factory that returns `{ name, async fetchRooms() }`, where `fetchRooms()` resolves to an array of `{ name, topic?, users, language?, ip, port }` and rejects on failure. Register it in the `switch` in `lib/index-adapters/index.js`.

### Caveat

**The real Ares index protocol and room-list format are unconfirmed.** The `aresChat` adapter is UNVERIFIED: it reuses an earlier guess (6-byte chunks of IPv4 + big-endian port from `https://ares.chat`) and only yields endpoints, not real room names or user counts. Use `mock` until the protocol is confirmed.

The WebSocket-to-Ares TCP proxy is not part of this change.
