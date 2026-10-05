const zlib = require('zlib');
const net = require('net');

const MAX_INPUT_LENGTH = 4096;
const MAX_INFLATED_BYTES = 64 * 1024;
const KEY = 28435;

function d67(data, b) {
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        out[i] = (data[i] ^ ((b >> 8) & 255)) & 255;
        b = (((b + data[i]) * 23219) + 36126) & 65535;
    }
    return out;
}

function e67(data, b) {
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        out[i] = (data[i] ^ (b >> 8)) & 255;
        b = ((out[i] + b) * 23219 + 36126) & 65535;
    }
    return out;
}

function validRoom(name, ip, port) {
    if (!net.isIPv4(ip)) return null;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { name, ip, port };
}

function decodePlain(hashlink) {
    const rest = hashlink.slice(9);
    const colon = rest.indexOf(':');
    if (colon < 0) return null;
    const ip = rest.slice(0, colon);
    const tail = rest.slice(colon + 1);
    const bar = tail.indexOf('|');
    if (bar < 0) return null;
    const portStr = tail.slice(0, bar);
    if (!/^\d+$/.test(portStr)) return null;
    return validRoom(tail.slice(bar + 1), ip, parseInt(portStr, 10));
}

function decodeEncrypted(hashlink) {
    const raw = Buffer.from(hashlink, 'base64');
    if (raw.length === 0) return null;
    const inflated = zlib.inflateSync(d67(raw, KEY), { maxOutputLength: MAX_INFLATED_BYTES });
    if (inflated.length < 42) return null;
    let pos = 32;
    const ip = `${inflated[pos]}.${inflated[pos + 1]}.${inflated[pos + 2]}.${inflated[pos + 3]}`;
    pos += 4;
    const port = inflated.readUInt16LE(pos);
    pos += 2;
    pos += 4;
    let end = inflated.indexOf(0, pos);
    if (end < 0) end = inflated.length;
    const name = inflated.toString('utf8', pos, end).replace(/\r\n/g, '\n');
    return validRoom(name, ip, port);
}

function decodeOnce(hashlink) {
    try {
        if (typeof hashlink !== 'string' || hashlink.length > MAX_INPUT_LENGTH) return null;
        if (hashlink.toUpperCase().startsWith('CHATROOM:')) return decodePlain(hashlink);
        return decodeEncrypted(hashlink);
    } catch (e) {
        return null;
    }
}

function decodeHashlink(input) {
    try {
        if (typeof input !== 'string') return null;
        let s = input.trim();
        s = s.replace(/^(arlnk|cb0t):\/\//i, '');
        let result = decodeOnce(s);
        if (result === null && s.endsWith('/')) result = decodeOnce(s.slice(0, -1));
        return result;
    } catch (e) {
        return null;
    }
}

function encodeHashlink({ ip, port, name }) {
    const head = Buffer.concat([Buffer.alloc(20), Buffer.from('CHATCHANNEL'), Buffer.from([0])]);
    const ipBytes = Buffer.from(ip.split('.').map(Number));
    const portBytes = Buffer.alloc(2);
    portBytes.writeUInt16LE(port);
    const payload = Buffer.concat([head, ipBytes, portBytes, ipBytes, Buffer.from(name, 'utf8'), Buffer.from([0, 0])]);
    return e67(zlib.deflateSync(payload), KEY).toString('base64');
}

module.exports = { decodeHashlink, encodeHashlink, d67, e67 };
