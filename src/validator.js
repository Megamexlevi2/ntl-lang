'use strict';
const NTL_RESERVED = new Set([
  'var', 'val', 'fn', 'class', 'if', 'else', 'unless', 'while', 'for', 'loop',
  'return', 'raise', 'throw', 'try', 'catch', 'finally', 'match', 'case', 'default',
  'in', 'of', 'break', 'continue', 'new', 'this', 'super', 'async', 'await',
  'true', 'false', 'null', 'void', 'typeof', 'instanceof', 'ifset', 'have',
  'enum', 'type', 'export', 'import', 'require', 'ntl', 'static', 'get', 'set', 'do', 'yield'
]);
class Validator {
  constructor() {
    this.warnings = [];
    this.errors = [];
    this.depth = 0;
  }
  validate(ast) {
    this.warnings = [];
    this.errors = [];
    this.depth = 0;
    this._inFunction = false;
    this._inLoop = false;
    this.visitProgram(ast);
    return { errors: this.errors, warnings: this.warnings };
  }
  error(message, node) {
    this.errors.push({ message, line: node ? node.line : 0 });
  }
  warn(message, node) {
    this.warnings.push({ message, line: node ? node.line : 0 });
  }
  visitProgram(ast) {
    for (const node of ast.body) this.visit(node);
  }
  visit(node) {
    if (!node) return;
    const prev = { fn: this._inFunction, loop: this._inLoop };
    switch (node.type) {
      case 'VarDeclaration':
        for (const d of node.declarations) {
          if (NTL_RESERVED.has(d.name)) {
            this.error(`'${d.name}' is a reserved keyword and cannot be used as a variable name`, node);
          }
        }
        if (node.declarations.some(d => d.init)) {
          for (const d of node.declarations) {
            if (d.init) this.visitExpr(d.init);
          }
        }
        break;
      case 'FnDeclaration':
        if (NTL_RESERVED.has(node.name)) {
          this.error(`'${node.name}' is a reserved keyword`, node);
        }
        if (node.params.length > 20) {
          this.warn(`Function '${node.name}' has ${node.params.length} parameters. Consider using an options object.`, node);
        }
        const seen = new Set();
        for (const p of node.params) {
          if (seen.has(p.name)) this.error(`Duplicate parameter name '${p.name}' in function '${node.name}'`, node);
          seen.add(p.name);
        }
        this._inFunction = true;
        this.visitBlock(node.body);
        this._inFunction = prev.fn;
        break;
      case 'ClassDeclaration':
        if (NTL_RESERVED.has(node.name)) this.error(`'${node.name}' is reserved`, node);
        for (const m of node.members) {
          if (m.type === 'ClassMethod') {
            this._inFunction = true;
            this.visitBlock(m.body);
            this._inFunction = prev.fn;
          }
        }
        break;
      case 'ReturnStatement':
        if (!this._inFunction) {
          this.error(`'return' used outside of a function`, node);
        }
        if (node.value) this.visitExpr(node.value);
        break;
      case 'BreakStatement':
      case 'ContinueStatement':
        if (!this._inLoop) {
          this.error(`'${node.type === 'BreakStatement' ? 'break' : 'continue'}' used outside of a loop`, node);
        }
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
      case 'LoopStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
        this._inLoop = true;
        this.visitBlock(node.body);
        this._inLoop = prev.loop;
        this.visitExpr(node.test || node.iterable);
        break;
      case 'TryStatement':
        if (!node.catchBlock && !node.finallyBlock) {
          this.warn('try without catch or finally has no effect', node);
        }
        this.visitBlock(node.tryBlock);
        if (node.catchBlock) this.visitBlock(node.catchBlock);
        if (node.finallyBlock) this.visitBlock(node.finallyBlock);
        break;
      case 'IfStatement':
      case 'UnlessStatement':
        this.visitExpr(node.test);
        this.visitBlock(node.consequent);
        if (node.alternate) {
          if (node.alternate.type === 'Block') this.visitBlock(node.alternate);
          else this.visit(node.alternate);
        }
        break;
      case 'ExprStatement':
        this.visitExpr(node.expression);
        break;
      case 'MatchStatement':
        this.visitExpr(node.subject);
        for (const c of node.cases) {
          if (c.test) this.visitExpr(c.test);
          if (c.body.type === 'Block') this.visitBlock(c.body);
          else this.visitExpr(c.body);
        }
        break;
      case 'NTLModuleImport':
        break;
    }
  }
  visitBlock(node) {
    if (!node || !node.body) return;
    for (const stmt of node.body) this.visit(stmt);
  }
  visitExpr(node) {
    if (!node) return;
    if (node.type === 'BinaryExpr' && node.op === '/' && node.right && node.right.type === 'NumberLit' && node.right.value === 0) {
      this.warn('Division by literal zero detected', node);
    }
    if (node.type === 'AssignExpr' && node.op === '=' && node.left && node.left.type === 'AssignExpr') {
      this.warn('Chained assignment can be confusing', node);
    }
    const children = ['left', 'right', 'callee', 'object', 'test', 'consequent', 'alternate', 'value', 'arg', 'argument'];
    for (const c of children) {
      if (node[c] && typeof node[c] === 'object' && node[c].type) this.visitExpr(node[c]);
    }
    if (node.args) node.args.forEach(a => { if (a) this.visitExpr(a); });
    if (node.elements) node.elements.forEach(e => { if (e) this.visitExpr(e); });
    if (node.props) node.props.forEach(p => { if (p.value) this.visitExpr(p.value); });
    if (node.body) {
      if (node.body.type === 'Block') this.visitBlock(node.body);
      else this.visitExpr(node.body);
    }
  }
}
module.exports = { Validator };
