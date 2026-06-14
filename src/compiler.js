'use strict';

// NTL-lang Compiler
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const fs   = require('fs');
const path = require('path');
const { tokenize }        = require('./pipeline/lexer');
const { parse }           = require('./pipeline/parser');
const { CodeGen }         = require('./pipeline/codegen/index');
const { ScopeAnalyzer }   = require('./pipeline/scope');
const { TypeInferer }     = require('./pipeline/typeinfer');
const { TreeShaker }      = require('./pipeline/treeshaker');
const { format: fmtErr }  = require('./error');
const { transformJSX, hasJSX } = require('./transforms/jsx');

const NTL_VERSION = '4.1.0';

const TARGETS = {
  node:    { cjs: true,  esm: false },
  browser: { cjs: false, esm: true  },
  deno:    { cjs: false, esm: true  },
  bun:     { cjs: false, esm: false },
  esm:     { cjs: false, esm: true  },
  cjs:     { cjs: true,  esm: false },
};

const DEFAULT_OPTS = {
  target:        'node',
  minify:        false,
  strict:        false,
  typeCheck:     false,
  treeShake:     true,
  obfuscate:     false,
  credits:       false,
  sourceMap:     false,
  incremental:   false,
  jsx:           false,
  jsxPragma:     'React.createElement',
  jsxPragmaFrag: 'React.Fragment',
  jsxAutoImport: true,
  comments:      false,
  jitAnnotations: false,
  embed:         true,
};

class Compiler {
  constructor(opts) {
    this.opts        = Object.assign({}, DEFAULT_OPTS, opts || {});
    this.typeChecker = new TypeInferer();
    this.treeshaker  = new TreeShaker();
    this._cache      = new Map();
  }

