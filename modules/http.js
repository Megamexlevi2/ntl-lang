// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';
const nodeHttp  = require('http');
const nodeHttps = require('https');
const nodePath  = require('path');
const nodeFs    = require('fs');
const nodeUrl   = require('url');

const MIME = {
  html: 'text/html; charset=utf-8', css: 'text/css', js: 'application/javascript',
  json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', txt: 'text/plain',
  pdf: 'application/pdf', woff: 'font/woff', woff2: 'font/woff2',
  mp4: 'video/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
  webp: 'image/webp', ts: 'application/typescript', xml: 'application/xml'
};

class Router {
  constructor() {
    this.routes     = { GET:[], POST:[], PUT:[], DELETE:[], PATCH:[], OPTIONS:[], HEAD:[] };
    this.middleware = [];
    this._404       = null;
    this._error     = null;
  }
  use(fn)                    { this.middleware.push(fn); return this; }
  get(path, ...handlers)     { return this._add('GET', path, handlers); }
  post(path, ...handlers)    { return this._add('POST', path, handlers); }
  put(path, ...handlers)     { return this._add('PUT', path, handlers); }
  delete(path, ...handlers)  { return this._add('DELETE', path, handlers); }
  patch(path, ...handlers)   { return this._add('PATCH', path, handlers); }
  options(path, ...handlers) { return this._add('OPTIONS', path, handlers); }
  head(path, ...handlers)    { return this._add('HEAD', path, handlers); }
  // router.all and router.any are aliases - catch-all for any method
  all(path, ...handlers) {
    for (const m of ['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD']) this._add(m, path, handlers);
    return this;
  }
  any(path, ...handlers) { return this.all(path, ...handlers); }
  notFound(fn)   { this._404 = fn; return this; }
  onError(fn)    { this._error = fn; return this; }
  _add(method, path, handlers) {
    const params = [];
    const rx = path
      .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, (c) => ['*','(',')'].includes(c) ? c : '\\' + c)
      .replace(/\\\*/g, '.*')
      .replace(/\*$/g, '.*')
      .replace(/:([^/]+)\*/g, (_, k) => { params.push({ name: k, greedy: true }); return '(.+)'; })
      .replace(/:([^/]+)/g, (_, k)   => { params.push({ name: k, greedy: false }); return '([^/]+)'; });
    this.routes[method].push({ pattern: new RegExp(`^${rx}$`), path, params, handlers });
    return this;
  }
  async handle(req, res) {
    try {
      for (const mw of this.middleware) {
        let didNext = false;
        await new Promise((resolve) => {
          mw(req, res, () => { didNext = true; resolve(); });
          if (!didNext) resolve();
        });
        if (res._sent) return;
      }
      const routes = this.routes[req.method] || [];
      const pathname = (req.path || '/').split('?')[0];
      for (const route of routes) {
        const m = pathname.match(route.pattern);
        if (!m) continue;
        req.params = {};
        route.params.forEach((p, i) => { req.params[p.name] = m[i + 1]; });
        for (const handler of route.handlers) {
          await handler(req, res);
          if (res._sent) return;
        }
        return;
      }
      if (this._404) { await this._404(req, res); return; }
      res.status(404).json({ error: true, message: 'Not Found', path: req.path });
    } catch (err) {
      if (this._error) { await this._error(err, req, res); return; }
      if (!res._sent) res.status(500).json({ error: true, message: err.message || 'Internal Server Error' });
    }
  }
}

function makeRequest(req) {
  const parsed = nodeUrl.parse(req.url, true);
  const nReq = {
    method:  req.method,
    url:     req.url,
    path:    parsed.pathname || '/',
    query:   parsed.query || {},
    headers: req.headers,
    params:  {},
    cookies: {},
    ip:      (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
    body:    null,
    get: (h) => req.headers[h.toLowerCase()],
    param: (n) => nReq.params[n] || nReq.query[n] || null
  };
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    try { nReq.cookies[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim()); } catch {}
  }
  return nReq;
}

function makeResponse(rawRes) {
  const nRes = {
    _status: 200,
    _headers: { 'Content-Type': 'application/json', 'X-Powered-By': 'NTL/1.0' },
    _sent: false,
    status(code)          { nRes._status = code; return nRes; },
    header(key, value)    { nRes._headers[key] = value; return nRes; },
    set(key, value)       { nRes._headers[key] = value; return nRes; },
    type(mime)            { nRes._headers['Content-Type'] = MIME[mime] || mime; return nRes; },
    cookie(name, val, opts) {
      opts = opts || {};
      let c = `${name}=${encodeURIComponent(val)}`;
      if (opts.maxAge)   c += `; Max-Age=${opts.maxAge}`;
      if (opts.path)     c += `; Path=${opts.path}`;
      if (opts.domain)   c += `; Domain=${opts.domain}`;
      if (opts.httpOnly) c += '; HttpOnly';
      if (opts.secure)   c += '; Secure';
      if (opts.sameSite) c += `; SameSite=${opts.sameSite}`;
      nRes._headers['Set-Cookie'] = c;
      return nRes;
    },
    redirect(url, code)   { rawRes.writeHead(code || 302, { Location: url }); rawRes.end(); nRes._sent = true; },
    json(data) {
      if (nRes._sent) return;
      nRes._sent = true;
      const body = JSON.stringify(data);
      nRes._headers['Content-Type'] = 'application/json';
      nRes._headers['Content-Length'] = Buffer.byteLength(body);
      rawRes.writeHead(nRes._status, nRes._headers);
      rawRes.end(body);
    },
    text(data) {
      if (nRes._sent) return;
      nRes._sent = true;
      nRes._headers['Content-Type'] = 'text/plain; charset=utf-8';
      const body = String(data);
      nRes._headers['Content-Length'] = Buffer.byteLength(body);
      rawRes.writeHead(nRes._status, nRes._headers);
      rawRes.end(body);
    },
    html(data) {
      if (nRes._sent) return;
      nRes._sent = true;
      nRes._headers['Content-Type'] = 'text/html; charset=utf-8';
      const body = String(data);
      rawRes.writeHead(nRes._status, nRes._headers);
      rawRes.end(body);
    },
    send(data) {
      if (typeof data === 'object' && data !== null) nRes.json(data);
      else nRes.text(String(data));
    },
    stream(readable) {
      if (nRes._sent) return;
      nRes._sent = true;
      rawRes.writeHead(nRes._status, nRes._headers);
      readable.pipe(rawRes);
    },
    file(filePath) {
      if (nRes._sent) return;
      try {
        const content = nodeFs.readFileSync(filePath);
        const ext = nodePath.extname(filePath).slice(1);
        nRes._headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
        nRes._sent = true;
        rawRes.writeHead(nRes._status, nRes._headers);
        rawRes.end(content);
      } catch { nRes.status(404).text('File not found'); }
    }
  };
  return nRes;
}

