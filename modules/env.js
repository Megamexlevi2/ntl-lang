'use strict';
// ntl:env — Production environment & config management
const fs   = require('fs');
const path = require('path');

function loadDotEnv(filePath) {
  const envPath = filePath || path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const result = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip inline comments
    const commentIdx = val.search(/\s+#/);
    if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

class Env {
  constructor(options) {
    options = options || {};
    this._data = {};
    this._schema = {};
    this._errors = [];
    // Load .env files
    const files = options.files || ['.env'];
    if (options.override !== false) {
      for (const file of files) {
        const loaded = loadDotEnv(path.resolve(process.cwd(), file));
        Object.assign(this._data, loaded);
      }
      // process.env always overrides
      Object.assign(this._data, process.env);
    } else {
      Object.assign(this._data, process.env);
      for (const file of [...files].reverse()) {
        const loaded = loadDotEnv(path.resolve(process.cwd(), file));
        for (const [k, v] of Object.entries(loaded)) {
          if (!(k in this._data)) this._data[k] = v;
        }
      }
    }
  }

  get(key, defaultVal) {
    const val = this._data[key];
    if (val === undefined || val === null || val === '') return defaultVal !== undefined ? defaultVal : null;
    return val;
  }

  str(key, defaultVal) {
    const v = this.get(key, defaultVal);
    return v !== null ? String(v) : null;
  }

  int(key, defaultVal) {
    const v = this.get(key, defaultVal !== undefined ? String(defaultVal) : undefined);
    if (v === null) return null;
    const n = parseInt(v, 10);
    if (isNaN(n)) throw new Error(`[ntl:env] ${key} must be an integer, got "${v}"`);
    return n;
  }

  float(key, defaultVal) {
    const v = this.get(key, defaultVal !== undefined ? String(defaultVal) : undefined);
    if (v === null) return null;
    const n = parseFloat(v);
    if (isNaN(n)) throw new Error(`[ntl:env] ${key} must be a number, got "${v}"`);
    return n;
  }

  bool(key, defaultVal) {
    const v = this.get(key, defaultVal !== undefined ? String(defaultVal) : undefined);
    if (v === null) return null;
    const s = String(v).toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
    throw new Error(`[ntl:env] ${key} must be a boolean, got "${v}"`);
  }

  list(key, separator, defaultVal) {
    const v = this.get(key, defaultVal !== undefined ? String(defaultVal) : undefined);
    if (v === null) return [];
    return v.split(separator || ',').map(s => s.trim()).filter(Boolean);
  }

  json(key, defaultVal) {
    const v = this.get(key);
    if (v === null) return defaultVal !== undefined ? defaultVal : null;
    try { return JSON.parse(v); } catch { throw new Error(`[ntl:env] ${key} is not valid JSON`); }
  }

  url(key, defaultVal) {
    const v = this.str(key, defaultVal);
    if (!v) return null;
    try { return new URL(v).toString(); } catch { throw new Error(`[ntl:env] ${key} is not a valid URL: "${v}"`); }
  }

  require(key) {
    const v = this.get(key);
    if (v === null || v === undefined || v === '') {
      throw new Error(`[ntl:env] Required environment variable "${key}" is not set`);
    }
    return v;
  }

  has(key) {
    const v = this._data[key];
    return v !== undefined && v !== null && v !== '';
  }

  set(key, value) {
    this._data[key] = String(value);
    process.env[key] = String(value);
    return this;
  }

  all() { return Object.assign({}, this._data); }

  schema(spec) {
    this._schema = spec;
    return this;
  }

  validate() {
    this._errors = [];
    for (const [key, rules] of Object.entries(this._schema)) {
      const r = typeof rules === 'string' ? { type: rules } : rules;
      const raw = this._data[key];
      if (r.required && (raw === undefined || raw === null || raw === '')) {
        this._errors.push(`"${key}" is required`); continue;
      }
      if (raw === undefined || raw === null || raw === '') continue;
      if (r.type === 'number' && isNaN(Number(raw)))
        this._errors.push(`"${key}" must be a number`);
      if (r.type === 'boolean' && !['true','false','1','0','yes','no'].includes(raw.toLowerCase()))
        this._errors.push(`"${key}" must be a boolean`);
      if (r.oneOf && !r.oneOf.includes(raw))
        this._errors.push(`"${key}" must be one of: ${r.oneOf.join(', ')}`);
      if (r.pattern && !new RegExp(r.pattern).test(raw))
        this._errors.push(`"${key}" does not match pattern ${r.pattern}`);
    }
    if (this._errors.length) {
      throw new Error('[ntl:env] Validation failed:\n  - ' + this._errors.join('\n  - '));
    }
    return this;
  }

  // Shortcut for common patterns
  get port()     { return this.int('PORT', 3000); }
  get nodeEnv()  { return this.str('NODE_ENV', 'development'); }
  get isDev()    { return this.nodeEnv === 'development'; }
  get isProd()   { return this.nodeEnv === 'production'; }
  get isTest()   { return this.nodeEnv === 'test'; }
  get dbUrl()    { return this.str('DATABASE_URL'); }
  get redisUrl() { return this.str('REDIS_URL'); }
  get jwtSecret(){ return this.str('JWT_SECRET'); }
  get debug()    { return this.bool('DEBUG', 'false'); }
}

const _default = new Env();

function load(options) { return new Env(options); }
function get(key, def)  { return _default.get(key, def); }
function str(key, def)  { return _default.str(key, def); }
function int(key, def)  { return _default.int(key, def); }
function bool(key, def) { return _default.bool(key, def); }
function list(key, sep, def) { return _default.list(key, sep, def); }
function require_(key)  { return _default.require(key); }
function has(key)       { return _default.has(key); }
function set(key, val)  { return _default.set(key, val); }

module.exports = {
  Env, load,
  get, str, int, bool, list, json: (k,d) => _default.json(k,d),
  url: (k,d) => _default.url(k,d),
  require: require_, has, set,
  all: () => _default.all(),
  get port()    { return _default.port; },
  get nodeEnv() { return _default.nodeEnv; },
  get isDev()   { return _default.isDev; },
  get isProd()  { return _default.isProd; },
  get isTest()  { return _default.isTest; },
  loadDotEnv
};
