'use strict';

// ntl:env — .env file loading, validation, and type-safe config
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const fs   = require('fs');
const path = require('path');

function parseDotEnv(text) {
  const result = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    let key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/, '"').replace(/\\\\/, '\\');
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    } else {
      const commentIdx = val.indexOf(' #');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    }
    result[key] = val;
  }
  return result;
}

function load(options) {
  options = options || {};
  const filePath  = options.path     || options.filePath || '.env';
  const override  = options.override !== false;
  const debug     = options.debug    || false;
  const encoding  = options.encoding || 'utf-8';

  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    if (options.required) throw new Error(`Missing required .env file: ${abs}`);
    return {};
  }

  const text = fs.readFileSync(abs, encoding);
  const vars  = parseDotEnv(text);
  let loaded  = 0;

  for (const [k, v] of Object.entries(vars)) {
    if (override || process.env[k] === undefined) {
      process.env[k] = v;
      loaded++;
    }
    if (debug) process.stdout.write(`[ntl:env] ${k}=${override || !process.env[k] ? v : '(skipped, already set)'}\n`);
  }

  return vars;
}

function loadFiles(files, options) {
  const merged = {};
  for (const f of files) {
    Object.assign(merged, load(Object.assign({}, options, { path: f, required: false })));
  }
  return merged;
}

function get(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val;
}

function getNumber(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  const n = Number(val);
  return isNaN(n) ? defaultValue : n;
}

function getBoolean(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val === 'true' || val === '1' || val === 'yes' || val === 'on';
}

function getArray(key, sep, defaultValue) {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue || [];
  return val.split(sep || ',').map(s => s.trim()).filter(Boolean);
}

function require_(key, message) {
  const val = process.env[key];
  if (val === undefined || val === '') {
    throw new Error(message || `Missing required environment variable: ${key}`);
  }
  return val;
}

function requireAll(keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(keys.map(k => [k, process.env[k]]));
}

function set(key, value) {
  process.env[key] = String(value);
  return value;
}

function unset(key) { delete process.env[key]; }

function has(key)   { return process.env[key] !== undefined; }

function all() { return Object.assign({}, process.env); }

// ─── Schema-based config ─────────────────────────────────────────────────────

class EnvField {
  constructor(type) {
    this._type     = type;
    this._optional = false;
    this._default  = undefined;
    this._choices  = null;
    this._min      = null;
    this._max      = null;
  }

  optional()        { this._optional = true; return this; }
  default(val)      { this._default  = val;  return this; }
  oneOf(values)     { this._choices  = values; return this; }
  min(n)            { this._min = n; return this; }
  max(n)            { this._max = n; return this; }

  _coerce(raw) {
    if (raw === undefined || raw === '') return this._default;
    if (this._type === 'number')  { const n = Number(raw); return isNaN(n) ? this._default : n; }
    if (this._type === 'boolean') return raw === 'true' || raw === '1' || raw === 'yes';
    if (this._type === 'array')   return raw.split(',').map(s => s.trim()).filter(Boolean);
    if (this._type === 'json')    { try { return JSON.parse(raw); } catch(_) { return this._default; } }
    return raw;
  }

  _validate(key, value) {
    if (value === undefined || value === null) {
      if (this._optional) return { ok: true, value: this._default !== undefined ? this._default : null };
      return { ok: false, error: `Missing required env var: ${key}` };
    }
    if (this._choices && !this._choices.includes(value)) {
      return { ok: false, error: `${key} must be one of: ${this._choices.join(', ')}, got: ${value}` };
    }
    if (this._type === 'number') {
      if (this._min !== null && value < this._min) return { ok: false, error: `${key} must be >= ${this._min}` };
      if (this._max !== null && value > this._max) return { ok: false, error: `${key} must be <= ${this._max}` };
    }
    return { ok: true, value };
  }
}

function schema(shape) {
  return {
    parse: (env) => {
      env = env || process.env;
      const result = {}, errors = [];
      for (const [key, field] of Object.entries(shape)) {
        const raw   = env[key];
        const value = field._coerce(raw);
        const r     = field._validate(key, value);
        if (!r.ok) errors.push(r.error);
        else result[key] = r.value;
      }
      if (errors.length) throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
      return result;
    },
    safeParse: (env) => {
      try { return { ok: true, data: this.parse(env) }; }
      catch(e) { return { ok: false, error: e.message }; }
    },
  };
}

const field = {
  string:  () => new EnvField('string'),
  number:  () => new EnvField('number'),
  boolean: () => new EnvField('boolean'),
  array:   () => new EnvField('array'),
  json:    () => new EnvField('json'),
  url:     () => {
    const f = new EnvField('string');
    const orig = f._validate.bind(f);
    f._validate = (key, value) => {
      const r = orig(key, value);
      if (!r.ok) return r;
      if (value) { try { new URL(value); } catch(_) { return { ok: false, error: `${key} must be a valid URL` }; } }
      return r;
    };
    return f;
  },
};

function is() { return get('NODE_ENV', 'development'); }
function isDev()  { return is() === 'development'; }
function isProd() { return is() === 'production'; }
function isTest() { return is() === 'test'; }

module.exports = {
  load, loadFiles, get, getNumber, getBoolean, getArray,
  require: require_, requireAll, set, unset, has, all,
  schema, field, is, isDev, isProd, isTest,
  parse: parseDotEnv,
};
