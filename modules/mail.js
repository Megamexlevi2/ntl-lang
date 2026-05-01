'use strict';

// ntl:mail — SMTP email client with attachments, templates, and retry support
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const net    = require('net');
const tls    = require('tls');
const crypto = require('crypto');

class SMTPError extends Error {
  constructor(msg, code) { super(msg); this.name = 'SMTPError'; this.code = code; }
}

function b64(s)    { return Buffer.from(s, 'utf-8').toString('base64'); }
function mime(s)   { return '=?UTF-8?B?' + b64(s) + '?='; }
function needsMime(s) { return /[^\x00-\x7E]/.test(s); }
function encodeHeader(s) { return needsMime(s) ? mime(s) : s; }

function buildMessage(opts) {
  const boundary = `ntl_${crypto.randomBytes(12).toString('hex')}`;
  const hasAttachments = opts.attachments && opts.attachments.length > 0;
  const hasAlt         = opts.html && opts.text;
  const lines          = [];

  const from = opts.from || 'noreply@ntl-app.local';
  const to   = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;

  lines.push(`From: ${encodeHeader(from)}`);
  lines.push(`To: ${encodeHeader(to)}`);
  if (opts.cc)      lines.push(`Cc: ${Array.isArray(opts.cc)  ? opts.cc.join(', ')  : opts.cc}`);
  if (opts.bcc)     lines.push(`Bcc: ${Array.isArray(opts.bcc) ? opts.bcc.join(', ') : opts.bcc}`);
  lines.push(`Subject: ${encodeHeader(opts.subject || '')}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`Message-ID: <${crypto.randomUUID()}@ntl>`);
  if (opts.replyTo) lines.push(`Reply-To: ${opts.replyTo}`);
  for (const [k, v] of Object.entries(opts.headers || {})) lines.push(`${k}: ${v}`);

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    if (hasAlt) {
      const altBoundary = `ntl_alt_${crypto.randomBytes(8).toString('hex')}`;
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(b64(opts.text || ''));
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(b64(opts.html));
      lines.push(`--${altBoundary}--`);
    } else if (opts.html) {
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(b64(opts.html));
    } else {
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset=UTF-8');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(b64(opts.text || ''));
    }
    for (const att of opts.attachments) {
      const filename  = att.filename || 'attachment';
      const content   = att.content;
      const ctype     = att.contentType || guessMime(filename);
      const cid       = att.cid;
      const inline    = att.inline || !!cid;
      const data      = Buffer.isBuffer(content) ? content.toString('base64') : b64(String(content));
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${ctype}; name="${encodeHeader(filename)}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push(`Content-Disposition: ${inline ? 'inline' : 'attachment'}; filename="${encodeHeader(filename)}"`);
      if (cid) lines.push(`Content-Id: <${cid}>`);
      lines.push('');
      lines.push(data);
    }
    lines.push(`--${boundary}--`);
  } else if (hasAlt) {
    const altBoundary = `ntl_alt_${crypto.randomBytes(8).toString('hex')}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push('');
    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(b64(opts.text || ''));
    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(b64(opts.html));
    lines.push(`--${altBoundary}--`);
  } else if (opts.html) {
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(b64(opts.html));
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(b64(opts.text || ''));
  }

  return lines.join('\r\n');
}

function guessMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', txt: 'text/plain', html: 'text/html',
    csv: 'text/csv', json: 'application/json', zip: 'application/zip',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mp4: 'video/mp4', mp3: 'audio/mpeg', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function smtpDialog(socket, config, envelope, message) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let step = 0;
    const recipients = [...(Array.isArray(envelope.to) ? envelope.to : [envelope.to])];
    if (envelope.cc)  recipients.push(...(Array.isArray(envelope.cc)  ? envelope.cc  : [envelope.cc]));
    if (envelope.bcc) recipients.push(...(Array.isArray(envelope.bcc) ? envelope.bcc : [envelope.bcc]));
    let rcptIdx = 0;

    const send = (line) => {
      socket.write(line + '\r\n');
    };

    const onLine = (line) => {
      if (line.length < 4) return;
      const code = parseInt(line.slice(0, 3));
      const ok   = code >= 200 && code < 400;

      if (!ok && code !== 334) {
        return reject(new SMTPError(`SMTP error: ${line}`, code));
      }

      switch(step) {
        case 0: // greeting
          send(`EHLO ntl-mailer`);
          step++;
          break;
        case 1: // EHLO response — may be multi-line
          if (line[3] === '-') break; // continue reading
          if (config.auth) {
            send('AUTH LOGIN');
            step++;
          } else {
            send(`MAIL FROM:<${envelope.from}>`);
            step = 3;
          }
          break;
        case 2: // AUTH LOGIN challenge
          if (code === 334) {
            const prompt = Buffer.from(line.slice(4), 'base64').toString('utf-8').toLowerCase();
            if (prompt.includes('user') || prompt.includes('name')) send(b64(config.auth.user));
            else send(b64(config.auth.pass));
          } else if (code === 235) {
            send(`MAIL FROM:<${envelope.from}>`);
            step++;
          }
          break;
        case 3: // MAIL FROM ack
          send(`RCPT TO:<${recipients[rcptIdx++]}>`);
          step++;
          break;
        case 4: // RCPT TO acks
          if (rcptIdx < recipients.length) {
            send(`RCPT TO:<${recipients[rcptIdx++]}>`);
          } else {
            send('DATA');
            step++;
          }
          break;
        case 5: // DATA start
          send(message + '\r\n.');
          step++;
          break;
        case 6: // DATA ack
          send('QUIT');
          step++;
          break;
        case 7: // QUIT
          socket.end();
          resolve({ accepted: recipients, messageId: `<${Date.now()}@ntl>` });
          break;
      }
    };

    socket.on('data', (data) => {
      buffer += data.toString('utf-8');
      const lines = buffer.split('\r\n');
      buffer = lines.pop();
      for (const line of lines) if (line) onLine(line);
    });
    socket.on('error', reject);
    socket.on('close', () => { if (step < 7) reject(new SMTPError('Connection closed unexpectedly')); });
  });
}

function createMailer(config) {
  config = config || {};
  const host = config.host || 'localhost';
  const port = config.port || (config.secure ? 465 : 587);

  async function send(opts) {
    const message  = buildMessage(opts);
    const from     = opts.from || config.from || 'noreply@ntl-app.local';
    const envelope = { from, to: opts.to, cc: opts.cc, bcc: opts.bcc };

    return new Promise((resolve, reject) => {
      const connect = config.secure
        ? () => tls.connect(port, host, config.tls || {}, onConnect)
        : () => { const s = net.createConnection(port, host, onConnect); return s; };

      let socket = connect();
      if (!config.secure && config.requireTLS !== false) {
        const origOnConnect = socket._events?.connect;
        socket.once('data', () => {});
      }

      function onConnect() {
        smtpDialog(socket, config, envelope, message)
          .then(result => resolve(Object.assign(result, { response: '250 OK' })))
          .catch(reject);
      }

      socket.on('error', reject);
      if (!config.secure) {
        socket.once('connect', onConnect);
      }
    });
  }

  async function sendMany(messages) {
    return Promise.all(messages.map(m => send(m)));
  }

  function template(html, vars) {
    let result = html;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v));
    }
    return result;
  }

  return { send, sendMany, template };
}

module.exports = { createMailer, buildMessage, guessMime, SMTPError };
