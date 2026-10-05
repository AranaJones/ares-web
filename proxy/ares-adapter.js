'use strict';

/**
 * Ares protocol adapter.
 *
 * All knowledge of Ares wire format lives in this file. The packet IDs below
 * are PLACEHOLDERS: adapt them (and encode/decode) to the real Ares / ib0t
 * specification. The rest of the gateway only uses the adapter's interface:
 *   encodeHandshake(nick) -> Buffer
 *   encodeChat(text)      -> Buffer
 *   createDecoder()       -> { push(chunk) -> [{ type, nick?, text? }] }
 *
 * Framing assumed: [length: uint16 LE][type: uint8][payload (length bytes)].
 */

const MSG = {
  HANDSHAKE: 0x01,
  CHAT_OUT: 0x0a,
  CHAT_IN: 0x0b,
  SYSTEM_IN: 0x0c,
};

const MAX_PAYLOAD = 0xffff;

function frame(type, payload) {
  if (payload.length > MAX_PAYLOAD) throw new Error('Packet payload too large');
  const header = Buffer.alloc(3);
  header.writeUInt16LE(payload.length, 0);
  header.writeUInt8(type, 2);
  return Buffer.concat([header, payload]);
}

function encodeHandshake(nick) {
  return frame(MSG.HANDSHAKE, Buffer.from(String(nick), 'utf8'));
}

function encodeChat(text) {
  return frame(MSG.CHAT_OUT, Buffer.from(String(text), 'utf8'));
}

// Incoming CHAT_IN payload: "<nick>\0<text>"
function decodePacket(type, payload) {
  switch (type) {
    case MSG.CHAT_IN: {
      const s = payload.toString('utf8');
      const i = s.indexOf('\0');
      return i === -1
        ? { type: 'message', nick: '?', text: s }
        : { type: 'message', nick: s.slice(0, i), text: s.slice(i + 1) };
    }
    case MSG.SYSTEM_IN:
      return { type: 'system', text: payload.toString('utf8') };
    default:
      return null;
  }
}

function createDecoder() {
  let buf = Buffer.alloc(0);
  return {
    push(chunk) {
      buf = Buffer.concat([buf, chunk]);
      const out = [];
      while (buf.length >= 3) {
        const len = buf.readUInt16LE(0);
        if (buf.length < 3 + len) break;
        const event = decodePacket(buf.readUInt8(2), buf.subarray(3, 3 + len));
        if (event) out.push(event);
        buf = buf.subarray(3 + len);
      }
      return out;
    },
  };
}

module.exports = { MSG, encodeHandshake, encodeChat, createDecoder };
