'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const STDLIB_DIR   = path.join(__dirname, '..', 'stdlib');
const MODULES_DIR  = path.join(__dirname, '..', 'modules');
const CACHE_DIR    = path.join(__dirname, '..', '.stdlib-cache');

const SELF_HOSTED = new Set(['cache', 'events', 'logger', 'queue', 'validate', 'env', 'utils']);

const _moduleCache = new Map();

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
  }
}

function loadStdlibModule(name) {
  if (_moduleCache.has(name)) return _moduleCache.get(name);

  const ntlSource  = path.join(STDLIB_DIR, name + '.ntl');
  const jsPrebuilt = path.join(MODULES_DIR, name + '.js');

  if (SELF_HOSTED.has(name) && fs.existsSync(ntlSource)) {
    const exports = compileAndLoad(name, ntlSource);
    _moduleCache.set(name, exports);
    return exports;
  }

  if (fs.existsSync(jsPrebuilt)) {
    const exports = require(jsPrebuilt);
    _moduleCache.set(name, exports);
    return exports;
  }

  throw new Error(`ntl:${name} — module not found`);
}

function compileAndLoad(name, ntlSourcePath) {
  ensureCacheDir();

  const cacheFile = path.join(CACHE_DIR, name + '.jsc');
  const source    = fs.readFileSync(ntlSourcePath, 'utf-8');
  const srcHash   = hashString(source);

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (cached.hash === srcHash) return runProtected(name, cached.code);
    } catch (_) {}
  }

  const { Compiler } = require(require('path').join(__dirname, 'compiler'));
  const compiler = new Compiler({ target: 'node', treeShake: false, strict: false, comments: false });
  const result   = compiler.compileSource(source, ntlSourcePath, {});

  if (!result.success) {
    const msgs = result.errors.map(e => e.message).join('; ');
    throw new Error(`ntl:${name} compile error — ${msgs}`);
  }

  const protectedCode = protect(result.code);

  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ hash: srcHash, code: protectedCode }), 'utf-8');
  } catch (_) {}

  return runProtected(name, protectedCode);
}

function runProtected(name, code) {
  const modExports = {};
  const modObj     = { exports: modExports };

  const ctx = vm.createContext({
    require, module: modObj, exports: modExports,
    console, process, Buffer, Math, JSON, Date, performance,
    setTimeout, setInterval, clearTimeout, clearInterval, setImmediate, clearImmediate,
    Promise, Object, Array, String, Number, Boolean, Error, TypeError,
    Map, Set, WeakMap, WeakSet, RegExp, Symbol, BigInt,
    URL, URLSearchParams, TextEncoder, TextDecoder,
  });

  try {
    vm.runInContext(code, ctx, { filename: `ntl:${name}` });
  } catch (e) {
    throw new Error(`ntl:${name} — ${e.message}`);
  }

  return modObj.exports;
}

function protect(code) {
  let out = code.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\n{3,}/g, '\n').trim();
  return `(function(module,exports,require){${out}})(module,exports,require);`;
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

module.exports = { loadStdlibModule, SELF_HOSTED };