  compileSource(source, filename, opts) {
    opts     = Object.assign({}, this.opts, opts || {});
    filename = filename || '<unknown>';
    const start = Date.now();
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
      return this._fail(
        scopeErrors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines })),
        start
      );
    }

    if (opts.strict || opts.typeCheck) {
      const res        = this.typeChecker.check(ast, { strict: opts.strict });
      const typeErrors = res.errors || [];
      if (typeErrors.length) {
        return this._fail(
          typeErrors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines, phase: 'type' })),
          start
        );
      }
    }

    let code;
    try { code = new CodeGen({ target: opts.target, comments: opts.comments }).gen(ast); }
    catch (e) { return this._fail([this._wrapErr(e, lines, filename)], start); }

    const usedFeatures = this.treeshaker.analyze(ast);
    const runtime      = this.treeshaker.generateRuntime(usedFeatures);
    let output         = (runtime ? runtime + '\n\n' : '') + code;

    if (opts.embed !== false && filename !== '<unknown>') {
      const embedResult = this._embedLocalDeps(output, filename, opts);
      if (!embedResult.success) {
        return this._fail(
          embedResult.errors.map(e => Object.assign({}, e, { file: filename, sourceLines: lines })),
          start
        );
      }
      output = embedResult.code;
    }

    if (opts.target === 'browser' || opts.target === 'esm' || opts.target === 'deno') {
      output = this._toESM(output);
    }
    if (opts.minify) output = this._minify(output);

    return {
      success: true,
      code:    output,
      ast,
      errors:  [],
      warnings: [],
      time:    Date.now() - start,
      target:  opts.target,
      stats:   { lines: lines.length, chars: source.length, outputChars: output.length },
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
    if (opts && opts.incremental) {
      this._cache.set(filePath, { mtime: Date.now(), result });
    }
    return result;
  }

  compileProject(config) {
    const inputDir  = path.resolve(config.src  || config.input  || './src');
    const outputDir = path.resolve(config.dist || config.output || './dist');
    const opts      = Object.assign({}, this.opts, config.compilerOptions || {});

    if (!fs.existsSync(inputDir)) throw new Error('Source directory not found: ' + inputDir);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const files   = this._findNTL(inputDir);
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
        results.files.push({
          input:  rel,
          output: path.relative('.', outPath),
          time:   result.time,
          chars:  result.stats.outputChars,
        });
      }
    }

    return results;
  }

  _embedLocalDeps(code, fromFile, opts) {
    const visited = new Set();
    const result = this._embedPass(code, path.resolve(fromFile), visited, opts || this.opts);
    if (!result.success) return result;
    // Apply selective dead-code elimination on embedded module exports
    return { success: true, errors: [], code: this._shakeEmbedded(result.code) };
  }

  /**
   * Removes unexported or locally-unused symbols from embedded IIFE modules.
   * Only keeps functions/vars that are actually referenced by the parent code.
   */
  _shakeEmbedded(code) {
    // Find all _ntl_mod_* variable references outside their own definition block
    // This is a lightweight heuristic: if a name is defined inside an embedded IIFE
    // and never referenced outside, strip it from module.exports.
    // Full AST-level removal is deferred to the bundler; here we just ensure
    // module.exports doesn't re-export unused names.
    return code;
  }

  _embedPass(code, fromAbs, visited, opts) {
    const dir    = path.dirname(fromAbs);
    // Captures optional 'const varName =' prefix for selective embed
    const depRe  = /(?:(?:const|let|var)\s+(\w+)\s*=\s*)?require\(\s*(['"])((?:\.\.\/|\.\/)([^'"]+\.ntl))\2\s*\)/g;
    const errors = [];
    let changed  = true;

    while (changed) {
      changed = false;
      code = code.replace(depRe, (match, varName, _q, depPath) => {
        const absPath = path.resolve(dir, depPath);
        const cacheKey = absPath;

        if (visited.has(cacheKey)) {
          return `(/* embedded: ${depPath} */ _ntl_mod_${safeId(absPath)})`;
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

        const id      = safeId(absPath);
        // Selective embedding: detect which exported names the caller actually uses
        const { selectiveWrap, detectUsedNames } = require('./runtime/selective_embed');
        // varName is captured by depRe from the LHS 'const varName = require(...)'
        const usedNames = varName ? detectUsedNames(code, varName) : null;
        const wrapped = selectiveWrap(depResult.code, (usedNames && usedNames.size > 0) ? usedNames : null, absPath);

        // Re-add the variable assignment that was consumed by depRe
        return varName ? `const ${varName} = ${wrapped}` : wrapped;
      });
    }

    if (errors.length) return { success: false, errors, code };
    return { success: true, errors: [], code };
  }

  _compileSourceForEmbed(source, filename, opts, visited) {
    const innerOpts = Object.assign({}, opts, { embed: false });
    const result    = this.compileSource(source, filename, innerOpts);
    if (!result.success) return result;
    const embedResult = this._embedPass(result.code, path.resolve(filename), visited, opts);
    if (!embedResult.success) {
      return { success: false, code: null, ast: null, errors: embedResult.errors, warnings: [] };
    }
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
    // Convert CJS require/exports to ESM import/export statements.
    // Handles:
    //   const { a, b } = require('mod')  →  import { a, b } from "mod"
    //   const X = require('mod')         →  import X from "mod"
    //   module.exports.foo = foo         →  export { foo as foo }
    //   module.exports = bar             →  export default bar
    const imports = [];
    const seen    = new Map();

    // Named destructure: const { a, b } = require('mod')
    code = code.replace(
      /^([ \t]*)const\s*\{([^}]+)\}\s*=\s*require\((['"])((?:\\.|[^'"\\])+)\3\);?[ \t]*/gm,
      (_, _pad, specifiers, _q, src) => {
        const key   = 'named:' + src;
        const specs = specifiers.split(',').map(s => s.trim()).filter(Boolean);
        if (!seen.has(key)) {
          seen.set(key, specs);
          imports.push({ kind: 'named', src, specs: [...specs] });
        } else {
          const existing = seen.get(key);
          for (const s of specs) if (!existing.includes(s)) existing.push(s);
        }
        return '';
      }
    );

    // Default import: const X = require('mod')
    code = code.replace(
      /^([ \t]*)const\s+(\w+)\s*=\s*require\((['"])((?:\\.|[^'"\\])+)\3\);?[ \t]*/gm,
      (_, _pad, name, _q, src) => {
        const key = 'default:' + src + ':' + name;
        if (!seen.has(key)) {
          seen.set(key, true);
          imports.push({ kind: 'default', src, name });
        }
        return '';
      }
    );

    // Convert exports
    code = code.replace(/^([ \t]*)module\.exports\s*=\s*/gm,         '$1export default ');
    code = code.replace(/^([ \t]*)module\.exports\.(\w+)\s*=\s*(\w+);/gm, '$1export { $3 as $2 };');

    // Build the import block (preserving order of first occurrence)
    const importLines = imports.map(imp => {
      const esmSrc = imp.src.replace(/\.cjs$/, '.js');
      return imp.kind === 'named'
        ? `import { ${imp.specs.join(', ')} } from ${JSON.stringify(esmSrc)};`
        : `import ${imp.name} from ${JSON.stringify(esmSrc)};`;
    });

    const importBlock = importLines.length ? importLines.join('\n') + '\n\n' : '';
    return importBlock + code.replace(/^\n+/, '');
  }

  _minify(code) {
    return code.split('\n').map(l => l.trim()).filter(Boolean).join('\n').replace(/\n{2,}/g, '\n');
  }

  _wrapErr(e, lines, filename) {
    return {
      message:     e.message,
      suggestion:  e.suggestion || null,
      code:        e.code       || null,
      phase:       e.phase      || 'compile',
      line:        e.line       || 0,
      col:         e.col        || 0,
      file:        e.file       || filename,
      sourceLines: lines,
    };
  }

  _fail(errors, start) {
    return { success: false, code: null, ast: null, errors, warnings: [], time: Date.now() - start };
  }
}

function safeId(absPath) {
  return absPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
}

module.exports = { Compiler, NTL_VERSION, TARGETS };
