'use strict';
const fs   = require('fs');
const path = require('path');
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4, SILENT: 99 };
const COLORS = {
  DEBUG: '\x1b[90m',
  INFO:  '\x1b[36m',
  WARN:  '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
  RESET: '\x1b[0m',
  BOLD:  '\x1b[1m',
  DIM:   '\x1b[2m',
  GRAY:  '\x1b[90m',
  GREEN: '\x1b[32m'
};
function colorize(text, color) {
  if (!process.stdout.isTTY) return text;
  return (COLORS[color] || '') + text + COLORS.RESET;
}
function timestamp() {
  return new Date().toISOString();
}
function formatValue(v) {
  if (v === null || v === undefined) return colorize('null', 'DIM');
  if (typeof v === 'object') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
}
class Logger {
  constructor(options) {
    options = options || {};
    this.name     = options.name || 'ntl';
    this.level    = options.level !== undefined ? options.level : LEVELS.DEBUG;
    this.showTime = options.showTime !== false;
    this.showName = options.showName !== false;
    this.colors   = options.colors !== false;
    this.logFile  = options.logFile || null;
    this._stream  = null;
    if (this.logFile) {
      this._stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    }
  }
  _log(levelName, args) {
    const numLevel = LEVELS[levelName];
    if (numLevel < this.level) return;
    const parts = [];
    if (this.showTime) {
      parts.push(colorize(`[${timestamp()}]`, 'DIM'));
    }
    parts.push(colorize(`[${levelName}]`, levelName));
    if (this.showName) {
      parts.push(colorize(`[${this.name}]`, 'GRAY'));
    }
    const message = args.map(formatValue).join(' ');
    parts.push(message);
    const line = parts.join(' ');
    if (numLevel >= LEVELS.ERROR) {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
    if (this._stream) {
      const plain = `[${timestamp()}] [${levelName}] [${this.name}] ${args.map(String).join(' ')}\n`;
      this._stream.write(plain);
    }
  }
  debug(...args)  { this._log('DEBUG', args); }
  info(...args)   { this._log('INFO', args); }
  warn(...args)   { this._log('WARN', args); }
  error(...args)  { this._log('ERROR', args); }
  fatal(...args)  { this._log('FATAL', args); process.exit(1); }
  time(label) {
    this._timers = this._timers || {};
    this._timers[label] = Date.now();
    this.debug(`Timer '${label}' started`);
  }
  timeEnd(label) {
    const start = (this._timers || {})[label];
    if (start === undefined) { this.warn(`Timer '${label}' not found`); return; }
    const elapsed = Date.now() - start;
    this.debug(`Timer '${label}': ${elapsed}ms`);
    return elapsed;
  }
  group(label) { this.info(`┌── ${label}`); }
  groupEnd()   { this.info(`└──`); }
  table(data) {
    if (!Array.isArray(data) || data.length === 0) { this.info('[empty table]'); return; }
    const keys = Object.keys(data[0]);
    const widths = keys.map(k => Math.max(k.length, ...data.map(row => String(row[k] ?? '').length)));
    const header = keys.map((k, i) => k.padEnd(widths[i])).join(' | ');
    const sep = widths.map(w => '-'.repeat(w)).join('-+-');
    this.info('┌─' + sep + '─┐');
    this.info('│ ' + header + ' │');
    this.info('├─' + sep + '─┤');
    for (const row of data) {
      const line = keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join(' | ');
      this.info('│ ' + line + ' │');
    }
    this.info('└─' + sep + '─┘');
  }
  child(options) {
    return new Logger(Object.assign({}, {
      name: this.name, level: this.level, showTime: this.showTime,
      colors: this.colors, logFile: this.logFile
    }, options || {}));
  }
  setLevel(level) {
    if (typeof level === 'string') this.level = LEVELS[level.toUpperCase()] || 0;
    else this.level = level;
  }
  close() {
    if (this._stream) { this._stream.end(); this._stream = null; }
  }
}
function createLogger(options) {
  return new Logger(options);
}
const defaultLogger = new Logger({ name: 'ntl' });
module.exports = {
  Logger,
  createLogger,
  log:   defaultLogger,
  LEVELS,
  debug: (...a) => defaultLogger.debug(...a),
  info:  (...a) => defaultLogger.info(...a),
  warn:  (...a) => defaultLogger.warn(...a),
  error: (...a) => defaultLogger.error(...a),
  fatal: (...a) => defaultLogger.fatal(...a)
};
