#!/usr/bin/env node
'use strict';

// Created by David Dev
// GitHub: https://github.com/Megamexlevi/ntl-lang
// (c) David Dev 2026. All rights reserved.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { Compiler, NTL_VERSION } = require('./src/compiler');
const { format: fmtErr, R }     = require('./src/error');
const { obfuscate }             = require('./modules/obf');
const { Bundler }               = require('./src/runtime/bundler');

const BOLD  = t => R.bold(t);
const DIM   = t => R.dim(t);
const CYAN  = t => R.cyan(t);
const GREEN  = t => R.green(t);
const RED    = t => R.red(t);
const GRAY   = t => R.gray(t);
const YELLOW = t => R.yellow(t);

const args       = process.argv.slice(2);
const flags      = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = args[i+1] && !args[i+1].startsWith('-') ? args[++i] : true;
  } else if (a.startsWith('-') && a.length === 2) {
    flags[a.slice(1)] = args[i+1] && !args[i+1].startsWith('-') ? args[++i] : true;
  } else {
    positional.push(a);
  }
}
const inlineCode = flags.e || flags.eval || null;
const cmd     = inlineCode ? '__eval__' : positional[0];
const fileArg = positional[1];

const HELP = `
${BOLD(CYAN('NTL') + ' v3.5')} ${GRAY('— A language for people who ship things')}

${BOLD('USAGE')}
  ntl <command> [file] [options]

${BOLD('COMMANDS')}
  ${GREEN('run')}    <file.ntl>          Run a NTL file
  ${GREEN('build')}  <file|ntl.json>     Compile to JavaScript
  ${GREEN('bundle')} <file|dir>          Bundle everything into one file
  ${GREEN('check')}  <file.ntl>          Type-check without running
  ${GREEN('watch')}  <file.ntl>          Recompile on save
  ${GREEN('dev')}    [dir]               Dev server with hot reload
  ${GREEN('repl')}                       Interactive prompt
  ${GREEN('init')}   [dir]               Create a new project
  ${GREEN('fmt')}    <file.ntl>          Format a file
  ${GREEN('ide')}    [file.ntl]          Open the terminal editor
  ${GREEN('jit')}    <file.ntl>          Build with JIT instrumentation
  ${GREEN('wasm')}   <file.ntl>          Compile to WebAssembly
  ${GREEN('binary')} <file.ntl> [-o out] Compile to a standalone executable binary
  ${GREEN('native')} <file.ntl>          Cross-compile (15 architectures)
  ${GREEN('opt')}    <file.ntl>          Show optimizer output
  ${GREEN('nax')}    <install|list|...>  Module manager
  ${GREEN('version')}                    Print version
  ${GREEN('help')}                       This screen

${BOLD('RUNNING CODE')}
  ${CYAN('ntl run app.ntl')}                   Run a file (JIT on by default)
  ${CYAN('ntl run app.ntl --verbose')}         Show V8 tier upgrades as they happen
  ${CYAN('ntl run app.ntl --jit-report')}      Print a hot-path table after execution
  ${CYAN('ntl -e "log 1 + 1"')}               Inline code, no file needed

${BOLD('BUILDING')}
  ${CYAN('ntl build app.ntl -o dist/app.js')}
  ${CYAN('ntl build app.ntl --minify --obfuscate')}
  ${CYAN('ntl build ntl.json')}               Build a full project
  ${CYAN('ntl build app.ntl --target=browser')}
  ${CYAN('ntl build app.ntl --comments')}      Add type annotations to output

${BOLD('LARGE PROJECTS')}
  ${DIM('ntl.json at the root configures multi-file projects:')}
  ${DIM('  { "src": "src", "dist": "dist", "compilerOptions": { "strict": true } }')}
  ${DIM('')}
  ${CYAN('ntl build ntl.json')}               Compile the whole project
  ${CYAN('ntl check ntl.json --strict')}      Type-check everything
  ${CYAN('ntl watch ntl.json')}               Watch mode for teams
  ${DIM('Works great in monorepos, CI pipelines, and Docker.')}

${BOLD('NODE.JS COMPATIBILITY')}
  ${DIM('NTL compiles to CommonJS. Every npm package works with no config:')}
  ${DIM('')}
  ${DIM('  val express  = require("express")')}
  ${DIM('  val prisma   = require("@prisma/client")')}
  ${DIM('  val {readFile} = require("fs/promises")')}
  ${DIM('')}
  ${DIM('All Node.js built-ins (fs, path, http, crypto...) are available.')}

${BOLD('BUILT-IN MODULES')}
  ${CYAN('ntl:http')}      server, router, fetch, cors, static, rate limit
  ${CYAN('ntl:db')}        SQLite — query builder, migrations, ORM
  ${CYAN('ntl:cache')}     LRU cache with TTL
  ${CYAN('ntl:logger')}    structured logs — levels, file output, child loggers
  ${CYAN('ntl:validate')}  schema validation (Zod-style)
  ${CYAN('ntl:events')}    event emitter / pub-sub
  ${CYAN('ntl:queue')}     job queue — retries, delays, concurrency
  ${CYAN('ntl:crypto')}    hashing, AES, JWT, UUID
  ${CYAN('ntl:env')}       env vars, .env files, validation
  ${CYAN('ntl:ws')}        WebSocket (no native deps)
  ${CYAN('ntl:mail')}      send email via SMTP
  ${CYAN('ntl:test')}      test runner
  ${CYAN('ntl:ai')}        OpenAI, Anthropic, Ollama integrations
  ${DIM('')}
  ${DIM('All built-in modules are written in NTL itself (self-hosted).')}
  ${DIM('Compiled and protected at load time — source is never exposed.')}

${BOLD('LANGUAGE FEATURES')}
  ${CYAN('@class Name {}')}            enhanced class with decorator support
  ${CYAN('state field')}               instance field declaration inside @class
  ${CYAN('unless expr { }')}           if not — reads like English
  ${CYAN('guard expr else { }')}       early exit pattern
  ${CYAN('defer { }')}                 cleanup on scope exit
  ${CYAN('each x in list { }')}        for-of without the noise
  ${CYAN('repeat N { }')}              run a block N times
  ${CYAN('try? expr')}                 returns null on throw
  ${CYAN('log expr, ...')}             console.log shorthand
  ${CYAN('range(n)')}                  [0..n-1]
  ${CYAN('sleep(ms)')}                 await N milliseconds
  ${CYAN('match x { case => }')}       pattern matching

${BOLD('TUTORIAL')}
  ${DIM('node tutorial.js     — starts an interactive tutorial at http://localhost:5000')}
  ${DIM('34 lessons, 10 chapters, runs NTL code live in the browser.')}
`;

