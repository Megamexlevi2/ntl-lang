'use strict';

// ntl:fs — file system utilities (async + sync, glob, watch, temp files)
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const fs      = require('fs');
const fsP     = require('fs').promises;
const path    = require('path');
const os      = require('os');
const crypto  = require('crypto');
const { EventEmitter } = require('./events');

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function read(filePath, opts) {
  opts = opts || {};
  const encoding = opts.encoding || opts.enc || (opts.binary ? null : 'utf-8');
  return fsP.readFile(filePath, encoding);
}

function readSync(filePath, opts) {
  opts = opts || {};
  const encoding = opts.encoding || opts.enc || (opts.binary ? null : 'utf-8');
  return fs.readFileSync(filePath, encoding);
}

async function write(filePath, data, opts) {
  opts = opts || {};
  if (opts.mkdirp !== false) fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const mode    = opts.mode  || undefined;
  const flag    = opts.flag  || opts.append ? 'a' : 'w';
  const encoding = opts.encoding || (Buffer.isBuffer(data) ? undefined : 'utf-8');
  await fsP.writeFile(filePath, data, { encoding, mode, flag });
}

function writeSync(filePath, data, opts) {
  opts = opts || {};
  if (opts.mkdirp !== false) fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const flag = opts.append ? 'a' : 'w';
  fs.writeFileSync(filePath, data, { encoding: Buffer.isBuffer(data) ? undefined : 'utf-8', flag });
}

async function append(filePath, data, opts) { return write(filePath, data, Object.assign({}, opts, { append: true })); }
function appendSync(filePath, data, opts)   { writeSync(filePath, data, Object.assign({}, opts, { append: true })); }

async function readJSON(filePath) {
  const text = await read(filePath);
  return JSON.parse(text);
}

function readJSONSync(filePath) { return JSON.parse(readSync(filePath)); }

async function writeJSON(filePath, data, opts) {
  opts = opts || {};
  const indent = opts.indent !== undefined ? opts.indent : 2;
  return write(filePath, JSON.stringify(data, null, indent) + '\n', opts);
}

function writeJSONSync(filePath, data, opts) {
  opts = opts || {};
  writeSync(filePath, JSON.stringify(data, null, opts.indent !== undefined ? opts.indent : 2) + '\n', opts);
}

async function readLines(filePath, opts) {
  const text = await read(filePath, opts);
  return text.split('\n');
}

async function exists(filePath) {
  try { await fsP.access(filePath); return true; }
  catch(_) { return false; }
}

function existsSync(filePath) { return fs.existsSync(filePath); }

async function stat(filePath) { return fsP.stat(filePath); }
function statSync(filePath)   { return fs.statSync(filePath); }

async function isFile(filePath)      { try { return (await fsP.stat(filePath)).isFile(); }      catch(_) { return false; } }
async function isDirectory(filePath) { try { return (await fsP.stat(filePath)).isDirectory(); } catch(_) { return false; } }
function isFileSync(filePath)        { try { return fs.statSync(filePath).isFile(); }      catch(_) { return false; } }
function isDirSync(filePath)         { try { return fs.statSync(filePath).isDirectory(); } catch(_) { return false; } }

async function size(filePath)  { return (await fsP.stat(filePath)).size; }

async function copy(src, dest, opts) {
  opts = opts || {};
  if (opts.mkdirp !== false) fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
  const flags = opts.overwrite === false ? fs.constants.COPYFILE_EXCL : 0;
  return fsP.copyFile(src, dest, flags);
}

async function move(src, dest, opts) {
  opts = opts || {};
  if (opts.mkdirp !== false) fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
  try { await fsP.rename(src, dest); }
  catch(_) { await copy(src, dest, opts); await remove(src); }
}

async function remove(filePath) {
  const s = await fsP.stat(filePath).catch(() => null);
  if (!s) return;
  if (s.isDirectory()) await fsP.rm(filePath, { recursive: true, force: true });
  else await fsP.unlink(filePath);
}

