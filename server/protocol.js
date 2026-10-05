const { randomUUID } = require('node:crypto');

const MAX_PACKET_LENGTH = 65535;

function encodePacket(type, payload = Buffer.alloc(0)) {
    if (!Number.isInteger(type) || type < 0 || type > 255) {
        throw new RangeError('Packet type must be an unsigned byte.');
    }
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    if (body.length > MAX_PACKET_LENGTH) {
        throw new RangeError('Packet payload exceeds the Ares frame limit.');
    }
    const frame = Buffer.allocUnsafe(body.length + 3);
    frame.writeUInt16LE(body.length, 0);
    frame[2] = type;
    body.copy(frame, 3);
    return frame;
}

function encodeGuid() {
    const uuid = Buffer.from(randomUUID().replaceAll('-', ''), 'hex');
    return Buffer.concat([
        uuid.subarray(0, 4).reverse(),
        uuid.subarray(4, 6).reverse(),
        uuid.subarray(6, 8).reverse(),
        uuid.subarray(8)
    ]);
}

function encodeLogin(nickname) {
    const nick = Buffer.from(nickname, 'utf8');
    if (!nick.length || nick.length > 30 || nick.includes(0)) {
        throw new RangeError('Nickname must be 1–30 UTF-8 bytes and contain no NUL byte.');
    }
    const appName = Buffer.from('Ares Web 1.0\0', 'utf8');
    const region = Buffer.from([0]);
    const payload = Buffer.concat([
        encodeGuid(),
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0]),
        nick, Buffer.from([0]),
        appName,
        Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0]),
        region,
        Buffer.from([0])
    ]);
    return encodePacket(2, payload);
}

class FrameDecoder {
    constructor() {
        this.buffer = Buffer.alloc(0);
    }

    push(chunk) {
        this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
        const packets = [];
        while (this.buffer.length >= 3) {
            const length = this.buffer.readUInt16LE(0);
            const frameLength = length + 3;
            if (this.buffer.length < frameLength) break;
            packets.push({
                type: this.buffer[2],
                payload: this.buffer.subarray(3, frameLength)
            });
            this.buffer = this.buffer.subarray(frameLength);
        }
        return packets;
    }
}

class PacketReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    get remaining() {
        return this.buffer.length - this.offset;
    }

    ensure(size) {
        if (!Number.isInteger(size) || size < 0 || size > this.remaining) {
            throw new RangeError('Packet ended before all fields were read.');
        }
    }

    readByte() {
        this.ensure(1);
        return this.buffer[this.offset++];
    }

    readUInt16() {
        this.ensure(2);
        const value = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    readIP() {
        this.ensure(4);
        const value = [...this.buffer.subarray(this.offset, this.offset + 4)].join('.');
        this.offset += 4;
        return value;
    }

    readString() {
        const terminator = this.buffer.indexOf(0, this.offset);
        const end = terminator === -1 ? this.buffer.length : terminator;
        const value = this.buffer.toString('utf8', this.offset, end);
        this.offset = terminator === -1 ? end : end + 1;
        return value.replace(/\r\n/g, '\n');
    }

    skip(size) {
        this.ensure(size);
        this.offset += size;
    }
}

module.exports = { encodePacket, encodeLogin, FrameDecoder, PacketReader };
