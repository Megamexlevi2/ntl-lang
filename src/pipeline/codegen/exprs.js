'use strict';

// Expression-level code generators.
// Everything that returns a value (not a statement) is handled here.

/**
 * Mixes expression-generation methods into a CodeGen instance.
 * @param {object} gen - The CodeGen instance to extend.
 */
function mixinExprs(gen) {

  /**
   * The main expression dispatch. Routes each AST expression node
   * to the correct helper method.
   * @param {object} node
   * @returns {string}
   */
  gen.genExpr = function(node) {
    if (!node) return '';
    switch (node.type) {
      // --- match used as an expression (IIFE wrapper) ---
      case 'MatchStmt': {
        const uid  = `${node.line || 0}_${Math.floor(Math.random() * 9999)}`;
        const subj = `_m${uid}`;
        let iife   = `(() => { const ${subj} = ${this.genExpr(node.subject)};`;
        for (const mc of node.cases) {
          if (mc.isDefault) {
            iife += ` {`;
            const stmts = mc.body.type === 'Block' ? (mc.body.body || []) : [mc.body];
            for (const s of stmts) {
              const gs = this.genStmt(s, 0).trim();
              iife += gs.startsWith('return') || gs.startsWith('throw') || gs.startsWith('{')
                ? ` ${gs}` : ` return ${gs.replace(/;$/, '')};`;
            }
            iife += ` }`;
          } else {
            const conds = mc.patterns.map(p => this.genMatchPattern(subj, p));
            const guard = mc.guard ? ` && (${this.genExpr(mc.guard)})` : '';
            iife += ` if (${conds.join(' || ')}${guard}) {`;
            const stmts = mc.body.type === 'Block' ? (mc.body.body || []) : [mc.body];
            for (const s of stmts) {
              const gs = this.genStmt(s, 0).trim();
              iife += gs.startsWith('return') || gs.startsWith('throw') || gs.startsWith('{')
                ? ` ${gs}` : ` return ${gs.replace(/;$/, '')};`;
            }
            iife += ` }`;
          }
        }
        iife += ` })()`;
        return iife;
      }

      // --- literals ---
      case 'NumberLit':    return typeof node.value === 'bigint' ? String(node.value) + 'n' : String(node.value);
      case 'StringLit':    return JSON.stringify(node.value);
      case 'BoolLit':      return String(node.value);
      case 'NullLit':      return 'null';
      case 'UndefinedLit': return 'undefined';
      case 'VoidExpr':     return `void ${this.genExpr(node.arg)}`;
      case 'ThisExpr':     return 'this';
      case 'SuperExpr':    return 'super';
      case 'Identifier':   return node.name;

      // --- compound literals ---
      case 'TemplateLit': return this.genTemplate(node);
      case 'ArrayLit': {
        const els = (node.elements || []).map(e => e ? this.genExpr(e) : '');
        return `[${els.join(', ')}]`;
      }
      case 'ObjectLit': return this.genObjectLit(node);

      // --- functions ---
      case 'FnExpr':
      case 'FnDecl':  return this.genFnExpr(node);
      case 'ArrowFn': return this.genArrowFn(node);

      // --- member access ---
      case 'MemberExpr': {
        const objNode = node.object;
        const needsParens = objNode && (
          objNode.type === 'BinaryExpr'  ||
          objNode.type === 'TernaryExpr' ||
          objNode.type === 'AssignExpr'  ||
          objNode.type === 'LogicalExpr' ||
          (objNode.type === 'NumberLiteral' && !node.computed)
        );
        let obj = this.genExpr(objNode);
        if (needsParens) obj = `(${obj})`;
        if (node.computed) return `${obj}${node.optional ? '?.[' : '['}${this.genExpr(node.prop)}]`;
        return `${obj}${node.optional ? '?.' : '.'}${node.prop}`;
      }

      // --- calls ---
      case 'CallExpr': {
        const args   = (node.args || []).map(a => this.genExpr(a));
        // super.init(...) in NTL becomes super(...) in JS
        if (node.callee?.type === 'MemberExpr' &&
            node.callee.object?.type === 'SuperExpr' &&
            node.callee.prop === 'init') {
          return `super(${args.join(', ')})`;
        }
        const callee = this.genExpr(node.callee);
        if (node.optional) return `${callee}?.(${args.join(', ')})`;
        return `${callee}(${args.join(', ')})`;
      }
      case 'NewExpr': {
        const args = (node.args || []).map(a => this.genExpr(a));
        return `new ${this.genExpr(node.callee)}(${args.join(', ')})`;
      }

      // --- operators ---
      case 'BinaryExpr': {
        const l = this.genExprParens(node.left, node);
        const r = this.genExprParens(node.right, node);
        const op = node.op;
        // NaN comparisons are rewritten to isNaN() for correctness
        const rIsNaN = node.right?.type === 'Identifier' && node.right.name === 'NaN';
        const lIsNaN = node.left?.type  === 'Identifier' && node.left.name  === 'NaN';
        if (rIsNaN && (op === '===' || op === '=='))  return `isNaN(${l})`;
        if (rIsNaN && (op === '!==' || op === '!='))  return `!isNaN(${l})`;
        if (lIsNaN && (op === '===' || op === '=='))  return `isNaN(${r})`;
        if (lIsNaN && (op === '!==' || op === '!='))  return `!isNaN(${r})`;
        return `${l} ${op} ${r}`;
      }
      case 'UnaryExpr': {
        const arg = this.genExpr(node.arg);
        if (node.op === 'delete') return `delete ${arg}`;
        if (node.prefix !== false && (node.op === '++' || node.op === '--')) return `${node.op}${arg}`;
        if (node.op === '++' || node.op === '--') return `${arg}${node.op}`;
        const needSpace = ['typeof', 'void', 'delete', 'throw'].includes(node.op);
        return needSpace ? `${node.op} ${arg}` : `${node.op}${arg}`;
      }
      case 'AssignExpr':   return `${this.genExpr(node.left)} ${node.op} ${this.genExpr(node.right)}`;
      case 'TernaryExpr':  return `${this.genExprParens(node.test, { precedence: 4 })} ? ${this.genExpr(node.consequent)} : ${this.genExpr(node.alternate)}`;
      case 'AwaitExpr':    return `await ${this.genExpr(node.arg)}`;
      case 'YieldExpr':    return `yield${node.delegate ? '*' : ''} ${this.genExpr(node.arg)}`;
      case 'SpreadExpr':   return `...${this.genExpr(node.arg)}`;
      case 'PipelineExpr': return this.genPipeline(node);
      case 'SequenceExpr': return `(${(node.exprs || []).map(e => this.genExpr(e)).join(', ')})`;
      case 'NotExpr':      return `!(${this.genExpr(node.value)})`;

      // --- NTL-specific expressions ---
      case 'HaveExpr': {
        if (!node.matchMode && !node.inExpr) {
          // `have expr` with optional chaining — unwraps to ?. chain
          const optChain = (n) => {
            if (!n) return '';
            if (n.type === 'MemberExpr') {
              const obj  = optChain(n.object);
              const prop = typeof n.prop === 'string' ? n.prop : (n.prop?.name || this.genExpr(n.prop));
              if (n.computed) return `${obj}?.[${this.genExpr(n.prop)}]`;
              return `${obj}?.${prop}`;
            }
            return n.name || this.genExpr(n);
          };
          return optChain(node.value || node.expr);
        }
        return this._haveCondExpr(node);
      }
      case 'TrySafeExpr': {
        // `try? expr` — returns null on error instead of throwing
        const expr = this.genExpr(node.expr);
        return `((() => { try { return ${expr}; } catch(_ntl_e) { return null; } })())`;
      }
      case 'RangeExpr':    return this.genRange(node);
      case 'SleepExpr':    return `(await new Promise((_r) => setTimeout(_r, ${this.genExpr(node.ms)})))`;

      // --- module imports as expressions ---
      case 'RequireExpr': {
        const { resolveModuleName } = require('../../runtime/resolver');
        const src     = node.source || '';
        const ntlName = resolveModuleName(src);
        if (ntlName) return `require(${JSON.stringify('ntl:' + ntlName)})`;
        if (src.endsWith('.ntl') && (src.startsWith('./') || src.startsWith('../')))
          return `require(${JSON.stringify(src)})`;
        const fixedSrc = src.endsWith('.ntl') ? src.slice(0, -4) + '.js' : src;
        return `require(${JSON.stringify(fixedSrc)})`;
      }
      case 'NaxImportExpr':   return this.genNaxImport(node);
      case 'NTLRequireExpr': {
        const m = (node.modules || [])[0];
        if (!m) return 'undefined';
        return `require(${JSON.stringify('ntl:' + m)})`;
      }

      // --- misc ---
      case 'RegexLit':       return `/${node.pattern}/${node.flags}`;
      case 'ChannelExpr':    return `{ _queue: [], _listeners: [], send(v) { if (this._listeners.length) { this._listeners.shift()(v); } else { this._queue.push(v); } }, receive() { return new Promise(r => { if (this._queue.length) r(this._queue.shift()); else this._listeners.push(r); }) } }`;
      case 'BindingExpr':    return `${this.genExpr(node.object)}.${node.method}.bind(${this.genExpr(node.object)})`;
      case 'SatisfiesExpr':  return this.genExpr(node.expr);
      case 'DecoratedExpr':  return this.genExpr(node.expr || node.stmt);

      default:
        if (node.name)             return node.name;
        if (node.value !== undefined) return JSON.stringify(node.value);
        return '';
    }
  };

  /**
   * Wraps an expression in parentheses if its operator precedence is lower
   * than its parent node's operator — prevents incorrect JS output.
   * @param {object} node   - Child node.
   * @param {object} parent - Parent node (must have `.op`).
   * @returns {string}
   */
  gen.genExprParens = function(node, parent) {
    const PREC = {
      '||': 3, '&&': 4, '|': 5, '^': 6, '&': 7,
      '==': 8, '!=': 8, '===': 8, '!==': 8,
      '<': 9, '>': 9, '<=': 9, '>=': 9,
      '<<': 10, '>>': 10, '>>>': 10,
      '+': 11, '-': 11, '*': 12, '/': 12, '%': 12, '**': 13,
    };
    const code = this.genExpr(node);
    if (node.type === 'BinaryExpr' && parent && parent.op) {
      const pp = PREC[parent.op] || 0;
      const cp = PREC[node.op]   || 0;
      if (cp < pp) return `(${code})`;
    }
    return code;
  };

  /** @param {object} node @returns {string} */
  gen.genTemplate = function(node) {
    // The parser stores parts as either:
    //   - a raw string (from the lexer's readTemplate output), or
    //   - an array of {kind, value/source} segments (from the JSX transform)
    if (!node.parts) return '``';

    // Raw string path — parts is the verbatim content between backticks
    if (typeof node.parts === 'string') {
      return '`' + node.parts + '`';
    }

    // Array-of-segments path (used by the JSX transform and some parser paths)
    if (!node.parts.length) return '``';
    const { tokenize } = require('../lexer');
    const { parse }    = require('../parser');
    const parts = node.parts.map(p => {
      if (p.kind === 'str')  return p.value.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
      if (p.kind === 'expr') {
        try {
          const toks = tokenize(p.source, '<template>');
          const ast  = parse(toks, '<template>');
          const code = this.genExpr(ast.body[0].expr || ast.body[0]);
          return '${' + code + '}';
        } catch (e) { return '${' + p.source + '}'; }
      }
      return '';
    });
    return '`' + parts.join('') + '`';
  };

  /** @param {object} node @returns {string} */
  gen.genObjectLit = function(node) {
    const parts = (node.props || []).map(p => {
      if (p.kind === 'spread')    return `...${this.genExpr(p.arg)}`;
      if (p.kind === 'shorthand') return p.key;
      if (p.kind === 'method') {
        const pre    = p.isGet ? 'get ' : p.isSet ? 'set ' : '';
        const params = this.genParams(p.params);
        const body   = this.genBlock(p.body, 1);
        return `${pre}${p.key}(${params}) ${body}`;
      }
      if (p.kind === 'prop') {
        const k = p.computed ? `[${this.genExpr(p.key)}]` : p.key;
        return `${k}: ${this.genExpr(p.value)}`;
      }
      return '';
    });
    return `{ ${parts.join(', ')} }`;
  };

  /** @param {object} node @returns {string} */
  gen.genFnExpr = function(node) {
    const a      = node.isAsync     ? 'async ' : '';
    const g      = node.isGenerator ? '*'      : '';
    const params = this.genParams(node.params);
    const body   = this.genBlock(node.body, 0);
    return `${a}function${g}${node.name ? ' ' + node.name : ''}(${params}) ${body}`;
  };

  /** @param {object} node @returns {string} */
  gen.genArrowFn = function(node) {
    const a        = node.isAsync ? 'async ' : '';
    const params   = this.genParams(node.params);
    // Single-parameter arrow functions omit the parentheses for readability
    const paramStr = (node.params && node.params.length === 1 &&
      !node.params[0].rest && !node.params[0].defaultVal && !node.params[0].typeAnn)
      ? node.params[0].name : `(${params})`;
    if (node.body.type === 'Block') return `${a}${paramStr} => ${this.genBlock(node.body, 0)}`;
    const STMT_BODY_TYPES = new Set([
      'LogStmt', 'IfStmt', 'WhileStmt', 'ReturnStmt', 'ThrowStmt',
      'VarDecl', 'FnDecl', 'ClassDecl', 'UnlessStmt', 'GuardStmt',
    ]);
    if (STMT_BODY_TYPES.has(node.body.type)) {
      const inner = this.genStmt(node.body, 1).trimEnd().replace(/;$/, '');
      return `${a}${paramStr} => { ${inner}; }`;
    }
    return `${a}${paramStr} => ${this.genExpr(node.body)}`;
  };

  /** Compiles `left |> right` (pipeline) to `right(left)`. @param {object} node @returns {string} */
  gen.genPipeline = function(node) {
    return `(${this.genExpr(node.right)})(${this.genExpr(node.left)})`;
  };

  /**
   * Generates a `range(...)` call.
   * `range(n)` → `[0..n-1]`
   * `range(start, end, step?)` → slice of the range.
   * @param {object} node
   * @returns {string}
   */
  gen.genRange = function(node) {
    const args = node.args || [];
    if (args.length === 0) return '[]';
    if (args.length === 1) {
      const n = this.genExpr(args[0]);
      return `Array.from({length: ${n}}, (_, _i) => _i)`;
    }
    const start = this.genExpr(args[0]);
    const end   = this.genExpr(args[1]);
    const step  = args[2] ? this.genExpr(args[2]) : '1';
    return `Array.from({length: Math.max(0, Math.ceil((${end} - ${start}) / ${step}))}, (_, _i) => ${start} + _i * ${step})`;
  };

  /** @param {object} node @returns {string} */
  gen.genNaxImport = function(node) {
    const { NAX_RUNTIME_PATH } = require('../../runtime/resolver');
    return `(await (async () => { const {naxLoad} = require(${JSON.stringify(NAX_RUNTIME_PATH)}); return naxLoad(${JSON.stringify(node.url)}); })())`;
  };

  /**
   * Generates the JS expression for `have`/`not have`/`between`/`in`/`matches`/etc.
   * All NTL membership and range expressions are compiled here.
   * @param {object} node
   * @returns {string}
   */
  gen._haveCondExpr = function(node) {
    const exprNode = node.expr || node.value;
    const expr     = this.genExpr(exprNode);
    const inE      = node.inExpr;
    switch (node.matchMode) {
      case 'in': {
        const tgt = this.genExpr(inE);
        return `(()=>{const _v=${expr},_t=${tgt};return Array.isArray(_t)?_t.includes(_v):(_t instanceof Set?_t.has(_v):(_t&&typeof _t==='object'?(_v in _t):typeof _t==='string'?_t.includes(String(_v)):false));})()`;
      }
      case 'not_in': {
        const tgt = this.genExpr(inE);
        return `!(()=>{const _v=${expr},_t=${tgt};return Array.isArray(_t)?_t.includes(_v):(_t instanceof Set?_t.has(_v):(_t&&typeof _t==='object'?(_v in _t):typeof _t==='string'?_t.includes(String(_v)):false));})()`;
      }
      case 'matches':
        return `(${this.genExpr(inE)}).test(String(${expr}))`;
      case 'is': {
        const nm = inE?.name ? inE.name.toLowerCase() : this.genExpr(inE);
        if (['string', 'number', 'boolean', 'function', 'bigint', 'symbol', 'undefined'].includes(nm))
          return `(typeof (${expr})===${JSON.stringify(nm)})`;
        return `((${expr}) instanceof ${this.genExpr(inE)})`;
      }
      case 'is_not': {
        const nm = inE?.name ? inE.name.toLowerCase() : this.genExpr(inE);
        if (['string', 'number', 'boolean', 'function', 'bigint', 'symbol', 'undefined'].includes(nm))
          return `(typeof (${expr})!==${JSON.stringify(nm)})`;
        return `!((${expr}) instanceof ${this.genExpr(inE)})`;
      }
      case 'between': {
        const lo = this.genExpr(inE.lo), hi = this.genExpr(inE.hi);
        return `((${expr})>=(${lo})&&(${expr})<=(${hi}))`;
      }
      case 'startsWith':
        return `String(${expr}).startsWith(String(${this.genExpr(inE)}))`;
      case 'endsWith':
        return `String(${expr}).endsWith(String(${this.genExpr(inE)}))`;
      default:
        // Bare `have x` — truthy check that also rejects empty string
        return `(${expr})!==null&&(${expr})!==undefined&&(${expr})!==false&&(${expr})!==''`;
    }
  };
}

module.exports = { mixinExprs };
