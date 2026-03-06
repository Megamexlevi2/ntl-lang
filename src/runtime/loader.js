'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const STDLIB_DIR   = path.join(__dirname, '..', '..', 'stdlib');
const MODULES_DIR  = path.join(__dirname, '..', '..', 'modules');
const CACHE_DIR    = path.join(__dirname, '..', '..', '.stdlib-cache');

const SELF_HOSTED = new Set([
  'cache', 'events', 'logger', 'queue', 'validate', 'env', 'utils',
  'crypto', 'fs', 'android', 'test', 'ai', 'mail', 'http', 'ws', 'db', 'obf', 'web'
]);

const _moduleCache = new Map();

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (_) {}
  }
}

function loadStdlibModule(name) {
  if (_moduleCache.has(name)) return _moduleCache.get(name);

  const subdirs = ['core', 'net', 'data', 'tools', 'ai', 'mobile', ''];
  let ntlSource = null;
  for (const sub of subdirs) {
    const candidate = sub
      ? path.join(STDLIB_DIR, sub, name + '.ntl')
      : path.join(STDLIB_DIR, name + '.ntl');
    if (require('fs').existsSync(candidate)) { ntlSource = candidate; break; }
  }
  if (!ntlSource) ntlSource = path.join(STDLIB_DIR, name + '.ntl');
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

  const { Compiler } = require(require('path').join(__dirname, '..', 'compiler'));
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
  let out = '';
  let i = 0;
  const len = code.length;
  while (i < len) {
    const ch = code[i];
    if (ch === '`') {
      out += ch; i++;
      while (i < len) {
        const c2 = code[i];
        if (c2 === '\\') { out += c2 + (code[i+1]||''); i += 2; continue; }
        out += c2; i++;
        if (c2 === '`') break;
        if (c2 === '$' && code[i] === '{') {
          out += code[i++];
          let depth = 1;
          while (i < len && depth > 0) {
            const c3 = code[i];
            if (c3 === '{') depth++;
            else if (c3 === '}') depth--;
            out += c3; i++;
          }
        }
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      out += ch; i++;
      while (i < len) {
        const c2 = code[i];
        if (c2 === '\\') { out += c2 + (code[i+1]||''); i += 2; continue; }
        out += c2; i++;
        if (c2 === ch) break;
      }
      continue;
    }
    if (ch === '/' && code[i+1] === '*') {
      i += 2;
      while (i < len && !(code[i] === '*' && code[i+1] === '/')) i++;
      i += 2; out += ' '; continue;
    }
    if (ch === '/' && (code[i+1] === '/' || code[i+1] === ' ' || code[i+1] === '\n')) {
      if (code[i+1] === '/') {
        const tr = out.trimEnd(); const prev = tr.slice(-1);
        const afterOp = '=({[,!&|?:^~%<>;\n+*'.includes(prev) || tr === '';
        if (!afterOp) { while (i < len && code[i] !== '\n') i++; continue; }
      }
    }
    if (ch === '/' && code[i+1] === '/') {
      const tr = out.trimEnd(); const prev = tr.slice(-1);
      const afterOp = '=({[,!&|?:^~%<>;\n+*'.includes(prev) || tr === '';
      if (!afterOp) { while (i < len && code[i] !== '\n') i++; continue; }
      out += ch; i++; continue;
    }
    if (ch === '/') {
      const tr = out.trimEnd(); const prev = tr.slice(-1);
      const afterOp = '=({[,!&|?:^~%<>;'.includes(prev) || tr === '' ||
        /\b(return|typeof|instanceof|in|of|new|delete|throw|case)\s*$/.test(tr);
      if (afterOp && code[i+1] !== '=') {
        out += ch; i++;
        while (i < len) {
          const c2 = code[i];
          if (c2 === '\\') { out += c2 + (code[i+1]||''); i += 2; continue; }
          if (c2 === '[') {
            out += c2; i++;
            while (i < len && code[i] !== ']') {
              if (code[i] === '\\') { out += code[i] + (code[i+1]||''); i += 2; continue; }
              out += code[i++];
            }
            if (i < len) { out += code[i++]; }
            continue;
          }
          out += c2; i++;
          if (c2 === '/') break;
        }
        while (i < len && /[gimsuy]/.test(code[i])) out += code[i++];
        continue;
      }
    }
    out += ch; i++;
  }
  out = out.replace(/\n{3,}/g, '\n').trim();
  return `(function(module,exports,require){${out}})(module,exports,require);`;
}
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

module.exports = { loadStdlibModule, SELF_HOSTED };