function buildOpts() {
  return {
    target:        flags.target        || 'node',
    strict:        !!flags.strict,
    minify:        !!flags.minify,
    obfuscate:     !!flags.obfuscate,
    treeShake:     flags['no-treeshake'] !== true,
    credits:       !!flags.credits,
    typeCheck:     !!(flags['type-check'] || flags.check),
    sourceMap:     !!flags['source-map'],
    incremental:   !!flags.incremental,
    jsx:           !!flags.jsx,
    jsxPragma:     flags['jsx-pragma']  || 'React.createElement',
    jsxPragmaFrag: flags['jsx-frag']    || 'React.Fragment',
    jsxAutoImport: flags['jsx-import'] !== 'none',
    comments:      !!flags.comments,
    arch:          flags.arch           || null,
  };
}

function die(msg)  { process.stderr.write('\n' + RED('error') + ': ' + msg + '\n\n'); process.exit(1); }
function ok(msg)   { process.stdout.write(GREEN('  ✓') + ' ' + msg + '\n'); }
function info(msg) { process.stdout.write(GRAY('  ' + msg) + '\n'); }
function warn(msg) { process.stderr.write(YELLOW('  warn') + ': ' + msg + '\n'); }

function makeRunContext(absFile, extras) {
  const ctx = {
    require: (m) => {
      if (m.startsWith('./') || m.startsWith('../')) {
        return require(path.resolve(path.dirname(absFile), m));
      }
      if (m.startsWith('ntl:')) {
        const modName = m.slice(4);
        try {
          const { loadStdlibModule } = require('./src/runtime/loader');
          return loadStdlibModule(modName);
        } catch(_) {
          try { return require(path.join(__dirname, 'modules', modName)); } catch(_2) {}
        }
      }
      return require(m);
    },
    console, process, Buffer, global, globalThis,
    setTimeout, setInterval, clearTimeout, clearInterval,
    setImmediate, clearImmediate, queueMicrotask,
    Promise, Math, JSON, Date, performance,
    Object, Array, String, Number, Boolean,
    Error, TypeError, RangeError, ReferenceError, SyntaxError,
    Map, Set, WeakMap, WeakSet,
    RegExp, Symbol, BigInt, Proxy, Reflect,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto:    require('crypto'),
    path, fs, vm,
    os:        require('os'),
    events:    require('events'),
    stream:    require('stream'),
    http:      require('http'),
    https:     require('https'),
    net:       require('net'),
    child_process: require('child_process'),
    assert:    require('assert'),
    util:      require('util'),
    zlib:      require('zlib'),
    querystring: require('querystring'),
    __filename: absFile,
    __dirname:  path.dirname(absFile),
    module:    { exports: {}, filename: absFile, id: absFile },
    exports:   {},
  };
  ctx.global     = ctx;
  ctx.globalThis = ctx;
  if (extras) Object.assign(ctx, extras);
  return ctx;
}

