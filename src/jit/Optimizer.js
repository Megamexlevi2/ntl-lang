'use strict';

class Optimizer {
  constructor(opts) {
    this.opts = Object.assign({ constantFolding: true, deadCode: true, inlining: true, loopUnroll: false }, opts || {});
    this.stats = { folded: 0, eliminated: 0, inlined: 0 };
  }

  optimize(ast) {
    if (!ast) return ast;
    let node = this._clone(ast);
    if (this.opts.constantFolding) node = this._foldConstants(node);
    if (this.opts.deadCode)        node = this._eliminateDeadCode(node);
    if (this.opts.inlining)        node = this._inlineSmallFunctions(node);
    return node;
  }

  _clone(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(n => this._clone(n));
    const out = {};
    for (const k of Object.keys(node)) out[k] = this._clone(node[k]);
    return out;
  }

  _foldConstants(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(n => this._foldConstants(n));

    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'line' || k === 'col') continue;
      const v = node[k];
      if (v && typeof v === 'object') node[k] = this._foldConstants(v);
    }

    if (node.type === 'BinaryExpr') {
      const l = node.left, r = node.right;
      if (l && l.type === 'Literal' && r && r.type === 'Literal') {
        const lv = l.value, rv = r.value;
        let result = null;
        switch (node.op) {
          case '+':   result = typeof lv === 'string' || typeof rv === 'string' ? String(lv) + String(rv) : lv + rv; break;
          case '-':   result = lv - rv; break;
          case '*':   result = lv * rv; break;
          case '/':   if (rv !== 0) result = lv / rv; break;
          case '%':   if (rv !== 0) result = lv % rv; break;
          case '**':  result = lv ** rv; break;
          case '===': result = lv === rv; break;
          case '!==': result = lv !== rv; break;
          case '==':  result = lv == rv; break;
          case '!=':  result = lv != rv; break;
          case '<':   result = lv < rv; break;
          case '>':   result = lv > rv; break;
          case '<=':  result = lv <= rv; break;
          case '>=':  result = lv >= rv; break;
          case '&&':  result = lv && rv; break;
          case '||':  result = lv || rv; break;
        }
        if (result !== null) {
          this.stats.folded++;
          return { type: 'Literal', value: result, raw: JSON.stringify(result), line: node.line, col: node.col };
        }
      }
    }

    if (node.type === 'UnaryExpr' && node.operand && node.operand.type === 'Literal') {
      const v = node.operand.value;
      let result = null;
      switch (node.op) {
        case '-':  result = -v; break;
        case '!':  result = !v; break;
        case '~':  result = ~v; break;
        case '+':  result = +v; break;
      }
      if (result !== null) {
        this.stats.folded++;
        return { type: 'Literal', value: result, raw: JSON.stringify(result), line: node.line, col: node.col };
      }
    }

    return node;
  }

  _eliminateDeadCode(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(n => this._eliminateDeadCode(n)).filter(Boolean);

    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'line' || k === 'col') continue;
      const v = node[k];
      if (Array.isArray(v)) node[k] = v.map(n => this._eliminateDeadCode(n)).filter(Boolean);
      else if (v && typeof v === 'object' && v.type) node[k] = this._eliminateDeadCode(v);
    }

    if ((node.type === 'IfStmt' || node.type === 'UnlessStmt') && node.test && node.test.type === 'Literal') {
      const cond = !!node.test.value;
      const branch = node.type === 'IfStmt' ? cond : !cond;
      this.stats.eliminated++;
      if (branch) return node.consequent ? this._eliminateDeadCode(node.consequent) : null;
      return node.alternate ? this._eliminateDeadCode(node.alternate) : null;
    }

    if (node.type === 'WhileStmt' && node.test && node.test.type === 'Literal' && !node.test.value) {
      this.stats.eliminated++;
      return null;
    }

    return node;
  }

  _inlineSmallFunctions(ast) {
    if (!ast || ast.type !== 'Program') return ast;
    const INLINE_THRESHOLD = 3;
    const smallFns = new Map();

    for (const stmt of (ast.body || [])) {
      if (stmt && stmt.type === 'FnDecl' && !stmt.isAsync && !stmt.isGenerator) {
        const body = stmt.body && stmt.body.body ? stmt.body.body : [];
        if (body.length <= INLINE_THRESHOLD && stmt.params && stmt.params.length <= 4) {
          smallFns.set(stmt.name, { params: stmt.params, body });
        }
      }
    }

    if (!smallFns.size) return ast;

    const inline = (node) => {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) return node.map(inline);

      for (const k of Object.keys(node)) {
        if (k === 'type' || k === 'line' || k === 'col') continue;
        const v = node[k];
        if (Array.isArray(v)) node[k] = v.map(inline).filter(Boolean);
        else if (v && typeof v === 'object') node[k] = inline(v);
      }

      if (node.type === 'CallExpr' && node.callee && node.callee.type === 'Identifier') {
        const fn = smallFns.get(node.callee.name);
        if (fn && fn.body.length === 1) {
          const ret = fn.body[0];
          if (ret && ret.type === 'ReturnStmt' && ret.value) {
            this.stats.inlined++;
          }
        }
      }
      return node;
    };

    ast.body = inline(ast.body);
    return ast;
  }

  getStats() { return Object.assign({}, this.stats); }
}

module.exports = { Optimizer };
