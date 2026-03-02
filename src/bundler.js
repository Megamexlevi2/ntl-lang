'use strict';
const fs   = require('fs');
const path = require('path');
const { Compiler } = require('./compiler');

class Bundler {
  constructor(opts) {
    this.opts = Object.assign({ target: 'node', minify: false }, opts || {});
    this.compiler = new Compiler(this.opts);
    this._compiled = new Map();
  }

  bundleFile(entryPath, outPath) {
    const absEntry = path.resolve(entryPath);
    const parts = [];
    const visited = new Set();

    this._collectDeps(absEntry, parts, visited);

    const bundleCode = this._buildBundle(parts);

    if (outPath) {
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, bundleCode, 'utf-8');
    }
    return bundleCode;
  }

  bundleDir(dirPath, outPath) {
    const files = this._walkNtl(dirPath);
    const parts = [];
    const visited = new Set();

    for (const f of files) {
      this._collectDeps(f, parts, visited);
    }

    const bundleCode = this._buildBundle(parts);
    if (outPath) {
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(outPath, bundleCode, 'utf-8');
    }
    return bundleCode;
  }

  _collectDeps(absFile, parts, visited) {
    if (visited.has(absFile)) return;
    visited.add(absFile);

    if (!fs.existsSync(absFile)) return;

    const source = fs.readFileSync(absFile, 'utf-8');
    const result = this.compiler.compileSource(source, absFile, { ...this.opts, inBundle: true });
    if (!result.success) {
      throw new Error(`Bundle compile error in ${absFile}:\n` + result.errors.map(e => e.message).join('\n'));
    }

    const deps = this._extractDeps(result.code, absFile);
    for (const dep of deps) {
      this._collectDeps(dep, parts, visited);
    }

    const moduleId = this._moduleId(absFile);
    parts.push({ id: moduleId, code: result.code, file: absFile });
  }

  _extractDeps(code, fromFile) {
    const deps = [];
    const dir = path.dirname(fromFile);
    const re = /require\(["'](\.[^"']+\.js)["']\)/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      const resolved = path.resolve(dir, m[1]);
      if (fs.existsSync(resolved)) deps.push(resolved);
      else {
        const ntlVersion = resolved.replace(/\.js$/, '.ntl');
        if (fs.existsSync(ntlVersion)) {
          deps.push(ntlVersion);
        }
      }
    }
    return deps;
  }

  _moduleId(absFile) {
    return absFile.replace(/\\/g, '/').replace(/[^a-zA-Z0-9_]/g, '_');
  }

  _buildBundle(parts) {
    if (parts.length === 0) return '';

    const lines = [
      '(function(globalThis) {',
      '  "use strict";',
      '  const __ntl_modules = {};',
      '  const __ntl_require = function(id) {',
      '    if (!__ntl_modules[id]) throw new Error("Module not found: " + id);',
      '    if (!__ntl_modules[id].__loaded) {',
      '      __ntl_modules[id].__loaded = true;',
      '      __ntl_modules[id].factory(__ntl_modules[id].exports, __ntl_require);',
      '    }',
      '    return __ntl_modules[id].exports;',
      '  };',
    ];

    for (const part of parts) {
      const escaped = JSON.stringify(part.id);
      lines.push(`  __ntl_modules[${escaped}] = { exports: {}, __loaded: false, factory: function(module, require) {`);
      lines.push(`    var exports = module.exports;`);
      lines.push(`    var __dirname = ${JSON.stringify(path.dirname(part.file))};`);
      lines.push(`    var __filename = ${JSON.stringify(part.file)};`);
      const indented = part.code.split('\n').map(l => '    ' + l).join('\n');
      lines.push(indented);
      lines.push('  }};');
    }

    const entryId = JSON.stringify(parts[parts.length - 1].id);
    lines.push(`  __ntl_require(${entryId});`);
    lines.push('})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : global);');

    return lines.join('\n');
  }

  _walkNtl(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !['node_modules', '.git', 'dist'].includes(e.name)) {
        results.push(...this._walkNtl(full));
      } else if (e.isFile() && e.name.endsWith('.ntl')) {
        results.push(full);
      }
    }
    return results;
  }
}

module.exports = { Bundler };
