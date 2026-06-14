'use strict';

// CLI command implementations for the `ntl` tool.
// Each exported function handles one CLI command (run, build, watch, etc.).
// All I/O goes through process.stdout / process.stderr so commands are
// easy to test independently of the argument-parsing layer.

const fs   = require('fs');
const path = require('path');

/**
 * @typedef {object} CLIContext
 * @property {object}   flags      - Parsed flag map (string → string|true).
 * @property {string[]} positional - Non-flag arguments.
 * @property {object}   colors     - ANSI color helpers (BOLD, DIM, CYAN, …).
 * @property {Function} buildOpts  - Returns compiler options from current flags.
 * @property {Function} die        - Prints error and exits.
 * @property {Function} ok         - Prints success line.
 * @property {Function} info       - Prints info line.
 * @property {Function} fmtErr     - Formats a compiler error for display.
 * @property {Function} runFile    - Compiles and runs a .ntl file.
 * @property {Function} compileAndWrite - Compiles a file and writes the output.
 * @property {string}   NTL_DIR    - Absolute path to the ntl package root.
 */

/**
 * `ntl run <file.ntl>` — compiles and executes a NTL file.
 * @param {CLIContext} ctx
 */
function cmdRun(ctx) {
  const { positional, flags, die, runFile, buildOpts } = ctx;
  const fileArg = positional[1];
  if (!fileArg)                die('Usage: ntl run <file.ntl>');
  if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
  runFile(fileArg, buildOpts());
}

/**
 * `ntl build <file.ntl|ntl.yaml> [-o output.js]` — compiles to JavaScript.
 * Supports `--reverse` to decompile JS back to NTL.
 * Supports `--embed` to inline only the used parts of each imported module
 * directly into the output file (no external require() calls at runtime).
 * @param {CLIContext} ctx
 */
function cmdBuild(ctx) {
  const { positional, flags, die, ok, buildOpts, compileAndWrite, fmtErr, colors, NTL_DIR } = ctx;
  const { CYAN, GRAY, RED } = colors;
  const fileArg = positional[1];

  if (!fileArg) die('Usage: ntl build <file.ntl|ntl.yaml> [-o output.js]');
  if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);

  if (flags.reverse || flags.r) {
    const { reverseCompile } = require(path.join(NTL_DIR, 'src/reverse'));
    const jsSrc = fs.readFileSync(fileArg, 'utf-8');
    const revResult = reverseCompile(jsSrc, fileArg);

    if (!revResult.success) {
      for (const e of revResult.errors) {
        process.stderr.write(RED('  error') + ': ' + e.message + '\n');
      }
      process.exit(1);
    }

    const outFile = typeof flags.reverse === 'string'
      ? flags.reverse
      : (flags.out || flags.o || (fileArg.endsWith('.js') ? fileArg.replace(/\.js$/, '.ntl') : 'output.ntl'));

    fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
    fs.writeFileSync(outFile, revResult.code, 'utf-8');

    process.stdout.write('\n');
    ok(`${path.relative('.', fileArg)}  ${GRAY('→')}  ${CYAN(outFile)}`);
    process.stdout.write('\n');
    return;
  }

  if (flags.embed) {
    _cmdBuildEmbed(ctx);
    return;
  }

  const outFile = flags.out || flags.o || (fileArg.endsWith('.ntl') ? fileArg.replace(/\.ntl$/, '.js') : 'output.js');

  process.stdout.write('\n');
  compileAndWrite(fileArg, outFile, buildOpts());
}

/**
 * Implementation of `ntl build --embed`.
 * Compiles the entry file, then for every `require('ntl:...')` or relative
 * require found in the compiled output, loads the module source, compiles it,
 * detects which exports are actually used by the caller, strips the rest, and
 * inlines the result as an IIFE at the top of the output — replacing the
 * original require() call with a reference to the already-inlined binding.
 *
 * Result: a fully self-contained JS file with zero external ntl: requires.
 * @param {CLIContext} ctx
 */
