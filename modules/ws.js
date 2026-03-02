'use strict';
// ntl:ws — WebSocket server & client (uses Node.js built-in net/http, no npm deps)
// Implements RFC 6455 WebSocket protocol natively

const http  = require('http');
const https = require('https');
const net   = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('./events');

const OPCODE = { CONTINUATION:0, TEXT:1, BINARY:2, CLOSE:8, PING:9, PONG:10 };
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const READY = { CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3 };

// ── Frame Parser ─────────────────────────────────────────────────────────────

function parseFrame(buf) {
  if (buf.length < 2) return null;
  const byte0 = buf[0], byte1 = buf[1];
  const fin    = (byte0 & 0x80) !== 0;
  const opcode = byte0 & 0x0F;
  const masked = (byte1 & 0x80) !== 0;
  let payloadLen = byte1 & 0x7F;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2); offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10;
  }

  const maskLen = masked ? 4 : 0;
  if (buf.length < offset + maskLen + payloadLen) return null;

  let payload = buf.slice(offset + maskLen, offset + maskLen + payloadLen);
  if (masked) {
    const mask = buf.slice(offset, offset + 4);
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  }

  return { fin, opcode, masked, payload, totalLen: offset + maskLen + payloadLen };
}

function buildFrame(opcode, data, mask) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data instanceof ArrayBuffer ? data : String(data));
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.allocUnsafe(2 + (mask ? 4 : 0));
    header[0] = 0x80 | opcode;
    header[1] = (mask ? 0x80 : 0) | len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4 + (mask ? 4 : 0));
    header[0] = 0x80 | opcode; header[1] = (mask ? 0x80 : 0) | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10 + (mask ? 4 : 0));
    header[0] = 0x80 | opcode; header[1] = (mask ? 0x80 : 0) | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  if (mask) {
    const m = crypto.randomBytes(4);
    const maskOffset = header.length - 4;
    m.copy(header, maskOffset);
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) masked[i] ^= m[i % 4];
    return Buffer.concat([header, masked]);
  }

  return Buffer.concat([header, payload]);
}

// ── WebSocket Connection ──────────────────────────────────────────────────────

class WebSocket extends EventEmitter {
  constructor(socket, isServer) {
    super();
    this._socket = socket;
    this._isServer = isServer;
    this._readyState = READY.OPEN;
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._pingTimer = null;
    this.id = crypto.randomBytes(8).toString('hex');

    socket.on('data', (chunk) => {
      this._buffer = Buffer.concat([this._buffer, chunk]);
      this._processFrames();
    });

    socket.on('close', () => {
      this._readyState = READY.CLOSED;
      this.emit('close', 1000, 'Connection closed');
    });

    socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  get readyState() { return this._readyState; }
  get isOpen()     { return this._readyState === READY.OPEN; }

  send(data, options) {
    if (this._readyState !== READY.OPEN) return false;
    options = options || {};
    const isBuffer = Buffer.isBuffer(data) || data instanceof ArrayBuffer;
    const opcode = options.binary || isBuffer ? OPCODE.BINARY : OPCODE.TEXT;
    const payload = isBuffer ? (Buffer.isBuffer(data) ? data : Buffer.from(data)) : String(data);
    try {
      this._socket.write(buildFrame(opcode, payload, !this._isServer));
      return true;
    } catch { return false; }
  }

  sendJSON(data) { return this.send(JSON.stringify(data)); }
  sendBinary(buf){ return this.send(buf, { binary: true }); }

  ping(data) {
    if (this._readyState !== READY.OPEN) return;
    this._socket.write(buildFrame(OPCODE.PING, data || ''));
  }

  close(code, reason) {
    if (this._readyState !== READY.OPEN) return;
    this._readyState = READY.CLOSING;
    const codeBuf = Buffer.allocUnsafe(2);
    codeBuf.writeUInt16BE(code || 1000, 0);
    const reasonBuf = reason ? Buffer.from(reason) : Buffer.alloc(0);
    this._socket.write(buildFrame(OPCODE.CLOSE, Buffer.concat([codeBuf, reasonBuf])));
    this._socket.end();
  }

  _processFrames() {
    while (this._buffer.length >= 2) {
      const frame = parseFrame(this._buffer);
      if (!frame) break;
      this._buffer = this._buffer.slice(frame.totalLen);

      switch (frame.opcode) {
        case OPCODE.TEXT:
        case OPCODE.BINARY:
        case OPCODE.CONTINUATION:
          if (frame.opcode !== OPCODE.CONTINUATION) {
            this._fragments = [{ opcode: frame.opcode, payload: frame.payload }];
          } else {
            this._fragments.push({ opcode: frame.opcode, payload: frame.payload });
          }
          if (frame.fin) {
            const full = Buffer.concat(this._fragments.map(f => f.payload));
            const isText = this._fragments[0].opcode === OPCODE.TEXT;
            this._fragments = [];
            if (isText) {
              const msg = full.toString('utf8');
              let parsed = msg;
              try { parsed = JSON.parse(msg); } catch {}
              this.emit('message', parsed, msg, false);
            } else {
              this.emit('message', full, full, true);
            }
          }
          break;
        case OPCODE.PING:
          this._socket.write(buildFrame(OPCODE.PONG, frame.payload));
          this.emit('ping', frame.payload);
          break;
        case OPCODE.PONG:
          this.emit('pong', frame.payload);
          break;
        case OPCODE.CLOSE:
          const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1000;
          const reason = frame.payload.length > 2 ? frame.payload.slice(2).toString() : '';
          if (this._readyState === READY.OPEN) this.close(code, reason);
          this._readyState = READY.CLOSED;
          this.emit('close', code, reason);
          break;
      }
    }
  }

  startHeartbeat(intervalMs, timeoutMs) {
    intervalMs = intervalMs || 30000;
    timeoutMs = timeoutMs || 10000;
    let pongTimeout;
    this._pingTimer = setInterval(() => {
      if (!this.isOpen) { clearInterval(this._pingTimer); return; }
      this.ping();
      pongTimeout = setTimeout(() => {
        if (this.isOpen) { this.close(1001, 'Ping timeout'); }
      }, timeoutMs);
    }, intervalMs);
    this.on('pong', () => { if (pongTimeout) clearTimeout(pongTimeout); });
    return this;
  }
}

// ── WebSocket Server ──────────────────────────────────────────────────────────

class WebSocketServer extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this._clients = new Map();
    this._rooms = new Map();
    this._path = options.path || '/';
    this._onUpgrade = null;
  }

  handleUpgrade(req, socket, head, callback) {
    const key = req.headers['sec-websocket-key'];
    if (!key || req.headers['upgrade'] !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    const protocol = req.headers['sec-websocket-protocol'] || '';
    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      ...(protocol ? [`Sec-WebSocket-Protocol: ${protocol.split(',')[0].trim()}`] : []),
      '', ''
    ].join('\r\n');

    socket.write(headers);
    const ws = new WebSocket(socket, true);
    ws._req = req;
    ws.ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    ws.path = req.url;
    ws.query = new URLSearchParams(req.url.split('?')[1] || '').entries()
      ? Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || '')) : {};

    this._clients.set(ws.id, ws);
    ws.on('close', () => {
      this._clients.delete(ws.id);
      for (const room of this._rooms.values()) room.delete(ws.id);
      this.emit('disconnect', ws);
    });

    if (callback) callback(ws, req);
    this.emit('connection', ws, req);
  }

  attach(server) {
    server.on('upgrade', (req, socket, head) => {
      const url = req.url.split('?')[0];
      if (this._path !== '/' && url !== this._path) {
        socket.destroy(); return;
      }
      this.handleUpgrade(req, socket, head);
    });
    return this;
  }

  broadcast(data, exclude) {
    for (const [id, ws] of this._clients) {
      if (exclude && (id === exclude || (exclude.id && id === exclude.id))) continue;
      ws.send(data);
    }
  }

  broadcastJSON(data, exclude) {
    this.broadcast(JSON.stringify(data), exclude);
  }

  join(ws, room) {
    if (!this._rooms.has(room)) this._rooms.set(room, new Set());
    this._rooms.get(room).add(ws.id);
    return this;
  }

  leave(ws, room) {
    const r = this._rooms.get(room);
    if (r) r.delete(ws.id);
    return this;
  }

  to(room) {
    const ids = this._rooms.get(room) || new Set();
    const clients = [...ids].map(id => this._clients.get(id)).filter(Boolean);
    return {
      send: (data) => clients.forEach(ws => ws.send(data)),
      sendJSON: (data) => clients.forEach(ws => ws.sendJSON(data)),
      emit: (event, data) => clients.forEach(ws => ws.sendJSON({ event, data })),
      size: clients.length
    };
  }

  get size()    { return this._clients.size; }
  get clients() { return [...this._clients.values()]; }

  get(id) { return this._clients.get(id) || null; }
}

