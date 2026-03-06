// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// (c) David Dev 2026. All rights reserved.
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const cp   = require('child_process');

const NTL_DIR = path.resolve(__dirname, '..');
const { TARGETS, TARGET_ALIASES, resolveTarget, listTargets } = require('./targets');

const STDLIB_NAMES = [
  'crypto','fs','events','http','ws','db','test','ai',
  'mail','validate','cache','env','logger','queue',
  'web','obf','android','utils'
];

function _findStdlibFile(name) {
  for (const sub of ['core','net','data','tools','ai','mobile','']) {
    const p = sub
      ? path.join(NTL_DIR, 'stdlib', sub, name + '.ntl')
      : path.join(NTL_DIR, 'stdlib', name + '.ntl');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function _compileAllStdlib() {
  const { Compiler } = require('./compiler');
  const c = new Compiler({ target: 'node', minify: true });
  const out = {};
  for (const name of STDLIB_NAMES) {
    const src = _findStdlibFile(name);
    if (!src) { out[name] = ''; continue; }
    const r = c.compileSource(fs.readFileSync(src, 'utf8'), name + '.ntl', { target: 'node' });
    out[name] = r.success ? r.code : '';
  }
  return out;
}

function _makeEmbeddedPreamble(compiled) {
  const table = JSON.stringify(compiled);
  return `(function(){
const _mod=require('module');
const _compiled=${table};
const _cache={};
const _origLoad=_mod._load.bind(_mod);
_mod._load=function(req,parent,isMain){
  if(req.startsWith('ntl:')){
    const name=req.slice(4);
    if(_cache[name])return _cache[name];
    const code=_compiled[name];
    if(!code)throw new Error('NTL module not found: '+req);
    const m={exports:{}};
    (new Function('module','exports','require',code))(m,m.exports,(r)=>_mod._load(r,parent,false));
    _cache[name]=m.exports;
    return m.exports;
  }
  return _origLoad(req,parent,isMain);
};
})();`;
}

async function compileToBinary(inputFile, outputFile, opts) {
  opts = opts || {};
  const targetName = opts.target || 'linux-x64';
  const target = resolveTarget(targetName);
  if (!target) throw new Error(`Unknown target: ${targetName}. Run "ntl binary --list-targets" to see available targets.`);

  if (target.os === 'wasm') {
    return _compileToWasm(inputFile, outputFile, opts, target);
  }

  const { Compiler } = require('./compiler');
  const compiler = new Compiler({ target: 'node', minify: true });
  const result = compiler.compileFile(inputFile, { target: 'node', minify: true });
  if (!result.success) throw new Error(result.errors.map(e => e.message).join('\n'));

  const stdlib = _compileAllStdlib();
  const preamble = _makeEmbeddedPreamble(stdlib);
  const fullCode = preamble + '\n' + result.code;

  const mode = opts.mode || (opts.standalone ? 'standalone' : 'shell');

  if (mode === 'standalone') {
    await _createStandaloneBinary(fullCode, outputFile, opts, target);
  } else {
    _createShellBinary(fullCode, outputFile, opts, target);
  }
}

function _createShellBinary(code, outputFile, opts, target) {
  const b64 = Buffer.from(code).toString('base64');
  let nodeCmd = 'node';

  const isWin = target && target.os === 'win';
  if (isWin) {
    const bat = [
      '@echo off',
      'setlocal',
      'set TMPFILE=%TEMP%\\ntl_%RANDOM%.js',
      'powershell -Command "[System.Convert]::FromBase64String(\'' + b64 + "') | Set-Content -Path $env:TMPFILE -Encoding Byte\"",
      'node "%TMPFILE%" %*',
      'del "%TMPFILE%"',
    ].join('\r\n');
    fs.writeFileSync(outputFile + '.bat', bat, 'ascii');
    return;
  }

  const shell = [
    '#!/bin/sh',
    'T=$(mktemp /tmp/.ntlXXXXXX)',
    'trap "rm -f $T" EXIT',
    'printf "%s" \'' + b64 + '\' | base64 -d > "$T"',
    'exec ' + nodeCmd + ' "$T" "$@"',
    '',
  ].join('\n');
  fs.writeFileSync(outputFile, shell, 'utf8');
  fs.chmodSync(outputFile, 0o755);
}

async function _createStandaloneBinary(code, outputFile, opts, target) {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), '.ntl_pkg_'));
  const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true }); } catch(_) {} };
  try {
    const pkgDir = path.join(tmpDir, 'pkg');
    fs.mkdirSync(pkgDir);
    fs.writeFileSync(path.join(pkgDir, 'app.js'), code, 'utf8');

    const nodeInTarget = target && target.os === target.os;
    fs.copyFileSync(process.execPath, path.join(pkgDir, 'node'));
    fs.chmodSync(path.join(pkgDir, 'node'), 0o755);

    const tarGz = path.join(tmpDir, 'payload.tar.gz');
    cp.spawnSync('tar', ['-czf', tarGz, '-C', tmpDir, 'pkg'], { timeout: 120000 });
    const b64 = fs.readFileSync(tarGz).toString('base64');

    const isWin = target && target.os === 'win';
    if (isWin) {
      const bat = [
        '@echo off',
        'setlocal',
        'set TD=%TEMP%\\ntl_%RANDOM%',
        'mkdir "%TD%"',
        'powershell -Command "$b=\'' + b64 + "';$d=[Convert]::FromBase64String($b);[IO.File]::WriteAllBytes('$env:TD\\p.tar.gz',$d);cd $env:TD;tar -xzf p.tar.gz\"",
        '"%TD%\\pkg\\node.exe" "%TD%\\pkg\\app.js" %*',
        'rmdir /s /q "%TD%"',
      ].join('\r\n');
      fs.writeFileSync(outputFile + '.bat', bat, 'ascii');
      return;
    }

    const targetNote = target ? ` (${target.triple})` : '';
    const shell = [
      '#!/bin/sh',
      `# NTL standalone binary — target: ${target ? target.triple : 'native'}`,
      'SELF=$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")',
      'TD=$(mktemp -d /tmp/.ntlXXXXXX)',
      'trap "rm -rf $TD" EXIT',
      'grep -A999999 "^#PAYLOAD$" "$SELF" | tail -n +2 | base64 -d | tar -xz -C "$TD"',
      'exec "$TD/pkg/node" "$TD/pkg/app.js" "$@"',
      '#PAYLOAD',
      b64,
      '',
    ].join('\n');
    fs.writeFileSync(outputFile, shell, 'utf8');
    fs.chmodSync(outputFile, 0o755);
  } finally { cleanup(); }
}