function _cmdBuildEmbed(ctx) {
  const { positional, flags, die, ok, info, buildOpts, colors, NTL_DIR } = ctx;
  const { CYAN, GRAY } = colors;

  const fileArg = positional[1];
  const outFile = flags.out || flags.o || (fileArg.endsWith('.ntl') ? fileArg.replace(/\.ntl$/, '.js') : 'output.js');
  const opts    = buildOpts();

  // Determine whether the final output should be ESM
  const isESM = opts.target === 'esm' || opts.target === 'browser' || opts.target === 'deno';

  const { Compiler }                       = require(path.join(NTL_DIR, 'src/compiler'));
  const { selectiveWrap, detectUsedNames } = require(path.join(NTL_DIR, 'src/runtime/selective_embed'));
  const MODULES_DIR                        = path.join(NTL_DIR, 'modules');

  // ── Step 1: compile user code with the REAL target ─────────────────────────
  // For ESM targets, genImport now emits native `import` statements directly,
  // so we compile with opts.target (esm/browser/deno/node) as-is.
  // We no longer force CJS first — that was the source of the _toESM pollution bug.
  const compiler = new Compiler(opts);
  const source   = fs.readFileSync(fileArg, 'utf-8');
  const result   = compiler.compileSource(source, path.resolve(fileArg), opts);

  if (!result.success) {
    for (const e of result.errors) process.stderr.write(e.message + '\n');
    process.exit(1);
  }

  let mainCode = result.code;

  // ── Step 2: find and embed ntl: modules ────────────────────────────────────
  // Match BOTH forms:
  //   ESM:  import { X } from "ntl:mod"
  //   CJS:  const { X } = require('ntl:mod')
  const importRe  = /^import\s+(\{[^}]+\}|\w+)\s+from\s+["']ntl:(\w+)["'];?[ \t]*/gm;
  const requireRe = /(?:const|let|var)\s+(\{[^}]+\}|\w+)\s*=\s*require\(["']ntl:(\w+)["']\);?/g;

  const embeds = [];
  let m;

  while ((m = importRe.exec(mainCode)) !== null) {
    embeds.push({ fullMatch: m[0], binding: m[1].trim(), modName: m[2] });
  }
  while ((m = requireRe.exec(mainCode)) !== null) {
    embeds.push({ fullMatch: m[0], binding: m[1].trim(), modName: m[2] });
  }

  if (embeds.length === 0) {
    info('No ntl: modules found \u2014 nothing to embed. Writing plain build.');
  }

  const preambleChunks = [];
  const embedLog = [];

  for (const { fullMatch, binding, modName } of embeds) {
    const jsPath = path.join(MODULES_DIR, modName + '.js');
    if (!fs.existsSync(jsPath)) {
      info(`  skipped ntl:${modName} \u2014 no prebuilt JS found, keeping import`);
      continue;
    }

    const modSource = fs.readFileSync(jsPath, 'utf-8');

    // Detect which exported names the caller actually uses
    let usedNames = null;
    const isDestructured = binding.startsWith('{');
    if (isDestructured) {
      usedNames = new Set(
        binding.slice(1, -1).split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean)
      );
    } else {
      usedNames = detectUsedNames(mainCode, binding);
    }

    const iife     = selectiveWrap(modSource, usedNames, jsPath);
    const varName  = `__ntl_embed_${modName}__`;
    const usedList = usedNames ? [...usedNames].join(', ') : '(all)';

    // Replace import/require line with a reference to the IIFE variable
    mainCode = mainCode.replace(fullMatch, `const ${binding} = ${varName};\n`);
    preambleChunks.push(`const ${varName} = ${iife};`);
    embedLog.push({ modName, usedList });
  }

  // Also embed relative .ntl requires
  const relRe = /require\(['"](\.[^'"]+\.ntl)['"]\)/g;
  const relEmbeds = [];
  while ((m = relRe.exec(mainCode)) !== null) {
    relEmbeds.push({ fullMatch: m[0], relPath: m[1] });
  }
  // Relative deps always compile to CJS so selectiveWrap can process them
  const cjsOpts     = Object.assign({}, opts, { target: 'node' });
  const cjsCompiler = new Compiler(cjsOpts);
  for (const { fullMatch, relPath } of relEmbeds) {
    const absPath = path.resolve(path.dirname(path.resolve(fileArg)), relPath);
    if (!fs.existsSync(absPath)) continue;
    const depSrc    = fs.readFileSync(absPath, 'utf-8');
    const depResult = cjsCompiler.compileSource(depSrc, absPath, cjsOpts);
    if (!depResult.success) continue;
    const iife    = selectiveWrap(depResult.code, null, absPath);
    const varName = '__ntl_embed_rel_' + absPath.replace(/[^a-zA-Z0-9]/g, '_') + '__';
    preambleChunks.push(`const ${varName} = ${iife};`);
    mainCode = mainCode.replace(fullMatch, varName);
    embedLog.push({ modName: relPath, usedList: '(all)' });
  }

  // ── Step 3: assemble the bundle ────────────────────────────────────────────
  // The IIFEs use module.exports internally — they are self-contained CJS blobs.
  // The user's mainCode already has the right format (native ESM or CJS).
  // We intentionally do NOT call _toESM here: that function would hoist the
  // require('fs'/'path'/etc.) calls from inside the IIFEs to the top as ESM
  // imports, breaking the output. The IIFEs are valid JS in both ESM and CJS
  // files since they use no top-level import/export syntax.
  let finalCode = [
    '// Generated by ntl build --embed',
    '// Embedded modules: ' + (embedLog.length ? embedLog.map(e => `ntl:${e.modName}`).join(', ') : 'none'),
    '',
    ...preambleChunks,
    '',
    mainCode,
  ].join('\n');

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, finalCode, 'utf-8');

  process.stdout.write('\n');
  const modeLabel = isESM ? '(embed · esm)' : '(embed)';
  ok(`${path.relative('.', fileArg)}  ${GRAY('→')}  ${CYAN(outFile)}  ${GRAY(modeLabel)}`);

  for (const { modName, usedList } of embedLog) {
    info(`  embedded ntl:${modName}  ${GRAY('used: ' + usedList)}`);
  }

  const kb = (finalCode.length / 1024).toFixed(1);
  info(`  total size: ${GRAY(kb + ' KB')}`);
  process.stdout.write('\n');
}