function runFile(file, opts) {
  const absFile  = path.resolve(file);
  const source   = fs.readFileSync(file, 'utf-8');
  const srcLines = source.split('\n');
  const useJIT   = !!(flags.profile || flags['jit-report']);
  const verbose  = !!(flags.verbose || flags.v);
  const report   = !!(flags['jit-report']);
  const optimize = flags['no-optimize'] !== true;

  if (useJIT) {
    const { JITRunner } = require('./src/jit/JITRuntime');
    const compiler = new Compiler(opts);
    const runner   = new JITRunner({ verbose, showUpgrades: verbose, optimize });
    const ctx      = makeRunContext(absFile, { __ntl_jit_profiler__: runner.profiler });
    vm.createContext(ctx);

    const res = runner.run(source, file, compiler, ctx);

    if (!res.success) {
      for (const e of (res.errors || [])) {
        process.stderr.write(fmtErr(
          Object.assign({ file, sourceLines: srcLines, ntlError: false }, e), srcLines));
      }
      process.exit(1);
    }
    if (report || verbose) runner.printReport();
  } else {
    const compiler = new Compiler(opts);
    const result   = compiler.compileSource(source, file, opts);
    if (!result.success) {
      for (const e of result.errors) {
        process.stderr.write(fmtErr(Object.assign({}, e, { file, sourceLines: srcLines }), srcLines));
      }
      process.exit(1);
    }
    const os      = require('os');
    const crypto  = require('crypto');
    const tmpDir  = os.tmpdir();
    const tmpHash = crypto.createHash('md5').update(absFile + source.length).digest('hex').slice(0, 8);
    const tmpFile = path.join(tmpDir, 'ntl_run_' + tmpHash + '.js');

    const preamble = _buildRunPreamble(absFile);
    const fullCode = preamble + '\n' + result.code;

    try {
      fs.writeFileSync(tmpFile, fullCode, 'utf-8');
      require(tmpFile);
    } catch (e) {
      const errMsg = (e && e.message) ? e.message : String(e);
      const errObj = Object.assign({}, e, { message: errMsg, file, sourceLines: srcLines, ntlError: false });
      process.stderr.write(fmtErr(errObj, srcLines));
      process.exit(1);
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
}

function _buildRunPreamble(absFile) {
  const ntlDir  = JSON.stringify(path.join(__dirname));
  const fileDir = JSON.stringify(path.dirname(absFile));
  return `(function(){
const Module  = require('module');
const _path   = require('path');
const _ntlDir = ${ntlDir};
const _fileDir= ${fileDir};
const _orig   = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(req, parent, isMain, opts) {
  if (req.startsWith('./') || req.startsWith('../')) {
    return _orig(_path.resolve(_fileDir, req), parent, isMain, opts);
  }
  if (req.startsWith('ntl:')) {
    const { resolveToPath } = require(_path.join(_ntlDir, 'src/runtime/resolver'));
    const p = resolveToPath(req);
    if (p) return p;
  }
  return _orig(req, parent, isMain, opts);
};
const _origLoad = Module._load.bind(Module);
Module._load = function(req, parent, isMain) {
  if (req.startsWith('ntl:')) {
    const { loadStdlibModule } = require(_path.join(_ntlDir, 'src/runtime/loader'));
    return loadStdlibModule(req.slice(4));
  }
  return _origLoad(req, parent, isMain);
};
})();`;
}

function compileAndWrite(inputFile, outputFile, opts) {
  const compiler = new Compiler(opts);
  const t0 = Date.now();
  if (inputFile.endsWith('.json')) {
    const config     = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const projResult = compiler.compileProject(config);
    process.stdout.write('\n');
    for (const f of projResult.files) {
      ok(`${f.input}  →  ${CYAN(f.output)}  ${GRAY(f.chars + ' bytes, ' + f.time + 'ms')}`);
    }
    if (projResult.failed > 0) {
      process.stdout.write('\n');
      for (const e of projResult.errors) process.stderr.write(fmtErr(e, e.sourceLines));
      process.stdout.write(RED(`\n  ✖ ${projResult.failed} file(s) failed\n\n`));
      process.exit(1);
    }
    process.stdout.write('\n' + GREEN(`  ✔ ${projResult.succeeded} file(s) compiled`) +
      GRAY(` in ${Date.now() - t0}ms`) + '\n\n');
    return;
  }
  const result = compiler.compileFile(inputFile, opts);
  if (!result.success) {
    for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines));
    process.exit(1);
  }
  let code = result.code;
  if (opts.obfuscate) code = obfuscate(code, { level: 'max', stringArray: true, encodeNumbers: true, deadCode: true });
  if (outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    const preamble = _buildRunPreamble(path.resolve(inputFile));
    const finalCode = preamble + '\n' + code;
    fs.writeFileSync(outputFile, finalCode, 'utf-8');
    const kb = (finalCode.length / 1024).toFixed(1);
    ok(`${path.relative('.', inputFile)}  ${GRAY('→')}  ${outputFile}  ${GRAY(kb + ' KB · ' + result.time + 'ms · ' + result.target)}`);
    for (const w of (result.warnings || [])) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
  } else {
    process.stdout.write(code);
  }
}

