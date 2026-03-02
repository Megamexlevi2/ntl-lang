'use strict';

const { JITRunner, JITProfiler, instrumentCode } = require('./JITRuntime');
const { Optimizer } = require('./Optimizer');

/**
 * JITPipeline — thin facade kept for backward compatibility.
 * The real work is done inside JITRunner / JITRuntime.js.
 */
class JITPipeline {
  constructor(opts) {
    this.opts      = Object.assign({ verbose: false, profile: true, optimize: true }, opts || {});
    this.optimizer = new Optimizer({ constantFolding: true, deadCode: true, inlining: true });
    this._runner   = null;
  }

  /**
   * Compile NTL source, apply optimizations, inject JIT instrumentation.
   * Returns { success, code, optimizations, errors }.
   */
  compileWithJIT(source, filename, compiler) {
    const result = compiler.compileSource(source, filename, { target: 'node', treeShake: true });
    if (!result.success) return result;

    if (this.opts.optimize && result.ast) this.optimizer.optimize(result.ast);
    const optimStats = this.optimizer.getStats();
    const instrumentedCode = instrumentCode(result.code);

    return Object.assign({}, result, {
      code:          instrumentedCode,
      jit:           true,
      optimizations: optimStats,
    });
  }

  /**
   * Run NTL source through the full JIT pipeline (compile + optimize + execute).
   */
  run(source, filename, compiler, ctx) {
    this._runner = new JITRunner({
      verbose:      this.opts.verbose,
      showReport:   true,
      showUpgrades: true,
      optimize:     this.opts.optimize,
    });
    const res = this._runner.run(source, filename, compiler, ctx);
    return Object.assign({ runner: this._runner }, res);
  }

  printReport() {
    if (this._runner) this._runner.printReport();
  }

  getOptimizer() { return this.optimizer; }
}

module.exports = { JITPipeline };
