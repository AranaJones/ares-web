# Ares Web Chat

A browser chat client with a cached room directory and an OpenAI-compatible
server-side chat proxy. The room directory defaults to sample rooms because
the Ares index wire protocol is not verified. Chat requires an endpoint
configured by the server operator.

## Run

```sh
npm install
npm start
```

Open <http://localhost:3000>. Node.js 18 or newer is required. Run the tests
with `npm test`.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listen port |
| `ARES_INDEX_ADAPTER` | `mock` | `mock` or `http` |
| `ARES_INDEX_URL` | — | URL returning an array of rooms or `{ "rooms": [...] }`, required for `http` |
| `ROOMS_CACHE_TTL_SECONDS` | `60` | How long a room response is cached |
| `ARES_GALAXY_BASE_URL` | — | OpenAI-compatible API origin; chat is disabled when unset |
| `ARES_GALAXY_CHAT_PATH` | `/v1/chat/completions` | Chat-completions path on the configured origin |
| `ARES_GALAXY_MODEL` | `ares-galaxy-default` | Model sent to the upstream API |
| `ARES_GALAXY_API_KEY` | — | Optional server-side bearer key; never sent to the browser |
| `ARES_GALAXY_TEMPERATURE` | `0.7` | Sampling temperature |

For example:

```sh
ARES_GALAXY_BASE_URL=https://api.example.test \
ARES_GALAXY_MODEL=my-model \
ARES_GALAXY_API_KEY=your-key \
npm start
```

`GET /api/rooms` returns `{ rooms, lastUpdated, stale, source }`. Room records
use `name`, `topic`, `users`, and `language`. An HTTP adapter must provide this
JSON shape; it does not claim to implement the undocumented Ares index
protocol. The browser renders remote room and chat text as text, not HTML.

The chat endpoint validates request sizes and keeps the API key on the server,
but it does not authenticate users or impose per-user quotas. Do not expose an
instance with a paid upstream API key to the public internet without adding
appropriate authentication and rate limiting at the deployment layer.

The proposed WebSocket-to-TCP gateway is not included: its Ares packet framing
and message identifiers are unverified, and the draft gateway permitted
arbitrary outbound TCP connections unless separately restricted. The
OpenAI-compatible chat proxy is a separate, configurable feature and does not
claim to implement the Ares wire protocol.