function checkFile(file, opts) {
  const compiler = new Compiler(Object.assign({}, opts, { typeCheck: true }));
  const source   = fs.readFileSync(file, 'utf-8');
  const result   = compiler.compileSource(source, file, opts);
  if (!result.success) { for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines)); process.exit(1); }
  ok(`${path.relative('.', file)} — no errors found`);
  for (const w of (result.warnings || [])) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
}

function watchFile(file, opts) {
  info(`Watching ${CYAN(file)} for changes...`);
  const run = () => {
    try { compileAndWrite(file, flags.out || flags.o || null, opts); }
    catch (e) { process.stderr.write(RED('  Error: ') + e.message + '\n'); }
  };
  run();
  fs.watch(file, { persistent: true }, ev => { if (ev === 'change') run(); });
}

function devServer(dir, opts) {
  const port = parseInt(flags.port || flags.p || '3000');
  dir = dir || '.';
  info(`Starting dev server on ${CYAN('http://localhost:' + port)}`);
  const compiler = new Compiler(opts);
  const http     = require('http');
  const files    = {};
  const ntlFiles = findNTL(dir);
  const compile  = (f) => {
    const r = compiler.compileFile(f, opts);
    if (r.success) { files[f] = r.code; ok(`Compiled ${path.relative(dir, f)}`); }
    else for (const e of r.errors) process.stderr.write(fmtErr(e, e.sourceLines));
  };
  ntlFiles.forEach(f => { compile(f); fs.watch(f, ev => { if (ev === 'change') compile(f); }); });
  http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index' : req.url.replace(/\.js$/, '');
    const key = Object.keys(files).find(f => f.endsWith(urlPath.slice(1) + '.ntl'));
    if (key) { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(files[key]); }
    else { res.writeHead(404); res.end('Not found'); }
  }).listen(port, () => ok(`Dev server running at ${CYAN('http://localhost:' + port)}`));
}

function findNTL(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      files.push(...findNTL(full));
    } else if (entry.name.endsWith('.ntl')) {
      files.push(full);
    }
  }
  return files;
}

