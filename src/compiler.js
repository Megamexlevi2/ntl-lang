'use strict';
const fs   = require('fs');
const path = require('path');
const { tokenize }      = require('./pipeline/lexer');
const { parse }         = require('./pipeline/parser');
const { CodeGen }       = require('./pipeline/codegen');
const { ScopeAnalyzer } = require('./pipeline/scope');
const { TypeInferer }   = require('./pipeline/typeinfer');
const { TreeShaker }    = require('./pipeline/treeshaker');
const { format: fmtErr } = require('./error');
const { transformJSX, hasJSX } = require('./transforms/jsx');

const NTL_VERSION = '3.5.0';
const TARGETS = {
  node:    { cjs: true,  esm: false },
  browser: { cjs: false, esm: true  },
  deno:    { cjs: false, esm: true  },
  bun:     { cjs: false, esm: false },
  esm:     { cjs: false, esm: true  },
  cjs:     { cjs: true,  esm: false },
};

class Compiler {
  constructor(opts) {
    this.opts = Object.assign({
      target: 'node', minify: false, strict: false, typeCheck: false,
      treeShake: true, obfuscate: false, credits: false, sourceMap: false,
      incremental: false, jsx: false, jsxPragma: 'React.createElement',
      jsxPragmaFrag: 'React.Fragment', jsxAutoImport: true,
      comments: false, jitAnnotations: false, embed: true,
    }, opts || {});
    this.typeChecker = new TypeInferer();
    this.treeshaker  = new TreeShaker();
    this._cache      = new Map();
    this._embedCache = new Map();
  }

