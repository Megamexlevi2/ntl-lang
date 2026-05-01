#!/usr/bin/env node
'use strict';

// NTL — Node Transpiled Language
// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// (c) David Dev 2026. Apache-2.0 License.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { Compiler, NTL_VERSION } = require('./src/compiler');
const { format: fmtErr, R }     = require('./src/error');
const { obfuscate }             = require('./modules/obf');
const { Bundler }               = require('./src/runtime/bundler');

const BOLD   = t => R.bold(t);
const DIM    = t => R.dim(t);
const CYAN   = t => R.cyan(t);
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
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      flags[a.slice(2)] = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
    }
  } else if (a.startsWith('-') && a.length === 2) {
    flags[a.slice(1)] = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
  } else {
    positional.push(a);
  }
}

const inlineCode = flags.e || flags.eval || null;
const cmd        = inlineCode ? '__eval__' : positional[0];
const fileArg    = positional[1];

const HELP = `
${BOLD(CYAN('ntl') + ' v' + NTL_VERSION)} ${GRAY('— a backend language that compiles to JavaScript')}

${BOLD('USAGE')}
  ntl <command> [file] [options]

${BOLD('COMMANDS')}
  ${GREEN('run')}      <file.ntl>            Run a NTL file
  ${GREEN('build')}    <file|ntl.yaml>       Compile to JavaScript
  ${GREEN('bundle')}   <file|dir>            Bundle into a single file
  ${GREEN('check')}    <file.ntl>            Type-check without running
  ${GREEN('watch')}    <file.ntl>            Recompile whenever the file changes
  ${GREEN('dev')}      [dir]                 Dev server with hot reload
  ${GREEN('init')}     [dir]                 Start a new project
  ${GREEN('fmt')}      <file.ntl>            Format a file
  ${GREEN('repl')}                           Interactive shell
  ${GREEN('nax')}      <install|list|...>    Module manager (like Cargo for NTL)
  ${GREEN('version')}                        Print version info
  ${GREEN('help')}                           Show this screen

${BOLD('RUNNING CODE')}
  ${CYAN('ntl run app.ntl')}
  ${CYAN('ntl run app.ntl --jit-report')}     Print a hot-path table after running
  ${CYAN('ntl -e "log 1 + 1"')}              Run a one-liner inline

${BOLD('BUILDING')}
  ${CYAN('ntl build app.ntl -o dist/app.js')}
  ${CYAN('ntl build app.ntl --minify --obfuscate')}
  ${CYAN('ntl build ntl.yaml')}              Build a full project from config
  ${CYAN('ntl build app.ntl --target=browser')}

${BOLD('PROJECTS')}
  ${DIM('Create an ntl.yaml at the root to manage multi-file projects:')}
  ${DIM('')}
  ${CYAN('ntl init')}                        Scaffolds src/, dist/, and ntl.yaml
  ${CYAN('ntl build ntl.yaml')}             Compile the whole project
  ${CYAN('ntl check ntl.yaml --strict')}    Type-check every file
  ${CYAN('ntl watch ntl.yaml')}             Watch mode for teams

${BOLD('MODULE MANAGER (nax)')}
  ${DIM('nax installs NTL modules from GitHub — like Cargo crates.')}
  ${DIM('')}
  ${CYAN('nax install github.com/user/repo')}
  ${CYAN('nax list')}
  ${CYAN('nax clear')}
  ${CYAN('nax new')}                         Create a module.json for publishing

${BOLD('BUILT-IN MODULES')}
  ${CYAN('ntl:http')}      HTTP server, router, middleware, CORS, fetch
  ${CYAN('ntl:db')}        SQLite — query builder, migrations, ORM
  ${CYAN('ntl:crypto')}    Hashing, AES, JWT, UUID
  ${CYAN('ntl:validate')}  Schema validation
  ${CYAN('ntl:ws')}        WebSockets
  ${CYAN('ntl:events')}    Event emitter / pub-sub
  ${CYAN('ntl:logger')}    Structured logging
  ${CYAN('ntl:cache')}     LRU cache with TTL
  ${CYAN('ntl:queue')}     Job queue with retries
  ${CYAN('ntl:mail')}      Send email via SMTP
  ${CYAN('ntl:env')}       .env files and config validation
  ${CYAN('ntl:test')}      Built-in test runner
  ${CYAN('ntl:ai')}        OpenAI, Anthropic, Ollama

${BOLD('NODE.JS COMPATIBILITY')}
  ${DIM('NTL compiles to CommonJS. Every npm package works with no extra config:')}
  ${DIM('')}
  ${DIM('  val express = require("express")')}
  ${DIM('  val prisma  = require("@prisma/client")')}

${BOLD('LANGUAGE HIGHLIGHTS')}
  ${CYAN('val / var')}            immutable and mutable bindings
  ${CYAN('fn / async fn')}        function declaration
  ${CYAN('match x { case => }')}  pattern matching
  ${CYAN('have in / between')}    expressive membership and range checks
  ${CYAN('unless / guard')}       readable early-exit patterns
  ${CYAN('defer { }')}            cleanup on scope exit
  ${CYAN('each x of list { }')}   cleaner for-of loops
  ${CYAN('log expr')}             shorthand for console.log
  ${CYAN('range(n)')}             generates [0..n-1]
  ${CYAN('sleep(ms)')}            awaits N milliseconds
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
        } catch (_) {
          try { return require(path.join(__dirname, 'modules', modName)); } catch (_2) {}
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
    crypto:        require('crypto'),
    path, fs, vm,
    os:            require('os'),
    events:        require('events'),
    stream:        require('stream'),
    http:          require('http'),
    https:         require('https'),
    net:           require('net'),
    child_process: require('child_process'),
    assert:        require('assert'),
    util:          require('util'),
    zlib:          require('zlib'),
    querystring:   require('querystring'),
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
        process.stderr.write(fmtErr(Object.assign({ file, sourceLines: srcLines, ntlError: false }, e), srcLines));
      }
      process.exit(1);
    }
    if (report || verbose) runner.printReport();
  } else {
    const compiler = new Compiler(opts);
    const result   = compiler.compileSource(source, absFile, opts);
    if (!result.success) {
      for (const e of result.errors) {
        process.stderr.write(fmtErr(Object.assign({}, e, { file, sourceLines: srcLines }), srcLines));
      }
      process.exit(1);
    }
    const os_     = require('os');
    const crypto_ = require('crypto');
    const tmpDir  = os_.tmpdir();
    const tmpHash = crypto_.createHash('md5').update(absFile + source.length).digest('hex').slice(0, 8);
    const tmpFile = path.join(tmpDir, 'ntl_run_' + tmpHash + '.js');
    const preamble  = buildRunPreamble(absFile);
    const fullCode  = preamble + '\n' + result.code;
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

function buildRunPreamble(absFile) {
  const ntlDir  = JSON.stringify(path.join(__dirname));
  const fileDir = JSON.stringify(path.dirname(absFile));
  return `(function(){
const Module = require('module');
const _path  = require('path');
const _fileDir = ${fileDir};
function _resolveNtlDir() {
  try { return _path.dirname(require.resolve('ntl-lang/package.json')); } catch(_) {}
  try {
    const _r = require('fs').realpathSync(process.argv[1] || '');
    const _m = _r.match(/^(.*?node_modules[\\\\/]ntl-lang)/);
    if (_m) return _m[1];
  } catch(_) {}
  return ${ntlDir};
}
const _ntlDir = _resolveNtlDir();
const _origResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function(req, parent, isMain, opts) {
  if (req.startsWith('./') || req.startsWith('../')) {
    return _origResolve(_path.resolve(_fileDir, req), parent, isMain, opts);
  }
  if (req.startsWith('ntl:')) {
    try {
      const { resolveToPath } = require(_path.join(_ntlDir, 'src/runtime/resolver'));
      const p = resolveToPath(req);
      if (p) return p;
    } catch(_) {}
  }
  return _origResolve(req, parent, isMain, opts);
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

  if (inputFile.endsWith('.yaml') || inputFile.endsWith('.json')) {
    let config;
    if (inputFile.endsWith('.yaml')) {
      const yaml = require('./src/yaml');
      config = yaml.loadFile(inputFile);
    } else {
      config = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    }
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
  if (opts.obfuscate) {
    code = obfuscate(code, { level: 'max', stringArray: true, encodeNumbers: true, deadCode: true });
  }
  if (outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    const preamble  = buildRunPreamble(path.resolve(inputFile));
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
  if (!result.success) {
    for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines));
    process.exit(1);
  }
  ok(`${path.relative('.', file)} — no errors`);
  for (const w of (result.warnings || [])) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
}

function watchFile(file, opts) {
  info(`Watching ${CYAN(file)}...`);
  const run = () => {
    try { compileAndWrite(file, flags.out || flags.o || null, opts); }
    catch (e) { process.stderr.write(RED('  error: ') + e.message + '\n'); }
  };
  run();
  fs.watch(file, { persistent: true }, ev => { if (ev === 'change') run(); });
}

function devServer(dir, opts) {
  const port = parseInt(flags.port || flags.p || '3000');
  dir = dir || '.';
  info(`Dev server at ${CYAN('http://localhost:' + port)}`);
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
  }).listen(port, () => ok(`Listening at ${CYAN('http://localhost:' + port)}`));
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

  const cfgPath = path.join(dir, 'ntl.yaml');
  if (!fs.existsSync(cfgPath)) {
    const yaml = require('./src/yaml');
    const cfg = yaml.stringify({
      name:    path.basename(path.resolve(dir)),
      version: '0.1.0',
      src:     'src',
      dist:    'dist',
      compilerOptions: {
        target:    'node',
        strict:    true,
        minify:    false,
        treeShake: true,
      },
    });
    fs.writeFileSync(cfgPath, '# NTL Project Configuration\n\n' + cfg + '\n', 'utf-8');
    ok(`Created ${CYAN('ntl.yaml')}`);
  }

  const mainFile = path.join(dir, 'src', 'main.ntl');
  if (!fs.existsSync(mainFile)) {
    fs.writeFileSync(mainFile,
      `val name: string = "World"\n\nfn greet(name: string) -> string {\n  return \`Hello, \${name}!\`\n}\n\nlog greet(name)\n`,
      'utf-8'
    );
    ok(`Created ${CYAN('src/main.ntl')}`);
  }

  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: path.basename(path.resolve(dir)),
      version: '0.1.0',
      scripts: {
        build: 'ntl build ntl.yaml',
        dev:   'ntl dev',
        start: 'node dist/main.js',
      },
      devDependencies: {},
    }, null, 2) + '\n', 'utf-8');
    ok(`Created ${CYAN('package.json')}`);
  }

  if (!fs.existsSync(path.join(dir, '.gitignore'))) {
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ndist/\n.ntl-cache/\n');
    ok(`Created ${CYAN('.gitignore')}`);
  }

  process.stdout.write('\n');
  ok(`Project ready. Run ${CYAN('ntl run src/main.ntl')} to get started.`);
  process.stdout.write('\n');
}

