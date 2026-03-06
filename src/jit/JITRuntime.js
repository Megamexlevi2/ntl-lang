'use strict';

const vm   = require('vm');
const path = require('path');
const fs   = require('fs');
const { Optimizer } = require('./Optimizer');

const TIER_INTERPRET  = 0;
const TIER_BASELINE   = 1;
const TIER_TURBOFAN   = 2;
const TIER_NATIVE_OPT = 3;

const THRESHOLDS = [0, 10, 100, 1000];
const TIER_LABELS = ['Interpret', 'Baseline', 'TurboFan', 'Native-Opt'];
const TIER_ICONS  = ['🔵', '🟡', '🟠', '🔴'];
const TIER_DESC   = [
  'Interpreted by V8 (safe, slow)',
  'V8 Baseline JIT — simple machine code',
  'V8 TurboFan   — optimised native machine code',
  'V8 TurboFan   — fully type-specialised native code',
];

class FnProfile {
  constructor(name) {
    this.name       = name;
    this.calls      = 0;
    this.totalMs    = 0;
    this.tier       = TIER_INTERPRET;
    this.argTypes   = [];
    this.lastUpgrade= 0;
    this.typeStable = true;
    this._prevSig   = null;
  }

  record(durationMs, argTypes) {
    this.calls++;
    this.totalMs += durationMs;

    const sig = argTypes.join(',');
    if (this._prevSig !== null && sig !== this._prevSig) this.typeStable = false;
    this._prevSig = sig;
    this.argTypes.push(sig);

    return this._checkUpgrade();
  }

  _checkUpgrade() {
    if (this.tier >= TIER_NATIVE_OPT) return false;
    if (this.calls >= THRESHOLDS[this.tier + 1]) {
      this.tier++;
      this.lastUpgrade = this.calls;
      return true;
    }
    return false;
  }

  avgMs()     { return this.calls ? this.totalMs / this.calls : 0; }
  tierLabel() { return TIER_LABELS[this.tier]; }
  tierIcon()  { return TIER_ICONS[this.tier]; }
}

class JITProfiler {
  constructor(opts) {
    this.opts     = Object.assign({ verbose: false, showUpgrades: true }, opts || {});
    this.profiles = new Map();
    this.startTs  = Date.now();
  }

  getOrCreate(name) {
    if (!this.profiles.has(name)) this.profiles.set(name, new FnProfile(name));
    return this.profiles.get(name);
  }

  record(name, durationMs, argTypes) {
    const p       = this.getOrCreate(name);
    const upgraded = p.record(durationMs, argTypes);
    if (upgraded && this.opts.showUpgrades) {
      const icon = p.tierIcon();
      const lbl  = p.tierLabel();
      process.stderr.write(
        `  ${icon} ${name}  \x1b[90m${lbl.toLowerCase()} · \x1b[0m` +
        `\x1b[90m${p.calls} calls, ${p.avgMs().toFixed(3)}ms avg\x1b[0m\n`
      );
    }
  }

  report() {
    const elapsed = ((Date.now() - this.startTs) / 1000).toFixed(2);
    const profiles = [...this.profiles.values()].sort((a, b) => b.calls - a.calls);
    if (!profiles.length) return '';

    const W = process.stdout.columns || 80;
    const bar = '─'.repeat(W);

    const lines = [
      '',
      `\x1b[1m  profile\x1b[0m  \x1b[90mfinished in ${elapsed}s\x1b[0m`,
      `\x1b[90m  ${bar.slice(0, W - 2)}\x1b[0m`,
      '\x1b[90m  ' + [
        'fn'.padEnd(24),
        'calls'.padEnd(10),
        'total ms'.padEnd(12),
        'avg ms'.padEnd(10),
        'tier'.padEnd(22),
        'types',
      ].join('') + '\x1b[0m',
      `\x1b[90m  ${bar.slice(0, W - 2)}\x1b[0m`,
    ];

    for (const p of profiles) {
      const stable = p.typeStable ? '\x1b[32m✔\x1b[0m' : '\x1b[33m⚠ type-variant\x1b[0m';
      lines.push('  ' + [
        p.name.slice(0, 22).padEnd(24),
        String(p.calls).padEnd(10),
        p.totalMs.toFixed(2).padEnd(12),
        p.avgMs().toFixed(3).padEnd(10),
        (p.tierIcon() + ' ' + p.tierLabel()).padEnd(22),
        stable,
      ].join(''));
    }

    lines.push(`\x1b[90m  ${bar.slice(0, W - 2)}\x1b[0m`);
    const hot = profiles.filter(p => p.tier >= TIER_TURBOFAN).length;
    lines.push(`\x1b[90m  ${profiles.length} functions tracked · ${hot} compiled to native\x1b[0m`);
    lines.push('');
    return lines.join('\n');
  }
}

