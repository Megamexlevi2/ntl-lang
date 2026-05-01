'use strict';

// ntl:crypto — cryptographic utilities for backend services
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang
// Uses only Node.js built-in crypto module. Zero external dependencies.

const crypto = require('crypto');

// ─── Hashing ──────────────────────────────────────────────────────────────────

function sha256(data, encoding) {
  return crypto.createHash('sha256').update(data).digest(encoding || 'hex');
}

function sha512(data, encoding) {
  return crypto.createHash('sha512').update(data).digest(encoding || 'hex');
}

function md5(data, encoding) {
  return crypto.createHash('md5').update(data).digest(encoding || 'hex');
}

function hash(algorithm, data, encoding) {
  return crypto.createHash(algorithm).update(data).digest(encoding || 'hex');
}

function hmac(algorithm, key, data, encoding) {
  return crypto.createHmac(algorithm, key).update(data).digest(encoding || 'hex');
}

function hmacSHA256(key, data, encoding) { return hmac('sha256', key, data, encoding); }
function hmacSHA512(key, data, encoding) { return hmac('sha512', key, data, encoding); }

// ─── BCrypt (pure Node.js PBKDF2-based, bcrypt-compatible API) ───────────────

const BCRYPT_ROUNDS = 10;

async function bcryptHash(password, rounds) {
  rounds = rounds || BCRYPT_ROUNDS;
  const salt = crypto.randomBytes(16);
  const iterations = Math.pow(2, rounds);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha512', (err, key) => {
      if (err) return reject(err);
      const buf = Buffer.alloc(49);
      buf[0] = rounds;
      salt.copy(buf, 1);
      key.copy(buf, 17);
      resolve('$ntl$' + rounds + '$' + buf.toString('base64url'));
    });
  });
}

async function bcryptVerify(password, hash) {
  if (!hash.startsWith('$ntl$')) return false;
  const parts = hash.split('$');
  const rounds = parseInt(parts[2]);
  const buf = Buffer.from(parts[3], 'base64url');
  const salt = buf.slice(1, 17);
  const stored = buf.slice(17);
  const iterations = Math.pow(2, rounds);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha512', (err, key) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(key, stored));
    });
  });
}

// ─── AES-256-GCM encryption ───────────────────────────────────────────────────

const AES_ALG  = 'aes-256-gcm';
const IV_LEN   = 12;
const TAG_LEN  = 16;
const KEY_LEN  = 32;

function randomKey() {
  return crypto.randomBytes(KEY_LEN).toString('base64url');
}

function aesEncrypt(plaintext, keyB64) {
  const key = Buffer.from(keyB64, 'base64url').slice(0, KEY_LEN);
  const iv  = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(AES_ALG, key, iv);
  const enc    = Buffer.concat([cipher.update(String(plaintext), 'utf-8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function aesDecrypt(ciphertextB64, keyB64) {
  const key  = Buffer.from(keyB64, 'base64url').slice(0, KEY_LEN);
  const buf  = Buffer.from(ciphertextB64, 'base64url');
  const iv   = buf.slice(0, IV_LEN);
  const tag  = buf.slice(IV_LEN, IV_LEN + TAG_LEN);
  const enc  = buf.slice(IV_LEN + TAG_LEN);
  const dec  = crypto.createDecipheriv(AES_ALG, key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString('utf-8');
}

function deriveKey(password, salt, iterations, keyLen) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt || 'ntl-salt', iterations || 100000, keyLen || KEY_LEN, 'sha512', (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('base64url'));
    });
  });
}

// ─── JWT (HS256 / HS384 / HS512) ─────────────────────────────────────────────

function b64url(buf)    { return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString('base64url'); }
function b64urlStr(s)   { return b64url(Buffer.from(s, 'utf-8')); }
function parseB64(s)    { return JSON.parse(Buffer.from(s, 'base64url').toString('utf-8')); }

const JWT_ALGOS = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' };