async function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct  = (req.headers['content-type'] || '').split(';')[0].trim();
      if (ct === 'application/json') {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      } else if (ct === 'application/x-www-form-urlencoded') {
        const obj = {};
        for (const pair of raw.split('&')) {
          const eq = pair.indexOf('=');
          if (eq < 0) continue;
          try { obj[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1)); } catch {}
        }
        resolve(obj);
      } else {
        resolve(raw);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function createServer(routerOrHandler) {
  const server = nodeHttp.createServer(async (req, res) => {
    const nReq = makeRequest(req);
    const nRes = makeResponse(res);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      nReq.body = await readBody(req);
    }
    if (routerOrHandler instanceof Router) {
      await routerOrHandler.handle(nReq, nRes);
    } else if (typeof routerOrHandler === 'function') {
      await routerOrHandler(nReq, nRes);
    }
  });
  return server;
}

function listen(port, routerOrHandler, callback) {
  const server = createServer(routerOrHandler);
  server.listen(port, () => {
    if (callback) callback(port);
    else console.log(`[ntl:http] Server on http://localhost:${port}`);
  });
  return server;
}

async function fetchUrl(url, options) {
  options = options || {};
  return new Promise((resolve, reject) => {
    const parsed = nodeUrl.parse(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? nodeHttps : nodeHttp;
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.path || '/',
      method:   (options.method || 'GET').toUpperCase(),
      headers:  options.headers || {}
    };
    let body = null;
    if (options.body) {
      if (typeof options.body === 'object') {
        body = JSON.stringify(options.body);
        opts.headers['Content-Type'] = 'application/json';
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      } else {
        body = String(options.body);
        opts.headers['Content-Length'] = Buffer.byteLength(body);
      }
    }
    const req = transport.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const ct  = (res.headers['content-type'] || '').split(';')[0].trim();
        let data = raw;
        if (ct === 'application/json') { try { data = JSON.parse(raw); } catch {} }
        resolve({
          status: res.statusCode, headers: res.headers, data, raw,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          json() { return typeof data === 'object' ? data : JSON.parse(raw); },
          text() { return raw; }
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function cors(options) {
  options = options || {};
  return function(req, res, next) {
    res.header('Access-Control-Allow-Origin',  options.origin  || '*');
    res.header('Access-Control-Allow-Methods', options.methods || 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', options.headers || 'Content-Type,Authorization');
    if (options.credentials) res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (next) next();
  };
}

function staticFiles(rootDir, options) {
  options = options || {};
  return function(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { if (next) next(); return; }
    const pathname = nodeUrl.parse(req.url).pathname;
    let filePath = nodePath.resolve(rootDir, '.' + pathname);
    if (!filePath.startsWith(nodePath.resolve(rootDir))) { if (next) next(); return; }
    if (nodeFs.existsSync(filePath) && nodeFs.statSync(filePath).isDirectory()) {
      filePath = nodePath.join(filePath, options.index || 'index.html');
    }
    if (!nodeFs.existsSync(filePath)) { if (next) next(); return; }
    res.file(filePath);
  };
}

function rateLimit(options) {
  options = options || {};
  const windowMs = options.windowMs || 60000;
  const max      = options.max || 100;
  const store    = new Map();
  return function(req, res, next) {
    const key = req.ip || 'global';
    const now = Date.now();
    const entry = store.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
    entry.count++;
    store.set(key, entry);
    if (entry.count > max) {
      res.status(429).json({ error: true, message: 'Too Many Requests', retryAfter: Math.ceil((entry.reset - now) / 1000) });
      return;
    }
    res.header('X-RateLimit-Limit', String(max));
    res.header('X-RateLimit-Remaining', String(max - entry.count));
    if (next) next();
  };
}

function createRouter(opts) { return new Router(opts); }

module.exports = {
  Router: createRouter,
  createRouter, createServer, listen,
  fetch: fetchUrl, get: (u, o) => fetchUrl(u, Object.assign({}, o, { method: 'GET' })),
  post: (u, o) => fetchUrl(u, Object.assign({}, o, { method: 'POST' })),
  put:  (u, o) => fetchUrl(u, Object.assign({}, o, { method: 'PUT' })),
  delete: (u, o) => fetchUrl(u, Object.assign({}, o, { method: 'DELETE' })),
  cors, static: staticFiles, rateLimit, MIME
};
