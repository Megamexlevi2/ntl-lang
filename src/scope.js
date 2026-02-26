'use strict';
const { findSimilar } = require('./error');
const BUILTINS = new Set([
  'console','require','process','module','exports','__filename','__dirname',
  'setTimeout','setInterval','clearTimeout','clearInterval','setImmediate','queueMicrotask',
  'Math','JSON','Date','Object','Array','String','Number','Boolean','BigInt',
  'Promise','Error','TypeError','RangeError','ReferenceError','SyntaxError',
  'Buffer','RegExp','Symbol','Map','Set','WeakMap','WeakSet','WeakRef','Proxy','Reflect',
  'Int8Array','Uint8Array','Int16Array','Uint16Array','Int32Array','Uint32Array',
  'Float32Array','Float64Array','BigInt64Array','BigUint64Array',
  'globalThis','global','undefined','Infinity','NaN','isNaN','isFinite',
  'parseInt','parseFloat','encodeURIComponent','decodeURIComponent',
  'structuredClone','fetch','URL','URLSearchParams','AbortController',
  'TextEncoder','TextDecoder','atob','btoa','performance',
  '__ntl','_ntl','arguments','eval','AggregateError'
]);
class Scope {
  constructor(kind, parent) {
    this.kind = kind;
    this.parent = parent || null;
    this.bindings = new Map();
  }
  declare(name, meta) { this.bindings.set(name, Object.assign({ used: false }, meta)); }
  lookup(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    return this.parent ? this.parent.lookup(name) : null;
  }
  has(name) { return this.bindings.has(name); }
  allNames() {
    const names = [...this.bindings.keys()];
    if (this.parent) names.push(...this.parent.allNames());
    return names;
  }
  allUserNames() { return this.allNames().filter(n => !BUILTINS.has(n) && n.length > 1 && !n.startsWith('_ntl')); }
}
class ScopeAnalyzer {
  constructor(filename, sourceLines) {
    this.filename = filename || '<unknown>';
    this.sourceLines = sourceLines || [];
    this.errors = [];
    this.root = new Scope('global');
    this.current = this.root;
    for (const b of BUILTINS) this.root.declare(b, { kind: 'builtin' });
  }
  push(kind) { this.current = new Scope(kind, this.current); return this.current; }
  pop() { if (this.current.parent) this.current = this.current.parent; }
  declare(name, meta) { this.current.declare(name, meta || { kind: 'var' }); }
  use(name, line, col) {
    if (!name || name === '_' || name === 'undefined') return true;
    const binding = this.current.lookup(name);
    if (binding) { binding.used = true; return true; }
    const similar = findSimilar(name, this.current.allUserNames());
    const isPrint = name === 'print' || name === 'println';
    const err = {
      ntlError: true,
      type: 'undeclared', name, line: line || 0, col: col || 1,
      message: `Variable '${name}' is not defined`,
      phase: isPrint ? 'runtime' : 'scope',
      code: isPrint ? 'UNDEF_FUNC' : 'UNDEF_VAR',
      file: this.filename,
      sourceLines: this.sourceLines,
      similar: similar.map(s => {
        const b = this.current.lookup(s);
        return b && b.line ? `${s}    (line ${b.line})` : s;
      })
    };
    if (isPrint) {
      err.message = `Undefined function: '${name}'`;
      err.suggestion = [
        `Use console.log instead of ${name} (recommended):\n     > console.log(message)`,
        `Define '${name}' as an alias if you prefer the syntax:\n     > const ${name} = console.log\n     > ${name}(message)`,
        `Use NTL's built-in logging module:\n     > const require(ntl, logger)\n     > val log = logger.create()\n     > log.info(message)`
      ];
      err.exBad = `${name}("Hello, World")`;
      err.exGood = 'console.log("Hello, World")';
    } else if (similar.length > 0) {
      err.suggestion = [
        `Declare '${name}' before using it:\n     > const ${name} = <value>`,
        `Pass '${name}' as a function parameter:\n     > function doSomething(${name}) {\n     >   return ${name}\n     > }`,
        `Check for typos — did you mean ${similar.slice(0, 2).map(s => `'${s.split(' ')[0]}'`).join(' or ')}?`
      ];
    } else {
      err.suggestion = [
        `Declare '${name}' before using it:\n     > const ${name} = <value>\n     > return ${name}`,
        `Pass '${name}' as a function parameter:\n     > function doSomething(${name}) {\n     >   return ${name}\n     > }`
      ];
    }
    this.errors.push(err);
    return false;
  }
  analyze(ast) {
    this.errors = [];
    this._hoistAll(ast.body || []);
    this.visitBlock({ body: ast.body || [] });
    return this.errors;
  }
  _hoistAll(stmts) {
    for (const s of stmts) {
      if (!s) continue;
      if (s.type === 'FnDecl' && s.name)    this.declare(s.name, { kind: 'fn', line: s.line });
      if (s.type === 'ClassDecl' && s.name) this.declare(s.name, { kind: 'class', line: s.line });
      if (s.type === 'EnumDecl')  this.declare(s.name, { kind: 'enum', line: s.line });
      if (s.type === 'MacroDecl') this.declare(s.name, { kind: 'macro', line: s.line });
      if (s.type === 'NamespaceDecl') this.declare(s.name, { kind: 'namespace', line: s.line });
      if (s.type === 'ExportDecl' && s.declaration) this._hoistAll([s.declaration]);
      if (s.type === 'DecoratedExpr') {
        const inner = s.expr || s.stmt;
        if (inner) {
          if (inner.type === 'FnExpr' && inner.name) this.declare(inner.name, { kind: 'fn', line: inner.line });
          if (inner.type === 'FnDecl' && inner.name) this.declare(inner.name, { kind: 'fn', line: inner.line });
          if (inner.type === 'ClassDecl' && inner.name) this.declare(inner.name, { kind: 'class', line: inner.line });
          this._hoistAll([inner]);
        }
      }
    }
  }
  visitBlock(node) { for (const s of (node.body || [])) this.visitStmt(s); }
  visitStmt(node) {
    if (!node) return;
    switch (node.type) {
      case 'VarDecl': {
        if (node.init) this.visitExpr(node.init);
        if (node.name) this.declare(node.name, { kind: node.isConst ? 'const' : 'var', line: node.line });
        if (node.destructure) this._declareDestructure(node.destructure);
        break;
      }
      case 'MultiVarDecl':
        for (const d of (node.declarations || [])) this.visitStmt(Object.assign({}, d, { type: 'VarDecl' }));
        break;
      case 'FnDecl':   this._visitFn(node); break;
      case 'ClassDecl': this._visitClass(node); break;
      case 'InterfaceDecl': case 'TypeAlias': case 'DeclareStmt': break;
      case 'MacroDecl': this.declare(node.name, { kind: 'macro' }); break;
      case 'EnumDecl': this.declare(node.name, { kind: 'enum', line: node.line }); break;
      case 'NamespaceDecl': {
        this.declare(node.name, { kind: 'namespace', line: node.line });
        this.push('namespace'); this._hoistAll(node.body || []); this.visitBlock({ body: node.body || [] }); this.pop();
        break;
      }
      case 'ExprStmt': this.visitExpr(node.expr); break;
      case 'ReturnStmt': if (node.value) this.visitExpr(node.value); break;
      case 'ThrowStmt': this.visitExpr(node.value); break;
      case 'IfStmt': case 'UnlessStmt': {
        this.visitExpr(node.test);
        const cons = node.consequent;
        this.push('block');
        if (cons && cons.type === 'Block') this.visitBlock(cons);
        else if (cons) this.visitStmt(cons);
        this.pop();
        if (node.alternate) {
          this.push('block');
          if (node.alternate.type === 'Block') this.visitBlock(node.alternate);
          else this.visitStmt(node.alternate);
          this.pop();
        }
        break;
      }
      case 'WhileStmt': this.visitExpr(node.test); this.push('block'); this.visitBlock(node.body); this.pop(); break;
      case 'DoWhileStmt': this.push('block'); this.visitBlock(node.body); this.pop(); this.visitExpr(node.test); break;
      case 'ForOfStmt': case 'ForInStmt': {
        this.visitExpr(node.iterable);
        this.push('block');
        if (node.id) this.declare(node.id, { kind: 'const', line: node.line });
        if (node.destructure) this._declareDestructure(node.destructure);
        this.visitBlock(node.body); this.pop();
        break;
      }
      case 'LoopStmt': this.push('block'); this.visitBlock(node.body); this.pop(); break;
      case 'TryStmt': {
        this.push('block'); this.visitBlock(node.block); this.pop();
        if (node.catchBlock) {
          this.push('catch');
          if (node.catchParam) this.declare(node.catchParam, { kind: 'var', line: node.line });
          this.visitBlock(node.catchBlock); this.pop();
        }
        if (node.finallyBlock) { this.push('block'); this.visitBlock(node.finallyBlock); this.pop(); }
        break;
      }
      case 'MatchStmt': {
        this.visitExpr(node.subject);
        for (const cas of (node.cases || [])) {
          this.push('match');
          if (cas.patterns) for (const p of cas.patterns) this._declareMatchBindings(p);
          if (cas.guard) this.visitExpr(cas.guard);
          this.visitBlock(cas.body); this.pop();
        }
        break;
      }
      case 'Block': this.push('block'); this.visitBlock(node); this.pop(); break;
      case 'BreakStmt': case 'ContinueStmt': break;
      case 'ImportDecl': {
        if (node.defaultImport) this.declare(node.defaultImport, { kind: 'import', line: node.line });
        if (node.namespace) this.declare(node.namespace, { kind: 'import', line: node.line });
        for (const s of (node.specifiers || [])) this.declare(s.local, { kind: 'import', line: node.line });
        break;
      }
      case 'ExportDecl':
        if (node.declaration) this.visitStmt(node.declaration);
        else if (node.value) this.visitExpr(node.value);
        break;
      case 'NTLRequire': for (const m of (node.modules || [])) this.declare(m, { kind: 'import', line: node.line }); break;
      case 'SpawnStmt': this.visitExpr(node.expr); break;
      case 'ImmutableDecl': this.visitStmt(node.decl); break;
      case 'UsingDecl': this.visitExpr(node.init); this.declare(node.name, { kind: 'const', line: node.line }); break;
      case 'IfSetStmt': {
        this.visitExpr(node.expr);
        this.push('block');
        if (node.alias) this.declare(node.alias, { kind: 'const', line: node.line });
        this.visitBlock(node.consequent); this.pop();
        if (node.alternate) { this.push('block'); this.visitBlock(node.alternate); this.pop(); }
        break;
      }
      case 'DecoratedExpr': {
        if (node.decorators) {
          for (const d of node.decorators) {
            this.use(d.name, node.line, node.col);
            if (d.args) for (const a of d.args) this.visitExpr(a);
          }
        }
        const inner = node.expr || node.stmt;
        if (inner) {
          if (inner.type === 'FnDecl') { this._visitFn(inner); }
          else if (inner.type === 'ClassDecl') { this._visitClass(inner); }
          else if (inner.type === 'FnExpr' && inner.name) {
            if (!this.current.has(inner.name)) this.declare(inner.name, { kind: 'fn', line: inner.line });
            this._visitFn(inner);
          }
          else this.visitExpr(inner);
        }
        break;
      }
      default: if (node.expr) this.visitExpr(node.expr); break;
    }
  }
  _visitFn(node) {
    if (node.name && !this.current.has(node.name)) this.declare(node.name, { kind: 'fn', line: node.line });
    this.push('function');
    for (const p of (node.params || [])) {
      if (p.name) this.declare(p.name, { kind: 'param', line: node.line });
      if (p.defaultVal) this.visitExpr(p.defaultVal);
    }
    if (node.body) { this._hoistAll(node.body.body || []); this.visitBlock(node.body); }
    this.pop();
  }
  _visitClass(node) {
    if (node.name && !this.current.has(node.name)) this.declare(node.name, { kind: 'class', line: node.line });
    this.push('class');
    this.declare('this', { kind: 'builtin' });
    if (node.superClass) {
      const sc = typeof node.superClass === 'string' ? node.superClass : (node.superClass.expr || String(node.superClass));
      if (sc && /^\w+$/.test(sc)) this.use(sc, node.line, node.col);
    }
    for (const m of (node.members || [])) {
      if (m.kind === 'field' && m.init) this.visitExpr(m.init);
      if (m.kind === 'method' && m.body) {
        this.push('function');
        this.declare('this', { kind: 'builtin' });
        for (const p of (m.params || [])) if (p.name) this.declare(p.name, { kind: 'param', line: node.line });
        this._hoistAll(m.body.body || []);
        this.visitBlock(m.body); this.pop();
      }
    }
    this.pop();
  }
  _declareDestructure(d) {
    if (!d) return;
    if (d.kind === 'object') for (const p of d.props) { if (p.nested) this._declareDestructure(p.nested); else if (p.alias || p.name) this.declare(p.alias || p.name, { kind: 'var' }); }
    else if (d.kind === 'array') for (const item of d.items) { if (!item) continue; if (item.nested) this._declareDestructure(item.nested); else if (item.name) this.declare(item.name, { kind: 'var' }); }
  }
  _declareMatchBindings(pat) {
    if (!pat) return;
    if (pat.kind === 'binding') this.declare(pat.name, { kind: 'const' });
    if (pat.kind === 'variant') (pat.fields || []).forEach(f => this._declareMatchBindings(f));
    if (pat.kind === 'object') {
      for (const p of (pat.props || [])) {
        if (p.alias) this.declare(p.alias, { kind: 'const' });
        else if (p.key) this.declare(p.key, { kind: 'const' });
      }
    }
    if (pat.kind === 'array') {
      for (const item of (pat.items || [])) {
        if (!item) continue;
        if (item.name) this.declare(item.name, { kind: 'const' });
        if (item.nested) this._declareMatchBindings(item.nested);
      }
    }
  }
  visitExpr(node) {
    if (!node) return;
    switch (node.type) {
      case 'Identifier': this.use(node.name, node.line, node.col); break;
      case 'BinaryExpr': this.visitExpr(node.left); this.visitExpr(node.right); break;
      case 'UnaryExpr': this.visitExpr(node.arg); break;
      case 'AssignExpr': this.visitExpr(node.left); this.visitExpr(node.right); break;
      case 'TernaryExpr': this.visitExpr(node.test); this.visitExpr(node.consequent); this.visitExpr(node.alternate); break;
      case 'CallExpr': this.visitExpr(node.callee); for (const a of (node.args || [])) this.visitExpr(a); break;
      case 'NewExpr': this.visitExpr(node.callee); for (const a of (node.args || [])) this.visitExpr(a); break;
      case 'MemberExpr': this.visitExpr(node.object); if (node.computed) this.visitExpr(node.prop); break;
      case 'ArrayLit': for (const e of (node.elements || [])) if (e) this.visitExpr(e); break;
      case 'ObjectLit': for (const p of (node.props || [])) {
        if (p.kind === 'prop') this.visitExpr(p.value);
        else if (p.kind === 'shorthand') this.use(p.key, node.line);
        else if (p.kind === 'spread') this.visitExpr(p.arg);
        else if (p.kind === 'method' && p.body) {
          this.push('function');
          for (const param of (p.params || [])) if (param.name) this.declare(param.name, { kind: 'param' });
          this.visitBlock(p.body); this.pop();
        }
        break;
      }
      case 'ArrowFn': case 'FnExpr': {
        this.push('function');
        for (const p of (node.params || [])) { if (p.name) this.declare(p.name, { kind: 'param' }); if (p.defaultVal) this.visitExpr(p.defaultVal); }
        if (node.body) { if (node.body.type === 'Block') { this._hoistAll(node.body.body || []); this.visitBlock(node.body); } else this.visitExpr(node.body); }
        this.pop();
        break;
      }
      case 'AwaitExpr': case 'YieldExpr': if (node.arg) this.visitExpr(node.arg); break;
      case 'SpreadExpr': this.visitExpr(node.arg); break;
      case 'PipelineExpr': this.visitExpr(node.left); this.visitExpr(node.right); break;
      case 'HaveExpr': this.visitExpr(node.value); break;
      case 'SequenceExpr': for (const e of (node.exprs || [])) this.visitExpr(e); break;
      case 'SatisfiesExpr': this.visitExpr(node.expr); break;
      case 'DecoratedExpr': if (node.expr) this.visitExpr(node.expr); break;
      default: break;
    }
  }
}
module.exports = { ScopeAnalyzer, Scope, BUILTINS };
