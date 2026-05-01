'use strict';

// ntl:logger — structured logging with levels, child loggers, file output
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

const LEVELS  = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: Infinity };
const COLORS  = {
  trace: '\x1b[37m',  debug: '\x1b[36m', info:  '\x1b[32m',
  warn:  '\x1b[33m',  error: '\x1b[31m', fatal: '\x1b[35m',
};
const RESET = '\x1b[0m';
const GRAY  = '\x1b[90m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

function levelName(n) {
  return Object.entries(LEVELS).find(([, v]) => v === n)?.[0] || String(n);
}

function safeStringify(obj, indent) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Error) return { message: v.message, name: v.name, stack: v.stack };
    return v;
  }, indent);
}

class Logger {
  constructor(opts) {
    opts           = opts || {};
    this._name     = opts.name      || null;
    this._level    = LEVELS[opts.level] ?? LEVELS.info;
    this._pretty   = opts.pretty    !== false;
    this._useColor = opts.color     !== false && process.stdout.isTTY;
    this._filePath = opts.filePath  || null;
    this._redact   = opts.redact    || [];
    this._parent   = opts._parent   || null;
    this._ctx      = opts.context   || {};
    this._streams  = [];
    this._fileStream = null;

    if (this._filePath) {
      fs.mkdirSync(path.dirname(path.resolve(this._filePath)), { recursive: true });
      this._fileStream = fs.createWriteStream(this._filePath, { flags: 'a' });
    }
  }

  _write(level, msg, data) {
    if (level < this._level) return;
    const name_  = levelName(level);
    const ts     = new Date().toISOString();
    const merged = Object.assign({}, this._ctx, data || {});
    if (this._parent) Object.assign(merged, this._parent._ctx);

    if (this._redact.length) {
      for (const key of this._redact) {
        delete merged[key];
        if (merged.err) delete merged.err[key];
      }
    }

    if (this._pretty) {
      const color = this._useColor ? (COLORS[name_] || RESET) : '';
      const end   = this._useColor ? RESET : '';
      const gray  = this._useColor ? GRAY  : '';
      const bold  = this._useColor ? BOLD  : '';
      const dim   = this._useColor ? DIM   : '';

      let line = `${gray}${ts}${end}  ${bold}${color}${name_.toUpperCase().padEnd(5)}${end}`;
      if (this._name) line += `  ${dim}${this._name}${end}`;
      if (msg)        line += `  ${msg}`;

      const extra = Object.assign({}, merged);
      if (extra.err && extra.err.stack) {
        line += '\n' + gray + extra.err.stack + end;
        delete extra.err;
      }
      const keys = Object.keys(extra);
      if (keys.length) {
        if (keys.length <= 3 && keys.every(k => typeof extra[k] !== 'object' || extra[k] === null)) {
          line += '  ' + gray + keys.map(k => `${k}=${JSON.stringify(extra[k])}`).join(' ') + end;
        } else {
          line += '\n' + gray + safeStringify(extra, 2).split('\n').map(l => '  ' + l).join('\n') + end;
        }
      }

      process.stdout.write(line + '\n');
    } else {
      const log = Object.assign({ time: ts, level: level, name: this._name, msg }, merged);
      const line = safeStringify(log) + '\n';
      process.stdout.write(line);
      if (this._fileStream) this._fileStream.write(line);
    }
  }

  trace(msg, data)  { this._write(LEVELS.trace, msg, data); }
  debug(msg, data)  { this._write(LEVELS.debug, msg, data); }
  info(msg, data)   { this._write(LEVELS.info,  msg, data); }
  warn(msg, data)   { this._write(LEVELS.warn,  msg, data); }
  error(msg, data)  { this._write(LEVELS.error, msg, data); }
  fatal(msg, data)  { this._write(LEVELS.fatal, msg, data); process.nextTick(() => process.exit(1)); }

  log(level, msg, data) {
    const lvl = typeof level === 'string' ? (LEVELS[level] ?? LEVELS.info) : level;
    this._write(lvl, msg, data);
  }

  child(ctx) {
    return new Logger({
      name:     this._name,
      level:    levelName(this._level),
      pretty:   this._pretty,
      color:    this._useColor,
      filePath: this._filePath,
      redact:   this._redact,
      context:  Object.assign({}, this._ctx, ctx),
      _parent:  this,
    });
  }

  withContext(ctx) { return this.child(ctx); }

  setLevel(level) {
    const n = typeof level === 'string' ? LEVELS[level] : level;
    if (n !== undefined) this._level = n;
    return this;
  }

  get level() { return levelName(this._level); }

  addStream(fn) { this._streams.push(fn); return this; }

  startTimer(label) {
    const start = Date.now();
    return {
      done:  (msg, data) => this.info(msg || label, Object.assign({ duration_ms: Date.now() - start }, data)),
      error: (msg, data) => this.error(msg || label, Object.assign({ duration_ms: Date.now() - start }, data)),
    };
  }

  close() {
    if (this._fileStream) { this._fileStream.end(); this._fileStream = null; }
  }
}

function createLogger(opts) { return new Logger(opts || {}); }

const defaultLogger = createLogger({ name: 'app', level: 'info' });

module.exports = { Logger, createLogger, defaultLogger, LEVELS };