// ── WebSocket Client ──────────────────────────────────────────────────────────

class WebSocketClient extends EventEmitter {
  constructor(url, options) {
    super();
    options = options || {};
    this._url = url;
    this._options = options;
    this._ws = null;
    this._reconnect = options.reconnect !== false;
    this._reconnectDelay = options.reconnectDelay || 2000;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this._connecting = false;
  }

  connect() {
    if (this._connecting || (this._ws && this._ws.isOpen)) return this;
    this._connecting = true;
    const url = new URL(this._url);
    const isSecure = url.protocol === 'wss:';
    const port = url.port || (isSecure ? 443 : 80);
    const key = crypto.randomBytes(16).toString('base64');

    const options = {
      hostname: url.hostname, port: parseInt(port),
      path: url.pathname + url.search,
      headers: Object.assign({
        'Upgrade': 'websocket', 'Connection': 'Upgrade',
        'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13',
        'Host': url.host
      }, this._options.headers || {})
    };

    const transport = isSecure ? https : http;
    const req = transport.request(options);
    req.on('upgrade', (res, socket) => {
      this._connecting = false;
      this._reconnectAttempts = 0;
      this._ws = new WebSocket(socket, false);
      this._ws.on('message', (...args) => this.emit('message', ...args));
      this._ws.on('close', (code, reason) => {
        this.emit('close', code, reason);
        if (this._reconnect && this._reconnectAttempts < this._maxReconnectAttempts) {
          this._reconnectAttempts++;
          setTimeout(() => this.connect(), this._reconnectDelay * this._reconnectAttempts);
        }
      });
      this._ws.on('error', (err) => this.emit('error', err));
      this._ws.on('ping', () => this.emit('ping'));
      this._ws.on('pong', () => this.emit('pong'));
      this.emit('open');
    });
    req.on('error', (err) => {
      this._connecting = false;
      this.emit('error', err);
      if (this._reconnect && this._reconnectAttempts < this._maxReconnectAttempts) {
        this._reconnectAttempts++;
        setTimeout(() => this.connect(), this._reconnectDelay * this._reconnectAttempts);
      }
    });
    req.end();
    return this;
  }

  send(data)     { return this._ws ? this._ws.send(data) : false; }
  sendJSON(data) { return this._ws ? this._ws.sendJSON(data) : false; }
  close(code, reason) { if (this._ws) { this._reconnect = false; this._ws.close(code, reason); } }
  get isOpen()   { return this._ws ? this._ws.isOpen : false; }
}

module.exports = { WebSocket, WebSocketServer, WebSocketClient, READY, OPCODE };
