'use strict';

// ntl:http — HTTP server, router, middleware, client
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const url_    = require('url');
const crypto  = require('crypto');
const zlib    = require('zlib');
const { Readable } = require('stream');

// ─── Router ───────────────────────────────────────────────────────────────────

class Router {
  constructor() {
    this._routes    = [];
    this._mw        = [];
    this._notFound  = null;
    this._errHandler = null;
  }

  use(...args) {
    if (typeof args[0] === 'string') {
      const prefix = args[0];
      const mw     = args.slice(1);
      mw.forEach(fn => this._mw.push({ prefix, fn }));
    } else {
      args.forEach(fn => this._mw.push({ prefix: null, fn }));
    }
    return this;
  }

  route(method, pattern, ...handlers) {
    const { re, keys } = compilePath(pattern);
    handlers.forEach(fn => this._routes.push({ method: method.toUpperCase(), re, keys, pattern, fn }));
    return this;
  }

  get(pattern, ...h)    { return this.route('GET',    pattern, ...h); }
  post(pattern, ...h)   { return this.route('POST',   pattern, ...h); }
  put(pattern, ...h)    { return this.route('PUT',    pattern, ...h); }
  patch(pattern, ...h)  { return this.route('PATCH',  pattern, ...h); }
  delete(pattern, ...h) { return this.route('DELETE', pattern, ...h); }
  head(pattern, ...h)   { return this.route('HEAD',   pattern, ...h); }
  options(pattern, ...h){ return this.route('OPTIONS',pattern, ...h); }
  all(pattern, ...h)    {
    ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].forEach(m => this.route(m, pattern, ...h));
    return this;
  }

  notFound(fn) { this._notFound = fn; return this; }
  onError(fn)  { this._errHandler = fn; return this; }

  handle(req, res, done) {
    const mwList   = this._mw.filter(m => !m.prefix || req.url.startsWith(m.prefix));
    const urlParsed = url_.parse(req.url, true);
    const pathname  = urlParsed.pathname || '/';

    req.path  = pathname;
    req.query = urlParsed.query || {};

    const matched = this._routes.filter(r => {
      if (r.method !== req.method && r.method !== 'ALL') return false;
      return r.re.test(pathname);
    });

    const chain = [];
    mwList.forEach(m => chain.push(m.fn));
    matched.forEach(r => {
      chain.push((req, res, next) => {
        const m = pathname.match(r.re);
        req.params = {};
        if (m) r.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1] || ''); });
        return r.fn(req, res, next);
      });
    });
    if (chain.length === 0) {
      if (done) return done();
      if (this._notFound) return this._notFound(req, res);
      res.status(404).json({ error: 'Not Found', path: req.path });
      return;
    }

    let i = 0;
    const next = (err) => {
      if (err) {
        if (this._errHandler) return this._errHandler(err, req, res, () => {});
        res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
        return;
      }
      if (i >= chain.length) { if (done) done(); return; }
      try { chain[i++](req, res, next); }
      catch (e) { next(e); }
    };
    next();
  }
}

// ─── Request/Response wrappers ────────────────────────────────────────────────

function wrapRequest(req) {
  req.params  = {};
  req.query   = {};
  req.body    = null;
  req._body   = false;

  req.get  = (h) => req.headers[h.toLowerCase()];
  req.is   = (type) => (req.headers['content-type'] || '').includes(type);
  req.ip   = req.socket?.remoteAddress || req.connection?.remoteAddress || '::1';
  req.secure = req.socket?.encrypted || false;

  req.parseBody = () => new Promise((resolve, reject) => {
    if (req._body) return resolve(req.body);
    const chunks = [];
    req.on('data', d => chunks.push(d));
    req.on('end',  () => {
      req._body = true;
      const raw = Buffer.concat(chunks);
      const ct  = (req.headers['content-type'] || '').split(';')[0].trim();
      if (ct === 'application/json') {
        try { req.body = JSON.parse(raw.toString('utf-8')); }
        catch (e) { req.body = {}; }
      } else if (ct === 'application/x-www-form-urlencoded') {
        req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf-8')));
      } else if (ct === 'text/plain') {
        req.body = raw.toString('utf-8');
      } else {
        req.body = raw;
      }
      resolve(req.body);
    });
    req.on('error', reject);
  });

  return req;
}