/**
 * `ntl bundle <file.ntl|dir> [-o output.js]` — bundles into a single file.
 * @param {CLIContext} ctx
 */
function cmdBundle(ctx) {
  const { positional, flags, die, ok, buildOpts, colors, NTL_DIR } = ctx;
  const { CYAN } = colors;
  const fileArg = positional[1];
  if (!fileArg) die('Usage: ntl bundle <file.ntl|dir> [-o output.js]');
  const outFile = flags.out || flags.o || 'dist/bundle.js';
  const { Bundler } = require(path.join(NTL_DIR, 'src/runtime/bundler'));
  const bundler = new Bundler(buildOpts());
  process.stdout.write('\n');
  try {
    const stat = fs.statSync(fileArg);
    if (stat.isDirectory()) bundler.bundleDir(fileArg, outFile);
    else                    bundler.bundleFile(fileArg, outFile);
    ok(`Bundled ${CYAN(fileArg)}  →  ${CYAN(outFile)}`);
  } catch (e) { die(e.message); }
}

/**
 * `ntl check <file.ntl> [--strict]` — type-checks without running.
 * @param {CLIContext} ctx
 */
function cmdCheck(ctx) {
  const { positional, flags, die, ok, buildOpts, fmtErr, colors, NTL_DIR } = ctx;
  const { GRAY, RED } = colors;
  const fileArg = positional[1];
  if (!fileArg)                die('Usage: ntl check <file.ntl> [--strict]');
  if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
  const { Compiler } = require(path.join(NTL_DIR, 'src/compiler'));
  const compiler = new Compiler(Object.assign({}, buildOpts(), { typeCheck: true }));
  const source   = fs.readFileSync(fileArg, 'utf-8');
  const result   = compiler.compileSource(source, fileArg, buildOpts());
  if (!result.success) {
    for (const e of result.errors) process.stderr.write(fmtErr(e, e.sourceLines));
    process.exit(1);
  }
  ok(`${path.relative('.', fileArg)} — no errors`);
  for (const w of (result.warnings || [])) process.stdout.write(GRAY(`  ⚠ ${w.message}\n`));
}

