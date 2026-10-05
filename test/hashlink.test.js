const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { decodeHashlink, encodeHashlink, d67, e67 } = require('../lib/hashlink');

test('plain format', () => {
    assert.deepStrictEqual(decodeHashlink('CHATROOM:1.2.3.4:54321|My Room'), { name: 'My Room', ip: '1.2.3.4', port: 54321 });
    assert.strictEqual(decodeHashlink('chatroom:1.2.3.4:80|x').port, 80);
    assert.strictEqual(decodeHashlink('ChatRoom:1.2.3.4:80|a:b|c').name, 'a:b|c');
});

test('plain rejects', () => {
    for (const s of ['CHATROOM:1.2.3.999:80|x', 'CHATROOM:1.2.3.4:65536|x', 'CHATROOM:1.2.3.4:abc|x', 'CHATROOM:1.2.3.4:80']) {
        assert.strictEqual(decodeHashlink(s), null, s);
    }
});

test('round trip', () => {
    const room = { ip: '10.20.30.40', port: 40000, name: 'Café ☕' };
    assert.deepStrictEqual(decodeHashlink(encodeHashlink(room)), room);
    const buf = Buffer.from('hello world');
    assert.deepStrictEqual(d67(e67(buf, 28435), 28435), buf);
});

test('prefixes and trailing slash', () => {
    const room = { ip: '1.2.3.4', port: 300, name: 'R' };
    const h = encodeHashlink(room);
    for (const s of ['arlnk://' + h, 'ARLNK://' + h, 'cb0t://' + h + '/', '  ' + h + '  ']) {
        assert.deepStrictEqual(decodeHashlink(s), room);
    }
});

test('garbage returns null', () => {
    const h = encodeHashlink({ ip: '1.2.3.4', port: 80, name: 'R' });
    assert.strictEqual(decodeHashlink('!!!not base64!!!'), null);
    assert.strictEqual(decodeHashlink(h.slice(0, 10)), null);
    assert.strictEqual(decodeHashlink(Buffer.from('plain text').toString('base64')), null);
    assert.strictEqual(decodeHashlink(e67(zlib.deflateSync(Buffer.alloc(10)), 28435).toString('base64')), null);
    assert.strictEqual(decodeHashlink('A'.repeat(5000)), null);
    assert.strictEqual(decodeHashlink(null), null);
});

test('socket join_hashlink', async () => {
    const { server } = require('../server');
    const { io } = require('socket.io-client');
    await new Promise((r) => server.listen(0, r));
    const client = io(`http://localhost:${server.address().port}`);
    const ask = (hashlink) => new Promise((r) => { client.once('join_hashlink_result', r); client.emit('join_hashlink', { hashlink }); });
    try {
        assert.deepStrictEqual(await ask('CHATROOM:1.2.3.4:5|Hi'), { ok: true, room: { name: 'Hi', ip: '1.2.3.4', port: 5 } });
        assert.deepStrictEqual(await ask('garbage!'), { ok: false, error: 'Invalid hashlink' });
    } finally {
        client.close();
        server.close();
    }
});