function wrapResponse(res) {
  res._ntlSent   = false;
  res._headers   = {};
  res._status    = 200;
  res._cookies   = [];

  res.status = (code) => { res.statusCode = code; return res; };

  res.set = (key, val) => {
    if (typeof key === 'object') { Object.entries(key).forEach(([k, v]) => res.setHeader(k, v)); }
    else res.setHeader(key, val);
    return res;
  };

  res.get = (h) => res.getHeader(h);

  res.cookie = (name, value, opts) => {
    opts = opts || {};
    let str = `${name}=${encodeURIComponent(value)}`;
    if (opts.maxAge)   str += `; Max-Age=${opts.maxAge}`;
    if (opts.expires)  str += `; Expires=${opts.expires.toUTCString()}`;
    if (opts.path)     str += `; Path=${opts.path}`;
    if (opts.domain)   str += `; Domain=${opts.domain}`;
    if (opts.secure)   str += '; Secure';
    if (opts.httpOnly !== false) str += '; HttpOnly';
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    const existing = res.getHeader('Set-Cookie') || [];
    res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, str] : [str]);
    return res;
  };

  res.clearCookie = (name, opts) => res.cookie(name, '', Object.assign({}, opts, { maxAge: 0 }));

  res.json = (data) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    const body = JSON.stringify(data);
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
    return res;
  };

  res.text = (data, encoding) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(String(data), encoding || 'utf-8');
    return res;
  };

  res.html = (data) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(String(data), 'utf-8');
    return res;
  };

  res.send = (data) => {
    if (data === null || data === undefined) { res.end(); return res; }
    if (typeof data === 'object' && !Buffer.isBuffer(data)) return res.json(data);
    if (Buffer.isBuffer(data)) { res.end(data); return res; }
    return res.text(String(data));
  };

  res.redirect = (codeOrUrl, loc) => {
    if (typeof codeOrUrl === 'number') { res.statusCode = codeOrUrl; res.setHeader('Location', loc); }
    else { res.statusCode = 302; res.setHeader('Location', codeOrUrl); }
    res.end();
    return res;
  };

  res.sendFile = (filePath, opts) => {
    opts = opts || {};
    const abs = path.resolve(opts.root || '.', filePath);
    if (!fs.existsSync(abs)) { res.status(404).json({ error: 'File not found' }); return; }
    const stat = fs.statSync(abs);
    const ext  = path.extname(abs).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    fs.createReadStream(abs).pipe(res);
  };

  res.download = (filePath, filename) => {
    filename = filename || path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  };

  res.stream = (readable) => { readable.pipe(res); return res; };

  res.sse = () => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.statusCode = 200;
    const write = res.write.bind(res);
    return {
      send: (data, event) => {
        if (event) write(`event: ${event}\n`);
        write(`data: ${typeof data === 'object' ? JSON.stringify(data) : data}\n\n`);
      },
      comment: (c) => write(`: ${c}\n\n`),
      close:   () => res.end(),
    };
  };

  return res;
}

// ─── Middleware factories ─────────────────────────────────────────────────────

function bodyParser() {
  return async (req, res, next) => {
    await req.parseBody();
    next();
  };
}

