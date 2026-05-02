'use strict';

// Statement-level code generators.
// Each method handles one AST statement type and returns a JavaScript string.
// Methods that generate expressions delegate to codegen-exprs via `this.genExpr`.

/**
 * Mixes statement-generation methods into a CodeGen instance.
 * Call this once in the CodeGen constructor: `mixinStmts(this)`.
 * @param {object} gen - The CodeGen instance to extend.
 */
function mixinStmts(gen) {

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genVarDecl = function(node, pad) {
    const p = this.pad(pad);
    const isReassigned = node.name && this._reassigned && this._reassigned.has(node.name);
    const kw = (node.isConst && !isReassigned) ? 'const' : 'let';
    const typeAnn = (node.typeAnn && this._comments)
      ? ` // : ${node.typeAnn.name || node.typeAnn}` : '';
    if (node.destructure) {
      const dp   = this.genDestructPat(node.destructure);
      const init = node.init ? ` = ${this.genExpr(node.init)}` : ' = undefined';
      return `${p}${kw} ${dp}${init};${typeAnn}\n`;
    }
    if (!node.init) return `${p}${kw} ${node.name};${typeAnn}\n`;
    return `${p}${kw} ${node.name} = ${this.genExpr(node.init)};${typeAnn}\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genFnDecl = function(node, pad) {
    const p   = this.pad(pad);
    const a   = node.isAsync     ? 'async ' : '';
    const g   = node.isGenerator ? '*'      : '';
    const params = this.genParams(node.params);
    const body   = this.genBlock(node.body, pad);
    const retComment = (node.returnType && this._comments)
      ? this._blockComment('@returns ' + (node.returnType.name || String(node.returnType)), pad) : '';
    if (!node.name) return `${p}${a}function${g}(${params}) ${body}`;
    return `${retComment}${p}${a}function${g} ${node.name}(${params}) ${body}\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genEnum = function(node, pad) {
    const p       = this.pad(pad);
    const members = node.members.map((m, i) =>
      `  ${m.name}: ${m.init ? this.genExpr(m.init) : i}`
    ).join(',\n');
    return `${p}const ${node.name} = Object.freeze({\n${members}\n${p}});\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genNamespace = function(node, pad) {
    const p    = this.pad(pad);
    const body = node.body.map(s => this.genStmt(s, pad + 1)).join('');
    const exported = [];
    for (const s of (node.body || [])) {
      if (s.type === 'VarDecl'    && s.name) exported.push(s.name);
      if (s.type === 'FnDecl'     && s.name) exported.push(s.name);
      if (s.type === 'ClassDecl'  && s.name) exported.push(s.name);
      if (s.type === 'EnumDecl'   && s.name) exported.push(s.name);
      if (s.type === 'ExportDecl') {
        if (s.declaration && s.declaration.name) exported.push(s.declaration.name);
        if (s.specifiers) s.specifiers.forEach(sp => exported.push(sp.local));
      }
    }
    const exportLines = exported.map(n => `${p}    ${n},`).join('\n');
    return `${p}const ${node.name} = (function() {\n${body}${p}  return {\n${exportLines}\n${p}  };\n${p}})();\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genIf = function(node, pad) {
    const p = this.pad(pad);
    let s   = `${p}if (${this.genExpr(node.test)}) ${this.genBlock(node.consequent, pad)}\n`;
    if (node.alternate) {
      if (node.alternate.type === 'IfStmt') s += `${p}else ${this.genIf(node.alternate, pad).trimStart()}`;
      else s += `${p}else ${this.genBlock(node.alternate, pad)}\n`;
    }
    return s;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genUnless = function(node, pad) {
    const p = this.pad(pad);
    let s   = `${p}if (!(${this.genExpr(node.test)})) ${this.genBlock(node.consequent, pad)}\n`;
    if (node.alternate) s += `${p}else ${this.genBlock(node.alternate, pad)}\n`;
    return s;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genForOf = function(node, pad) {
    const p  = this.pad(pad);
    const kw = node.isConst ? 'const' : 'let';
    const id = node.destructure ? this.genDestructPat(node.destructure) : node.id;
    return `${p}for (${kw} ${id} of ${this.genExpr(node.iterable)}) ${this.genBlock(node.body, pad)}\n`;
  };

  /** Compiles `repeat N { }` into a counted for-loop. @param {object} node @param {number} pad @returns {string} */
  gen.genRepeat = function(node, pad) {
    const p = this.pad(pad);
    if (!node.count) return `${p}while (true) ${this.genBlock(node.body, pad)}\n`;
    const counter = `_ntl_i${node.line || 0}`;
    const n       = `_ntl_n${node.line || 0}`;
    return `${p}{ const ${n} = (${this.genExpr(node.count)}); for (let ${counter}=0; ${counter}<${n}; ${counter}++) ${this.genBlock(node.body, pad)} }\n`;
  };

  /** Compiles `guard cond else { }` — early exit if condition is false. @param {object} node @param {number} pad @returns {string} */
  gen.genGuard = function(node, pad) {
    const p = this.pad(pad);
    return `${p}if (!(${this.genExpr(node.test)})) ${this.genBlock(node.alternate, pad)}\n`;
  };

  /** Compiles `defer { }` — registers a cleanup callback on process exit. @param {object} node @param {number} pad @returns {string} */
  gen.genDefer = function(node, pad) {
    const p       = this.pad(pad);
    const deferFn = `_ntl_defer_${node.id || 0}`;
    const bodyCode = this.genBlock(node.body, pad);
    return `${p}const ${deferFn} = (() => { const _fn = () => ${bodyCode}; process.on('exit', _fn); return _fn; })();\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genAssert = function(node, pad) {
    const p    = this.pad(pad);
    const test = this.genExpr(node.test);
    const msg  = node.message
      ? this.genExpr(node.message)
      : `"Assertion failed: ${test.replace(/"/g, "'")}"`;
    return `${p}if (!(${test})) { throw new Error(${msg}); }\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genTry = function(node, pad) {
    const p = this.pad(pad);
    let s   = `${p}try ${this.genBlock(node.block, pad)}\n`;
    if (node.catchBlock) {
      const cp = node.catchParam ? ` (${node.catchParam})` : '';
      s += `${p}catch${cp} ${this.genBlock(node.catchBlock, pad)}\n`;
    }
    if (node.finallyBlock) s += `${p}finally ${this.genBlock(node.finallyBlock, pad)}\n`;
    return s;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genImport = function(node, pad) {
    const p = this.pad(pad);
    if (node.typeOnly) return '';
    const { resolveModuleName } = require('../../runtime/resolver');
    const rawSrc = node.source || '';
    const ntlName = resolveModuleName(rawSrc);
    let requireExpr;
    if (ntlName) {
      requireExpr = `require(${JSON.stringify('ntl:' + ntlName)})`;
    } else if (rawSrc.endsWith('.ntl') && (rawSrc.startsWith('./') || rawSrc.startsWith('../'))) {
      requireExpr = `require(${JSON.stringify(rawSrc)})`;
    } else {
      const src = rawSrc.endsWith('.ntl') ? rawSrc.slice(0, -4) + '.js' : rawSrc;
      requireExpr = `require(${JSON.stringify(src)})`;
    }
    if (node.namespace) return `${p}const ${node.namespace} = ${requireExpr};\n`;
    if (node.defaultImport && !node.specifiers?.length) return `${p}const ${node.defaultImport} = ${requireExpr};\n`;
    if (node.defaultImport && node.specifiers?.length) {
      const specs = node.specifiers.map(s => s.imported === s.local ? s.imported : `${s.imported}: ${s.local}`).join(', ');
      return `${p}const ${node.defaultImport} = ${requireExpr};\n${p}const { ${specs} } = ${requireExpr};\n`;
    }
    if (node.specifiers?.length) {
      const specs = node.specifiers.map(s => s.imported === s.local ? s.imported : `${s.imported}: ${s.local}`).join(', ');
      return `${p}const { ${specs} } = ${requireExpr};\n`;
    }
    return `${p}${requireExpr};\n`;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genExport = function(node, pad) {
    const p = this.pad(pad);
    if (node.default) return `${p}module.exports = ${this.genExpr(node.value)};\n`;
    if (node.declaration) {
      const decl = this.genStmt(node.declaration, pad);
      const name = node.declaration.name;
      return `${decl}${name ? `${p}module.exports.${name} = ${name};\n` : ''}`;
    }
    if (node.specifiers?.length) {
      return node.specifiers.map(s => `${p}module.exports.${s.exported} = ${s.local};\n`).join('');
    }
    return '';
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genNTLRequire = function(node, pad) {
    const p = this.pad(pad);
    return (node.modules || []).map(m =>
      `${p}const ${m} = require(${JSON.stringify('ntl:' + m)});`
    ).join('\n') + '\n';
  };

  /** Compiles a `component Name(props) { }` declaration into a React-style function component. @param {object} node @param {number} pad @returns {string} */
  gen.genComponent = function(node, pad) {
    const p      = this.pad(pad);
    const params = this.genParams(node.params || []);
    const body   = this.genBlock(node.body, pad);
    const name   = node.name;
    return `${p}function ${name}(${params}) ${body}\n${p}${name}._isNTLComponent = true;\n`;
  };

  /** Compiles `select { case ch -> v: ... }` into a Promise.race expression. @param {object} node @param {number} pad @returns {string} */
  gen.genSelect = function(node, pad) {
    const p        = this.pad(pad);
    const fn       = `async function __select_${node.line || 0}() {\n`;
    const promises = node.cases.map((c, i) =>
      `${p}  Promise.resolve(${this.genExpr(c.channel)}).then(v => ({ i: ${i}, v }))`
    );
    const raceCode   = `${p}  const { i, v } = await Promise.race([\n${promises.join(',\n')}\n${p}  ]);\n`;
    const switchCode = node.cases.map((c, i) => {
      const bind = c.binding
        ? `${p}  if (i === ${i}) { const ${c.binding} = v; ${this.genBlock(c.body, pad + 2)} }\n`
        : `${p}  if (i === ${i}) ${this.genBlock(c.body, pad + 2)}\n`;
      return bind;
    }).join('');
    return `${p}(${fn}${raceCode}${switchCode}${p}})();\n`;
  };

  /** Compiles `immutable val x = expr` — declares and then freezes the value. @param {object} node @param {number} pad @returns {string} */
  gen.genImmutable = function(node, pad) {
    const p     = this.pad(pad);
    const inner = this.genStmt(node.decl, pad).trimEnd();
    const name  = node.decl.name;
    if (name) return `${inner}\nObject.freeze(${name});\n`;
    return inner + '\n';
  };

  /** Compiles `have expr in collection` as a statement guard or if-block. @param {object} node @param {number} pad @returns {string} */
  gen.genHaveStmt = function(node, pad) {
    const p        = this.pad(pad);
    const cond     = this._haveCondExpr(node);
    const alias    = node.alias;
    const exprCode = this.genExpr(node.expr);

    if (node.isGuard) {
      const alt = node.alternate ? this.genBlock(node.alternate, pad + 1) : '{ return; }';
      if (alias) return `${p}const ${alias} = ${exprCode};\n${p}if (!(${cond})) ${alt}\n`;
      return `${p}if (!(${cond})) ${alt}\n`;
    }

    if (alias) {
      let out = `${p}{\n${p}  const ${alias} = ${exprCode};\n${p}  if (${cond}) ${this.genBlock(node.consequent, pad + 1)}\n`;
      if (node.alternate) out += `${p}  else ${this.genBlock(node.alternate, pad + 1)}\n`;
      out += `${p}}\n`;
      return out;
    }

    let out = `${p}if (${cond}) ${node.consequent ? this.genBlock(node.consequent, pad + 1) : '{}'}\n`;
    if (node.alternate) out += `${p}else ${this.genBlock(node.alternate, pad + 1)}\n`;
    return out;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genIfHave = function(node, pad) {
    const p     = this.pad(pad);
    const id    = node.id != null ? node.id : Math.floor(Math.random() * 99999);
    const alias = node.alias || `_ntl_ifhave_${id}`;
    const exprCode = this.genExpr(node.expr);
    const cond     = this._haveCondExpr(node);
    let out;
    if (node.alias) {
      out = `${p}{\n${p}  const ${alias} = ${exprCode};\n${p}  if (${cond}) ${this.genBlock(node.consequent, pad + 1)}\n`;
      if (node.alternate) out += `${p}  else ${this.genBlock(node.alternate, pad + 1)}\n`;
      out += `${p}}\n`;
    } else {
      out = `${p}if (${cond}) ${this.genBlock(node.consequent, pad + 1)}\n`;
      if (node.alternate) out += `${p}else ${this.genBlock(node.alternate, pad + 1)}\n`;
    }
    return out;
  };

  /** @param {object} node @param {number} pad @returns {string} */
  gen.genIfSet = function(node, pad) {
    const p     = this.pad(pad);
    const id    = node.id != null ? node.id : Math.floor(Math.random() * 99999);
    const expr  = this.genExpr(node.expr);
    const alias = node.alias || `_ntl_ifset_${id}`;
    let s = `${p}{\n${p}  const ${alias} = ${expr};\n${p}  if (${alias} !== null && ${alias} !== undefined) ${this.genBlock(node.consequent, pad + 1)}\n`;
    if (node.alternate) s += `${p}  else ${this.genBlock(node.alternate, pad + 1)}\n`;
    s += `${p}}\n`;
    return s;
  };

  /** Generates a JS block `{ ... }` from a Block AST node. @param {object} node @param {number} pad @returns {string} */
  gen.genBlock = function(node, pad) {
    if (!node) return '{}';
    pad = pad !== undefined ? pad : this.indent;
    const p = this.pad(pad);
    if (node.type !== 'Block' && node.type !== 'BlockStmt')
      return `{\n${p}  ${this.genExpr(node)};\n${p}}`;
    const body = (node.body || []).map(s => this.genStmt(s, pad + 1)).filter(Boolean).join('');
    return `{\n${body}${p}}`;
  };
}

module.exports = { mixinStmts };
