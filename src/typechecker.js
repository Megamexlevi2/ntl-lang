'use strict';
const PRIMITIVE_TYPES = new Set(['int', 'float', 'str', 'bool', 'null', 'void', 'any', 'never',
  'number', 'string', 'boolean', 'undefined', 'object', 'symbol', 'bigint']);
const TYPE_ALIASES = {
  int: 'number', float: 'number', str: 'string', bool: 'boolean',
  list: 'Array', map: 'Object', fn: 'function'
};
function normalize(t) {
  if (!t) return 'any';
  if (t.endsWith('?')) return normalize(t.slice(0, -1)) + '?';
  return TYPE_ALIASES[t] || t;
}
function isCompatible(a, b) {
  if (!a || !b || a === 'any' || b === 'any') return true;
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  if (na === 'null' || na.endsWith('?')) return true;
  if (nb === 'null' || nb.endsWith('?')) return true;
  if (na === 'number' && (nb === 'int' || nb === 'float')) return true;
  if (nb === 'number' && (na === 'int' || na === 'float')) return true;
  return false;
}
class TypeEnv {
  constructor(parent) {
    this.parent = parent || null;
    this.types = new Map();
  }
  define(name, type) { this.types.set(name, type); }
  lookup(name) {
    if (this.types.has(name)) return this.types.get(name);
    if (this.parent) return this.parent.lookup(name);
    return null;
  }
}
class TypeChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.env = new TypeEnv(null);
    this.initBuiltins();
  }
  initBuiltins() {
    this.env.define('console', 'object');
    this.env.define('Math', 'object');
    this.env.define('JSON', 'object');
    this.env.define('Date', 'class');
    this.env.define('Array', 'class');
    this.env.define('Object', 'class');
    this.env.define('String', 'class');
    this.env.define('Number', 'class');
    this.env.define('Boolean', 'class');
    this.env.define('Promise', 'class');
    this.env.define('require', 'function');
    this.env.define('print', 'function');
    this.env.define('log', 'function');
    this.env.define('println', 'function');
    this.env.define('process', 'object');
    this.env.define('Buffer', 'class');
  }
  push() { this.env = new TypeEnv(this.env); }
  pop()  { if (this.env.parent) this.env = this.env.parent; }
  error(message, node) {
    this.errors.push({ message, line: node ? node.line : 0, severity: 'error' });
  }
  warn(message, node) {
    this.warnings.push({ message, line: node ? node.line : 0, severity: 'warning' });
  }
  check(ast) {
    this.errors = [];
    this.warnings = [];
    this.visitProgram(ast);
    return { success: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
  }
  visitProgram(ast) {
    for (const node of ast.body) this.visitNode(node);
  }
  visitNode(node) {
    if (!node) return 'any';
    switch (node.type) {
      case 'VarDeclaration':   return this.visitVarDecl(node);
      case 'ConstDeclaration': return this.visitConstDecl(node);
      case 'FnDeclaration':    return this.visitFnDecl(node);
      case 'ClassDeclaration': return this.visitClassDecl(node);
      case 'IfStatement':
      case 'UnlessStatement':  return this.visitIf(node);
      case 'IfSetStatement':   return this.visitIfSet(node);
      case 'WhileStatement':
      case 'DoWhileStatement': { this.visitExpr(node.test); this.push(); this.visitBlock(node.body); this.pop(); return 'void'; }
      case 'ForInStatement':
      case 'ForOfStatement':   return this.visitFor(node);
      case 'TryStatement':     return this.visitTry(node);
      case 'MatchStatement':   return this.visitMatch(node);
      case 'ReturnStatement':  return node.value ? this.visitExpr(node.value) : 'void';
      case 'RaiseStatement':   return this.visitExpr(node.value);
      case 'ExprStatement':    return this.visitExpr(node.expression);
      case 'Block':            this.push(); this.visitBlock(node); this.pop(); return 'void';
      case 'NTLModuleImport':
        for (const m of node.modules) this.env.define(m, 'object');
        return 'void';
      case 'EnumDeclaration':
        this.env.define(node.name, 'enum');
        return 'void';
      case 'TypeAlias':
        return 'void';
      case 'ExportStatement':
        if (node.declaration) return this.visitNode(node.declaration);
        if (node.value) return this.visitExpr(node.value);
        return 'void';
      default: return this.visitExpr(node);
    }
  }
  visitVarDecl(node) {
    for (const d of node.declarations) {
      let inferredType = 'any';
      if (d.init) inferredType = this.visitExpr(d.init);
      const declared = d.typeAnnotation ? normalize(d.typeAnnotation) : inferredType;
      if (d.typeAnnotation && inferredType !== 'any' && !isCompatible(declared, inferredType)) {
        this.warn(`Type annotation '${d.typeAnnotation}' may not match inferred type '${inferredType}'`, node);
      }
      if (d.name) this.env.define(d.name, declared);
    }
    return 'void';
  }
  visitConstDecl(node) {
    const t = this.visitExpr(node.init);
    this.env.define(node.name, t);
    return 'void';
  }
  visitFnDecl(node) {
    const returnType = node.returnType ? normalize(node.returnType) : 'any';
    this.env.define(node.name, 'function');
    this.push();
    for (const p of node.params) {
      const pt = p.typeAnnotation ? normalize(p.typeAnnotation) : 'any';
      this.env.define(p.name, pt);
    }
    this.visitBlock(node.body);
    this.pop();
    return 'function';
  }
  visitClassDecl(node) {
    this.env.define(node.name, 'class');
    this.push();
    this.env.define('this', node.name);
    for (const m of node.members) {
      if (m.type === 'ClassMethod') {
        this.push();
        this.env.define('this', node.name);
        for (const p of m.params) this.env.define(p.name, p.typeAnnotation ? normalize(p.typeAnnotation) : 'any');
        this.visitBlock(m.body);
        this.pop();
      } else if (m.type === 'ClassProperty' && m.value) {
        this.visitExpr(m.value);
      }
    }
    this.pop();
    return 'class';
  }
  visitIf(node) {
    this.visitExpr(node.test);
    this.push(); this.visitBlock(node.consequent); this.pop();
    if (node.alternate) {
      this.push();
      if (node.alternate.type === 'Block') this.visitBlock(node.alternate);
      else this.visitNode(node.alternate);
      this.pop();
    }
    return 'void';
  }
  visitIfSet(node) {
    this.visitExpr(node.value);
    this.push();
    if (node.alias) this.env.define(node.alias, 'any');
    this.visitBlock(node.consequent);
    this.pop();
    if (node.alternate) { this.push(); if (node.alternate.type === 'Block') this.visitBlock(node.alternate); else this.visitNode(node.alternate); this.pop(); }
    return 'void';
  }
  visitFor(node) {
    this.visitExpr(node.iterable);
    this.push();
    if (node.id) this.env.define(node.id, 'any');
    this.visitBlock(node.body);
    this.pop();
    return 'void';
  }
  visitTry(node) {
    this.push(); this.visitBlock(node.tryBlock); this.pop();
    if (node.catchBlock) {
      this.push();
      if (node.catchParam) this.env.define(node.catchParam, 'Error');
      this.visitBlock(node.catchBlock);
      this.pop();
    }
    if (node.finallyBlock) { this.push(); this.visitBlock(node.finallyBlock); this.pop(); }
    return 'void';
  }
  visitMatch(node) {
    this.visitExpr(node.subject);
    for (const c of node.cases) {
      if (c.test) this.visitExpr(c.test);
      this.push();
      if (c.body.type === 'Block') this.visitBlock(c.body);
      else this.visitExpr(c.body);
      this.pop();
    }
    return 'void';
  }
  visitBlock(node) {
    if (!node || !node.body) return;
    for (const s of node.body) this.visitNode(s);
  }
  visitExpr(node) {
    if (!node) return 'any';
    switch (node.type) {
      case 'NumberLit':  return 'number';
      case 'StringLit':  return 'string';
      case 'BoolLit':    return 'boolean';
      case 'NullLit':    return 'null';
      case 'TemplateLit': {
        for (const p of node.parts || []) {
          if (p.kind === 'expr' && p.ast) this.visitExpr(p.ast);
        }
        return 'string';
      }
      case 'Identifier': {
        const t = this.env.lookup(node.name);
        return t || 'any';
      }
      case 'BinaryExpr': {
        const lt = this.visitExpr(node.left);
        const rt = this.visitExpr(node.right);
        if (['+', '-', '*', '/', '%', '**'].includes(node.op)) {
          if (node.op === '+' && (lt === 'string' || rt === 'string')) return 'string';
          return 'number';
        }
        if (['==', '!=', '===', '!==', '<', '>', '<=', '>=', '&&', '||', 'instanceof', 'in'].includes(node.op)) return 'boolean';
        if (node.op === '??') return rt;
        return 'any';
      }
      case 'UnaryExpr': {
        if (node.op === '!') return 'boolean';
        if (node.op === 'typeof') return 'string';
        if (node.op === '-' || node.op === '+') return 'number';
        return 'any';
      }
      case 'AssignExpr': return this.visitExpr(node.right);
      case 'TernaryExpr': {
        this.visitExpr(node.test);
        const ct = this.visitExpr(node.consequent);
        const at = this.visitExpr(node.alternate);
        return isCompatible(ct, at) ? ct : 'any';
      }
      case 'CallExpr': {
        this.visitExpr(node.callee);
        for (const a of node.args || []) this.visitExpr(a);
        return 'any';
      }
      case 'NewExpr': {
        for (const a of node.args || []) this.visitExpr(a);
        if (node.callee.type === 'Identifier') return node.callee.name;
        return 'object';
      }
      case 'MemberExpr':
        this.visitExpr(node.object);
        return 'any';
      case 'FnExpression':
      case 'ArrowFn': {
        this.push();
        for (const p of node.params || []) this.env.define(p.name, p.typeAnnotation ? normalize(p.typeAnnotation) : 'any');
        if (node.body.type === 'Block') this.visitBlock(node.body);
        else this.visitExpr(node.body);
        this.pop();
        return 'function';
      }
      case 'ArrayLit':   for (const e of node.elements || []) { if (e) this.visitExpr(e); } return 'Array';
      case 'ObjectLit':  for (const p of node.props || []) { if (p.value) this.visitExpr(p.value); } return 'object';
      case 'HaveExpr':   this.visitExpr(node.value); return 'boolean';
      case 'AwaitExpr':  return this.visitExpr(node.arg);
      case 'SpreadExpr': return this.visitExpr(node.arg);
      case 'PipelineExpr': { this.visitExpr(node.left); this.visitExpr(node.right); return 'any'; }
      case 'UpdateExpr': return 'number';
      case 'RequireExpr': return 'any';
      default: return 'any';
    }
  }
}
module.exports = { TypeChecker, normalize, isCompatible };
