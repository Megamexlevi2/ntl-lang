'use strict';
// ntl:mail — Send emails via SMTP (no npm dependencies, pure Node.js)

const net   = require('net');
const tls   = require('tls');
const dns   = require('dns');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);

function encodeMimeHeader(str) {
  if (!/[^\x00-\x7E]/.test(str)) return str;
  return `=?UTF-8?B?${Buffer.from(str).toString('base64')}?=`;
}

function buildMime(options) {
  const from    = options.from;
  const to      = Array.isArray(options.to) ? options.to : [options.to];
  const cc      = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
  const bcc     = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];
  const subject = options.subject || '';
  const text    = options.text || '';
  const html    = options.html || '';
  const replyTo = options.replyTo || null;
  const id      = `<${Date.now()}.${Math.random().toString(36).slice(2)}@ntl-lang>`;

  let mime = `From: ${encodeMimeHeader(from)}\r\n`;
  mime += `To: ${to.map(encodeMimeHeader).join(', ')}\r\n`;
  if (cc.length)    mime += `Cc: ${cc.map(encodeMimeHeader).join(', ')}\r\n`;
  if (replyTo)      mime += `Reply-To: ${encodeMimeHeader(replyTo)}\r\n`;
  mime += `Subject: ${encodeMimeHeader(subject)}\r\n`;
  mime += `Message-ID: ${id}\r\n`;
  mime += `Date: ${new Date().toUTCString()}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;
  mime += `X-Mailer: ntl-lang/2.0\r\n`;

  if (html && text) {
    const boundary = `ntl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    mime += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    mime += `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${text}\r\n`;
    mime += `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${html}\r\n`;
    mime += `--${boundary}--\r\n`;
  } else if (html) {
    mime += `Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
    mime += Buffer.from(html).toString('base64').match(/.{1,76}/g).join('\r\n') + '\r\n';
  } else {
    mime += `Content-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n`;
  }

  return { mime, to, cc, bcc, all: [...to, ...cc, ...bcc] };
}

class SMTPClient {
  constructor(options) {
    options = options || {};
    this.host     = options.host || 'localhost';
    this.port     = options.port || (options.secure ? 465 : 587);
    this.secure   = options.secure || false;
    this.user     = options.user || options.auth?.user || '';
    this.pass     = options.pass || options.auth?.pass || '';
    this.timeout  = options.timeout || 10000;
    this.from     = options.from || '';
    this.name     = options.name || 'ntl-lang';
    this._pool    = [];
    this._poolSize = options.poolSize || 1;
  }

  async _connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`SMTP connection timeout to ${this.host}:${this.port}`)), this.timeout);
      const socket = this.secure
        ? tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false })
        : net.connect({ host: this.host, port: this.port });

      const conn = { socket, buffer: '', ready: false };
      const send = (cmd) => new Promise((res, rej) => {
        conn._pending = { resolve: res, reject: rej };
        socket.write(cmd + '\r\n');
      });

      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        conn.buffer += chunk;
        const lines = conn.buffer.split('\r\n');
        conn.buffer = lines.pop();
        for (const line of lines) {
          if (conn._pending && /^\d{3}[ \-]/.test(line)) {
            const code = parseInt(line.slice(0, 3));
            if (code >= 400) { conn._pending.reject(new Error(`SMTP ${code}: ${line.slice(4)}`)); }
            else if (!line.slice(3).startsWith('-')) { conn._pending.resolve({ code, message: line.slice(4) }); }
            if (!line.slice(3).startsWith('-')) conn._pending = null;
          }
        }
      });

      socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
      socket.once('connect', async () => {
        clearTimeout(timeout);
        try {
          await new Promise(res => { conn._pending = { resolve: res, reject }; });
          await send(`EHLO ${this.name}`);
          if (!this.secure && this.port === 587) {
            await send('STARTTLS');
            const tlsSocket = tls.connect({ socket, rejectUnauthorized: false });
            await new Promise(res => tlsSocket.once('secureConnect', res));
            conn.socket = tlsSocket;
            tlsSocket.setEncoding('utf8');
            tlsSocket.on('data', socket.listeners('data')[0]);
            tlsSocket.on('error', socket.listeners('error')[0]);
            await send(`EHLO ${this.name}`);
          }
          if (this.user && this.pass) {
            await send('AUTH LOGIN');
            await send(Buffer.from(this.user).toString('base64'));
            await send(Buffer.from(this.pass).toString('base64'));
          }
          resolve(Object.assign(conn, { send }));
        } catch (err) { reject(err); }
      });
    });
  }

  async send(options) {
    const { mime, all } = buildMime(Object.assign({ from: this.from }, options));
    const conn = await this._connect();
    const from = (options.from || this.from).replace(/^.*<|>.*$/g, '') || (options.from || this.from);
    try {
      await conn.send(`MAIL FROM:<${from}>`);
      for (const rcpt of all) {
        const addr = rcpt.replace(/^.*<|>.*$/g, '') || rcpt;
        await conn.send(`RCPT TO:<${addr}>`);
      }
      await conn.send('DATA');
      conn.socket.write(mime + '\r\n.\r\n');
      await new Promise(res => { conn._pending = { resolve: res, reject: console.error }; });
      await conn.send('QUIT');
    } finally {
      conn.socket.destroy();
    }
    return { accepted: all, messageId: mime.match(/Message-ID: (<[^>]+>)/)?.[1] };
  }

  // Helper: send a template email
  async template(to, subject, html, data) {
    let body = html;
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        body = body.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v);
      }
    }
    return this.send({ to, subject, html: body });
  }
}

// ── Fake transport (for tests/dev) ───────────────────────────────────────────

class FakeTransport {
  constructor() { this.sent = []; }
  async send(options) {
    const msg = Object.assign({ sentAt: new Date() }, options);
    this.sent.push(msg);
    console.log(`[ntl:mail] FAKE SEND: To=${Array.isArray(options.to)?options.to.join(','):options.to} Subject="${options.subject}"`);
    return { accepted: [options.to].flat(), messageId: `fake-${Date.now()}` };
  }
  clear() { this.sent = []; return this; }
  last()  { return this.sent[this.sent.length - 1] || null; }
}

function createTransport(options) {
  if (!options || options.fake || options.debug) return new FakeTransport();
  return new SMTPClient(options);
}

module.exports = { SMTPClient, FakeTransport, createTransport };
