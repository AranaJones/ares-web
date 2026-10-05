(() => {
  const $ = selector => document.querySelector(selector);
  const connectForm = $('#connect-form');
  const messageForm = $('#message-form');
  const status = $('#connection-status');
  const chatLog = $('#chat-log');
  const userList = $('#user-list');
  const messageInput = $('#message');
  let socket;
  let connected = false;
  let myNickname = '';
  const users = new Map();

  fetch('/config.json')
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (!config) return;
      if (config.host) $('#host').value = config.host;
      if (Number.isInteger(config.port) && config.port >= 1 && config.port <= 65535) {
        $('#port').value = String(config.port);
      }
    })
    .catch(() => {});

  function setStatus(text, state = '') {
    status.textContent = text;
    status.dataset.state = state;
  }

  function addLine(text, kind = 'system') {
    const line = document.createElement('li');
    line.className = `line ${kind}`;
    line.textContent = text;
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderUsers() {
    userList.replaceChildren();
    for (const user of users.values()) {
      const item = document.createElement('li');
      item.textContent = user.nickname;
      if (user.level > 0) item.title = `Room level ${user.level}`;
      userList.appendChild(item);
    }
    $('#user-count').textContent = String(users.size);
  }

  function setConnected(value) {
    connected = value;
    $('#connect-button').disabled = value;
    $('#disconnect-button').disabled = !value;
    messageInput.disabled = !value;
    $('#send-button').disabled = !value;
    if (!value) {
      users.clear();
      renderUsers();
    }
  }

  function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  connectForm.addEventListener('submit', event => {
    event.preventDefault();
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    chatLog.replaceChildren();
    users.clear();
    renderUsers();
    myNickname = $('#nickname').value.trim();
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const current = new WebSocket(`${scheme}//${location.host}`);
    socket = current;
    $('#connect-button').disabled = true;
    $('#disconnect-button').disabled = false;
    setStatus('Opening browser connection…', 'connecting');
    current.addEventListener('open', () => {
      if (socket !== current) return;
      send({
        type: 'connect',
        host: $('#host').value.trim(),
        port: Number($('#port').value),
        nickname: myNickname
      });
    });
    current.addEventListener('message', event => {
      if (socket !== current) return;
      let packet;
      try {
        packet = JSON.parse(event.data);
      } catch {
        addLine('Received invalid data from the gateway.');
        return;
      }
      switch (packet.type) {
        case 'status':
          setStatus(packet.message, packet.status);
          if (packet.status === 'disconnected') setConnected(false);
          break;
        case 'connected':
          myNickname = packet.nickname || myNickname;
          $('#room-name').textContent = packet.roomName || `${$('#host').value}:${$('#port').value}`;
          setStatus(`Connected as ${myNickname}`, 'connected');
          setConnected(true);
          messageInput.focus();
          break;
        case 'server':
          addLine(`Server: ${packet.version}`);
          break;
        case 'error':
          addLine(packet.message);
          setStatus(packet.message, 'error');
          $('#connect-button').disabled = false;
          break;
        case 'topic':
          $('#topic').textContent = packet.topic;
          break;
        case 'user':
          users.set(packet.user.nickname, packet.user);
          renderUsers();
          break;
        case 'users':
          users.clear();
          for (const user of packet.users) users.set(user.nickname, user);
          renderUsers();
          break;
        case 'join':
          users.set(packet.user.nickname, packet.user);
          renderUsers();
          addLine(`${packet.user.nickname} joined`, 'system');
          break;
        case 'part':
          users.delete(packet.nickname);
          renderUsers();
          addLine(`${packet.nickname} left`, 'system');
          break;
        case 'message':
          addLine(packet.kind === 'emote'
            ? `* ${packet.sender} ${packet.text}`
            : `${packet.sender}: ${packet.text}`,
          packet.sender === myNickname ? 'own' : 'message');
          break;
        default:
          break;
      }
    });
    current.addEventListener('close', () => {
      if (socket !== current) return;
      setConnected(false);
      setStatus('Not connected');
    });
    current.addEventListener('error', () => {
      if (socket !== current) return;
      setStatus('WebSocket connection failed', 'error');
      $('#connect-button').disabled = false;
      $('#disconnect-button').disabled = true;
      addLine('Could not connect to the chat gateway.');
    });
  });

  $('#disconnect-button').addEventListener('click', () => {
    send({ type: 'disconnect' });
    if (socket) socket.close();
  });

  messageForm.addEventListener('submit', event => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !connected) return;
    const emote = text.startsWith('/me ') && text.length > 4;
    send({ type: emote ? 'emote' : 'message', text: emote ? text.slice(4) : text });
    messageInput.value = '';
  });
})();
