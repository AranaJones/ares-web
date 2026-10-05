const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const axios = require('axios');
const { io: connect } = require('socket.io-client');

axios.get = async () => ({ data: Buffer.from([1, 2, 3, 4, 0x1f, 0x90]) });
const { server } = require('../server');

test('index.html inline script is syntactically valid', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length > 0);
    scripts.forEach(m => new vm.Script(m[1]));
});

test('frontend and backend use matching event names', async () => {
    await new Promise(r => server.listen(0, r));
    const client = connect(`http://localhost:${server.address().port}`);
    const rooms = await new Promise((resolve, reject) => {
        client.on('connect_error', reject);
        client.on('live_channels_data', resolve);
        client.on('connect', () => client.emit('get_live_channels'));
    });
    assert.deepStrictEqual(rooms.map(r => [r.ip, r.port]), [['1.2.3.4', 8080]]);
    client.close();
    const { io } = require('../server');
    io.close();
});
