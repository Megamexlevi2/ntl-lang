'use strict';

// Code generator — converts a NTL AST into JavaScript source.
//
// The logic is split across four focused sub-modules:
//   helpers.js  — padding, safe IDs, destructure, params, reassignment scan
//   stmts.js    — statement generators (if, for, try, import, export, …)
//   class.js    — class declarations, match statements, decorators
//   exprs.js    — expression generators (literals, calls, operators, …)
//
// This file assembles them into the public CodeGen class.

const { pad, safeId, genDestructPat, genDestructurePattern, genParams, collectReassigned } = require('./helpers');
const { mixinStmts }  = require('./stmts');
const { mixinClass }  = require('./class');
const { mixinExprs }  = require('./exprs');

class CodeGen {
  /**
   * @param {object} [opts]
   * @param {string}  [opts.target]   - Compilation target (node, browser, …)
   * @param {boolean} [opts.comments] - Include type annotation comments in output.
   */
  constructor(opts) {
    this.opts        = opts || {};
    this.indent      = 0;
    this._macros     = {};
    this._deferStack = [];
    this._comments   = !!(opts && opts.comments);

    // Install all method groups onto this instance
    mixinStmts(this);
    mixinClass(this);
    mixinExprs(this);
  }

  // --- Delegating helpers (forward to pure functions from helpers.js) ---

  /** @param {number} n @returns {string} */
  pad(n) { return pad(n !== undefined ? n : this.indent); }

  /** @param {string} text @returns {string} */
  _comment(text) {
    if (!this._comments) return '';
    return ' ';
  }

  /**
   * @param {string} text
   * @param {number} [padLevel]
   * @returns {string}
   */
  _blockComment(text, padLevel) {
    if (!this._comments) return '';
    const p = typeof padLevel === 'number' ? '  '.repeat(padLevel) : '';
    return p + '// ' + text + '\n';
  }

  /** @param {object} d @returns {string} */
  genDestructPat(d)          { return genDestructPat(d, this.genExpr.bind(this)); }
  /** @param {object} d @returns {string} */
  genDestructurePattern(d)   { return genDestructurePattern(d, this.genExpr.bind(this)); }
  /** @param {Array} params @returns {string} */
  genParams(params)          { return genParams(params, this.genExpr.bind(this), this.genDestructurePattern.bind(this)); }

  // --- Entry point ---

  /**
   * Generates JavaScript source for an entire AST.
   * @param {object} node - Root `Program` node (or any statement node).
   * @param {number} [pad]
   * @returns {string}
   */
  gen(node, pad) {
    if (!node) return '';
    pad = pad !== undefined ? pad : this.indent;
    switch (node.type) {
      case 'Program': {
        // Scan the whole tree once to find every reassigned variable.
        // The result informs const-vs-let decisions in genVarDecl.
        this._reassigned = collectReassigned(node);
        const body = node.body.map(s => this.genStmt(s, 0)).filter(Boolean).join('');
        return body;
      }
      default: return this.genStmt(node, pad);
    }
  }

  /**
   * Dispatches a statement node to the correct `gen*` method.
   * @param {object} node
   * @param {number} pad
   * @returns {string}
   */
  genStmt(node, pad) {
    if (!node) return '';
    pad = pad !== undefined ? pad : this.indent;
    const p = this.pad(pad);
    switch (node.type) {
      case 'VarDecl':       return this.genVarDecl(node, pad);
      case 'MultiVarDecl':  return node.declarations.map(d => this.genVarDecl(Object.assign({}, d, { type: 'VarDecl' }), pad)).join('\n');
      case 'FnDecl':        return this.genFnDecl(node, pad);
      case 'ClassDecl':     return this.genClassDecl(node, pad);
      case 'InterfaceDecl': return ''; // interfaces are erased — type-only
      case 'TraitDecl':     return ''; // traits are erased — type-only
      case 'TypeAlias':     return ''; // type aliases are erased
      case 'MacroDecl':     { this._macros[node.name] = { params: node.params, body: node.body }; return ''; }
      case 'EnumDecl':      return this.genEnum(node, pad);
      case 'NamespaceDecl': return this.genNamespace(node, pad);
      case 'IfStmt':        return this.genIf(node, pad);
      case 'UnlessStmt':    return this.genUnless(node, pad);
      case 'WhileStmt':     return `${p}while (${this.genExpr(node.test)}) ${this.genBlock(node.body, pad)}\n`;
      case 'DoWhileStmt':   return `${p}do ${this.genBlock(node.body, pad)} while (${this.genExpr(node.test)});\n`;
      case 'ForOfStmt':     return this.genForOf(node, pad);
      case 'ForInStmt': {
        const kw = node.isConst ? 'const' : 'let';
        const id = node.id || this.genDestructPat(node.destructure);
        return `${p}for (${kw} ${id} in ${this.genExpr(node.iterable)}) ${this.genBlock(node.body, pad)}\n`;
      }
      case 'LoopStmt':      return `${p}while (true) ${this.genBlock(node.body, pad)}\n`;
      case 'RepeatStmt':    return this.genRepeat(node, pad);
      case 'GuardStmt':     return this.genGuard(node, pad);
      case 'DeferStmt':     return this.genDefer(node, pad);
      case 'LogStmt':       return `${p}console.log(${(node.args || []).map(a => this.genExpr(a)).join(', ')});\n`;
      case 'AssertStmt':    return this.genAssert(node, pad);
      case 'SleepStmt':     return `${p}await new Promise((_r) => setTimeout(_r, ${this.genExpr(node.ms)}));\n`;
      case 'ReturnStmt':    return `${p}return${node.value ? ' ' + this.genExpr(node.value) : ''};\n`;
      case 'ThrowStmt':     return `${p}throw ${this.genExpr(node.value)};\n`;
      case 'TryStmt':       return this.genTry(node, pad);
      case 'MatchStmt':     return this.genMatch(node, pad);
      case 'BreakStmt':     return `${p}break;\n`;
      case 'ContinueStmt':  return `${p}continue;\n`;
      case 'BlockStmt':
      case 'Block':         return this.genBlock(node, pad);
      case 'ExprStmt':      return `${p}${this.genExpr(node.expr)};\n`;
      case 'DecoratedExpr': return this.genDecorated(node, pad);
      case 'ImportDecl':    return this.genImport(node, pad);
      case 'ExportDecl':    return this.genExport(node, pad);
      case 'NTLRequire':    return this.genNTLRequire(node, pad);
      case 'ComponentDecl': return this.genComponent(node, pad);
      case 'SpawnStmt':     return `${p}Promise.resolve().then(() => ${this.genExpr(node.expr)});\n`;
      case 'SelectStmt':    return this.genSelect(node, pad);
      case 'ImmutableDecl': return this.genImmutable(node, pad);
      case 'IfHaveStmt':    return this.genIfHave(node, pad);
      case 'HaveStmt':      return this.genHaveStmt(node, pad);
      case 'IfSetStmt':     return this.genIfSet(node, pad);
      case 'UsingDecl':     return `${p}const ${node.name} = ${this.genExpr(node.init)};\n`;
      case 'DeclareStmt':   return '';
      default:              return `${p}${this.genExpr(node)};\n`;
    }
  }
}

/**
 * Convenience function — compiles an AST directly to JS string.
 * @param {object} ast
 * @param {object} [opts]
 * @returns {string}
 */
function generate(ast, opts) { return new CodeGen(opts).gen(ast); }

module.exports = { CodeGen, generate, safeId };