function cors(opts) {
  opts = opts || {};
  const origin  = opts.origin  || '*';
  const methods = (opts.methods || ['GET','HEAD','PUT','PATCH','POST','DELETE']).join(',');
  const headers = (opts.allowedHeaders || ['Content-Type', 'Authorization']).join(',');

  return (req, res, next) => {
    const reqOrigin = req.headers.origin;
    if (origin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (typeof origin === 'function') {
      res.setHeader('Access-Control-Allow-Origin', origin(reqOrigin) ? reqOrigin : 'null');
    } else if (Array.isArray(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin.includes(reqOrigin) ? reqOrigin : 'null');
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (opts.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    if (opts.maxAge)      res.setHeader('Access-Control-Max-Age', String(opts.maxAge));
    if (opts.exposedHeaders) res.setHeader('Access-Control-Expose-Headers', opts.exposedHeaders.join(','));
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    next();
  };
}

function rateLimit(opts) {
  opts = opts || {};
  const windowMs  = opts.windowMs   || 60 * 1000;
  const max       = opts.max         || 100;
  const keyFn     = opts.keyGenerator || ((req) => req.ip);
  const message   = opts.message     || { error: 'Too many requests, please try again later.' };
  const store     = new Map();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }
    entry.count++;
    res.setHeader('X-RateLimit-Limit',     String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('X-RateLimit-Reset',     String(Math.ceil(entry.resetTime / 1000)));
    if (entry.count > max) {
      res.statusCode = 429;
      return res.json(message);
    }
    next();
  };
}

function staticFiles(urlPath, dirPath, opts) {
  opts = opts || {};
  const root     = path.resolve(dirPath);
  const maxAge   = opts.maxAge   || 86400;
  const index    = opts.index    || 'index.html';
  const dotfiles = opts.dotfiles || 'ignore';

  return (req, res, next) => {
    if (!req.path.startsWith(urlPath)) return next();
    let rel = req.path.slice(urlPath.length) || '/';
    if (!rel.startsWith('/')) rel = '/' + rel;
    if (dotfiles === 'ignore' && path.basename(rel).startsWith('.')) return next();
    let abs = path.join(root, rel);
    if (!abs.startsWith(root)) return next();
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) abs = path.join(abs, index);
    if (!fs.existsSync(abs)) return next();
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return next();
    const ext  = path.extname(abs).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `"${stat.size}-${stat.mtime.getTime()}"`;
    if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return; }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(abs).pipe(res);
  };
}

function compress() {
  return (req, res, next) => {
    const ae = req.headers['accept-encoding'] || '';
    const _end  = res.end.bind(res);
    const _write = res.write.bind(res);
    if (ae.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      const gz = zlib.createGzip();
      gz.on('data', d => _write(d));
      gz.on('end',  ()  => _end());
      res.write = (d) => gz.write(d);
      res.end   = (d) => { if (d) gz.write(d); gz.end(); };
    }
    next();
  };
}

function requestId() {
  return (req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

function logger() {
  const reset = '\x1b[0m', gray = '\x1b[90m', green = '\x1b[32m', yellow = '\x1b[33m', red = '\x1b[31m';
  const colorStatus = s => s >= 500 ? red : s >= 400 ? yellow : s >= 300 ? gray : green;
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms  = Date.now() - start;
      const sc  = colorStatus(res.statusCode);
      process.stdout.write(`${gray}${new Date().toISOString()}${reset}  ${req.method.padEnd(7)} ${sc}${res.statusCode}${reset}  ${String(ms).padStart(5)}ms  ${req.url}\n`);
    });
    next();
  };
}

function helmet(opts) {
  opts = opts || {};
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options',  'nosniff');
    res.setHeader('X-Frame-Options',          opts.frameOptions  || 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection',         '1; mode=block');
    res.setHeader('Referrer-Policy',           opts.referrerPolicy || 'strict-origin-when-cross-origin');
    if (opts.hsts !== false) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (opts.csp) {
      res.setHeader('Content-Security-Policy', typeof opts.csp === 'string' ? opts.csp : buildCSP(opts.csp));
    }
    next();
  };
}

function timeout(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.writableEnded) res.status(503).json({ error: 'Request timed out' });
    }, ms || 30000);
    res.on('finish', () => clearTimeout(timer));
    res.on('close',  () => clearTimeout(timer));
    next();
  };
}