function signJWT(payload, secret, opts) {
  opts = opts || {};
  const alg  = opts.algorithm || 'HS256';
  const algo = JWT_ALGOS[alg];
  if (!algo) throw new Error(`Unsupported JWT algorithm: ${alg}`);
  const now = Math.floor(Date.now() / 1000);
  const claims = Object.assign({}, payload, {
    iat: now,
    exp: opts.expiresIn  ? now + parseDuration(opts.expiresIn) : undefined,
    nbf: opts.notBefore  ? now + parseDuration(opts.notBefore) : undefined,
    iss: opts.issuer     || undefined,
    aud: opts.audience   || undefined,
    sub: opts.subject    || undefined,
    jti: opts.jwtid      || undefined,
  });
  Object.keys(claims).forEach(k => claims[k] === undefined && delete claims[k]);
  const header  = b64urlStr(JSON.stringify({ alg, typ: 'JWT' }));
  const body    = b64urlStr(JSON.stringify(claims));
  const sig     = crypto.createHmac(algo, secret).update(header + '.' + body).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

function verifyJWT(token, secret, opts) {
  opts = opts || {};
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new JWTError('Invalid token format');
  let header, payload;
  try { header  = parseB64(parts[0]); } catch(_) { throw new JWTError('Invalid header'); }
  try { payload = parseB64(parts[1]); } catch(_) { throw new JWTError('Invalid payload'); }
  const algo = JWT_ALGOS[header.alg];
  if (!algo) throw new JWTError(`Unsupported algorithm: ${header.alg}`);
  const expected = crypto.createHmac(algo, secret).update(parts[0] + '.' + parts[1]).digest();
  const actual   = Buffer.from(parts[2], 'base64url');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new JWTError('Invalid signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new JWTError('Token expired');
  if (payload.nbf && now < payload.nbf) throw new JWTError('Token not yet valid');
  if (opts.issuer   && payload.iss !== opts.issuer)   throw new JWTError('Invalid issuer');
  if (opts.audience && payload.aud !== opts.audience) throw new JWTError('Invalid audience');
  return payload;
}

function decodeJWT(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try { return { header: parseB64(parts[0]), payload: parseB64(parts[1]) }; }
  catch(_) { return null; }
}

class JWTError extends Error {
  constructor(msg) { super(msg); this.name = 'JWTError'; }
}

function parseDuration(s) {
  if (typeof s === 'number') return s;
  const m = String(s).match(/^(\d+)\s*(s|m|h|d|w|y)?$/i);
  if (!m) return 0;
  const n = parseInt(m[1]);
  const u = (m[2] || 's').toLowerCase();
  const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
  return n * (units[u] || 1);
}

// ─── Random ───────────────────────────────────────────────────────────────────

function uuid()         { return crypto.randomUUID(); }
function randomBytes(n) { return crypto.randomBytes(n); }
function randomHex(n)   { return crypto.randomBytes(n || 16).toString('hex'); }
function randomBase64(n){ return crypto.randomBytes(n || 32).toString('base64url'); }
function randomInt(min, max) { return min + crypto.randomInt(max - min + 1); }

function randomString(length, charset) {
  charset = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const bytes = crypto.randomBytes(length * 2);
  for (let i = 0; i < length; i++) out += charset[bytes[i] % charset.length];
  return out;
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

const encode = {
  base64:    (s) => Buffer.from(s).toString('base64'),
  base64url: (s) => Buffer.from(s).toString('base64url'),
  hex:       (s) => Buffer.from(s).toString('hex'),
};

const decode = {
  base64:    (s) => Buffer.from(s, 'base64').toString('utf-8'),
  base64url: (s) => Buffer.from(s, 'base64url').toString('utf-8'),
  hex:       (s) => Buffer.from(s, 'hex').toString('utf-8'),
};

function timingSafeEqual(a, b) {
  const ba = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ─── Checksum ─────────────────────────────────────────────────────────────────

function checksum(data, algorithm) {
  return crypto.createHash(algorithm || 'sha256').update(data).digest('hex');
}

async function checksumFile(filePath, algorithm) {
  const fs = require('fs');
  return new Promise((resolve, reject) => {
    const h   = crypto.createHash(algorithm || 'sha256');
    const str = fs.createReadStream(filePath);
    str.on('data', d => h.update(d));
    str.on('end',  () => resolve(h.digest('hex')));
    str.on('error', reject);
  });
}

module.exports = {
  sha256, sha512, md5, hash, hmac, hmacSHA256, hmacSHA512,
  bcryptHash, bcryptVerify,
  aesEncrypt, aesDecrypt, randomKey, deriveKey,
  signJWT, verifyJWT, decodeJWT, JWTError,
  uuid, randomBytes, randomHex, randomBase64, randomInt, randomString,
  encode, decode, timingSafeEqual,
  checksum, checksumFile,
};