function removeSync(filePath) {
  if (!fs.existsSync(filePath)) return;
  const s = fs.statSync(filePath);
  if (s.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
  else fs.unlinkSync(filePath);
}

async function mkdir(dirPath, opts) {
  await fsP.mkdir(dirPath, { recursive: (opts && opts.recursive) !== false });
}

function mkdirSync(dirPath, opts) {
  fs.mkdirSync(dirPath, { recursive: (opts && opts.recursive) !== false });
}

async function readdir(dirPath, opts) {
  opts = opts || {};
  const entries = await fsP.readdir(dirPath, { withFileTypes: opts.withTypes });
  if (opts.withTypes) return entries;
  return entries;
}

function readdirSync(dirPath, opts) {
  return fs.readdirSync(dirPath, opts || {});
}

async function ls(dirPath, opts) {
  opts = opts || {};
  const entries = await fsP.readdir(dirPath, { withFileTypes: true });
  return entries.map(e => ({
    name:  e.name,
    path:  path.join(dirPath, e.name),
    isFile: e.isFile(),
    isDir:  e.isDirectory(),
    isSymlink: e.isSymbolicLink(),
  }));
}

// ─── Glob (no external deps) ──────────────────────────────────────────────────

function matchGlob(pattern, filePath) {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*\\\*/g, '%%DOUBLESTAR%%')
    .replace(/\*/g, '[^/]*')
    .replace(/%%DOUBLESTAR%%\//g, '(?:[^/]+/)*')
    .replace(/%%DOUBLESTAR%%/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regexStr}$`).test(filePath);
}

async function glob(pattern, opts) {
  opts = opts || {};
  const cwd     = opts.cwd || process.cwd();
  const results = [];
  const ignore  = opts.ignore || [];

  async function walk(dir, rel) {
    let entries;
    try { entries = await fsP.readdir(dir, { withFileTypes: true }); }
    catch(_) { return; }

    for (const entry of entries) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const entryAbs = path.join(dir, entry.name);

      if (ignore.some(p => matchGlob(p, entryRel) || entryRel.includes(p))) continue;
      if (entry.name === 'node_modules' && !pattern.includes('node_modules')) continue;
      if (entry.name.startsWith('.') && !opts.dot) continue;

      if (entry.isDirectory()) {
        await walk(entryAbs, entryRel);
      } else if (matchGlob(pattern, entryRel)) {
        results.push(opts.absolute ? entryAbs : entryRel);
      }
    }
  }

  await walk(cwd, '');
  return results;
}

// ─── Temp files ───────────────────────────────────────────────────────────────

function tmpPath(opts) {
  opts = opts || {};
  const ext    = opts.ext    || opts.extension || '';
  const prefix = opts.prefix || 'ntl_';
  const dir    = opts.dir    || os.tmpdir();
  return path.join(dir, `${prefix}${crypto.randomBytes(8).toString('hex')}${ext}`);
}

async function tmpFile(content, opts) {
  const p = tmpPath(opts);
  await write(p, content || '');
  return p;
}

async function tmpDir(opts) {
  const p = tmpPath(Object.assign({}, opts, { ext: '' }));
  await mkdir(p);
  return p;
}

// ─── Watcher ─────────────────────────────────────────────────────────────────

function watch(target, opts) {
  opts = opts || {};
  const emitter  = new EventEmitter();
  const watchers = [];

  const watcher = fs.watch(target, { recursive: opts.recursive !== false }, (eventType, filename) => {
    emitter.emit('change', { event: eventType, file: filename, path: path.join(target, filename || '') });
  });
  watchers.push(watcher);

  watcher.on('error', (e) => emitter.emit('error', e));

  return {
    on:    (...args) => emitter.on(...args),
    off:   (...args) => emitter.off(...args),
    close: ()        => { watchers.forEach(w => w.close()); emitter.emit('close'); },
  };
}

// ─── Path utilities ───────────────────────────────────────────────────────────

const pathUtils = {
  join:      (...args) => path.join(...args),
  resolve:   (...args) => path.resolve(...args),
  relative:  (from, to) => path.relative(from, to),
  dirname:   (p) => path.dirname(p),
  basename:  (p, ext) => path.basename(p, ext),
  extname:   (p) => path.extname(p),
  parse:     (p) => path.parse(p),
  normalize: (p) => path.normalize(p),
  isAbsolute:(p) => path.isAbsolute(p),
  sep:       path.sep,
  delimiter: path.delimiter,
};

module.exports = {
  read, readSync, write, writeSync,
  append, appendSync,
  readJSON, readJSONSync, writeJSON, writeJSONSync,
  readLines, readdir, readdirSync, ls,
  exists, existsSync, stat, statSync,
  isFile, isFileSync, isDirectory, isDirSync,
  size, copy, move, remove, removeSync,
  mkdir, mkdirSync, glob, matchGlob,
  tmpPath, tmpFile, tmpDir,
  watch, path: pathUtils,
};