function buildCSP(obj) {
  return Object.entries(obj).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : v}`).join('; ');
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

async function fetch(reqUrl, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const parsed  = new URL(reqUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod     = isHttps ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   (opts.method || 'GET').toUpperCase(),
      headers:  Object.assign({ 'User-Agent': 'ntl-lang/3.5' }, opts.headers || {}),
    };
    let body = opts.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      body = JSON.stringify(body);
      options.headers['Content-Type']   = options.headers['Content-Type'] || 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end',  () => {
        const raw = Buffer.concat(chunks);
        resolve({
          ok:         res.statusCode >= 200 && res.statusCode < 300,
          status:     res.statusCode,
          statusText: res.statusMessage,
          headers:    res.headers,
          text:   ()   => Promise.resolve(raw.toString('utf-8')),
          json:   ()   => Promise.resolve(JSON.parse(raw.toString('utf-8'))),
          buffer: ()   => Promise.resolve(raw),
          body:   raw,
        });
      });
    });
    req.on('error', reject);
    if (opts.timeout) req.setTimeout(opts.timeout, () => { req.destroy(new Error('Request timed out')); });
    if (body) req.write(body);
    req.end();
  });
}

async function fetchJSON(url, opts)  { return (await fetch(url, opts)).json(); }
async function fetchText(url, opts)  { return (await fetch(url, opts)).text(); }

// ─── Server factory ───────────────────────────────────────────────────────────

function createServer(opts) {
  opts = opts || {};
  const router = new Router();
  const server = http.createServer(async (rawReq, rawRes) => {
    wrapRequest(rawReq);
    wrapResponse(rawRes);
    rawRes.setHeader('X-Powered-By', 'ntl-lang');
    router.handle(rawReq, rawRes, () => {
      if (!rawRes.writableEnded) {
        rawRes.statusCode = 404;
        rawRes.json({ error: 'Not Found', path: rawReq.path });
      }
    });
  });

  const app = {
    server,
    use:     (...a) => { router.use(...a); return app; },
    get:     (p, ...h) => { router.get(p,     ...h); return app; },
    post:    (p, ...h) => { router.post(p,    ...h); return app; },
    put:     (p, ...h) => { router.put(p,     ...h); return app; },
    patch:   (p, ...h) => { router.patch(p,   ...h); return app; },
    delete:  (p, ...h) => { router.delete(p,  ...h); return app; },
    head:    (p, ...h) => { router.head(p,    ...h); return app; },
    options: (p, ...h) => { router.options(p, ...h); return app; },
    all:     (p, ...h) => { router.all(p,     ...h); return app; },
    notFound: (fn) => { router.notFound(fn);    return app; },
    onError:  (fn) => { router.onError(fn);     return app; },

    cors:       (o) => { app.use(cors(o));         return app; },
    rateLimit:  (o) => { app.use(rateLimit(o));    return app; },
    static:     (u, d, o) => { app.use(staticFiles(u, d, o)); return app; },
    compress:   ()  => { app.use(compress());      return app; },
    logger:     ()  => { app.use(logger());        return app; },
    helmet:     (o) => { app.use(helmet(o));       return app; },
    timeout:    (ms)=> { app.use(timeout(ms));     return app; },
    bodyParser: ()  => { app.use(bodyParser());    return app; },
    requestId:  ()  => { app.use(requestId());     return app; },

    listen: (port, host, cb) => {
      if (typeof host === 'function') { cb = host; host = '0.0.0.0'; }
      host = host || '0.0.0.0';
      server.listen(port, host, cb || (() => {}));
      return server;
    },
    close: (cb) => server.close(cb),
    router,
  };

  if (opts.cors)       app.cors(opts.cors);
  if (opts.rateLimit)  app.rateLimit(opts.rateLimit);
  if (opts.logger)     app.logger();
  if (opts.compress)   app.compress();
  if (opts.helmet)     app.helmet(opts.helmet);
  if (opts.bodyParser !== false) app.bodyParser();
  if (opts.requestId)  app.requestId();

  return app;
}

function createRouter() { return new Router(); }

// ─── Path compilation ─────────────────────────────────────────────────────────

function compilePath(pattern) {
  if (pattern instanceof RegExp) return { re: pattern, keys: [] };
  const keys = [];
  const re   = new RegExp(
    '^' + pattern
      .replace(/\//g, '\\/')
      .replace(/:(\w+)\?/g, (_, k) => { keys.push(k); return '([^\\/]*)'; })
      .replace(/:(\w+)/g,   (_, k) => { keys.push(k); return '([^\\/]+)'; })
      .replace(/\*/g,              ()  => '(.*)') + '(?:\\/)?$'
  );
  return { re, keys };
}

// ─── MIME types ───────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.tar':  'application/x-tar',
  '.gz':   'application/gzip',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
};

module.exports = {
  createServer,
  createRouter,
  Router,
  fetch,
  fetchJSON,
  fetchText,
  cors,
  rateLimit,
  staticFiles,
  compress,
  logger,
  helmet,
  timeout,
  bodyParser,
  requestId,
  MIME_TYPES,
};
