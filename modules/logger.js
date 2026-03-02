'use strict';
const fs = require('fs');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4, silent: 99 };

const C = {
  debug: '\x1b[90m',
  info:  '\x1b[32m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
  reset: '\x1b[0m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m',
  gray:  '\x1b[90m',
  cyan:  '\x1b[36m',
};

const USE_COLOR = process.stderr && process.stderr.isTTY !== false && !process.env.NO_COLOR;
const col = (color, text) => USE_COLOR ? `${C[color] || ''}${text}${C.reset}` : text;

function shortTime() {
  const d = new Date();
  return [
    String(d.getHours()).padStart(2,'0'),
    String(d.getMinutes()).padStart(2,'0'),
    String(d.getSeconds()).padStart(2,'0'),
  ].join(':') + '.' + String(d.getMilliseconds()).padStart(3,'0');
}

function pretty(v) {
  if (v === null || v === undefined) return col('gray', 'null');
  if (typeof v === 'boolean') return col('cyan', String(v));
  if (typeof v === 'number') return col('cyan', String(v));
  if (typeof v === 'string') return v;
  if (v instanceof Error) return col('error', `${v.name}: ${v.message}`);
  try { return JSON.stringify(v); } catch { return String(v); }
}

class Logger {
  constructor(options) {
    options = options || {};
    this.name    = options.name  || '';
    this.level   = LEVELS[options.level] !== undefined ? LEVELS[options.level] : 0;
    this.json    = options.json  || false;
    this._file   = options.file  ? fs.createWriteStream(options.file, { flags: 'a' }) : null;
    this._fields = options.fields || {};
  }

  _write(level, msg, data) {
    if (LEVELS[level] < this.level) return;

    if (this.json) {
      const entry = Object.assign({ time: new Date().toISOString(), level, msg }, this._fields, data || {});
      const line = JSON.stringify(entry) + '\n';
      process.stderr.write(line);
      if (this._file) this._file.write(line);
      return;
    }

    const LEVEL_ICON  = { debug: 'debug', info: 'info', warn: 'warn', error: 'error', fatal: 'fatal' };
    const LEVEL_COLOR = { debug: 'dim', info: 'cyan', warn: 'yellow', error: 'red', fatal: 'red' };
    const badge = col(LEVEL_COLOR[level] || 'dim', LEVEL_ICON[level] || level);
    const time  = col('dim', shortTime());
    const name  = this.name ? col('dim', this.name + ':') + ' ' : '';
    const extra = data && Object.keys(data).length ? ' ' + col('dim', JSON.stringify(data)) : '';

    const line = `  ${badge} ${name}${msg}${extra}\n`;
    process.stderr.write(line);
    if (this._file) this._file.write(line.replace(/\x1b\[[0-9;]*m/g, ''));
  }

  child(fields) {
    return new Logger({
      name:   this.name,
      level:  Object.keys(LEVELS).find(k => LEVELS[k] === this.level) || 'debug',
      fields: Object.assign({}, this._fields, fields),
      file:   this._file ? this._file.path : null,
    });
  }

  debug(msg, data)  { this._write('debug', msg, data); }
  info(msg, data)   { this._write('info',  msg, data); }
  warn(msg, data)   { this._write('warn',  msg, data); }
  error(msg, data)  { this._write('error', msg, data); }
  fatal(msg, data)  { this._write('fatal', msg, data); process.exit(1); }

  time(label) {
    const t0 = Date.now();
    return { done: (msg) => this.info((msg || label) + col('gray', ` (${Date.now()-t0}ms)`)) };
  }
}

function createLogger(options) { return new Logger(options); }

module.exports = { Logger, createLogger };
