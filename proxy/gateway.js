'use strict';

const net = require('net');
const { WebSocketServer } = require('ws');
const adapter = require('./ares-adapter');

const MAX_TEXT = 1000;
const MAX_NICK = 32;
const CONNECT_TIMEOUT_MS = 10000;

/**
 * Attaches a WebSocket gateway to an http.Server at /ws.
 *
 * Browser -> gateway (JSON):
 *   { type: 'connect', host, port, nick } | { type: 'message', text } | { type: 'disconnect' }
 * Gateway -> browser (JSON):
 *   { type: 'status', state } | { type: 'message', nick, text } | { type: 'system', text } | { type: 'error', text }
 *
 * options.allowHost(host, port) -> boolean restricts reachable Ares targets
 * (defaults to any, so set it in production to avoid an open TCP relay).
 */
function attachGateway(server, options = {}) {
  const allowHost = options.allowHost || (() => true);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });

  wss.on('connection', (ws) => {
    let tcp = null;
    let connected = false;

    const send = (obj) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    };

    const closeTcp = () => {
      if (tcp) {
        tcp.destroy();
        tcp = null;
      }
      connected = false;
    };

    function openTcp({ host, port, nick }) {
      closeTcp();
      port = Number(port);
      if (typeof host !== 'string' || !host || !Number.isInteger(port) || port < 1 || port > 65535) {
        return send({ type: 'error', text: 'Invalid host or port' });
      }
      if (!allowHost(host, port)) {
        return send({ type: 'error', text: 'Target not allowed' });
      }
      nick = String(nick || 'AresUser').slice(0, MAX_NICK);

      const decoder = adapter.createDecoder();
      const sock = net.connect({ host, port });
      tcp = sock;
      sock.setTimeout(CONNECT_TIMEOUT_MS, () => {
        if (!connected) sock.destroy(new Error('Connection timed out'));
      });
      send({ type: 'status', state: 'connecting' });

      sock.on('connect', () => {
        connected = true;
        sock.setTimeout(0);
        sock.write(adapter.encodeHandshake(nick));
        send({ type: 'status', state: 'connected' });
      });
      sock.on('data', (chunk) => {
        try {
          decoder.push(chunk).forEach(send);
        } catch (err) {
          send({ type: 'error', text: 'Protocol error' });
          sock.destroy();
        }
      });
      sock.on('error', (err) => send({ type: 'error', text: err.message }));
      sock.on('close', () => {
        if (tcp === sock) tcp = null;
        connected = false;
        send({ type: 'status', state: 'disconnected' });
      });
    }

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return send({ type: 'error', text: 'Invalid JSON' });
      }
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'connect') {
        openTcp(msg);
      } else if (msg.type === 'message') {
        if (!tcp || !connected) return send({ type: 'error', text: 'Not connected' });
        const text = String(msg.text || '').slice(0, MAX_TEXT);
        if (text) tcp.write(adapter.encodeChat(text));
      } else if (msg.type === 'disconnect') {
        closeTcp();
      }
    });

    ws.on('close', closeTcp);
    ws.on('error', closeTcp);
  });

  return wss;
}

module.exports = { attachGateway };