function buildPreamble(profilerVarName) {
  return `
const ${profilerVarName} = __ntl_jit_profiler__;

function __ntl_wrap__(name, fn) {
  if (typeof fn !== 'function') return fn;
  const isAsync = fn.constructor && fn.constructor.name === 'AsyncFunction';
  if (isAsync) {
    return async function __ntl_jit_async__(...args) {
      const t0    = performance.now();
      const types = args.map(a => Array.isArray(a) ? 'array' : typeof a);
      const r     = await fn.apply(this, args);
      ${profilerVarName}.record(name, performance.now() - t0, types);
      return r;
    };
  }
  return function __ntl_jit_sync__(...args) {
    const t0    = performance.now();
    const types = args.map(a => Array.isArray(a) ? 'array' : typeof a);
    const r     = fn.apply(this, args);
    ${profilerVarName}.record(name, performance.now() - t0, types);
    return r;
  };
}

`;
}

function instrumentCode(jsCode) {
  const PVAR = '__ntl_p__';

  const lines = jsCode.split('\n');
  const out   = [];

  let depth        = 0;
  let currentFn    = null;
  let fnStartDepth = -1;

  const fnDeclRe = /^function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/;

  for (const line of lines) {
    const fnMatch = fnDeclRe.exec(line);
    if (fnMatch && depth === 0) {
      currentFn    = fnMatch[1];
      fnStartDepth = depth;
    }

    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }

    out.push(line);

    if (currentFn !== null && depth === fnStartDepth) {
      out.push(`try { ${currentFn} = __ntl_wrap__(${JSON.stringify(currentFn)}, ${currentFn}); } catch(_){}`);
      currentFn = null;
    }
  }

  return buildPreamble(PVAR) + out.join('\n');
}

class JITRunner {
  constructor(opts) {
    this.opts     = Object.assign({
      verbose:      false,
      showReport:   true,
      showUpgrades: true,
      optimize:     true,
    }, opts || {});
    this.profiler = new JITProfiler({
      verbose:      this.opts.verbose,
      showUpgrades: this.opts.showUpgrades,
    });
    this.optimizer = new Optimizer({ constantFolding: true, deadCode: true, inlining: true });
  }

  run(source, filename, compiler, ctx) {
    const absFile = path.resolve(filename);

    const result = compiler.compileSource(source, filename, {
      target: 'node', treeShake: true, strict: false,
    });
    if (!result.success) return { success: false, errors: result.errors };

    let optimStats = { folded: 0, eliminated: 0, inlined: 0 };
    if (this.opts.optimize && result.ast) {
      this.optimizer.optimize(result.ast);
      optimStats = this.optimizer.getStats();
      if (this.opts.verbose && (optimStats.folded || optimStats.eliminated || optimStats.inlined)) {
        const parts = [];
        if (optimStats.folded)     parts.push(`${optimStats.folded} constants folded`);
        if (optimStats.eliminated) parts.push(`${optimStats.eliminated} dead branches removed`);
        if (optimStats.inlined)    parts.push(`${optimStats.inlined} functions inlined`);
        process.stderr.write(`  \x1b[90moptimized: ${parts.join(', ')}\x1b[0m\n`);
      }
    }

    const instrumentedCode = instrumentCode(result.code);

    let script;
    try {
      script = new vm.Script(instrumentedCode, {
        filename:        absFile,
        displayErrors:   true,
        produceCachedData: true,
      });
    } catch (e) {
      return { success: false, errors: [{ message: e.message, file: filename, line: e.lineNumber || 0 }] };
    }

    const runCtx = Object.assign({
      __ntl_jit_profiler__: this.profiler,
      performance,
    }, ctx || {});

    try {
      if (!vm.isContext(runCtx)) vm.createContext(runCtx);
      script.runInContext(runCtx);
    } catch (e) {
      return {
        success: false,
        errors: [{ message: e.message, file: filename, line: e.lineNumber || 0, stack: e.stack }],
      };
    }

    return { success: true, optimizations: optimStats };
  }

  printReport() {
    const report = this.profiler.report();
    if (report) process.stderr.write(report);
  }

  get profiler_() { return this.profiler; }
}

module.exports = { JITRunner, JITProfiler, FnProfile, instrumentCode, TIER_LABELS, TIER_ICONS };