function printVersion() {
  process.stdout.write(`\nntl ${NTL_VERSION}  ${GRAY('node ' + process.version + '  ' + process.platform + '/' + process.arch)}\n\n`);
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
  }
  process.exit(_eRes.success ? 0 : 1);
}

switch (cmd) {

  case 'run': {
    if (!fileArg)                die('Usage: ntl run <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    runFile(fileArg, buildOpts());
    break;
  }

  case 'build': {
    if (!fileArg)                die('Usage: ntl build <file.ntl|ntl.yaml> [-o output.js]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    if (flags.reverse || flags.r) {
      const { reverseCompile } = require('./src/reverse');
      const jsSrc     = fs.readFileSync(fileArg, 'utf-8');
      const revResult = reverseCompile(jsSrc, fileArg);
      if (!revResult.success) {
        for (const e of revResult.errors) process.stderr.write(RED('  error') + ': ' + e.message + '\n');
        process.exit(1);
      }
      const outFile = flags.reverse !== true ? flags.reverse : (flags.out || flags.o || fileArg.replace(/\.js$/, '.ntl'));
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.writeFileSync(outFile, revResult.code, 'utf-8');
      process.stdout.write('\n');
      ok(`${path.relative('.', fileArg)}  ${GRAY('→')}  ${CYAN(outFile)}`);
      process.stdout.write('\n');
      break;
    }
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
    if (!fileArg)                die('Usage: ntl check <file.ntl> [--strict]');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    checkFile(fileArg, buildOpts());
    break;
  }

  case 'watch': {
    if (!fileArg)                die('Usage: ntl watch <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    watchFile(fileArg, buildOpts());
    break;
  }

  case 'dev': {
    devServer(fileArg || '.', buildOpts());
    break;
  }

  case 'init': {
    initProject(fileArg);
    break;
  }

  case 'repl': {
    require('./repl').start();
    break;
  }

  case 'fmt': {
    if (!fileArg)                die('Usage: ntl fmt <file.ntl>');
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    try {
      const { format } = require('./src/transforms/formatter');
      const source     = fs.readFileSync(fileArg, 'utf-8');
      const formatted  = format(source);
      if (flags.check) {
        if (formatted !== source) { process.stderr.write(RED('  not formatted: ') + fileArg + '\n'); process.exit(1); }
        ok(`${fileArg} — already formatted`);
      } else {
        fs.writeFileSync(fileArg, formatted, 'utf-8');
        ok(`Formatted ${CYAN(fileArg)}`);
      }
    } catch (e) { die(e.message); }
    break;
  }

  case 'nax': {
    const sub = positional[1];
    if (!sub) {
      process.stdout.write('\n');
      info('nax — NTL module manager');
      info('');
      info('  nax install <github.com/user/repo>   Install a module');
      info('  nax list                             List installed modules');
      info('  nax clear                            Clear the cache');
      info('  nax new                              Create a module.json');
      info('  nax info <name>                      Show module details');
      process.stdout.write('\n');
      break;
    }
    (async () => {
      const { naxLoad, naxClear, naxList, createModuleJson } = require('./src/runtime/nax');
      if (sub === 'install') {
        const url = positional[2];
        if (!url) die('Usage: nax install <github.com/user/repo>');
        try {
          process.stdout.write('\n');
          info(`Fetching ${CYAN(url)}...`);
          await naxLoad(url);
          ok(`Installed ${CYAN(url)}`);
          process.stdout.write('\n');
        } catch (e) { die(e.message); }
      } else if (sub === 'list') {
        const modules = naxList();
        process.stdout.write('\n');
        if (modules.length === 0) {
          info('No modules installed yet.');
        } else {
          for (const m of modules) {
            process.stdout.write(`  ${CYAN(m.name)} ${GRAY('v' + m.version)}`);
            if (m.description) process.stdout.write(` — ${m.description}`);
            process.stdout.write('\n');
          }
        }
        process.stdout.write('\n');
      } else if (sub === 'clear') {
        naxClear();
        ok('Cache cleared');
      } else if (sub === 'new') {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = q => new Promise(res => rl.question(q, res));
        process.stdout.write('\n');
        const name        = await ask('  Module name: ');
        const description = await ask('  Description: ');
        const main        = await ask('  Entry file (index.ntl): ') || 'index.ntl';
        const author      = await ask('  Author: ');
        rl.close();
        const json = createModuleJson({ name, description, main, author });
        fs.writeFileSync('module.json', json);
        ok('Created module.json');
        process.stdout.write('\n');
      } else if (sub === 'info') {
        const name    = positional[2];
        const modules = naxList();
        const found   = modules.find(m => m.name === name);
        if (!found) die(`Module not found: ${name}`);
        process.stdout.write('\n');
        process.stdout.write(`  ${BOLD(found.name)} v${found.version}\n`);
        if (found.description) process.stdout.write(`  ${GRAY(found.description)}\n`);
        if (found.author) process.stdout.write(`  ${GRAY('by ' + found.author)}\n`);
        process.stdout.write('\n');
      } else {
        die(`Unknown nax command: ${sub}`);
      }
    })().catch(e => die(e.message));
    break;
  }

  case 'version': {
    printVersion();
    break;
  }

  case 'help':
  case '--help':
  case '-h':
  case undefined: {
    process.stdout.write(HELP + '\n');
    break;
  }

  default: {
    process.stderr.write(RED('\nerror') + `: unknown command '${cmd}'\n\nRun ${CYAN('ntl help')} to see available commands.\n\n`);
    process.exit(1);
  }
}
