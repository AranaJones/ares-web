# Ares Web Chat

A browser chat client for Ares rooms. A Node.js gateway speaks the room's TCP protocol and relays supported events to the browser over WebSockets. This project does not connect to the Ares directory; enter a room's host and port directly.

## Run locally

Requirements: Node.js 18 or newer.

```sh
npm install
cp .env.example .env
npm start
```

Set any desired values from `.env` in your shell or hosting provider (the application does not load `.env` files itself), then open `http://localhost:3000`. `ARES_HOST` and `ARES_PORT` prefill the form; they can also be supplied per connection through the form. `PORT` controls the web server port.

The gateway accepts public IPv4 room hosts by default and rejects private, loopback, link-local, and reserved destinations. To limit users to specific room hosts, set `ARES_ALLOWED_HOSTS` to comma-separated hostnames or IPv4 addresses. An explicit allow-list also permits private IPv4 destinations; only use that option when the gateway is trusted and those destinations are intended. Never expose an unrestricted gateway to untrusted users.

## Deploy

The container listens on the `PORT` environment variable (default `3000`) and binds to all interfaces.

### Docker

```sh
docker build -t ares-web .
docker run --rm -p 3000:3000 \
  -e ARES_ALLOWED_HOSTS=chat.example.org \
  ares-web
```

### Render

Create a **Web Service** from this repository, use the Dockerfile, and add `ARES_ALLOWED_HOSTS` and optional `ARES_HOST` / `ARES_PORT` environment variables in the service settings. Render provides HTTPS; open the HTTPS URL so the browser uses secure WebSockets (`wss:`).

### Fly.io

Deploy with the included Dockerfile (for example, `fly launch --dockerfile Dockerfile`), set `ARES_ALLOWED_HOSTS` and optional room defaults as Fly secrets/environment variables, and expose the HTTP service through Fly's TLS proxy. The browser automatically uses `wss:` when the page is loaded over HTTPS.

### VPS

Run the container or `npm start` behind a TLS reverse proxy such as Caddy or nginx. Forward WebSocket upgrade requests to the Node server and publish only HTTPS. Configure `ARES_ALLOWED_HOSTS` to the rooms your users should reach; do not expose the gateway's plain HTTP port directly to the internet.

## Supported protocol

The packet framing, client login fields, and room event layouts are based on Ares chat packet handling in [AresChat/cb0t](https://github.com/AresChat/cb0t), particularly `TCPPacketWriter`, `TCPPacketReader`, `TCPOutbound`, `TCPMsg`, and `Room.Handler`. That client is licensed under **GNU AGPL-3.0-or-later**; see its [license](https://github.com/AresChat/cb0t/blob/master/install-files/license.rtf). This project reimplements the packet layouts for the web gateway and is not affiliated with the cb0t authors.

Implemented: TCP length/type framing, initial client login, public messages and emotes, user-list records and completion, joins, parts, topics, server errors/features, echo/fast-ping replies, WebSocket heartbeat, and basic message rate limiting.

Not implemented: Ares encryption/crypto-key negotiation, compressed packets, private messages, avatars, custom fonts, voice clips, scribbles, redirection, room discovery, and other advanced extensions. Use only rooms that allow connections from this client; servers requiring unsupported encryption or features may not work.

## Tests

```sh
npm test
```
