'use strict';

// Class, match-expression, and decorator code generators.
// These are larger/more complex statement types that deserve their own file.

/**
 * Mixes class/match/decorator generation methods into a CodeGen instance.
 * @param {object} gen - The CodeGen instance to extend.
 */
function mixinClass(gen) {

  /**
   * Generates a class declaration, handling fields, methods, static members,
   * abstract methods (skipped), getters, setters, and `init` → `constructor` rename.
   * @param {object} node
   * @param {number} pad
   * @returns {string}
   */
  gen.genClassDecl = function(node, pad) {
    const p  = this.pad(pad);
    const sc = node.superClass;
    const ext = sc
      ? ` extends ${(typeof sc === 'object' && sc.kind) ? (sc.kind === 'type' ? sc.expr : String(sc)) : String(sc)}`
      : '';
    const lines   = [`${p}class ${node.name || ''}${ext} {\n`];
    const fields  = [];
    const methods = [];
    for (const m of (node.members || [])) {
      if (m.kind === 'field')  fields.push(m);
      else if (m.kind === 'method') methods.push(m);
    }
    for (const f of fields) {
      const name = (typeof f.name === 'object' && f.name.computed)
        ? `[${this.genExpr(f.name.expr)}]` : f.name;
      const init = f.init ? ` = ${this.genExpr(f.init)}` : '';
      lines.push(`${p}  ${f.isStatic ? 'static ' : ''}${name}${init};\n`);
    }
    for (const m of methods) {
      if (m.isAbstract) continue; // abstract methods have no body to emit
      const async_ = m.isAsync  ? 'async ' : '';
      const stat   = m.isStatic ? 'static ' : '';
      const acc    = m.isGet    ? 'get '   : m.isSet ? 'set ' : '';
      const rawName = (typeof m.name === 'object' && m.name.computed)
        ? `[${this.genExpr(m.name.expr)}]` : m.name;
      // NTL uses `init` as the constructor keyword; rename to `constructor` in JS output
      const jsName = rawName === 'init' ? 'constructor' : String(rawName);
      const params = this.genParams(m.params);
      const body   = this.genBlock(m.body, pad + 1);
      lines.push(`${p}  ${stat}${async_}${acc}${jsName}(${params}) ${body}\n`);
    }
    lines.push(`${p}}\n`);
    return lines.join('');
  };

  /**
   * Generates a `match` statement.
   * Uses "safe mode" (a `matched` boolean flag) when any case has a guard
   * combined with a destructuring pattern — otherwise uses simpler if/else-if chains.
   * @param {object} node
   * @param {number} pad
   * @returns {string}
   */
  gen.genMatch = function(node, pad) {
    const p       = this.pad(pad);
    const uid     = `${node.line || 0}_${Math.floor(Math.random() * 9999)}`;
    const subj    = `_ntl_m${uid}`;
    const matched = `_ntl_matched${uid}`;

    // Safe mode is required when a guarded case also binds variables,
    // because we must check the guard before committing to the binding.
    const needsSafeMode = node.cases.some(mc =>
      !mc.isDefault && mc.guard &&
      mc.patterns.some(p => ['binding', 'object', 'array', 'variant'].includes(p.kind))
    );

    const lines = [`${p}{\n`, `${p}  const ${subj} = ${this.genExpr(node.subject)};\n`];

    if (needsSafeMode) {
      lines.push(`${p}  let ${matched} = false;\n`);
      for (const mc of node.cases) {
        if (mc.isDefault) {
          lines.push(`${p}  if (!${matched}) {\n`);
          this._emitCaseBody(mc.body, pad + 2, lines);
          lines.push(`${p}    ${matched} = true;\n`);
          lines.push(`${p}  }\n`);
          continue;
        }
        const conds     = mc.patterns.map(pat => this.genMatchPattern(subj, pat));
        const bindDecls = mc.patterns.flatMap(pat => this.genMatchBindingDecls(subj, pat));
        lines.push(`${p}  if (!${matched} && (${conds.join(' || ')})) {\n`);
        for (const bd of bindDecls) lines.push(`${p}    ${bd}\n`);
        if (mc.guard) {
          lines.push(`${p}    if (${this.genExpr(mc.guard)}) {\n`);
          this._emitCaseBody(mc.body, pad + 4, lines);
          lines.push(`${p}      ${matched} = true;\n`);
          lines.push(`${p}    }\n`);
        } else {
          this._emitCaseBody(mc.body, pad + 2, lines);
          lines.push(`${p}    ${matched} = true;\n`);
        }
        lines.push(`${p}  }\n`);
      }
    } else {
      let first = true;
      for (const mc of node.cases) {
        if (mc.isDefault) {
          lines.push(`${p}  ${first ? '' : 'else '}{\n`);
          this._emitCaseBody(mc.body, pad + 2, lines);
          lines.push(`${p}  }\n`);
        } else {
          const conds     = mc.patterns.map(pat => this.genMatchPattern(subj, pat));
          const bindDecls = mc.patterns.flatMap(pat => this.genMatchBindingDecls(subj, pat));
          const guard     = mc.guard ? ` && (${this.genExpr(mc.guard)})` : '';
          const kw        = first ? 'if' : 'else if';
          if (bindDecls.length > 0) {
            lines.push(`${p}  ${kw} (${conds.join(' || ')}${guard}) {\n`);
            for (const bd of bindDecls) lines.push(`${p}    ${bd}\n`);
            this._emitCaseBody(mc.body, pad + 2, lines);
            lines.push(`${p}  }\n`);
          } else {
            lines.push(`${p}  ${kw} (${conds.join(' || ')}${guard}) ${this.genBlock(mc.body, pad + 2)}\n`);
          }
        }
        first = false;
      }
    }
    lines.push(`${p}}\n`);
    return lines.join('');
  };

  /** @private Pushes the statements of a match case body into the lines array. */
  gen._emitCaseBody = function(body, pad, lines) {
    if (body.type === 'Block') {
      for (const s of (body.body || [])) lines.push(this.genStmt(s, pad));
    } else {
      lines.push(this.genStmt(body, pad));
    }
  };

  /**
   * Returns JS variable declaration strings that bind pattern captures.
   * For example, `binding` captures become `const name = subject;`.
   * @param {string} subj - JS expression for the match subject.
   * @param {object} pat  - Pattern AST node.
   * @returns {string[]}
   */
  gen.genMatchBindingDecls = function(subj, pat) {
    if (!pat) return [];
    switch (pat.kind) {
      case 'binding': return [`const ${pat.name} = ${subj};`];
      case 'variant': return (pat.fields || []).flatMap((f, i) =>
        this.genMatchBindingDecls(`${subj}._${i}`, f));
      case 'array': return (pat.items || []).flatMap((item, i) => {
        if (!item)       return [];
        if (item.rest)   return [`const ${item.name} = Array.from(${subj}).slice(${i});`];
        if (item.name)   return [`const ${item.name} = ${subj}[${i}];`];
        return [];
      });
      case 'object': return (pat.props || []).flatMap(p => {
        const localName = p.alias || p.key;
        return [`const ${localName} = ${subj}.${p.key};`];
      });
      default: return [];
    }
  };

  /**
   * Returns a JS boolean expression that tests whether a value matches a pattern.
   * @param {string} subj
   * @param {object} pat
   * @returns {string}
   */
  gen.genMatchPattern = function(subj, pat) {
    if (!pat) return 'false';
    switch (pat.kind) {
      case 'literal': {
        if (pat.value === null)      return `${subj} === null`;
        if (pat.value === undefined) return `${subj} === undefined`;
        return `${subj} === ${JSON.stringify(pat.value)}`;
      }
      case 'binding':  return 'true';
      case 'wildcard': return 'true';
      case 'enumVal':  return `${subj} === ${pat.path}`;
      case 'variant': {
        const tagCheck   = `${subj} && ${subj}._tag === ${JSON.stringify(pat.name)}`;
        const fieldChecks = pat.fields.map((f, i) => this.genMatchPattern(`${subj}._${i}`, f));
        return [tagCheck, ...fieldChecks].join(' && ');
      }
      case 'array': {
        const checks = [`Array.isArray(${subj})`];
        pat.items.forEach((item, i) => {
          if (item && item.kind !== 'rest') checks.push(this.genMatchPattern(`${subj}[${i}]`, item));
        });
        return checks.join(' && ');
      }
      case 'object': {
        const checks = [`${subj} !== null && typeof ${subj} === 'object'`];
        for (const prop of pat.props) checks.push(`${subj}.${prop.key} !== undefined`);
        return checks.join(' && ');
      }
      default: return 'true';
    }
  };

  /**
   * Generates the post-declaration code that applies a built-in NTL decorator.
   * Decorators transform the target (function/class) by reassigning it.
   * @param {object} dec        - Decorator AST node (name + args).
   * @param {string} targetName - The JS identifier being decorated.
   * @param {string} _p         - Indentation prefix (unused, kept for API compat).
   * @returns {string}
   */
  gen._applyDecorator = function(dec, targetName, _p) {
    const a  = dec.args ? dec.args.map(x => this.genExpr(x)) : [];
    const a0 = a[0] || '"deprecated"';
    switch (dec.name) {
      case 'class':
        return `if(typeof ${targetName}.__ntl_meta==='undefined'){Object.defineProperty(${targetName},'__ntl_meta',{value:{name:${JSON.stringify(targetName)},decorators:['class'],created:Date.now()},writable:true});}`;
      case 'singleton':
        return `${targetName}=(function(_C){let _i=null;return new Proxy(_C,{construct(t,args){if(!_i)_i=new _C(...args);return _i;}});})(${targetName});`;
      case 'sealed':
        return `Object.freeze(${targetName}.prototype);Object.freeze(${targetName});`;
      case 'abstract':
        return `${targetName}=(function(_C){return new Proxy(_C,{construct(t,a,nb){if(nb===_C)throw new TypeError(${JSON.stringify(targetName + ' cannot be instantiated directly (abstract)')});return Reflect.construct(t,a,nb);}});})(${targetName});`;
      case 'memo':
        return `${targetName}=(function(_f){const _c=new Map();return function(...a){const k=JSON.stringify(a);if(_c.has(k))return _c.get(k);const r=_f.apply(this,a);_c.set(k,r);return r;};})(${targetName});`;
      case 'deprecated':
        return `${targetName}=(function(_f,_m){return function(...a){console.warn('DEPRECATED:',_m);return _f.apply(this,a);};})(${targetName},${a0});`;
      case 'timeout':
        return `${targetName}=(function(_f,_ms){return async function(...a){return Promise.race([_f.apply(this,a),new Promise((_,rj)=>setTimeout(()=>rj(new Error('Timeout after '+_ms+'ms')),_ms))]);};})(${targetName},${a[0] || 5000});`;
      case 'retry':
        return `${targetName}=(function(_f,_n){return async function(...a){let _err;for(let i=0;i<_n;i++){try{return await _f.apply(this,a);}catch(e){_err=e;if(i<_n-1)await new Promise(r=>setTimeout(r,100*Math.pow(2,i)));}}throw _err;};})(${targetName},${a[0] || 3});`;
      case 'log':
        return `${targetName}=(function(_f,_n){return function(...a){console.log('['+_n+'] called',a);const r=_f.apply(this,a);console.log('['+_n+'] returned',r);return r;};})(${targetName},${JSON.stringify(targetName)});`;
      case 'cache':
        return `${targetName}=(function(_f,_ttl){const _c=new Map();return function(...a){const k=JSON.stringify(a);const h=_c.get(k);if(h&&Date.now()-h.t<_ttl)return h.v;const r=_f.apply(this,a);_c.set(k,{v:r,t:Date.now()});return r;};})(${targetName},${a[0] || 60000});`;
      case 'bind':
        return `${targetName}=(function(_C){Object.getOwnPropertyNames(_C.prototype).forEach(k=>{if(k!=='constructor'&&typeof _C.prototype[k]==='function'){const orig=_C.prototype[k];Object.defineProperty(_C.prototype,k,{get(){return orig.bind(this)}});}});return _C;})(${targetName});`;
      case 'validate':
        return `${targetName}=(function(_f,_s){return function(...a){if(_s&&_s.parse)_s.parse(a[0]);return _f.apply(this,a);};})(${targetName},${a[0] || 'null'});`;
      case 'event':
        return `${targetName}=(function(_C){const _e=new (require('events'))();_C.on=_e.on.bind(_e);_C.emit=_e.emit.bind(_e);_C.off=_e.off.bind(_e);return _C;})(${targetName});`;
      default: {
        const argStr = a.length ? ', ' + a.join(', ') : '';
        return `${targetName}=${dec.name}(${targetName}${argStr});`;
      }
    }
  };

  /**
   * Generates a decorated function or class declaration.
   * The inner declaration is emitted first, then decorator side-effects are appended.
   * @param {object} node
   * @param {number} pad
   * @returns {string}
   */
  gen.genDecorated = function(node, pad) {
    const p          = this.pad(pad);
    const decorators = node.decorators || [];
    const inner      = node.expr || node.stmt;
    if (!inner) return '';
    const name = inner.name || null;
    let innerCode = '';
    if (inner.type === 'FnDecl') innerCode = this.genFnDecl(inner, pad);
    else if (inner.type === 'FnExpr' && name) {
      const a      = inner.isAsync ? 'async ' : '';
      const params = this.genParams(inner.params);
      const body   = this.genBlock(inner.body, pad);
      innerCode = `${p}${a}function ${name}(${params}) ${body}\n`;
    } else if (inner.type === 'ClassDecl') {
      innerCode = this.genClassDecl(inner, pad);
    } else {
      innerCode = this.genStmt(inner, pad);
    }
    if (name && decorators.length > 0) {
      let result = innerCode.trimEnd() + '\n';
      for (const dec of [...decorators].reverse()) {
        result += `${p}${this._applyDecorator(dec, name, p)}\n`;
      }
      return result;
    }
    return innerCode;
  };
}

module.exports = { mixinClass };