function initProject(dir) {
  dir = dir || '.';
  fs.mkdirSync(path.join(dir, 'src'),  { recursive: true });
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  const cfg = {
    $schema: 'https://ntlang.dev/schema/ntl.json', name: path.basename(path.resolve(dir)),
    version: '0.1.0', src: 'src', dist: 'dist',
    compilerOptions: { target: 'node', strict: true, minify: false, treeShake: true },
    include: ['src*.ntl'], exclude: ['node_modules', 'dist'],
  };
  const cfgPath = path.join(dir, 'ntl.json');
  if (!fs.existsSync(cfgPath)) { fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8'); ok(`Created ${CYAN('ntl.json')}`); }
  const mainFile = path.join(dir, 'src', 'main.ntl');
  if (!fs.existsSync(mainFile)) {
    fs.writeFileSync(mainFile, 'val name: string = "World"\n\nfn greet(name: string) -> string {\n  return `Hello, ${name}!`\n}\n\nconsole.log(greet(name))\n', 'utf-8');
    ok(`Created ${CYAN('src/main.ntl')}`);
  }
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: cfg.name, version: cfg.version,
      scripts: { build: 'ntl build ntl.json', dev: 'ntl dev', start: 'node dist/main.js' },
      devDependencies: {} }, null, 2) + '\n', 'utf-8');
    ok(`Created ${CYAN('package.json')}`);
  }
  if (!fs.existsSync(path.join(dir, '.gitignore'))) {
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n*.js.map\n');
    ok(`Created ${CYAN('.gitignore')}`);
  }
  try {
    const { SCAFFOLDS } = require('./modules/web');
    for (const [relPath, content] of Object.entries(SCAFFOLDS)) {
      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      if (!fs.existsSync(fullPath)) { fs.writeFileSync(fullPath, content, 'utf-8'); ok(`Created ${CYAN(relPath)}`); }
    }
  } catch (_) {}
  process.stdout.write('\n');
  ok(`Project initialized! Run ${CYAN('ntl run src/main.ntl')} to start.`);
  process.stdout.write('\n');
}

function printVersion() {
  const cpu = require('os').cpus();
  process.stdout.write(`\nntl ${NTL_VERSION}  ${GRAY('node ' + process.version + '  v8/' + process.versions.v8 + '  ' + process.platform + '/' + process.arch)}\n\n`);
}

const eFlag = flags.e || flags.eval;
if (eFlag && typeof eFlag === 'string') {
  const { JITRunner } = require('./src/jit/JITRuntime');
  const _eCompiler = new Compiler({ target: 'node', treeShake: false });
  const _eRunner   = new JITRunner({ verbose: false, showUpgrades: false, optimize: false });
  const _eCtx      = makeRunContext('<eval>', {});
  vm.createContext(_eCtx);
  const _eRes = _eRunner.run(eFlag, '<eval>', _eCompiler, _eCtx);
  if (!_eRes.success) {
    for (const e of (_eRes.errors || [])) {
      process.stderr.write(fmtErr(Object.assign({ ntlError: false }, e), eFlag.split('\n')));
    }
    process.exit(1);
  }
  process.exit(0);
}

