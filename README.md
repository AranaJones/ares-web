# ares-web

Web client backend for the Ares network (Express + Socket.IO + axios).

## Run

    npm install
    npm start        # or: npm run dev (auto-restart, Node 18.11+)

Open http://localhost:3000.

## Configuration

- `PORT` – HTTP port (default `3000`).

The server fetches a node list from `https://ares.chat` on startup and on request,
assuming 6-byte records (IPv4 + big-endian port). If the host is unreachable or the
format differs, an empty list is returned and the app keeps running.
