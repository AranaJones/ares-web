<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ares Galaxy v2.x.x</title>
    <style>
        /* Classic Windows / Ares Palette */
        :root {
            --win-bg: #ece9d8; /* Vintage Windows XP base color */
            --ares-dark-grey: #3a3a3b;
            --ares-light-grey: #dedede;
            --ares-blue: #004efe;
            --border-light: #ffffff;
            --border-dark: #808080;
            --input-bg: #ffffff;
        }

        * { box-sizing: border-box; font-family: "Tahoma", "Segoe UI", sans-serif; font-size: 12px; }

        body { background-color: #5a7edc; margin: 0; padding: 10px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }

        /* Outer Application Window Frame */
        .ares-window { width: 100%; max-width: 900px; background: var(--win-bg); border: 3px solid #004efe; border-radius: 5px 5px 0px 0px; box-shadow: 4px 4px 20px rgba(0,0,0,0.4); display: flex; flex-direction: column; overflow: hidden; }

        /* Windows Title Bar */
        .title-bar { background: linear-gradient(180deg, #0058f5 0%, #004efe 8%, #0124b1 100%); padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; color: white; font-weight: bold; }
        .title-controls div { width: 16px; height: 16px; background: #e04343; border: 1px solid #fff; display: inline-block; text-align: center; line-height: 12px; font-size: 11px; cursor: pointer; border-radius: 2px; }

        /* Signature Ares P2P Top Navigation Tabs Dashboard Layout */
        .ares-tabs { background: #f1f0e6; display: flex; border-bottom: 1px solid var(--border-dark); padding: 4px 4px 0 4px; gap: 2px; }
        .tab-btn { background: #e1dfdd; border: 1px solid var(--border-dark); border-bottom: none; padding: 6px 12px; cursor: pointer; font-weight: normal; color: #333; border-radius: 3px 3px 0 0; display: flex; align-items: center; gap: 4px; }
        .tab-btn:hover { background: #fff; }
        .tab-btn.active { background: #fff; font-weight: bold; border-bottom: 1px solid #fff; margin-bottom: -1px; position: relative; z-index: 5; }

        /* Secondary Search/Utility Ribbon Toolbar */
        .ares-toolbar { background: #f4f3eb; border-bottom: 1px solid #d0d0d0; padding: 6px 12px; display: flex; align-items: center; gap: 15px; }
        
        /* Main Client Layout Matrix Grid splitting Rooms & Output logs */
        .main-workspace { display: grid; grid-template-columns: 240px 1fr; background: #fff; height: 420px; border: 2px inset #fff; }

        /* Left Side Room Hub panel matching early p2p nodes styles */
        .room-pane { background: #f0f0f0; border-right: 2px ridge #fff; display: flex; flex-direction: column; }
        .pane-header { background: #62729a; color: white; padding: 4px 8px; font-weight: bold; display: flex; justify-content: space-between; }
        .pane-header button { font-size: 10px; padding: 1px 4px; cursor: pointer; }
        .room-list { flex: 1; overflow-y: scroll; padding: 2px; }
        
        .channel-item { width: 100%; border: none; background: transparent; text-align: left; padding: 5px; cursor: pointer; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; }
        .channel-item:hover { background-color: #316ac5; color: white; }
        .channel-item .count { color: #008000; font-weight: bold; }
        .channel-item:hover .count { color: #fff; }

        /* Right Side Room Terminal Screen Layout container */
        .chat-pane { display: flex; flex-direction: column; background: #ffffff; }
        .chat-output { flex: 1; overflow-y: scroll; padding: 10px; display: flex; flex-direction: column; gap: 4px; background: #ffffff; border-bottom: 2px inset #fff; }
        
        /* Native Ares Chat text format presets */
        .msg { line-height: 1.3; font-family: "Courier New", monospace; font-size: 13px; color: #000; }
        .msg-user { color: #0000ff; font-weight: bold; }
        .msg-sys { color: #ff0000; font-style: italic; }

        /* Message input bottom tray container */
        .input-tray { background: #f1f0e6; padding: 8px; display: flex; gap: 5px; border-top: 1px solid var(--border-dark); }
        .input-tray input { flex: 1; padding: 4px; border: 2px inset #eee; }
        .input-tray button { background: #e1dfdd; border: 1px solid var(--border-dark); padding: 4px 15px; cursor: pointer; box-shadow: 1px 1px 1px #fff inset; }
        .input-tray button:active { border-style: inset; }

        /* Status Strip Footer text rule layer presets */
        .ares-statusbar { background: #ece9d8; border-top: 1px solid var(--border-dark); padding: 3px 8px; font-size: 11px; color: #555; display: flex; justify-content: space-between; }
    </style>
</head>
<body>

<div class="ares-window">
    <!-- Blue App Title Bar Frame Header -->
    <div class="title-bar">
        <span>Ares v2.5.7 Client</span>
        <div class="title-controls">
            <div>X</div>
        </div>
    </div>

    <!-- Retro Nav Bar Tab Row Array links Components -->
    <div class="ares-tabs">
        <button class="tab-btn">🔍 Search</button>
        <button class="tab-btn">📥 Transfer</button>
        <button class="tab-btn active">💬 Chat</button>
        <button class="tab-btn">🎵 Library</button>
        <button class="tab-btn">⚙️ Control Panel</button>
    </div>

    <!-- Sub Toolbar Area Ribbon Container Layer details -->
    <div class="ares-toolbar">
        <div>
            <label>Nickname: </label>
            <input type="text" id="username" value="AresUser" style="width:110px; padding:2px;">
        </div>
        <div id="connectionStatus" style="color: #008000; font-weight: bold;">Status: Online (Connected to Supernode)</div>
    </div>

    <!-- Dynamic Room Split Layout System Structure Area Grid View Component -->
    <div class="main-workspace">
        <!-- Room Hub Directory List Pane view selector panel block elements -->
        <div class="room-pane">
            <div class="pane-header">
                <span>Channels Directory</span>
                <button onclick="fetchLiveRooms()">Refresh</button>
            </div>
            <div class="room-list" id="rooms-list">
                <div style="padding:10px; text-align:center; color:#777;">Loading servers...</div>
            </div>
        </div>

        <!-- Terminal Chat Output Logs System UI Grid view display pane row box blocks -->
        <div class="chat-pane">
            <div class="chat-output" id="chat-box"></div>
            
            <!-- Message send row tray module element trigger box interface container -->
            <div class="input-tray">
                <input type="text" id="message" placeholder="Double-click a server channel link item to join..." disabled onkeypress="if(event.key==='Enter') send()">
                <button id="send-btn" onclick="send()" disabled>Send</button>
            </div>
        </div>
    </div>

    <!-- Status Strip Footer baseline component parameters wrapper -->
    <div class="ares-statusbar">
        <span>Connected Node Users: 247,912</span>
        <span>Shared Files Volume: 14.8 TB</span>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    const chatBox = document.getElementById('chat-box');
    const roomsList = document.getElementById('rooms-list');
    const connectionStatus = document.getElementById('connectionStatus');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('send-btn');

    function fetchLiveRooms() {
        roomsList.innerHTML = '<div style="padding:10px; text-align:center; color:#666;">Polling directory...</div>';
        socket.emit('get_live_channels');
    }

    socket.on('live_channels_data', (rooms) => {
        roomsList.innerHTML = '';
        rooms.forEach(room => {
            const btn = document.createElement('button');
            btn.className = 'channel-item';
            btn.innerHTML = `<span># ${room.name}</span> <span class="count">[${room.users}]</span>`;
            btn.onclick = () => connectToRoom(room.ip, room.port, room.name);
            roomsList.appendChild(btn);
        });
    });

    function connectToRoom(ip, port, name) {
        const username = document.getElementById('username').value;
        chatBox.innerHTML = ''; 
        appendMsg('System', `Negotiating network socket handshake with room [${name}]...`, 'msg-sys');
        socket.emit('connect_ares', { ip, port, username });
        
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.placeholder = `Type a message to room # ${name}...`;
        messageInput.focus();
    }

    function send() {
        const input = document.getElementById('message');
        if(input.value.trim() !== "") {
            socket.emit('send_message', input.value);
            appendMsg('You', input.value, 'msg-user');
            input.value = '';
        }
    }

    function appendMsg(user, text, className) {
        const div = document.createElement('div');
        div.className = 'msg';
        div.innerHTML = `<span class="${className || ''}">${user}:</span> ${text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    socket.on('status', (status) => connectionStatus.innerText = `Status: ${status}`);
    socket.on('chat_message', (data) => appendMsg(data.user, data.text));
    
    window.onload = fetchLiveRooms;
</script>
</body>
</html>
