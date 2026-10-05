# Ares Web Chat

## Room directory service

`GET /api/rooms` returns the cached room list:

```json
{ "rooms": [{ "name": "...", "topic": "...", "users": 0, "language": "en" }], "lastUpdated": "ISO timestamp", "stale": false }
```

If the Ares index is unreachable, the last cached data is served with `"stale": true` and the error is logged. CORS is enabled (`Access-Control-Allow-Origin: *`).

### Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `ARES_INDEX_HOST` / `ARES_INDEX_PORT` | unset | Ares index host and port |
| `ARES_INDEX_ADAPTER` | `mock` if no host set, else `ares` | `mock` uses fixture data |
| `ROOMS_CACHE_TTL_SECONDS` | 45 | Cache TTL |
| `ROOMS_REFRESH_INTERVAL_SECONDS` | 30 | Background refresh interval |

### Adapter

The index protocol is unconfirmed. `src/rooms/adapter.js` is a placeholder that throws until implemented; replace `fetchRooms()` there. `src/rooms/mockAdapter.js` provides fixture data for development and tests.

### Run / test

```
npm install
npm start
npm test
```

The frontend (`public/rooms.js`) renders the directory using safe text insertion; clicking a room calls the page's existing `connectToRoom(ip, port, name)`.
