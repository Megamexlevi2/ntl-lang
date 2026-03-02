// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';
const nodeFs   = require('fs');
const nodePath = require('path');
function read(filePath, encoding) {
  return nodeFs.readFileSync(filePath, encoding || 'utf8');
}
function readAsync(filePath, encoding) {
  return nodeFs.promises.readFile(filePath, encoding || 'utf8');
}
function write(filePath, data, options) {
  options = options || {};
  const dir = nodePath.dirname(filePath);
  if (!nodeFs.existsSync(dir)) nodeFs.mkdirSync(dir, { recursive: true });
  nodeFs.writeFileSync(filePath, data, options);
  return true;
}
function writeAsync(filePath, data, options) {
  return nodeFs.promises.writeFile(filePath, data, options || {});
}
function append(filePath, data) {
  nodeFs.appendFileSync(filePath, data, 'utf8');
  return true;
}
function exists(filePath) {
  return nodeFs.existsSync(filePath);
}
function remove(filePath) {
  if (!nodeFs.existsSync(filePath)) return false;
  const stat = nodeFs.statSync(filePath);
  if (stat.isDirectory()) {
    nodeFs.rmSync(filePath, { recursive: true, force: true });
  } else {
    nodeFs.unlinkSync(filePath);
  }
  return true;
}
function move(src, dest) {
  const destDir = nodePath.dirname(dest);
  if (!nodeFs.existsSync(destDir)) nodeFs.mkdirSync(destDir, { recursive: true });
  nodeFs.renameSync(src, dest);
  return true;
}
function copy(src, dest) {
  const destDir = nodePath.dirname(dest);
  if (!nodeFs.existsSync(destDir)) nodeFs.mkdirSync(destDir, { recursive: true });
  nodeFs.copyFileSync(src, dest);
  return true;
}
function mkdir(dirPath, recursive) {
  if (!nodeFs.existsSync(dirPath)) {
    nodeFs.mkdirSync(dirPath, { recursive: recursive !== false });
  }
  return true;
}
function list(dirPath, options) {
  options = options || {};
  if (!nodeFs.existsSync(dirPath)) return [];
  const entries = nodeFs.readdirSync(dirPath, { withFileTypes: true });
  if (options.filesOnly) return entries.filter(e => e.isFile()).map(e => e.name);
  if (options.dirsOnly)  return entries.filter(e => e.isDirectory()).map(e => e.name);
  return entries.map(e => e.name);
}
function listFull(dirPath, options) {
  return list(dirPath, options).map(n => nodePath.join(dirPath, n));
}
function stat(filePath) {
  if (!nodeFs.existsSync(filePath)) return null;
  const s = nodeFs.statSync(filePath);
  return {
    size: s.size,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    created: s.birthtime,
    modified: s.mtime,
    accessed: s.atime,
    mode: s.mode
  };
}
function walk(dirPath, fn) {
  const entries = nodeFs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = nodePath.join(dirPath, entry.name);
    fn(full, entry);
    if (entry.isDirectory()) walk(full, fn);
  }
}
function glob(pattern, baseDir) {
  baseDir = baseDir || process.cwd();
  const results = [];
  const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
  walk(baseDir, (full) => {
    const rel = nodePath.relative(baseDir, full).replace(/\\/g, '/');
    if (regex.test(rel)) results.push(full);
  });
  return results;
}
function readJson(filePath) {
  return JSON.parse(read(filePath));
}
function writeJson(filePath, data, pretty) {
  const json = pretty !== false ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  return write(filePath, json + '\n');
}
function readLines(filePath) {
  return read(filePath).split('\n');
}
function touch(filePath) {
  const now = new Date();
  if (nodeFs.existsSync(filePath)) {
    nodeFs.utimesSync(filePath, now, now);
  } else {
    write(filePath, '');
  }
  return true;
}
function extension(filePath) {
  return nodePath.extname(filePath).slice(1);
}
function basename(filePath, ext) {
  return nodePath.basename(filePath, ext);
}
function dirname(filePath) {
  return nodePath.dirname(filePath);
}
function join(...parts) {
  return nodePath.join(...parts);
}
function resolve(...parts) {
  return nodePath.resolve(...parts);
}
function relative(from, to) {
  return nodePath.relative(from, to);
}
function isAbsolute(filePath) {
  return nodePath.isAbsolute(filePath);
}
function tmpDir() {
  return require('os').tmpdir();
}
function tmpFile(prefix, ext) {
  prefix = prefix || 'ntl_';
  ext = ext || '.tmp';
  const id = Math.random().toString(36).slice(2, 10);
  return nodePath.join(tmpDir(), `${prefix}${id}${ext}`);
}
function watch(filePath, fn, options) {
  options = options || {};
  return nodeFs.watch(filePath, options, fn);
}
function watchDir(dir, fn, options) {
  options = Object.assign({ recursive: true }, options || {});
  return nodeFs.watch(dir, options, fn);
}

// Aliases for common patterns
function readText(p, enc) { return read(p, enc); }
function writeText(p, data, enc) { return write(p, data, enc); }
function readJSON(p) {
  try { return JSON.parse(read(p, 'utf-8')); }
  catch(e) { throw new Error('[ntl:fs] readJSON failed: ' + e.message); }
}
function writeJSON(p, data, pretty) {
  write(p, JSON.stringify(data, null, pretty !== false ? 2 : 0), 'utf-8');
}
function lines(p) {
  return (read(p, 'utf-8') || '').split('\n').filter(l => l.length > 0);
}
function tree(dir, depth, _cur) {
  _cur = _cur || 0; depth = depth || 3;
  if (_cur > depth) return [];
  const nodeFs = require('fs');
  const nodePath = require('path');
  const entries = [];
  try {
    for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
      entries.push({ name: entry.name, path: nodePath.join(dir, entry.name), isDir: entry.isDirectory() });
      if (entry.isDirectory()) {
        entries.push(...tree(nodePath.join(dir, entry.name), depth, _cur + 1));
      }
    }
  } catch {}
  return entries;
}
function copyDir(src, dst) {
  const nodeFs = require('fs');
  const nodePath = require('path');
  nodeFs.mkdirSync(dst, { recursive: true });
  for (const entry of nodeFs.readdirSync(src, { withFileTypes: true })) {
    const s = nodePath.join(src, entry.name);
    const d = nodePath.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else nodeFs.copyFileSync(s, d);
  }
}

module.exports = {
  read, readAsync, write, writeAsync, append,
  exists, remove, move, copy, mkdir,
  list, listFull, stat,
  walk, glob,
  readJson, writeJson, readLines,
  touch, extension, basename, dirname, join, resolve, relative, isAbsolute,
  tmpDir, tmpFile,
  watch, watchDir,
  sep: nodePath.sep,
  cwd: () => process.cwd(),
  home: () => require('os').homedir(),
  readText, writeText, readJSON, writeJSON, lines, tree, copyDir
};