/**
 * `ntl watch <file.ntl>` — recompiles whenever the file changes.
 * @param {CLIContext} ctx
 */
function cmdWatch(ctx) {
  const { positional, flags, die, info, buildOpts, compileAndWrite, colors } = ctx;
  const { CYAN, RED } = colors;
  const fileArg = positional[1];
  if (!fileArg)                die('Usage: ntl watch <file.ntl>');
  if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
  info(`Watching ${CYAN(fileArg)}...`);
  const run = () => {
    try { compileAndWrite(fileArg, flags.out || flags.o || null, buildOpts()); }
    catch (e) { process.stderr.write(RED('  error: ') + e.message + '\n'); }
  };
  run();
  fs.watch(fileArg, { persistent: true }, ev => { if (ev === 'change') run(); });
}

/**
 * `ntl dev [dir]` — dev server with hot reload.
 * Serves compiled .ntl files over HTTP and recompiles on change.
 * @param {CLIContext} ctx
 */
function cmdDev(ctx) {
  const { positional, flags, info, ok, buildOpts, fmtErr, colors, NTL_DIR } = ctx;
  const { CYAN } = colors;
  const dir  = positional[1] || '.';
  const port = parseInt(flags.port || flags.p || '3000');
  info(`Dev server at ${CYAN('http://localhost:' + port)}`);
  const { Compiler } = require(path.join(NTL_DIR, 'src/compiler'));
  const compiler = new Compiler(buildOpts());
  const http     = require('http');
  const files    = {};

  // Recursively find all .ntl files under `dir`
  const findNTL = (d) => {
    const out = [];
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        out.push(...findNTL(full));
      } else if (entry.name.endsWith('.ntl')) {
        out.push(full);
      }
    }
    return out;
  };

  const compile = (f) => {
    const r = compiler.compileFile(f, buildOpts());
    if (r.success) { files[f] = r.code; ok(`Compiled ${path.relative(dir, f)}`); }
    else for (const e of r.errors) process.stderr.write(fmtErr(e, e.sourceLines));
  };

  findNTL(dir).forEach(f => { compile(f); fs.watch(f, ev => { if (ev === 'change') compile(f); }); });

  http.createServer((req, res) => {
    const urlPath = req.url === '/' ? '/index' : req.url.replace(/\.js$/, '');
    const key = Object.keys(files).find(f => f.endsWith(urlPath.slice(1) + '.ntl'));
    if (key) { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(files[key]); }
    else     { res.writeHead(404); res.end('Not found'); }
  }).listen(port, () => ok(`Listening at ${CYAN('http://localhost:' + port)}`));
}

/**
 * `ntl init [dir]` — scaffolds a new NTL project.
 * Creates src/, dist/, ntl.yaml, src/main.ntl, package.json, .gitignore.
 * @param {CLIContext} ctx
 */
