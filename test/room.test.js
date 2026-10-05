const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { io: client } = require('socket.io-client');
const { server, io } = require('../server');

test('index.html script is valid JS', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  new Function(m[1]);
});

test('room list, join and chat work end-to-end', async () => {
  await new Promise(r => server.listen(0, r));
  const c = client(`http://localhost:${server.address().port}`);
  const rooms = await new Promise(r => { c.on('node_list_update', r); c.emit('request_nodes'); });
  assert.strictEqual(rooms[0].name, 'Lobby');
  const msg = new Promise(r => c.on('chat_message', m => m.username === 'Bob' && r(m)));
  c.emit('join_room', { room: 'Lobby', username: 'Bob' });
  await new Promise(r => setTimeout(r, 100));
  c.emit('chat_message', { room: 'Lobby', text: 'hi' });
  assert.strictEqual((await msg).text, 'hi');
  c.close(); io.close();
});
