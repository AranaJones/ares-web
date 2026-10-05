(function () {
  'use strict';

  const form = document.getElementById('chat-form');
  const input = document.getElementById('message');
  const sendBtn = document.getElementById('send-btn');
  const log = document.getElementById('chat-box');
  const statusEl = document.getElementById('connectionStatus');
  const connectBtn = document.getElementById('connect-btn');
  const hostInput = document.getElementById('room-host');
  const portInput = document.getElementById('room-port');
  const nickInput = document.getElementById('username');

  let ws = null;

  // Uses textContent only, so message data can never inject markup.
  function appendMessage(nick, text, cls) {
    const line = document.createElement('div');
    line.className = 'msg-line';
    const who = document.createElement('span');
    who.className = cls || 'nick-user';
    who.textContent = nick + ': ';
    const body = document.createElement('span');
    body.textContent = text;
    line.append(who, body);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function appendSystem(text) {
    appendMessage('System', text, 'nick-sys');
  }

  function setConnected(on) {
    input.disabled = !on;
    sendBtn.disabled = !on;
    connectBtn.textContent = on ? 'Disconnect' : 'Connect';
    if (on) input.focus();
  }

  function setStatus(text) {
    statusEl.textContent = 'Network State: ' + text;
  }

  function connect() {
    const host = hostInput.value.trim();
    const port = Number(portInput.value);
    if (!host || !port) return appendSystem('Enter a host and port first.');
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    ws = new WebSocket(proto + location.host + '/ws');
    const socket = ws;
    socket.addEventListener('open', function () {
      socket.send(JSON.stringify({ type: 'connect', host: host, port: port, nick: nickInput.value.trim() }));
    });
    socket.addEventListener('message', function (ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'message') appendMessage(String(msg.nick), String(msg.text));
      else if (msg.type === 'system') appendSystem(String(msg.text));
      else if (msg.type === 'error') appendSystem('Error: ' + msg.text);
      else if (msg.type === 'status') {
        setStatus(msg.state);
        setConnected(msg.state === 'connected');
      }
    });
    socket.addEventListener('close', function () {
      if (ws === socket) ws = null;
      setConnected(false);
      setStatus('Offline');
    });
  }

  function disconnect() {
    if (ws) ws.close();
  }

  function sendMessage() {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'message', text: text }));
    appendMessage(nickInput.value.trim() || 'Me', text);
    input.value = '';
    input.focus();
  }

  // Enter sends via the same path as the Send button / form submit.
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendMessage();
  });

  connectBtn.addEventListener('click', function () {
    if (ws) disconnect(); else connect();
  });

  setStatus('Offline');
})();
