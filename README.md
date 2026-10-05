# ares-web

Ares Galaxy web chat client.

## Join from a hashlink

Enter a hashlink in the toolbar, or open the page with `?join=<hashlink>`.
The decoder mirrors cb0t's `Hashlink.DecodeHashlink` (`lib/hashlink.js`).

Supported formats:

- Plain: `CHATROOM:<ip>:<port>|<name>` (prefix is case-insensitive)
- Encrypted: base64 → `d67` XOR cipher (key 28435) → zlib inflate → binary room record (IP, little-endian port, name)

Optional `arlnk://` or `cb0t://` prefixes and a trailing `/` are accepted.
Input is limited to 4096 characters and inflated data to 64 KB.

Scope: this only decodes the link and routes the room into the existing `connectToRoom` path.
The Ares chat protocol itself (login packet, framing) is not implemented, so no real room connection is made.

Run tests with `npm test`.