  compileSource(source, filename, opts) {
    opts = Object.assign({}, this.opts, opts || {});
    const start = Date.now();
    filename = filename || '<unknown>';
    const lines = source.split('\n');

    const autoJSX = opts.jsx || (opts.jsxAuto !== false && hasJSX(source));
    if (autoJSX) {
      const jsxResult = transformJSX(source, {
        pragma:      opts.jsxPragma    || 'React.createElement',
        pragmaFrag:  opts.jsxPragmaFrag || 'React.Fragment',
        importReact: opts.jsxAutoImport !== false,
        filename,
      });
      if (!jsxResult.success) {
        return this._fail([{ message: jsxResult.error, file: filename, phase: 'jsx', line: 0 }], start);
      }
      source = jsxResult.code;
    }

    let tokens, ast;
    try { tokens = tokenize(source, filename); }
    catch (e) { return this._fail([this._wrapErr(e, lines, filename)], start); }

    try { ast = parse(tokens, filename); }
    catch (e) { return this._fail([this._wrapErr(e, lines, filename)], start); }

    const scopeErrors = new ScopeAnalyzer(filename, lines).analyze(ast);
    if (scopeErrors.length) {
      return this._fail(scopeErrors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines })), start);
    }

    if (opts.strict || opts.typeCheck) {
      const res = this.typeChecker.check(ast, { strict: opts.strict });
      const typeErrors   = res.errors   || [];
      const typeWarnings = res.warnings || [];
      if (typeErrors.length) {
        return this._fail(typeErrors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines, phase: 'type' })), start);
      }
    }

    let code;
    try { code = new CodeGen({ target: opts.target, comments: opts.comments }).gen(ast); }
    catch (e) { return this._fail([this._wrapErr(e, lines, filename)], start); }

    const runtime = this.treeshaker.generateRuntime(this.treeshaker.analyze(ast));
    let output = (runtime ? runtime + '\n\n' : '') + code;

    if (opts.embed !== false && filename !== '<unknown>') {
      const embedResult = this._embedLocalDeps(output, filename, opts);
      if (!embedResult.success) {
        return this._fail(embedResult.errors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines })), start);
      }
      output = embedResult.code;
    }

    if (opts.target === 'browser' || opts.target === 'esm' || opts.target === 'deno') {
      output = this._toESM(output);
    }
    if (opts.minify) output = this._minify(output);

    return {
      success: true, code: output, ast,
      errors: [], warnings: [],
      time: Date.now() - start,
      target: opts.target,
      stats: { lines: lines.length, chars: source.length, outputChars: output.length },
    };
  }

  compileFile(filePath, opts) {
    if (!fs.existsSync(filePath)) {
      return this._fail([{ message: 'File not found: ' + filePath, file: filePath, line: 0 }], 0);
    }
    if (opts && opts.incremental) {
      const cached = this._cache.get(filePath);
      if (cached) {
        const mtime = fs.statSync(filePath).mtimeMs;
        if (cached.mtime >= mtime) return cached.result;
      }
    }
    const source = fs.readFileSync(filePath, 'utf-8');
    const result = this.compileSource(source, filePath, opts);
    if (opts && opts.incremental) this._cache.set(filePath, { mtime: Date.now(), result });
    return result;
  }

  compileProject(config) {
    const inputDir  = path.resolve(config.src  || config.input  || './src');
    const outputDir = path.resolve(config.dist || config.output || './dist');
    const opts = Object.assign({}, this.opts, config.compilerOptions || {});

    if (!fs.existsSync(inputDir)) throw new Error('Input directory not found: ' + inputDir);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const files = this._findNTL(inputDir);
    const results = { succeeded: 0, failed: 0, files: [], errors: [] };

    for (const file of files) {
      const rel     = path.relative(inputDir, file);
      const outPath = path.join(outputDir, rel.replace(/\.ntl$/, '.js'));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const result = this.compileFile(file, opts);
      if (!result.success) {
        results.failed++;
        results.errors.push(...result.errors.map(e => Object.assign({}, e, { file: rel })));
      } else {
        fs.writeFileSync(outPath, result.code, 'utf-8');
        results.succeeded++;
        results.files.push({ input: rel, output: path.relative('.', outPath), time: result.time, chars: result.stats.outputChars });
      }
    }
    return results;
  }

  _embedLocalDeps(code, fromFile, opts) {
    const visited = new Set();
    return this._embedPass(code, path.resolve(fromFile), visited, opts || this.opts);
  }

  _embedPass(code, fromAbs, visited, opts) {
    const dir = path.dirname(fromAbs);
    const depRe = /require\(\s*(['"])((?:\.\.?\/)[^'"]+\.ntl)\1\s*\)/g;
    const errors = [];
    let changed = true;

    while (changed) {
      changed = false;
      code = code.replace(depRe, (match, _q, depPath) => {
        const absPath = path.resolve(dir, depPath);
        const cacheKey = absPath;

        if (visited.has(cacheKey)) {
          return `(/* embedded: ${depPath} */ _ntl_mod_${_safeId(absPath)})`;
        }

        if (!fs.existsSync(absPath)) {
          errors.push({ message: `Cannot embed '${depPath}': file not found`, file: fromAbs, line: 0 });
          return match;
        }

        visited.add(cacheKey);
        changed = true;

        let depSource;
        try { depSource = fs.readFileSync(absPath, 'utf-8'); }
        catch (e) {
          errors.push({ message: `Cannot read '${depPath}': ${e.message}`, file: fromAbs, line: 0 });
          return match;
        }

        const depResult = this._compileSourceForEmbed(depSource, absPath, opts, visited);
        if (!depResult.success) {
          for (const e of depResult.errors) errors.push(e);
          return match;
        }

        const safeId = _safeId(absPath);
        const wrapped = [
          `(function() {`,
          `  const _ntl_mod_${safeId} = (function() {`,
          `    const module = { exports: {} };`,
          `    const exports = module.exports;`,
          `    const __filename = ${JSON.stringify(absPath)};`,
          `    const __dirname  = ${JSON.stringify(path.dirname(absPath))};`,
          depResult.code.split('\n').map(l => '    ' + l).join('\n'),
          `    return module.exports;`,
          `  })();`,
          `  return _ntl_mod_${safeId};`,
          `})()`,
        ].join('\n');

        return wrapped;
      });
    }

    if (errors.length) return { success: false, errors, code };
    return { success: true, errors: [], code };
  }

  _compileSourceForEmbed(source, filename, opts, visited) {
    const innerOpts = Object.assign({}, opts, { embed: false });
    const result = this.compileSource(source, filename, innerOpts);
    if (!result.success) return result;
    const embedResult = this._embedPass(result.code, path.resolve(filename), visited, opts);
    if (!embedResult.success) return { success: false, code: null, ast: null, errors: embedResult.errors, warnings: [] };
    return Object.assign({}, result, { code: embedResult.code });
  }

  _findNTL(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...this._findNTL(full));
      } else if (entry.name.endsWith('.ntl')) {
        files.push(full);
      }
    }
    return files;
  }

  _toESM(code) {
    return code
      .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import $1 from "$2";')
      .replace(/const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import { $1 } from "$2";')
      .replace(/module\.exports\s*=\s*/, 'export default ')
      .replace(/module\.exports\.(\w+)\s*=\s*/, 'export const $1 = ');
  }

  _minify(code) {
    return code.split('\n').map(l => l.trim()).filter(l => l).join('\n').replace(/\n{2,}/g, '\n');
  }

  _wrapErr(e, lines, filename) {
    return {
      message: e.message, suggestion: e.suggestion || null,
      code: e.code || null, phase: e.phase || 'compile',
      line: e.line || 0, col: e.col || 0,
      file: e.file || filename, sourceLines: lines,
    };
  }

  _fail(errors, start) {
    return { success: false, code: null, ast: null, errors, warnings: [], time: Date.now() - start };
  }
}

function _safeId(absPath) {
  return absPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
}

module.exports = { Compiler, NTL_VERSION, TARGETS };
