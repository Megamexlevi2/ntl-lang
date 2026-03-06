'use strict';

const { JITRunner, JITProfiler, instrumentCode } = require('./JITRuntime');
const { Optimizer } = require('./Optimizer');

class JITPipeline {
  constructor(opts) {
    this.opts      = Object.assign({ verbose: false, profile: true, optimize: true }, opts || {});
    this.optimizer = new Optimizer({ constantFolding: true, deadCode: true, inlining: true });
    this._runner   = null;
  }

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