function cmdInit(ctx) {
  const { positional, ok, colors, NTL_DIR } = ctx;
  const { CYAN } = colors;
  const dir = positional[1] || '.';
  fs.mkdirSync(path.join(dir, 'src'),  { recursive: true });
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });

  const cfgPath = path.join(dir, 'ntl.yaml');
  if (!fs.existsSync(cfgPath)) {
    const yaml = require(path.join(NTL_DIR, 'src/yaml'));
    const cfg  = yaml.stringify({
      name: path.basename(path.resolve(dir)), version: '0.1.0',
      src: 'src', dist: 'dist',
      compilerOptions: { target: 'node', strict: true, minify: false, treeShake: true },
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
      name: path.basename(path.resolve(dir)), version: '0.1.0',
      scripts: { build: 'ntl build ntl.yaml', dev: 'ntl dev', start: 'node dist/main.js' },
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

/**
 * `ntl fmt <file.ntl>` — auto-formats a NTL source file.
 * Pass `--check` to exit with error if the file is not already formatted.
 * @param {CLIContext} ctx
 */
function cmdFmt(ctx) {
  const { positional, flags, die, ok, colors, NTL_DIR } = ctx;
  const { CYAN, RED } = colors;
  const fileArg = positional[1];
  if (!fileArg)                die('Usage: ntl fmt <file.ntl>');
  if (!fs.existsSync(fileArg)) die(`File not found: ${fileArg}`);
  try {
    const { format } = require(path.join(NTL_DIR, 'src/transforms/formatter'));
    const source    = fs.readFileSync(fileArg, 'utf-8');
    const formatted = format(source);
    if (flags.check) {
      if (formatted !== source) { process.stderr.write(RED('  not formatted: ') + fileArg + '\n'); process.exit(1); }
      ok(`${fileArg} — already formatted`);
    } else {
      fs.writeFileSync(fileArg, formatted, 'utf-8');
      ok(`Formatted ${CYAN(fileArg)}`);
    }
  } catch (e) { die(e.message); }
}

/**
 * `ntl nax <sub-command> [args]` — nax module manager.
 * Sub-commands: install, list, clear, new, info.
 * @param {CLIContext} ctx
 */
async function cmdNax(ctx) {
  const { positional, die, ok, info, colors, NTL_DIR } = ctx;
  const { CYAN, GRAY, BOLD } = colors;
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
    return;
  }

  const { naxLoad, naxClear, naxList, createModuleJson } = require(path.join(NTL_DIR, 'src/runtime/nax'));

  if (sub === 'install') {
    const url = positional[2];
    if (!url) die('Usage: nax install <github.com/user/repo>');
    process.stdout.write('\n');
    info(`Fetching ${CYAN(url)}...`);
    await naxLoad(url);
    ok(`Installed ${CYAN(url)}`);
    process.stdout.write('\n');
  } else if (sub === 'list') {
    const modules = naxList();
    process.stdout.write('\n');
    if (modules.length === 0) { info('No modules installed yet.'); }
    else {
      for (const m of modules) {
        process.stdout.write(`  ${CYAN(m.name)} ${GRAY('v' + m.version)}`);
        if (m.description) process.stdout.write(` — ${m.description}`);
        process.stdout.write('\n');
      }
    }
    process.stdout.write('\n');
  } else if (sub === 'clear') {
    naxClear(); ok('Cache cleared');
  } else if (sub === 'new') {
    const readline = require('readline');
    const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = q => new Promise(res => rl.question(q, res));
    process.stdout.write('\n');
    const name        = await ask('  Module name: ');
    const description = await ask('  Description: ');
    const main        = await ask('  Entry file (index.ntl): ') || 'index.ntl';
    const author      = await ask('  Author: ');
    rl.close();
    const json = createModuleJson({ name, description, main, author });
    require('fs').writeFileSync('module.json', json);
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
    if (found.author)      process.stdout.write(`  ${GRAY('by ' + found.author)}\n`);
    process.stdout.write('\n');
  } else {
    die(`Unknown nax command: ${sub}`);
  }
}

module.exports = { cmdRun, cmdBuild, cmdBundle, cmdCheck, cmdWatch, cmdDev, cmdInit, cmdFmt, cmdNax };