async function _compileToWasm(inputFile, outputFile, opts, target) {
  const { Compiler } = require('./compiler');
  const compiler = new Compiler({ target: 'wasm' });
  const result = compiler.compileFile(inputFile, { target: 'wasm' });
  if (!result.success) throw new Error(result.errors.map(e => e.message).join('\n'));

  const { compileNTLToWasm } = require('./wasm/wasm-binary');
  const wasmBytes = compileNTLToWasm(result.ast, { target });
  fs.writeFileSync(outputFile.endsWith('.wasm') ? outputFile : outputFile + '.wasm', wasmBytes);
}

async function compileToAllTargets(inputFile, outDir, opts) {
  opts = opts || {};
  const targets = opts.targets || listTargets();
  fs.mkdirSync(outDir, { recursive: true });
  const results = [];
  for (const tname of targets) {
    const t = resolveTarget(tname);
    if (!t) continue;
    const base = path.basename(inputFile, '.ntl');
    const outFile = path.join(outDir, `${base}_${tname.replace(/[^a-z0-9]/gi,'_')}${t.ext}`);
    try {
      await compileToBinary(inputFile, outFile, { ...opts, target: tname });
      results.push({ target: tname, file: outFile, ok: true });
    } catch(e) {
      results.push({ target: tname, file: outFile, ok: false, error: e.message });
    }
  }
  return results;
}

module.exports = {
  compileToBinary,
  compileToAllTargets,
  listTargets,
  TARGETS,
  _createShellBinary,
  _createStandaloneBinary,
  _compileAllStdlib,
  _makeEmbeddedPreamble,
};
