#!/usr/bin/env node
'use strict';

// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { Compiler, NTL_VERSION } = require('./src/compiler');
const { format: fmtErr, print: printErr, R } = require('./src/error');
const { obfuscate } = require('./modules/obf');
const BOLD  = t => R.bold(t);
const DIM   = t => R.dim(t);
const CYAN  = t => R.cyan(t);
const GREEN = t => R.green(t);
const RED   = t => R.red(t);
const GRAY  = t => R.gray(t);
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else { flags[a.slice(2)] = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true; }
  } else if (a.startsWith('-') && a.length === 2) {
    flags[a.slice(1)] = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
  } else { positional.push(a); }
}
const cmd = positional[0];
const fileArg = positional[1];
const HELP = `
${BOLD(CYAN('NAX — The NTL Compiler'))} ${GRAY('v' + NTL_VERSION)}

${BOLD('USAGE')}
  ntl <command> [file] [options]

${BOLD('COMMANDS')}
  ${GREEN('run')}    <file.ntl>          Run a NTL file
  ${GREEN('build')}  <file|ntl.json>     Compile to JavaScript
  ${GREEN('check')}  <file.ntl>          Type-check without output
  ${GREEN('watch')}  <file.ntl>          Watch and recompile
  ${GREEN('dev')}    [dir]               Dev server with hot reload
  ${GREEN('repl')}                       Interactive REPL
  ${GREEN('init')}   [dir]               Create ntl.json project
  ${GREEN('version')}                    Print version info
  ${GREEN('help')}                       Show this help

${BOLD('BUILD OPTIONS')}
  ${CYAN('--out')} <path>               Output file (single file build)
  ${CYAN('-o')} <path>                  Alias for --out
  ${CYAN('--target')} <t>               Target: node|browser|deno|bun|esm|cjs
  ${CYAN('--strict')}                   Enable strict type checking
  ${CYAN('--minify')}                   Minify output
  ${CYAN('--obfuscate')}                Obfuscate output (max protection)
  ${CYAN('--no-treeshake')}             Disable tree shaking
  ${CYAN('--credits')}                  Add compiler header comment
  ${CYAN('--source-map')}               Generate source map

${BOLD('EXAMPLES')}
  ${DIM('ntl run app.ntl')}
  ${DIM('ntl build app.ntl -o dist/app.js --minify')}
  ${DIM('ntl build ntl.json --target=browser')}
  ${DIM('ntl build src/app.ntl --target=deno --obfuscate')}
  ${DIM('ntl check app.ntl --strict')}
  ${DIM('ntl dev --port=3000')}
  ${DIM('ntl init my-project')}

${BOLD('TARGETS')}
  ${CYAN('node')}    CommonJS for Node.js (default)
  ${CYAN('browser')} ESM for browsers
  ${CYAN('deno')}    ESM for Deno
  ${CYAN('bun')}     CommonJS for Bun
  ${CYAN('esm')}     Pure ES Modules
  ${CYAN('cjs')}     Pure CommonJS
`;
function die(msg) { process.stderr.write(RED('\n  ✖ ' + msg) + '\n\n'); process.exit(1); }
function ok(msg)  { process.stdout.write(GREEN('  ✔ ') + msg + '\n'); }
function info(msg){ process.stdout.write(GRAY('  · ') + msg + '\n'); }
function buildOpts() {
  return {
    target:    flags.target || 'node',
    strict:    !!flags.strict,
    minify:    !!flags.minify,
    obfuscate: !!flags.obfuscate,
    treeShake: flags['no-treeshake'] !== true,
    credits:   !!flags.credits,
    typeCheck: !!flags['type-check'] || !!flags.check,
    sourceMap: !!flags['source-map'],
    incremental: !!flags.incremental,
  };
}
function compileAndWrite(inputFile, outputFile, opts) {
  const compiler = new Compiler(opts);
  const t0 = Date.now();
  let result;
  if (inputFile.endsWith('.json') || inputFile.endsWith('ntl.json')) {
    const config = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const projResult = compiler.compileProject(config);
    process.stdout.write('\n');
    for (const f of projResult.files) {
      ok(`${f.input}  →  ${CYAN(f.output)}  ${GRAY(f.chars + ' bytes, ' + f.time + 'ms')}`);
    }
    if (projResult.failed > 0) {
      process.stdout.write('\n');
      for (const e of projResult.errors) {
        printErr(e);
      }
      process.stdout.write(RED(`\n  ✖ ${projResult.failed} file(s) failed\n\n`));
      process.exit(1);
    }
    process.stdout.write('\n' + GREEN(`  ✔ ${projResult.succeeded} file(s) compiled successfully`) + GRAY(` in ${Date.now() - t0}ms`) + '\n\n');
    return;
  }
  result = compiler.compileFile(inputFile, opts);
  if (!result.success) {
    for (const e of result.errors) {
      process.stderr.write(fmtErr(e, e.sourceLines));
    }
    process.exit(1);
  }
  let code = result.code;
  if (opts.obfuscate) code = obfuscate(code, { level: 'max', stringArray: true, encodeNumbers: true, deadCode: true });
  if (outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    fs.writeFileSync(outputFile, code, 'utf-8');
    const kb = (code.length / 1024).toFixed(1);
    ok(`${path.relative('.', inputFile)}  →  ${CYAN(outputFile)}  ${GRAY(kb + ' KB, ' + result.time + 'ms, target=' + result.target)}`);
    if (result.warnings && result.warnings.length) {
      for (const w of result.warnings) process.stdout.write(GRAY(`  ⚠ ${w.message} (${w.file}:${w.line})\n`));
    }
  } else {
    process.stdout.write(code);
  }
}
function runFile(file, opts) {
  const compiler = new Compiler(opts);
  const result = compiler.compileFile(file, opts);
  if (!result.success) {
    for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines));
    process.exit(1);
  }
  const absFile = path.resolve(file);
  const ctx = {
    require: (m) => {
      if (m.startsWith('./') || m.startsWith('../')) return require(path.resolve(path.dirname(absFile), m));
      return require(m);
    },
    console, process, setTimeout, setInterval, clearTimeout, clearInterval,
    setImmediate, queueMicrotask, Promise, Buffer, __filename: absFile,
    __dirname: path.dirname(absFile), module: { exports: {} }, exports: {},
    global, globalThis, Math, JSON, Date, Object, Array, String, Number,
    Boolean, Error, Map, Set, RegExp, Symbol, BigInt, WeakMap, WeakSet,
    Proxy, Reflect, URL, URLSearchParams, TextEncoder, TextDecoder,
    performance, crypto: require('crypto')
  };
  ctx.global = ctx; ctx.globalThis = ctx;
  try {
    vm.createContext(ctx);
    vm.runInContext(result.code, ctx, {
      filename: absFile,
      displayErrors: true,
    });
  } catch (e) {
    const srcLines = fs.readFileSync(file, 'utf-8').split('\n');
    process.stderr.write(fmtErr(Object.assign({}, e, { file, sourceLines: srcLines, ntlError: false }), srcLines));
    process.exit(1);
  }
}
function checkFile(file, opts) {
  const compiler = new Compiler(Object.assign({}, opts, { typeCheck: true }));
  const source = fs.readFileSync(file, 'utf-8');
  const result = compiler.compileSource(source, file, opts);
  if (!result.success) {
    for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines));
    process.exit(1);
  }
  ok(`${path.relative('.', file)} — no errors found`);
  if (result.warnings && result.warnings.length) {
    for (const w of result.warnings) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
  }
}
function watchFile(file, opts) {
  info(`Watching ${CYAN(file)} for changes...`);
  const run = () => {
    try {
      compileAndWrite(file, flags.out || flags.o || null, opts);
    } catch (e) {
      process.stderr.write(RED('  Error: ') + e.message + '\n');
    }
  };
  run();
  fs.watch(file, { persistent: true }, (ev) => { if (ev === 'change') run(); });
}
function devServer(dir, opts) {
  const port = parseInt(flags.port || flags.p || '3000');
  dir = dir || '.';
  info(`Starting dev server on ${CYAN('http://localhost:' + port)}`);
  info(`Watching ${CYAN(dir)} for .ntl changes...`);
  const compiler = new Compiler(opts);
  const http = require('http');
  const files = {};
  const compile = (f) => {
    const r = compiler.compileFile(f, opts);
    if (r.success) { files[f] = r.code; ok(`Compiled ${path.relative(dir, f)}`); }
    else for (const e of r.errors) process.stderr.write(fmtErr(e, e.sourceLines));
  };
  const ntlFiles = compiler._findNTLFiles ? compiler._findNTLFiles(dir) : findNTL(dir);
  ntlFiles.forEach(compile);
  ntlFiles.forEach(f => fs.watch(f, (ev) => { if (ev === 'change') compile(f); }));
  const server = http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index' : req.url.replace(/\.js$/, '');
    const key = Object.keys(files).find(f => f.endsWith(urlPath.slice(1) + '.ntl'));
    if (key) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(files[key]);
    } else {
      res.writeHead(404); res.end('Not found');
    }
  });
  server.listen(port, () => ok(`Dev server running at ${CYAN('http://localhost:' + port)}`));
}
function findNTL(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') files.push(...findNTL(full));
    else if (entry.name.endsWith('.ntl')) files.push(full);
  }
  return files;
}
function initProject(dir) {
  dir = dir || '.';
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  const cfg = {
    "$schema": "https://ntlang.dev/schema/ntl.json",
    "name": path.basename(path.resolve(dir)),
    "version": "0.1.0",
    "src": "src",
    "dist": "dist",
    "compilerOptions": {
      "target": "node",
      "strict": true,
      "minify": false,
      "treeShake": true,
      "credits": false
    },
    "include": ["src*.ntl"],
    "exclude": ["node_modules", "dist"]
  };
  const cfgPath = path.join(dir, 'ntl.json');
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    ok(`Created ${CYAN('ntl.json')}`);
  } else { info('ntl.json already exists, skipping'); }
  const main = path.join(dir, 'src', 'main.ntl');
  if (!fs.existsSync(main)) {
    fs.writeFileSync(main, [
      'val name: string = "World"',
      '',
      'fn greet(name: string) -> string {',
      '  return `Hello, ${name}!`',
      '}',
      '',
      'console.log(greet(name))',
    ].join('\n') + '\n', 'utf-8');
    ok(`Created ${CYAN('src/main.ntl')}`);
  }
  const pkg = path.join(dir, 'package.json');
  if (!fs.existsSync(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: cfg.name, version: cfg.version, scripts: { build: 'ntl build ntl.json', dev: 'ntl dev', start: 'node dist/main.js' }, devDependencies: {} }, null, 2) + '\n', 'utf-8');
    ok(`Created ${CYAN('package.json')}`);
  }
  const gitignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(gitignore)) { fs.writeFileSync(gitignore, 'node_modules/\ndist/\n*.js.map\n'); ok(`Created ${CYAN('.gitignore')}`); }
  process.stdout.write('\n');
  ok(`Project initialized! Run ${CYAN('ntl build ntl.json')} to compile.`);
  process.stdout.write('\n');
}
function printVersion() {
  process.stdout.write(`\n${BOLD(CYAN('NAX NTL Compiler'))} ${GRAY('v' + NTL_VERSION)}\n`);
  process.stdout.write(`${GRAY('Node.js')} ${process.version}\n`);
  process.stdout.write(`${GRAY('Platform')} ${process.platform} ${process.arch}\n\n`);
}
switch (cmd) {
  case 'run': {
    if (!fileArg) die("Usage: ntl run <file.ntl>");
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    runFile(fileArg, buildOpts());
    break;
  }
  case 'build': {
    if (!fileArg) die("Usage: ntl build <file.ntl|ntl.json> [-o output.js]");
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    const out = flags.out || flags.o || null;
    process.stdout.write('\n');
    compileAndWrite(fileArg, out, buildOpts());
    break;
  }
  case 'check': {
    if (!fileArg) die("Usage: ntl check <file.ntl> [--strict]");
    if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
    checkFile(fileArg, buildOpts());
    break;
  }
  case 'watch': {
    if (!fileArg) die("Usage: ntl watch <file.ntl>");
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
  case 'init': {
    initProject(fileArg);
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
  default: {
    die(`Unknown command '${cmd}'. Run 'ntl help' for usage.`);
  }
}
