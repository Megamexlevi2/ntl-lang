'use strict';
const nodeCrypto = require('crypto');
function sha256(input) {
  return nodeCrypto.createHash('sha256').update(String(input)).digest('hex');
}
function sha512(input) {
  return nodeCrypto.createHash('sha512').update(String(input)).digest('hex');
}
function md5(input) {
  return nodeCrypto.createHash('md5').update(String(input)).digest('hex');
}
function sha1(input) {
  return nodeCrypto.createHash('sha1').update(String(input)).digest('hex');
}
function hmac(algorithm, key, data) {
  return nodeCrypto.createHmac(algorithm, key).update(String(data)).digest('hex');
}
function hmacSha256(key, data) { return hmac('sha256', key, data); }
function hmacSha512(key, data) { return hmac('sha512', key, data); }
function randomBytes(n) {
  return nodeCrypto.randomBytes(n || 16).toString('hex');
}
function randomInt(min, max) {
  if (max === undefined) { max = min; min = 0; }
  return nodeCrypto.randomInt(min, max);
}
function uuid() {
  return nodeCrypto.randomUUID
    ? nodeCrypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = nodeCrypto.randomBytes(1)[0];
        const v = c === 'x' ? r & 0xf : (r & 0x3 | 0x8);
        return v.toString(16);
      });
}
function encryptAES(text, key) {
  const keyBuf = nodeCrypto.createHash('sha256').update(String(key)).digest();
  const iv = nodeCrypto.randomBytes(16);
  const cipher = nodeCrypto.createCipheriv('aes-256-cbc', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decryptAES(data, key) {
  const parts = String(data).split(':');
  if (parts.length < 2) throw new Error('[ntl:crypto] Invalid encrypted data format');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const keyBuf = nodeCrypto.createHash('sha256').update(String(key)).digest();
  const decipher = nodeCrypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
function base64Encode(data) {
  return Buffer.from(String(data), 'utf8').toString('base64');
}
function base64Decode(data) {
  return Buffer.from(String(data), 'base64').toString('utf8');
}
function base64UrlEncode(data) {
  return base64Encode(data).replace(/\+/g, '-').replace(/\
}
function base64UrlDecode(data) {
  let s = String(data).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return base64Decode(s);
}
function signJWT(payload, secret, expiresInSeconds) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Object.assign({ iat: now }, payload);
  if (expiresInSeconds) fullPayload.exp = now + expiresInSeconds;
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = nodeCrypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyJWT(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('[ntl:crypto] Invalid JWT format');
  const [header, body, sig] = parts;
  const expectedSig = nodeCrypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) throw new Error('[ntl:crypto] JWT signature invalid');
  const payload = JSON.parse(base64UrlDecode(body));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('[ntl:crypto] JWT has expired');
  }
  return payload;
}
function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return nodeCrypto.timingSafeEqual(ba, bb);
}
function hashPassword(password, rounds) {
  rounds = rounds || 10000;
  const salt = nodeCrypto.randomBytes(16).toString('hex');
  const hash = nodeCrypto.pbkdf2Sync(String(password), salt, rounds, 64, 'sha512').toString('hex');
  return `${rounds}:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 3) return false;
  const [rounds, salt, hash] = parts;
  const derived = nodeCrypto.pbkdf2Sync(String(password), salt, parseInt(rounds), 64, 'sha512').toString('hex');
  return constantTimeEqual(hash, derived);
}
module.exports = {
  sha256, sha512, md5, sha1,
  hmac, hmacSha256, hmacSha512,
  randomBytes, randomInt, uuid,
  encryptAES, decryptAES,
  base64Encode, base64Decode, base64UrlEncode, base64UrlDecode,
  signJWT, verifyJWT,
  constantTimeEqual,
  hashPassword, verifyPassword
};
