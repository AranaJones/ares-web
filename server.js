const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');
const dgram = require('dgram'); // Used for Ares UDP room list polling

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Hardcoded reliable Ares bootstrap nodes to poll for live rooms
const ARES_CNODES = [
    { ip: '209.190.4.10', port: 25192 },
    { ip: '64.34.163.66', port: 25192 }
];

io.on('connection', (socket) => {
    let aresSocket = null;

    // Fetch and send live channels when user requests them
    socket.on('get_live_channels', () => {
        const client = dgram.createSocket('udp4');
        
        // Protocol packet payload requesting the active room directory
        // Real Ares emulators (like sb0t/ib0t) send standard buffer signals
        const requestPacket = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x03]); 

        ARES_CNODES.forEach(node => {
            client.send(requestPacket, node.port, node.ip, (err) => {
                if (err) console.log(`Failed to fetch from bootstrap node: ${err.message}`);
            });
        });

        client.on('message', (msg) => {
            try {
                // This is a mockup parser. The true Ares packet unpacker loops over 
                // the raw UDP buffer to split out room names, IPs, ports, and user counts.
                const mockRooms = [
                    { name: "★ Official English Lobby ★", ip: "208.64.120.4", port: "47624", users: 42 },
                    { name: "🎵 Alternative Rock Cafe", ip: "67.212.180.14", port: "3112", users: 19 },
                    { name: "💻 Tech Support & Coding", ip: "185.220.101.5", port: "47624", users: 11 }
                ];
                socket.emit('live_channels_data', mockRooms);
                client.close();
            } catch (e) {
                if (!client.destroyed) client.close();
            }
        });

        // Timeout fallback if the Ares supernodes don't answer within 4 seconds
        setTimeout(() => {
            try { client.close(); } catch(e){}
        }, 4000);
    });

    socket.on('connect_ares', ({ ip, port, username }) => {
        if (aresSocket && !aresSocket.destroyed) {
            aresSocket.destroy();
        }

        console.log(`Connecting to ${ip}:${port} as ${username}`);
        aresSocket = new net.Socket();

        aresSocket.connect(port, ip, () => {
            socket.emit('status', 'Connected! Logging in...');
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
