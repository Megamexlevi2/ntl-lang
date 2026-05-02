#!/usr/bin/env node
'use strict';

// NTL — Node Transpiled Language
// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// (c) David Dev 2026. Apache-2.0 License.
//
// This file is intentionally thin — only argument parsing, shared helpers,
// and the command dispatcher live here.
// Actual command logic is in src/cli/commands.js.

const fs    = require('fs');
const path  = require('path');
const vm    = require('vm');
const https = require('https');

const NTL_DIR = __dirname;

const { Compiler, NTL_VERSION }  = require('./src/compiler');
const { format: fmtErr, R }      = require('./src/error');
const { obfuscate }              = require('./modules/obf');
const { Bundler }                = require('./src/runtime/bundler');
const {
  cmdRun, cmdBuild, cmdBundle, cmdCheck,
  cmdWatch, cmdDev, cmdInit, cmdFmt, cmdNax,
} = require('./src/cli/commands');

const BOLD   = t => R.bold(t);
const DIM    = t => R.dim(t);
const CYAN   = t => R.cyan(t);
const GREEN  = t => R.green(t);
const RED    = t => R.red(t);
const GRAY   = t => R.gray(t);
const YELLOW = t => R.yellow(t);
const colors = { BOLD, DIM, CYAN, GREEN, RED, GRAY, YELLOW };

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
      flags[a.slice(2)] = (args[i + 1] && !args[i + 1].startsWith('-')) ? args[++i] : true;
    }
  } else if (a.startsWith('-') && a.length === 2) {
    flags[a.slice(1)] = (args[i + 1] && !args[i + 1].startsWith('-')) ? args[++i] : true;
  } else {
    positional.push(a);
  }
}

const inlineCode = flags.e || flags.eval || null;
const cmd        = inlineCode ? '__eval__' : positional[0];

const HELP = `
${BOLD(CYAN('NTL') + ' v' + NTL_VERSION)} ${GRAY('— Crafting the backend, transpiled to JavaScript')}

${BOLD('⚡ QUICK START')}
  ${CYAN('ntl run app.ntl')}          Launch your application
  ${CYAN('ntl init')}                 Start a fresh project
  ${CYAN('ntl -e "log 5 + 5"')}       Quick math in the terminal

${BOLD('🛠️ CORE COMMANDS')}
  ${GREEN('run')}      <file>          Execute an NTL script
  ${GREEN('build')}    <input>         Compile to production-ready JS
  ${GREEN('bundle')}   <input>         Merge everything into a single file
  ${GREEN('check')}    <file>          Verify types and logic (no execution)
  ${GREEN('watch')}    <file>          Auto-recompile on every save
  ${GREEN('dev')}      [dir]           Fire up the dev server with hot-reload
  ${GREEN('fmt')}      <file>          Make your code look beautiful
  ${GREEN('repl')}                     Jump into the interactive shell
  ${GREEN('nax')}      <cmd>           Manage modules (your package companion)

${BOLD('📚 RESOURCES')}
  ${GREEN('documentation')}            Download the full README to your current folder
  ${GREEN('version')}                  Check what version you're running
  ${GREEN('help')}                     You're looking at it!

${BOLD('✨ LANGUAGE FEATURES')}
  ${GRAY('• Immutability by default with')} ${CYAN('val')}
  ${GRAY('• Clean loops with')} ${CYAN('each x of list')}
  ${GRAY('• Safe exits using')} ${CYAN('unless')} ${GRAY('and')} ${CYAN('guard')}
  ${GRAY('• Built-in magic:')} ${CYAN('ntl:http')}, ${CYAN('ntl:db')}, ${CYAN('ntl:ai')}, ${GRAY('and more.')}

${DIM('Created with ❤️ by David Dev — github.com/Megamexlevi2/ntl-lang')}
`;

function die(msg)  { process.stderr.write('\n' + RED('Oops!') + ' ' + msg + '\n\n'); process.exit(1); }
function ok(msg)   { process.stdout.write(GREEN('  ✓') + ' ' + msg + '\n'); }
function info(msg) { process.stdout.write(GRAY('  ' + msg) + '\n'); }

