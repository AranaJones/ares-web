const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeLogin, encodePacket, FrameDecoder, PacketReader } = require('../server/protocol');

test('encodes an Ares frame with a little-endian payload length', () => {
  const frame = encodePacket(10, Buffer.from([0x41, 0x42]));
  assert.deepEqual(frame, Buffer.from([2, 0, 10, 0x41, 0x42]));
});

test('decodes fragmented and concatenated frames', () => {
  const decoder = new FrameDecoder();
  const first = encodePacket(31, Buffer.from('topic\0'));
  const second = encodePacket(22, Buffer.from('Nora\0'));

  assert.deepEqual(decoder.push(first.subarray(0, 2)), []);
  assert.deepEqual(decoder.push(Buffer.concat([first.subarray(2), second])), [
    { type: 31, payload: Buffer.from('topic\0') },
    { type: 22, payload: Buffer.from('Nora\0') }
  ]);
});

test('builds a login packet with the requested nickname', () => {
  const frame = encodeLogin('WebGuest');
  assert.equal(frame.readUInt16LE(0), frame.length - 3);
  assert.equal(frame[2], 2);
  assert.equal(frame.readUInt16LE(3 + 16), 0);
  assert.equal(frame[3 + 31], 'W'.charCodeAt(0));
  assert.equal(frame.subarray(3 + 31, 3 + 40).toString(), 'WebGuest\0');
});

test('reads NUL-terminated strings and rejects truncated packet fields', () => {
  const reader = new PacketReader(Buffer.from([7, 0, 0, 192, 168, 1, 4, 0]));
  assert.equal(reader.readByte(), 7);
  assert.equal(reader.readUInt16(), 0);
  assert.equal(reader.readIP(), '192.168.1.4');
  assert.equal(reader.readString(), '');
  assert.throws(() => reader.readByte(), RangeError);
});

test('rejects invalid frame types, oversized frames, and invalid nicknames', () => {
  assert.throws(() => encodePacket(256), RangeError);
  assert.throws(() => encodePacket(1, Buffer.alloc(65536)), RangeError);
  assert.throws(() => encodeLogin(''), RangeError);
  assert.throws(() => encodeLogin('x'.repeat(31)), RangeError);
});
