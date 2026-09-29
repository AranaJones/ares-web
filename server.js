const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    let aresSocket = null;

    socket.on('connect_ares', ({ ip, port, username }) => {
        // SAFETY UPGRADE: If the user is already connected to a room,
        // cleanly close the old connection before opening the new one.
        if (aresSocket && !aresSocket.destroyed) {
            aresSocket.destroy();
            console.log('Cleaned up previous active socket before room switch.');
        }

        console.log(`Connecting to ${ip}:${port} as ${username}`);
        aresSocket = new net.Socket();

        aresSocket.connect(port, ip, () => {
            socket.emit('status', 'Connected to server! Logging in...');
            aresSocket.write(`ARES_LOGIN:${username}\n`);
        });

        aresSocket.on('data', (data) => {
            socket.emit('chat_message', { user: 'Server', text: data.toString('utf8') });
        });

        aresSocket.on('close', () => socket.emit('status', 'Disconnected.'));
        aresSocket.on('error', (err) => socket.emit('status', `Error: ${err.message}`));
    });

    socket.on('send_message', (msg) => {
        if (aresSocket && !aresSocket.destroyed) {
            aresSocket.write(`${msg}\n`);
        }
    });

    socket.on('disconnect', () => {
        if (aresSocket) aresSocket.destroy();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