function buildOpts() {
  return {
    target:        flags.target          || 'node',
    strict:        !!flags.strict,
    minify:        !!flags.minify,
    obfuscate:     !!flags.obfuscate,
    treeShake:     flags['no-treeshake'] !== true,
    credits:       !!flags.credits,
    typeCheck:     !!(flags['type-check'] || flags.check),
    sourceMap:     !!flags['source-map'],
    incremental:   !!flags.incremental,
    jsx:           !!flags.jsx,
    jsxPragma:     flags['jsx-pragma']   || 'React.createElement',
    jsxPragmaFrag: flags['jsx-frag']     || 'React.Fragment',
    jsxAutoImport: flags['jsx-import']   !== 'none',
    comments:      !!flags.comments,
    arch:          flags.arch             || null,
  };
}

function makeRunContext(absFile, extras) {
  const ctx = {
    require: (m) => {
      if (m.startsWith('./') || m.startsWith('../'))
        return require(path.resolve(path.dirname(absFile), m));
      if (m.startsWith('ntl:')) {
        const modName = m.slice(4);
        try { return require('./src/runtime/loader').loadStdlibModule(modName); } catch (_) {}
        try { return require(path.join(__dirname, 'modules', modName)); } catch (_2) {}
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
    crypto: require('crypto'), path, fs, vm,
    os: require('os'), events: require('events'), stream: require('stream'),
    http: require('http'), https: require('https'), net: require('net'),
    child_process: require('child_process'), assert: require('assert'),
    util: require('util'), zlib: require('zlib'), querystring: require('querystring'),
    __filename: absFile, __dirname: path.dirname(absFile),
    module: { exports: {}, filename: absFile, id: absFile }, exports: {},
  };
  ctx.global = ctx; ctx.globalThis = ctx;
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
      for (const e of (res.errors || []))
        process.stderr.write(fmtErr(Object.assign({ file, sourceLines: srcLines, ntlError: false }, e), srcLines));
      process.exit(1);
    }
    if (report || verbose) runner.printReport();
  } else {
    const compiler = new Compiler(opts);
    const result   = compiler.compileSource(source, absFile, opts);
    if (!result.success) {
      for (const e of result.errors)
        process.stderr.write(fmtErr(Object.assign({}, e, { file, sourceLines: srcLines }), srcLines));
      process.exit(1);
    }
    const os_     = require('os');
    const crypto_ = require('crypto');
    const tmpFile = path.join(
      os_.tmpdir(),
      'ntl_run_' + crypto_.createHash('md5').update(absFile + source.length).digest('hex').slice(0, 8) + '.js'
    );
    const fullCode = buildRunPreamble(absFile) + '\n' + result.code;
    try {
      fs.writeFileSync(tmpFile, fullCode, 'utf-8');
      require(tmpFile);
    } catch (e) {
      const errMsg = (e && e.message) ? e.message : String(e);
      process.stderr.write(fmtErr(Object.assign({}, e, { message: errMsg, file, sourceLines: srcLines, ntlError: false }), srcLines));
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
  if (req.startsWith('./') || req.startsWith('../'))
    return _origResolve(_path.resolve(_fileDir, req), parent, isMain, opts);
  if (req.startsWith('ntl:')) {
    try {
      const { resolveToPath } = require(_path.join(_ntlDir, 'src/runtime/resolver'));
      const p = resolveToPath(req); if (p) return p;
    } catch(_) {}
  }
  return _origResolve(req, parent, isMain, opts);
};
const _origLoad = Module._load.bind(Module);
Module._load = function(req, parent, isMain) {
  if (req.startsWith('ntl:')) {
    return require(_path.join(_ntlDir, 'src/runtime/loader')).loadStdlibModule(req.slice(4));
  }
  return _origLoad(req, parent, isMain);
};
})();`;
}

function compileAndWrite(inputFile, outputFile, opts) {
  const compiler = new Compiler(opts);
  const t0       = Date.now();

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
    for (const f of projResult.files)
      ok(`${f.input}  →  ${CYAN(f.output)}  ${GRAY(f.chars + ' bytes, ' + f.time + 'ms')}`);
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
  if (opts.obfuscate)
    code = obfuscate(code, { level: 'max', stringArray: true, encodeNumbers: true, deadCode: true });
  if (outputFile) {
    fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
    const finalCode = buildRunPreamble(path.resolve(inputFile)) + '\n' + code;
    fs.writeFileSync(outputFile, finalCode, 'utf-8');
    const kb = (finalCode.length / 1024).toFixed(1);
    ok(`${path.relative('.', inputFile)}  ${GRAY('→')}  ${outputFile}  ${GRAY(kb + ' KB · ' + result.time + 'ms · ' + result.target)}`);
    for (const w of (result.warnings || [])) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
  } else {
    process.stdout.write(code);
  }
}

function printVersion() {
  process.stdout.write(`\nntl ${NTL_VERSION}  ${GRAY('node ' + process.version + '  ' + process.platform + '/' + process.arch)}\n\n`);
}

async function cmdDocumentation() {
  const localPath = path.join(NTL_DIR, 'README.md');
  const targetPath = path.join(process.cwd(), 'NTL_README.md');
  
  info('Fetching documentation for you...');

  if (fs.existsSync(localPath)) {
    fs.copyFileSync(localPath, targetPath);
    ok(`Documentation copied to: ${CYAN(targetPath)}`);
    return;
  }

  const githubUrl = 'https://raw.githubusercontent.com/Megamexlevi2/ntl-lang/main/README.md';
  
  https.get(githubUrl, (res) => {
    if (res.statusCode !== 200) {
      die(`Could not find the documentation online either (Status: ${res.statusCode}).`);
      return;
    }

    const file = fs.createWriteStream(targetPath);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      ok(`Latest documentation downloaded from GitHub to: ${CYAN(targetPath)}`);
    });
  }).on('error', (err) => {
    die(`Network error while fetching documentation: ${err.message}`);
  });
}

const cliCtx = { flags, positional, colors, die, ok, info, buildOpts, runFile, compileAndWrite, fmtErr, NTL_DIR };

const eFlag = flags.e || flags.eval;
if (eFlag && typeof eFlag === 'string') {
  const { JITRunner } = require('./src/jit/JITRuntime');
  const _ec = new Compiler({ target: 'node', treeShake: false });
  const _er = new JITRunner({ verbose: false, showUpgrades: false, optimize: false });
  const _ex = makeRunContext('<eval>', {});
  vm.createContext(_ex);
  const _res = _er.run(eFlag, '<eval>', _ec, _ex);
  if (!_res.success)
    for (const e of (_res.errors || []))
      process.stderr.write(fmtErr(Object.assign({ ntlError: false }, e), eFlag.split('\n')));
  process.exit(_res.success ? 0 : 1);
}

switch (cmd) {
  case 'run':           cmdRun(cliCtx);    break;
  case 'build':         cmdBuild(cliCtx);  break;
  case 'bundle':        cmdBundle(cliCtx); break;
  case 'check':         cmdCheck(cliCtx);  break;
  case 'watch':         cmdWatch(cliCtx);  break;
  case 'dev':           cmdDev(cliCtx);    break;
  case 'init':          cmdInit(cliCtx);   break;
  case 'fmt':           cmdFmt(cliCtx);    break;
  case 'documentation': cmdDocumentation(); break;
  case 'repl':          require('./repl').start(); break;
  case 'nax':           cmdNax(cliCtx).catch(e => die(e.message)); break;
  case 'version':       printVersion(); break;
  case 'help': case '--help': case '-h': case undefined:
    process.stdout.write(HELP + '\n'); break;
  default:
    process.stderr.write(RED('\nWait a second...') + ` I don't recognize the command '${cmd}'.\n\nTry running ${CYAN('ntl help')} to see what I can do.\n\n`);
    process.exit(1);
}