switch (cmd) {

  case '__eval__': {
    const evalSource = String(inlineCode).replace(/;/g, '\n');
    const evalCompiler = new Compiler(buildOpts());
    const evalResult   = evalCompiler.compileSource(evalSource, '<eval>', buildOpts());
    if (!evalResult.success) {
      for (const e of evalResult.errors)
        process.stderr.write(fmtErr(Object.assign({}, e, { file: '<eval>', sourceLines: evalSource.split('\n') }), evalSource.split('\n')));
      process.exit(1);
    }
    const evalCtx = makeRunContext(path.resolve('./__eval__.ntl'));
    vm.createContext(evalCtx);
    try { new vm.Script(evalResult.code, { filename: '<eval>', displayErrors: true }).runInContext(evalCtx); }
    catch (e) {
      const lines = evalSource.split('\n');
      process.stderr.write(fmtErr(Object.assign({}, e, { file: '<eval>', sourceLines: lines, ntlError: false }), lines));
      process.exit(1);
    }
    break;
  }

  case 'tutorial': {
    const tutorialPath = require('path').join(__dirname, 'tutorial.js');
    if (!fs.existsSync(tutorialPath)) die('tutorial.js not found — run ntl from the project directory');
    require(tutorialPath);
    break;
  }

  case 'run': {
    if (!fileArg)              die('Usage: ntl run <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    runFile(fileArg, buildOpts());
    break;
  }

  case 'build': {
    if (!fileArg)              die('Usage: ntl build <file.ntl|ntl.json> [-o output.js]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    process.stdout.write('\n');
    compileAndWrite(fileArg, flags.out || flags.o || null, buildOpts());
    break;
  }

  case 'bundle': {
    if (!fileArg) die('Usage: ntl bundle <file.ntl|dir> [-o output.js]');
    const outFile = flags.out || flags.o || 'dist/bundle.js';
    const bundler = new Bundler(buildOpts());
    process.stdout.write('\n');
    try {
      const stat = fs.statSync(fileArg);
      if (stat.isDirectory()) bundler.bundleDir(fileArg, outFile);
      else bundler.bundleFile(fileArg, outFile);
      ok(`Bundled ${CYAN(fileArg)}  →  ${CYAN(outFile)}`);
    } catch (e) { die(e.message); }
    break;
  }

  case 'check': {
    if (!fileArg)              die('Usage: ntl check <file.ntl> [--strict]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    checkFile(fileArg, buildOpts());
    break;
  }

  case 'watch': {
    if (!fileArg)              die('Usage: ntl watch <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    watchFile(fileArg, buildOpts());
    break;
  }

  case 'dev': {
    devServer(fileArg || '.', buildOpts());
    break;
  }

  case 'repl': {
    require('./repl').start();
    break;
  }

  case 'android': case 'termux': {
    const m = require('./android/repl');
    if (m.AndroidREPL) new m.AndroidREPL().start();
    else die('Android REPL not available on this platform');
    break;
  }

  case 'fmt': {
    if (!fileArg)              die('Usage: ntl fmt <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const { format } = require('./src/transforms/formatter');
    const src = fs.readFileSync(fileArg, 'utf-8');
    const formatted = format(src);
    const dest = flags.out || flags.o || fileArg;
    fs.writeFileSync(dest, formatted, 'utf-8');
    ok(dest === fileArg ? `Formatted ${CYAN(fileArg)} in place` : `Formatted → ${CYAN(dest)}`);
    break;
  }

  case 'init': {
    initProject(fileArg);
    break;
  }

  case 'nax': {
    const sub = positional[1];
    const { naxLoad, naxList, naxClear, createModuleJson } = require('./src/runtime/nax');
    if (sub === 'install' || sub === 'add') {
      const url = positional[2];
      if (!url) die('Usage: ntl nax install <github.com/user/repo>');
      naxLoad(url).then(() => ok(`Module installed from ${CYAN(url)}`)).catch(e => die(e.message));
    } else if (sub === 'list') {
      const mods = naxList();
      if (!mods.length) info('No cached modules');
      else mods.forEach(m => info(`${CYAN(m.name)} by ${m.author} — ${m.description}`));
    } else if (sub === 'clear') {
      naxClear(); ok('Module cache cleared');
    } else if (sub === 'init') {
      const name = positional[2] || 'my-module';
      const json = createModuleJson({ name, description: 'A NTL module', main: 'index.ntl', license: 'MIT', author: 'Unknown' });
      fs.writeFileSync('module.json', json, 'utf-8'); ok(`Created ${CYAN('module.json')}`);
    } else {
      process.stdout.write(`\n${BOLD(CYAN('nax — NTL Module Manager'))}\n\n`);
      process.stdout.write(`  ${GREEN('nax install')} <url>   Install from GitHub\n`);
      process.stdout.write(`  ${GREEN('nax list')}           List cached modules\n`);
      process.stdout.write(`  ${GREEN('nax clear')}          Clear module cache\n`);
      process.stdout.write(`  ${GREEN('nax init')} [name]    Create module.json\n\n`);
    }
    break;
  }

  case 'ide': {
    const { TerminalIDE } = require('./src/ide/TerminalIDE');
    const ideFile = fileArg || null;
    if (ideFile && !fs.existsSync(ideFile)) {
      if (!ideFile.endsWith('.ntl')) die('IDE file must have .ntl extension');
      fs.writeFileSync(ideFile, '', 'utf-8');
    }
    const ide = new TerminalIDE(ideFile, { compiler: new Compiler(buildOpts()) });
    ide.start().catch(e => die(e.message));
    break;
  }

  case 'jit': {
    if (!fileArg)              die('Usage: ntl jit <file.ntl> [-o output.js]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const { JITPipeline } = require('./src/jit/JITPipeline');
    const pipeline = new JITPipeline({ verbose: !!flags.verbose, optimize: true });
    const source   = fs.readFileSync(fileArg, 'utf-8');
    const result   = pipeline.compileWithJIT(source, fileArg, new Compiler(buildOpts()));
    if (!result.success) { for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines)); process.exit(1); }
    process.stdout.write('\n');
    ok(`${path.relative('.', fileArg)}  compiled with profiling`);
    const s = result.optimizations || {};
    if (s.folded || s.eliminated || s.inlined) {
      const parts = [];
      if (s.folded)     parts.push(s.folded + ' constants folded');
      if (s.eliminated) parts.push(s.eliminated + ' dead branches removed');
      if (s.inlined)    parts.push(s.inlined + ' functions inlined');
      info(parts.join(' · '));
    };
    const outFile = flags.out || flags.o;
    if (outFile) {
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.writeFileSync(outFile, result.code, 'utf-8');
      ok(`written to ${outFile}`);
    } else {
      process.stdout.write(result.code);
    }
    break;
  }

  case 'wasm': {
    if (!fileArg)              die('Usage: ntl wasm <file.ntl> [-o output.wat] [--arch=wasm32]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const { WasmCompiler } = require('./src/wasm/WasmCompiler');
    const wasmArch   = flags.arch || 'wasm32';
    const wasmResult = new Compiler(buildOpts()).compileSource(fs.readFileSync(fileArg, 'utf-8'), fileArg, {});
    if (!wasmResult.success) { for (const e of wasmResult.errors) process.stderr.write(fmtErr(e, e.sourceLines)); process.exit(1); }
    const wat     = new WasmCompiler({ arch: wasmArch }).generateWAT(wasmResult.ast, { arch: wasmArch });
    const outFile = flags.out || flags.o || fileArg.replace(/\.ntl$/, '.wat');
    fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
    fs.writeFileSync(outFile, wat, 'utf-8');
    process.stdout.write('\n');
    ok(`${wasmArch}  compiled`);
    ok(`written  ${outFile}  ${GRAY('(' + (wat.length / 1024).toFixed(1) + ' KB)')}`);
    info('run: wat2wasm ' + path.relative('.', outFile));
    process.stdout.write('\n');
    break;
  }

  case 'native': {
    if (!fileArg) die('Usage: ntl native <file.ntl> [--arch=x86_64,arm64,...] [-o dir]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const { resolveArchTargets, ARCH_TARGETS } = require('./src/jit/ArchTargets');
    const { WasmCompiler: WC2 } = require('./src/wasm/WasmCompiler');
    const archStr = flags.arch || 'x86_64,arm64,wasm32';
    let archTargets;
    try { archTargets = resolveArchTargets(archStr); } catch (e) { die(e.message); }
    const natResult = new Compiler(buildOpts()).compileSource(fs.readFileSync(fileArg, 'utf-8'), fileArg, {});
    if (!natResult.success) { for (const e of natResult.errors) process.stderr.write(fmtErr(e, e.sourceLines)); process.exit(1); }
    const outDir = flags.out || flags.o || path.join(path.dirname(fileArg), 'native');
    fs.mkdirSync(outDir, { recursive: true });
    process.stdout.write('\n');
    info(`compiling for ${archTargets.length} targets`);
    process.stdout.write('\n');
    for (const arch of archTargets) {
      const wat     = new WC2({ arch }).generateWAT(natResult.ast, { arch });
      const outFile = path.join(outDir, `${path.basename(fileArg, '.ntl')}.${arch}.wat`);
      fs.writeFileSync(outFile, wat, 'utf-8');
      ok(`${ARCH_TARGETS[arch].name.padEnd(30)} → ${CYAN(path.relative('.', outFile))}`);
    }
    process.stdout.write('\n');
    ok(`${archTargets.length} targets  →  ${outDir}`);
    info('Run  wat2wasm <file.wat>   to convert to binary');
    info('Run  wasmtime <file.wasm>  to execute anywhere');
    process.stdout.write('\n');
    break;
  }

  case 'opt': {
    if (!fileArg)              die('Usage: ntl opt <file.ntl> [-o output.js]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const { Optimizer } = require('./src/jit/Optimizer');
    const optResult = new Compiler(buildOpts()).compileSource(fs.readFileSync(fileArg, 'utf-8'), fileArg, {});
    if (!optResult.success) { for (const e of optResult.errors) process.stderr.write(fmtErr(e, e.sourceLines)); process.exit(1); }
    const opt   = new Optimizer({ constantFolding: true, deadCode: true, inlining: true });
    opt.optimize(optResult.ast);
    const stats = opt.getStats();
    process.stdout.write('\n');
    ok(`${path.relative('.', fileArg)}`);
    process.stdout.write('\n');
    info(`${stats.folded} constants folded`);
    info(`${stats.eliminated} dead branches removed`);
    info(`${stats.inlined} functions inlined`);
    process.stdout.write('\n');
    if (flags.out || flags.o) {
      const outFile = flags.out || flags.o;
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.writeFileSync(outFile, optResult.code, 'utf-8');
      ok(`written to ${outFile}`);
      process.stdout.write('\n');
    }
    break;
  }

  case 'version': case '-v': case '--version': {
    printVersion();
    break;
  }

  case 'help': case '--help': case '-h': case undefined: {
    process.stdout.write(HELP + '\n');
    break;
  }

  case 'binary': {
    const { compileToBinary, compileToAllTargets, listTargets, TARGETS } = require('./src/native');
    if (flags['list-targets'] || flags['targets']) {
      process.stdout.write('\nAvailable targets:\n\n');
      const tgts = listTargets();
      const byOS = {};
      for (const t of tgts) {
        const info2 = TARGETS[t];
        const os2 = info2.os;
        if (!byOS[os2]) byOS[os2] = [];
        byOS[os2].push({ name: t, ...info2 });
      }
      for (const [osName, list] of Object.entries(byOS)) {
        process.stdout.write('  ' + CYAN(osName.toUpperCase()) + '\n');
        for (const t of list) {
          process.stdout.write('    ' + GREEN(t.name.padEnd(20)) + GRAY(t.triple) + '\n');
        }
      }
      process.stdout.write('\n');
      break;
    }
    const inputFile = fileArg;
    if (!inputFile) { process.stderr.write('Usage: ntl binary <file.ntl> [-o output] [--target=linux-arm64] [--standalone] [--all]\n'); process.exit(1); }
    const target = flags.target || flags.t || 'linux-x64';
    const mode = flags.standalone ? 'standalone' : 'shell';
    if (flags.all) {
      const outDir = flags.out || flags.o || path.basename(inputFile, '.ntl') + '-dist';
      info(`Compiling ${CYAN(inputFile)} for all targets → ${CYAN(outDir)}/`);
      compileToAllTargets(inputFile, outDir, { mode }).then(results => {
        let passed = 0, failed = 0;
        for (const r of results) {
          if (r.ok) { ok(GREEN(r.target.padEnd(22)) + GRAY(r.file)); passed++; }
          else { process.stdout.write('  ' + RED('✗') + ' ' + r.target.padEnd(22) + RED(r.error || 'failed') + '\n'); failed++; }
        }
        process.stdout.write('\n');
        ok(`${passed} targets built  ${failed ? RED(failed + ' failed') : ''}`);
      }).catch(e => { process.stderr.write(RED('  Error: ') + e.message + '\n'); process.exit(1); });
    } else {
      const outName = flags.out || flags.o || path.basename(inputFile, '.ntl');
      info(`Compiling ${CYAN(inputFile)} → ${CYAN(outName)}  ${GRAY('[' + target + ']')}`);
      compileToBinary(inputFile, outName, { mode, target }).then(() => {
        const finalFile = outName + (TARGETS[target] ? TARGETS[target].ext || '' : '');
        try {
          const kb = Math.round(require('fs').statSync(outName).size / 1024);
          ok(`${CYAN(outName)}  ${GRAY(kb + ' KB')}  ${GRAY('[' + target + ']')}`);
        } catch(_) { ok(CYAN(outName)); }
        if (mode === 'standalone') info(GRAY('  Self-contained — bundled runtime, no external dependencies.'));
        else info(GRAY('  Requires Node.js on target. Use --standalone to bundle runtime.'));
      }).catch(e => { process.stderr.write(RED('  Error: ') + e.message + '\n'); process.exit(1); });
    }
    break;
  }

  default: {
    die(`Unknown command '${cmd}'. Run  ntl help  for usage.`);
  }
}
