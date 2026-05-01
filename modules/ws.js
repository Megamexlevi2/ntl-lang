'use strict';

// ntl:ws — WebSocket server and client with rooms, namespaces, and heartbeat
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const http   = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('./events');

const WS_GUID  = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OPCODES  = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xA };
const STATE    = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function encodeFrame(data, opcode, mask) {
  const isBuf  = Buffer.isBuffer(data);
  const payload = isBuf ? data : Buffer.from(String(data), 'utf-8');
  const len    = payload.length;
  const frame  = [];

  frame.push(0x80 | opcode);

  if (len < 126)       frame.push(mask ? 0x80 | len : len);
  else if (len < 65536){ frame.push(mask ? 0xFE : 0x7E); frame.push((len >> 8) & 0xFF); frame.push(len & 0xFF); }
  else {
    frame.push(mask ? 0xFF : 0x7F);
    for (let i = 7; i >= 0; i--) frame.push((len / Math.pow(256, i)) & 0xFF);
  }

  if (mask) {
    const maskKey = crypto.randomBytes(4);
    frame.push(...maskKey);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ maskKey[i % 4];
    return Buffer.concat([Buffer.from(frame), masked]);
  }

  return Buffer.concat([Buffer.from(frame), payload]);
}

function decodeFrames(data) {
  const frames = [];
  let offset   = 0;

  while (offset < data.length) {
    if (data.length - offset < 2) break;
    const b0     = data[offset];
    const b1     = data[offset + 1];
    const fin    = !!(b0 & 0x80);
    const opcode = b0 & 0x0F;
    const masked = !!(b1 & 0x80);
    let len      = b1 & 0x7F;
    offset      += 2;

    if (len === 126)      { len = data.readUInt16BE(offset); offset += 2; }
    else if (len === 127) { len = Number(data.readBigUInt64BE(offset)); offset += 8; }

    let maskKey = null;
    if (masked) { maskKey = data.slice(offset, offset + 4); offset += 4; }

    if (data.length - offset < len) break;
    let payload = data.slice(offset, offset + len);
    offset += len;

    if (masked && maskKey) {
      const unmasked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
      payload = unmasked;
    }

    frames.push({ fin, opcode, payload });
  }

  return { frames, remaining: data.slice(offset) };
}

class WebSocket extends EventEmitter {
  constructor(socket, opts) {
    super();
    this._socket    = socket;
    this._state     = STATE.OPEN;
    this._buffer    = Buffer.alloc(0);
    this._fragments = [];
    this.id         = crypto.randomUUID();
    this.rooms      = new Set();
    this._pingTimer = null;
    this._metadata  = {};

    socket.on('data', (data) => this._onData(data));
    socket.on('close', () => { this._state = STATE.CLOSED; this.emit('close'); });
    socket.on('error', (e) => this.emit('error', e));

    if (opts && opts.heartbeat) {
      this._pingTimer = setInterval(() => this.ping(), opts.heartbeatInterval || 30000);
    }
  }

  get readyState() { return this._state; }
  get OPEN()       { return STATE.OPEN; }
  get CLOSED()     { return STATE.CLOSED; }

  send(data, cb) {
    if (this._state !== STATE.OPEN) { if (cb) cb(new Error('WebSocket is not open')); return; }
    const opcode = Buffer.isBuffer(data) ? OPCODES.binary : OPCODES.text;
    try {
      this._socket.write(encodeFrame(data, opcode, false), cb);
    } catch(e) {
      if (cb) cb(e);
      else this.emit('error', e);
    }
    return this;
  }

  sendJSON(data) { return this.send(JSON.stringify(data)); }

  ping(data) {
    if (this._state !== STATE.OPEN) return;
    try { this._socket.write(encodeFrame(data || '', OPCODES.ping, false)); } catch(_) {}
  }

  close(code, reason) {
    if (this._state !== STATE.OPEN) return;
    this._state = STATE.CLOSING;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code || 1000);
    const reasonBuf = reason ? Buffer.from(reason, 'utf-8') : Buffer.alloc(0);
    try { this._socket.write(encodeFrame(Buffer.concat([payload, reasonBuf]), OPCODES.close, false)); }
    catch(_) {}
    setTimeout(() => { try { this._socket.destroy(); } catch(_) {} }, 100);
  }

  terminate() {
    this._state = STATE.CLOSED;
    if (this._pingTimer) clearInterval(this._pingTimer);
    try { this._socket.destroy(); } catch(_) {}
  }

  set(key, value) { this._metadata[key] = value; return this; }
  get(key)        { return this._metadata[key]; }
  data(obj)       { Object.assign(this._metadata, obj); return this; }

  _onData(data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    const { frames, remaining } = decodeFrames(this._buffer);
    this._buffer = remaining;

    for (const frame of frames) {
      switch (frame.opcode) {
        case OPCODES.text:
        case OPCODES.binary:
          if (frame.fin && this._fragments.length === 0) {
            const msg = frame.opcode === OPCODES.text ? frame.payload.toString('utf-8') : frame.payload;
            this.emit('message', msg, frame.opcode === OPCODES.binary);
          } else {
            this._fragments.push(frame.payload);
            if (frame.fin) {
              const full = Buffer.concat(this._fragments);
              this._fragments = [];
              this.emit('message', frame.opcode === OPCODES.text ? full.toString('utf-8') : full, frame.opcode === OPCODES.binary);
            }
          }
          break;
        case OPCODES.ping:
          try { this._socket.write(encodeFrame(frame.payload, OPCODES.pong, false)); } catch(_) {}
          this.emit('ping', frame.payload);
          break;
        case OPCODES.pong:
          this.emit('pong', frame.payload);
          break;
        case OPCODES.close: {
          const code   = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1000;
          const reason = frame.payload.length > 2  ? frame.payload.slice(2).toString('utf-8') : '';
          this._state = STATE.CLOSING;
          try { this._socket.write(encodeFrame(frame.payload.slice(0, 2), OPCODES.close, false)); } catch(_) {}
          setTimeout(() => { this._socket.destroy(); }, 10);
          this.emit('close', code, reason);
          break;
        }
      }
    }
  }
}

class WebSocketServer extends EventEmitter {
  constructor(opts) {
    super();
    opts          = opts || {};
    this.clients  = new Set();
    this._rooms   = new Map();
    this._server  = opts.server;
    this._noServer = opts.noServer || false;
    this._opts    = opts;

    if (this._server) {
      this._server.on('upgrade', (req, socket, head) => this._handleUpgrade(req, socket, head));
    } else if (!this._noServer) {
      this._httpServer = http.createServer();
      this._httpServer.on('upgrade', (req, socket, head) => this._handleUpgrade(req, socket, head));
    }
  }

  handleUpgrade(req, socket, head) { this._handleUpgrade(req, socket, head); }

  _handleUpgrade(req, socket, head) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const accept  = acceptKey(key);
    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
    ];

    if (req.headers['sec-websocket-protocol']) {
      const protocols  = req.headers['sec-websocket-protocol'].split(',').map(s => s.trim());
      const selected   = this._opts.handleProtocols ? this._opts.handleProtocols(protocols, req) : protocols[0];
      if (selected) headers.push(`Sec-WebSocket-Protocol: ${selected}`);
    }

    socket.write(headers.join('\r\n') + '\r\n\r\n');

    const ws = new WebSocket(socket, this._opts);
    ws.req   = req;
    ws.url   = req.url;
    ws.ip    = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || '::1';

    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
      for (const room of ws.rooms) this._leaveRoom(ws, room);
    });

    this.emit('connection', ws, req);
  }

  listen(port, host, cb) {
    if (typeof host === 'function') { cb = host; host = '0.0.0.0'; }
    if (!this._httpServer) this._httpServer = http.createServer();
    this._httpServer.on('upgrade', (req, socket, head) => this._handleUpgrade(req, socket, head));
    this._httpServer.listen(port, host || '0.0.0.0', cb || (() => {}));
    return this._httpServer;
  }

  close(cb) {
    this.clients.forEach(c => c.terminate());
    if (this._httpServer) this._httpServer.close(cb);
    else if (cb) cb();
  }

  broadcast(data, filter) {
    for (const client of this.clients) {
      if (client.readyState === STATE.OPEN) {
        if (!filter || filter(client)) client.send(data);
      }
    }
  }

  broadcastJSON(data, filter) {
    const str = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === STATE.OPEN) {
        if (!filter || filter(client)) client.send(str);
      }
    }
  }

  join(ws, room) {
    ws.rooms.add(room);
    if (!this._rooms.has(room)) this._rooms.set(room, new Set());
    this._rooms.get(room).add(ws);
  }

  leave(ws, room)    { this._leaveRoom(ws, room); }
  _leaveRoom(ws, room) {
    ws.rooms.delete(room);
    const r = this._rooms.get(room);
    if (r) { r.delete(ws); if (!r.size) this._rooms.delete(room); }
  }

  to(room) {
    const clients = this._rooms.get(room) || new Set();
    return {
      emit:      (data) => { for (const c of clients) if (c.readyState === STATE.OPEN) c.send(data); },
      emitJSON:  (data) => { const str = JSON.stringify(data); for (const c of clients) if (c.readyState === STATE.OPEN) c.send(str); },
      clients:   () => [...clients],
      size:      () => clients.size,
    };
  }

  rooms()  { return [...this._rooms.keys()]; }
  roomOf(name) { return this._rooms.get(name) || new Set(); }
}

function createServer(opts) { return new WebSocketServer(opts || {}); }

module.exports = {
  WebSocket, WebSocketServer, createServer,
  OPEN: STATE.OPEN, CLOSED: STATE.CLOSED, CONNECTING: STATE.CONNECTING, CLOSING: STATE.CLOSING,
};
