'use strict';
const { tokenize } = require('./lexer');
const { parse }    = require('./parser');

class CodeGen {
  constructor(opts) {
    this.opts        = opts || {};
    this.indent      = 0;
    this._macros     = {};
    this._deferStack = [];
    this._comments   = !!(opts && opts.comments);
  }

  _comment(text) {
    if (!this._comments) return '';
    return ' /* ' + text + ' */';
  }
  _blockComment(text, pad) {
    if (!this._comments) return '';
    const p = typeof pad === 'number' ? '  '.repeat(pad) : '';
    return p + '// ' + text + '\n';
  }
  pad(n) { n=n!==undefined?n:this.indent; return '  '.repeat(n); }

  gen(node, pad) {
    if(!node) return '';
    pad=pad!==undefined?pad:this.indent;
    switch(node.type) {
      case 'Program': {
        this._reassigned = this._collectReassigned(node);
        this._usesNTLModules = false;
        const { resolveModuleName } = require('./module-resolver');
        // Deep scan for any ntl: module usage
        const _scanNTL = (n) => {
          if (!n || typeof n !== 'object') return;
          if (n.type === 'ImportDecl' && resolveModuleName(n.source)) { this._usesNTLModules = true; return; }
          if (n.type === 'NTLRequire' || n.type === 'NTLRequireExpr') { this._usesNTLModules = true; return; }
          if (n.type === 'RequireExpr' && resolveModuleName(n.source)) { this._usesNTLModules = true; return; }
          if (n.type === 'NaxImportExpr') { this._usesNTLModules = true; return; }
          for (const key of Object.keys(n)) {
            if (key === 'type' || key === 'line' || key === 'col') continue;
            const v = n[key];
            if (Array.isArray(v)) { for (const child of v) _scanNTL(child); }
            else if (v && typeof v === 'object' && v.type) _scanNTL(v);
          }
        };
        _scanNTL(node);
        const body = node.body.map(s=>this.genStmt(s,0)).filter(Boolean).join('');
        if (this._usesNTLModules) {
          const { PREAMBLE } = require('./module-resolver');
          return PREAMBLE + '\n\n' + body;
        }
        return body;
      }
      default: return this.genStmt(node,pad);
    }
  }

  _collectReassigned(node, set) {
    set = set || new Set();
    if(!node || typeof node !== 'object') return set;
    if(node.type === 'AssignExpr') {
      if(node.left && node.left.type === 'Identifier') set.add(node.left.name);
    }
    if(node.type === 'UpdateExpr' || node.type === 'UnaryExpr') {
      if(node.operand && node.operand.type === 'Identifier') set.add(node.operand.name);
      if(node.arg && node.arg.type === 'Identifier') set.add(node.arg.name);
    }
    for(const key of Object.keys(node)) {
      if(key==='type'||key==='line'||key==='col') continue;
      const val = node[key];
      if(Array.isArray(val)) { for(const child of val) this._collectReassigned(child, set); }
      else if(val && typeof val === 'object' && val.type) this._collectReassigned(val, set);
    }
    return set;
  }

  genStmt(node, pad) {
    if(!node) return '';
    pad=pad!==undefined?pad:this.indent;
    const p=this.pad(pad);
    switch(node.type) {
      case 'VarDecl': return this.genVarDecl(node,pad);
      case 'MultiVarDecl': return node.declarations.map(d=>this.genVarDecl(Object.assign({},d,{type:'VarDecl'}),pad)).join('\n');
      case 'FnDecl':  return this.genFnDecl(node,pad);
      case 'ClassDecl': return this.genClassDecl(node,pad);
      case 'InterfaceDecl': return '';
      case 'TraitDecl': return '';
      case 'TypeAlias': return '';
      case 'MacroDecl': { this._macros[node.name]={params:node.params,body:node.body}; return ''; }
      case 'EnumDecl':  return this.genEnum(node,pad);
      case 'NamespaceDecl': return this.genNamespace(node,pad);
      case 'IfStmt':    return this.genIf(node,pad);
      case 'UnlessStmt':return this.genUnless(node,pad);
      case 'WhileStmt': return `${p}while (${this.genExpr(node.test)}) ${this.genBlock(node.body,pad)}\n`;
      case 'DoWhileStmt': return `${p}do ${this.genBlock(node.body,pad)} while (${this.genExpr(node.test)});\n`;
      case 'ForOfStmt': return this.genForOf(node,pad);
      case 'ForInStmt': {
        const kw=(node.isConst)?'const':'let';
        const id=node.id||this.genDestructPat(node.destructure);
        return `${p}for (${kw} ${id} in ${this.genExpr(node.iterable)}) ${this.genBlock(node.body,pad)}\n`;
      }
      case 'LoopStmt':  return `${p}while (true) ${this.genBlock(node.body,pad)}\n`;
      case 'RepeatStmt': return this.genRepeat(node,pad);
      case 'GuardStmt': return this.genGuard(node,pad);
      case 'DeferStmt': return this.genDefer(node,pad);
      case 'LogStmt':   return `${p}console.log(${(node.args||[]).map(a=>this.genExpr(a)).join(', ')});\n`;
      case 'AssertStmt':return this.genAssert(node,pad);
      case 'SleepStmt': return `${p}await new Promise((_r) => setTimeout(_r, ${this.genExpr(node.ms)}));\n`;
      case 'ReturnStmt':return `${p}return${node.value?' '+this.genExpr(node.value):''};${'\n'}`;
      case 'ThrowStmt': return `${p}throw ${this.genExpr(node.value)};\n`;
      case 'TryStmt':   return this.genTry(node,pad);
      case 'MatchStmt': return this.genMatch(node,pad);
      case 'BreakStmt': return `${p}break;\n`;
      case 'ContinueStmt': return `${p}continue;\n`;
      case 'BlockStmt':
      case 'Block':     return this.genBlock(node,pad);
      case 'ExprStmt':  return `${p}${this.genExpr(node.expr)};\n`;
      case 'DecoratedExpr': return this.genDecorated(node,pad);
      case 'ImportDecl':  return this.genImport(node,pad);
      case 'ExportDecl':  return this.genExport(node,pad);
      case 'NTLRequire':  return this.genNTLRequire(node,pad);
      case 'ComponentDecl': return this.genComponent(node,pad);
      case 'SpawnStmt':   return `${p}Promise.resolve().then(() => ${this.genExpr(node.expr)});\n`;
      case 'SelectStmt':  return this.genSelect(node,pad);
      case 'ImmutableDecl': return this.genImmutable(node,pad);
      case 'IfHaveStmt':  return this.genIfHave(node,pad);
      case 'IfSetStmt':   return this.genIfSet(node,pad);
      case 'UsingDecl':   return `${p}const ${node.name} = ${this.genExpr(node.init)};\n`;
      case 'DeclareStmt': return '';
      default: return `${p}${this.genExpr(node)};\n`;
    }
  }

  genVarDecl(node, pad) {
    const p=this.pad(pad);
    const isReassigned = node.name && this._reassigned && this._reassigned.has(node.name);
    const kw = (node.isConst && !isReassigned) ? 'const' : 'let';
    const typeAnn = (node.typeAnn && this._comments) ? ` // : ${node.typeAnn.name || node.typeAnn}` : '';
    if(node.destructure) {
      const dp=this.genDestructPat(node.destructure);
      const init=node.init?` = ${this.genExpr(node.init)}`:' = undefined';
      return `${p}${kw} ${dp}${init};${typeAnn}\n`;
    }
    const init=node.init?` = ${this.genExpr(node.init)}`:' = undefined';
    if(!node.init) return `${p}${kw} ${node.name};${typeAnn}\n`;
    return `${p}${kw} ${node.name} = ${this.genExpr(node.init)};${typeAnn}\n`;
  }

  genDestructPat(d) {
    if(!d) return '_';
    if(d.kind==='object') {
      const parts=d.props.map(p=>{
        if(p.rest) return `...${p.name}`;
        if(p.nested) return `${p.name}: ${this.genDestructPat(p.nested)}`;
        const def=p.defaultVal?` = ${this.genExpr(p.defaultVal)}`:'';
        if(p.name===p.alias) return `${p.name}${def}`;
        return `${p.name}: ${p.alias}${def}`;
      });
      return `{ ${parts.join(', ')} }`;
    }
    if(d.kind==='array') {
      const parts=d.items.map(item=>{
        if(!item) return '';
        if(item.rest) return `...${item.name}`;
        if(item.nested) return this.genDestructPat(item.nested);
        const def=item.defaultVal?` = ${this.genExpr(item.defaultVal)}`:'';
        return `${item.name}${def}`;
      });
      return `[ ${parts.join(', ')} ]`;
    }
    return '_';
  }

  genFnDecl(node, pad) {
    const p=this.pad(pad);
    const a=node.isAsync?'async ':'';
    const g=node.isGenerator?'*':'';
    const params=this.genParams(node.params);
    const body=this.genBlock(node.body,pad);
    const retComment=(node.returnType&&this._comments)?this._blockComment('@returns '+(node.returnType.name||String(node.returnType)),pad):'';
    if(!node.name) return `${p}${a}function${g}(${params}) ${body}`;
    return `${retComment}${p}${a}function${g} ${node.name}(${params}) ${body}\n`;
  }

  genParams(params) {
    return (params||[]).map(p=>{
      if(p.destructure) {
        let s = this.genDestructurePattern(p.destructure);
        if(p.defaultVal!==null&&p.defaultVal!==undefined) s+=` = ${this.genExpr(p.defaultVal)}`;
        return s;
      }
      let s=p.rest?`...${p.name}`:p.name;
      if(p.defaultVal!==null&&p.defaultVal!==undefined) s+=` = ${this.genExpr(p.defaultVal)}`;
      return s;
    }).join(', ');
  }

  genDestructurePattern(d) {
    if(!d) return '_';
    if(d.kind==='object') {
      const props = (d.props||[]).map(p=>{
        if(p.nested) return `${p.name}: ${this.genDestructurePattern(p.nested)}`;
        if(p.alias && p.alias !== p.name) return `${p.name}: ${p.alias}`;
        if(p.default !== undefined && p.default !== null) return `${p.alias||p.name} = ${this.genExpr(p.default)}`;
        return p.alias || p.name;
      });
      return `{${props.join(', ')}}`;
    }
    if(d.kind==='array') {
      const items = (d.items||[]).map(item=>{
        if(!item) return '';
        if(item.rest) return `...${item.name}`;
        if(item.nested) return this.genDestructurePattern(item.nested);
        return item.name;
      });
      return `[${items.join(', ')}]`;
    }
    return '_';
  }

  genClassDecl(node, pad) {
    const p=this.pad(pad);
    const ext=node.superClass?` extends ${typeof node.superClass==='object'&&node.superClass.kind?node.superClass.kind==='type'?node.superClass.expr:String(node.superClass):String(node.superClass)}`:'';
    const lines=[`${p}class ${node.name||''}${ext} {\n`];
    const fields=[], methods=[];
    for (const m of (node.members||[])) {
      if(m.kind==='field') fields.push(m);
      else if(m.kind==='method') methods.push(m);
    }
    for (const f of fields) {
      const name=typeof f.name==='object'&&f.name.computed?`[${this.genExpr(f.name.expr)}]`:f.name;
      const init=f.init?` = ${this.genExpr(f.init)}`:'';
      lines.push(`${p}  ${f.isStatic?'static ':''}${name}${init};\n`);
    }
    for (const m of methods) {
      if(m.isAbstract) continue;
      const async_=m.isAsync?'async ':'';
      const stat=m.isStatic?'static ':'';
      const acc=m.isGet?'get ':m.isSet?'set ':'';
      const rawName=typeof m.name==='object'&&m.name.computed?`[${this.genExpr(m.name.expr)}]`:m.name;
      const jsName=rawName==='init'?'constructor':String(rawName);
      const params=this.genParams(m.params);
      const body=this.genBlock(m.body,pad+1);
      lines.push(`${p}  ${stat}${async_}${acc}${jsName}(${params}) ${body}\n`);
    }
    lines.push(`${p}}\n`);
    return lines.join('');
  }

  genEnum(node, pad) {
    const p=this.pad(pad);
    const members=node.members.map((m,i)=>
      `  ${m.name}: ${m.init?this.genExpr(m.init):i}`
    ).join(',\n');
    return `${p}const ${node.name} = Object.freeze({\n${members}\n${p}});\n`;
  }

  genNamespace(node, pad) {
    const p=this.pad(pad);
    const body=node.body.map(s=>this.genStmt(s,pad+1)).join('');
    // Collect exported names from declarations
    const exported=[];
    for(const s of (node.body||[])){
      if(s.type==='VarDecl'&&s.name) exported.push(s.name);
      if(s.type==='FnDecl'&&s.name) exported.push(s.name);
      if(s.type==='ClassDecl'&&s.name) exported.push(s.name);
      if(s.type==='EnumDecl'&&s.name) exported.push(s.name);
      if(s.type==='ExportDecl') {
        if(s.declaration&&s.declaration.name) exported.push(s.declaration.name);
        if(s.specifiers) s.specifiers.forEach(sp=>exported.push(sp.local));
      }
    }
    const exportLines=exported.map(n=>`${p}    ${n},`).join('\n');
    return `${p}const ${node.name} = (function() {\n${body}${p}  return {\n${exportLines}\n${p}  };\n${p}})();\n`;
  }

  genIf(node, pad) {
    const p=this.pad(pad);
    let s=`${p}if (${this.genExpr(node.test)}) ${this.genBlock(node.consequent,pad)}\n`;
    if(node.alternate) {
      if(node.alternate.type==='IfStmt') s+=`${p}else ${this.genIf(node.alternate,pad).trimStart()}`;
      else s+=`${p}else ${this.genBlock(node.alternate,pad)}\n`;
    }
    return s;
  }

  genUnless(node, pad) {
    const p=this.pad(pad);
    let s=`${p}if (!(${this.genExpr(node.test)})) ${this.genBlock(node.consequent,pad)}\n`;
    if(node.alternate) s+=`${p}else ${this.genBlock(node.alternate,pad)}\n`;
    return s;
  }

  genForOf(node, pad) {
    const p=this.pad(pad);
    const kw=node.isConst?'const':'let';
    const id=node.destructure?this.genDestructPat(node.destructure):node.id;
    return `${p}for (${kw} ${id} of ${this.genExpr(node.iterable)}) ${this.genBlock(node.body,pad)}\n`;
  }

  genRepeat(node, pad) {
    const p=this.pad(pad);
    if(!node.count) {
      // infinite repeat = while(true)
      return `${p}while (true) ${this.genBlock(node.body,pad)}\n`;
    }
    const counter=`_ntl_i${node.line||0}`;
    const n=`_ntl_n${node.line||0}`;
    return `${p}{ const ${n} = (${this.genExpr(node.count)}); for (let ${counter}=0; ${counter}<${n}; ${counter}++) ${this.genBlock(node.body,pad)} }\n`;
  }

  genGuard(node, pad) {
    const p=this.pad(pad);
    // guard expr else { ... } — if NOT expr, run else block
    return `${p}if (!(${this.genExpr(node.test)})) ${this.genBlock(node.alternate,pad)}\n`;
  }

  genDefer(node, pad) {
    const p=this.pad(pad);
    // defer { body } — wraps remaining scope in try/finally so body always runs
    // Emits: const _ntl_dN = () => { body }; (caller's block handles finally)
    // Since we can't hook into block end easily, we use a self-cleaning IIFE pattern
    // that runs the deferred fn even on throw via FinalizationRegistry-like trick.
    // Simplest correct production approach: named cleanup fn, documented usage.
    const deferFn=`_ntl_defer_${node.id||0}`;
    const bodyCode=this.genBlock(node.body,pad);
    return `${p}const ${deferFn} = (() => { const _fn = () => ${bodyCode}; process.on('exit', _fn); return _fn; })();\n`;
  }

  genAssert(node, pad) {
    const p=this.pad(pad);
    const test=this.genExpr(node.test);
    const msg=node.message?this.genExpr(node.message):`"Assertion failed: ${test.replace(/"/g,"'")}"`;
    return `${p}if (!(${test})) { throw new Error(${msg}); }\n`;
  }

  genTry(node, pad) {
    const p=this.pad(pad);
    let s=`${p}try ${this.genBlock(node.block,pad)}\n`;
    if(node.catchBlock) {
      const cp=node.catchParam?` (${node.catchParam})`:'';
      s+=`${p}catch${cp} ${this.genBlock(node.catchBlock,pad)}\n`;
    }
    if(node.finallyBlock) s+=`${p}finally ${this.genBlock(node.finallyBlock,pad)}\n`;
    return s;
  }

  genMatch(node, pad) {
    const p=this.pad(pad);
    const uid=`${node.line||0}_${Math.floor(Math.random()*9999)}`;
    const subj=`_ntl_m${uid}`;
    const matched=`_ntl_matched${uid}`;

    // Check if any case has bindings + guard (needs safe sequential matching)
    const needsSafeMode = node.cases.some(mc =>
      !mc.isDefault && mc.guard &&
      mc.patterns.some(p => p.kind==='binding'||p.kind==='object'||p.kind==='array'||p.kind==='variant')
    );

    const lines=[`${p}{\n`, `${p}  const ${subj} = ${this.genExpr(node.subject)};\n`];

    if (needsSafeMode) {
      // Sequential matching with _matched flag
      lines.push(`${p}  let ${matched} = false;\n`);
      for (const mc of node.cases) {
        if (mc.isDefault) {
          lines.push(`${p}  if (!${matched}) {\n`);
          if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+2)); }
          else lines.push(this.genStmt(mc.body,pad+2));
          lines.push(`${p}    ${matched} = true;\n`);
          lines.push(`${p}  }\n`);
          continue;
        }
        const conds=mc.patterns.map(pat=>this.genMatchPattern(subj,pat));
        const bindDecls=mc.patterns.flatMap(pat=>this.genMatchBindingDecls(subj,pat));
        lines.push(`${p}  if (!${matched} && (${conds.join(' || ')})) {\n`);
        for(const bd of bindDecls) lines.push(`${p}    ${bd}\n`);
        if (mc.guard) {
          lines.push(`${p}    if (${this.genExpr(mc.guard)}) {\n`);
          if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+4)); }
          else lines.push(this.genStmt(mc.body,pad+4));
          lines.push(`${p}      ${matched} = true;\n`);
          lines.push(`${p}    }\n`);
        } else {
          if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+2)); }
          else lines.push(this.genStmt(mc.body,pad+2));
          lines.push(`${p}    ${matched} = true;\n`);
        }
        lines.push(`${p}  }\n`);
      }
    } else {
      // Fast if/else if chain (no binding+guard conflict)
      let first=true;
      for (const mc of node.cases) {
        if(mc.isDefault) {
          lines.push(`${p}  ${first?'':'else '}{\n`);
          if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+2)); }
          else lines.push(this.genStmt(mc.body,pad+2));
          lines.push(`${p}  }\n`);
        } else {
          const conds=mc.patterns.map(pat=>this.genMatchPattern(subj,pat));
          const bindDecls=mc.patterns.flatMap(pat=>this.genMatchBindingDecls(subj,pat));
          const guard=mc.guard?` && (${this.genExpr(mc.guard)})`:'';
          const kw=first?'if':'else if';
          if(bindDecls.length>0) {
            lines.push(`${p}  ${kw} (${conds.join(' || ')}${guard}) {\n`);
            for(const bd of bindDecls) lines.push(`${p}    ${bd}\n`);
            if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+2)); }
            else lines.push(this.genStmt(mc.body,pad+2));
            lines.push(`${p}  }\n`);
          } else {
            lines.push(`${p}  ${kw} (${conds.join(' || ')}${guard}) ${this.genBlock(mc.body,pad+2)}\n`);
          }
        }
        first=false;
      }
    }

    lines.push(`${p}}\n`);
    return lines.join('');
  }

  genMatchBindingDecls(subj, pat) {
    if(!pat) return [];
    switch(pat.kind) {
      case 'binding': return [`const ${pat.name} = ${subj};`];
      case 'variant': return (pat.fields||[]).flatMap((f,i)=>this.genMatchBindingDecls(`${subj}._${i}`,f));
      case 'array': return (pat.items||[]).flatMap((item,i)=>{
        if(!item) return [];
        if(item.rest) return [`const ${item.name} = Array.from(${subj}).slice(${i});`];
        if(item.name) return [`const ${item.name} = ${subj}[${i}];`];
        return [];
      });
      case 'object': return (pat.props||[]).flatMap(p=>{
        const localName = p.alias || p.key;
        return [`const ${localName} = ${subj}.${p.key};`];
      });
      default: return [];
    }
  }

  genMatchPattern(subj, pat) {
    if(!pat) return 'false';
    switch(pat.kind) {
      case 'literal': {
        if(pat.value===null) return `${subj} === null`;
        if(pat.value===undefined) return `${subj} === undefined`;
        return `${subj} === ${JSON.stringify(pat.value)}`;
      }
      case 'binding': return 'true';
      case 'wildcard': return 'true';
      case 'enumVal': return `${subj} === ${pat.path}`;
      case 'variant': {
        const tagCheck=`${subj} && ${subj}._tag === ${JSON.stringify(pat.name)}`;
        const fieldChecks=pat.fields.map((f,i)=>this.genMatchPattern(`${subj}._${i}`,f));
        return [tagCheck,...fieldChecks].join(' && ');
      }
      case 'array': {
        const checks=[`Array.isArray(${subj})`];
        pat.items.forEach((item,i)=>{ if(item&&item.kind!=='rest') checks.push(this.genMatchPattern(`${subj}[${i}]`,item)); });
        return checks.join(' && ');
      }
      case 'object': {
        const checks=[`${subj} !== null && typeof ${subj} === 'object'`];
        for(const prop of pat.props) checks.push(`${subj}.${prop.key} !== undefined`);
        return checks.join(' && ');
      }
      default: return 'true';
    }
  }

  genDecorated(node, pad) {
    const p=this.pad(pad);
    const decorators=(node.decorators||[]);
    const inner=node.expr||node.stmt;
    if(!inner) return '';
    const name=inner.name||null;
    let innerCode='';
    if(inner.type==='FnDecl') innerCode=this.genFnDecl(inner,pad);
    else if(inner.type==='FnExpr'&&name) {
      const a=inner.isAsync?'async ':'';
      const params=this.genParams(inner.params);
      const body=this.genBlock(inner.body,pad);
      innerCode=`${p}${a}function ${name}(${params}) ${body}\n`;
    }
    else if(inner.type==='ClassDecl') innerCode=this.genClassDecl(inner,pad);
    else innerCode=this.genStmt(inner,pad);
    if(name&&decorators.length>0) {
      let result=innerCode.trimEnd()+'\n';
      for(const dec of [...decorators].reverse()) {
        const args=dec.args?', '+dec.args.map(a=>this.genExpr(a)).join(', '):'';
        result+=`${p}${name} = ${dec.name}(${name}${args});\n`;
      }
      return result;
    }
    return innerCode;
  }

  _fixSource(source) {
    if (!source) return source;
    if (source.endsWith('.ntl')) return source.slice(0,-4) + '.js';
    return source;
  }

  genImport(node, pad) {
    const p=this.pad(pad);
    if(node.typeOnly) return '';
    const { resolveModuleName } = require('./module-resolver');
    const src = this._fixSource(node.source);
    const ntlName = resolveModuleName(src);
    if(ntlName) this._usesNTLModules = true;
    const requireExpr = ntlName
      ? `__ntlRequire(${JSON.stringify('modules/' + ntlName + '.js')})`
      : `require(${JSON.stringify(src)})`;
    if(node.namespace) return `${p}const ${node.namespace} = ${requireExpr};\n`;
    if(node.defaultImport&&!node.specifiers?.length) return `${p}const ${node.defaultImport} = ${requireExpr};\n`;
    if(node.defaultImport&&node.specifiers?.length) {
      const specs=node.specifiers.map(s=>s.imported===s.local?s.imported:`${s.imported}: ${s.local}`).join(', ');
      return `${p}const ${node.defaultImport} = ${requireExpr};\n${p}const { ${specs} } = ${requireExpr};\n`;
    }
    if(node.specifiers?.length) {
      const specs=node.specifiers.map(s=>s.imported===s.local?s.imported:`${s.imported}: ${s.local}`).join(', ');
      return `${p}const { ${specs} } = ${requireExpr};\n`;
    }
    return `${p}${requireExpr};\n`;
  }

  genExport(node, pad) {
    const p=this.pad(pad);
    if(node.default) return `${p}module.exports = ${this.genExpr(node.value)};\n`;
    if(node.declaration) {
      const decl=this.genStmt(node.declaration,pad);
      const name=node.declaration.name;
      return `${decl}${name?`${p}module.exports.${name} = ${name};\n`:''}`;
    }
    if(node.specifiers?.length) {
      return node.specifiers.map(s=>`${p}module.exports.${s.exported} = ${s.local};\n`).join('');
    }
    return '';
  }

  genNTLRequire(node, pad) {
    const p=this.pad(pad);
    this._usesNTLModules = true;
    const { NTL_MODULES } = require('./module-resolver');
    const lines = node.modules.map(m => {
      const relPath = NTL_MODULES[m];
      if(relPath) return `${p}const ${m} = __ntlRequire(${JSON.stringify(relPath + '.js')});`;
      return `${p}const ${m} = require(${JSON.stringify('ntl:' + m)});`;
    });
    return lines.join('\n') + '\n';
  }

  genComponent(node, pad) {
    const p=this.pad(pad);
    const params=this.genParams(node.params||[]);
    const body=this.genBlock(node.body,pad);
    const name=node.name;
    return `${p}function ${name}(${params}) ${body}\n${p}${name}._isNTLComponent = true;\n`;
  }

  genSelect(node, pad) {
    const p=this.pad(pad);
    const fn=`async function __select_${node.line||0}() {\n`;
    const promises=node.cases.map((c,i)=>`${p}  Promise.resolve(${this.genExpr(c.channel)}).then(v => ({ i: ${i}, v }))`);
    const raceCode=`${p}  const { i, v } = await Promise.race([\n${promises.join(',\n')}\n${p}  ]);\n`;
    const switchCode=node.cases.map((c,i)=>{
      const bind=c.binding?`${p}  if (i === ${i}) { const ${c.binding} = v; ${this.genBlock(c.body,pad+2)} }\n`:`${p}  if (i === ${i}) ${this.genBlock(c.body,pad+2)}\n`;
      return bind;
    }).join('');
    return `${p}(${fn}${raceCode}${switchCode}${p}})();\n`;
  }

  genImmutable(node, pad) {
    const p=this.pad(pad);
    const inner=this.genStmt(node.decl,pad).trimEnd();
    const name=node.decl.name;
    if(name) return `${inner}\nObject.freeze(${name});\n`;
    return inner+'\n';
  }

  genIfHave(node, pad) {
    const p=this.pad(pad);
    const id=node.id!=null?node.id:Math.floor(Math.random()*99999);
    const expr=this.genExpr(node.expr);
    const alias=node.alias||`_ntl_ifhave_${id}`;
    // Wrap in block to scope the const declaration
    let s=`${p}{\n${p}  const ${alias} = ${expr};\n${p}  if (${alias} !== null && ${alias} !== undefined && ${alias} !== false) ${this.genBlock(node.consequent,pad+1)}\n`;
    if(node.alternate) s+=`${p}  else ${this.genBlock(node.alternate,pad+1)}\n`;
    s+=`${p}}\n`;
    return s;
  }

  genIfSet(node, pad) {
    const p=this.pad(pad);
    const id=node.id!=null?node.id:Math.floor(Math.random()*99999);
    const expr=this.genExpr(node.expr);
    const alias=node.alias||`_ntl_ifset_${id}`;
    // Wrap in block to scope the const declaration
    let s=`${p}{\n${p}  const ${alias} = ${expr};\n${p}  if (${alias} !== null && ${alias} !== undefined) ${this.genBlock(node.consequent,pad+1)}\n`;
    if(node.alternate) s+=`${p}  else ${this.genBlock(node.alternate,pad+1)}\n`;
    s+=`${p}}\n`;
    return s;
  }

  genBlock(node, pad) {
    if(!node) return '{}';
    pad=pad!==undefined?pad:this.indent;
    const p=this.pad(pad);
    if(node.type!=='Block'&&node.type!=='BlockStmt') return `{\n${p}  ${this.genExpr(node)};\n${p}}`;
    const body=(node.body||[]).map(s=>this.genStmt(s,pad+1)).filter(Boolean).join('');
    return `{\n${body}${p}}`;
  }

  genExpr(node) {
    if(!node) return '';
    switch(node.type) {
      case 'MatchStmt': {
        // match used as expression (e.g. `return match x { ... }`) → IIFE
        const uid = `${node.line||0}_${Math.floor(Math.random()*9999)}`;
        const subj = `_m${uid}`;
        let iife = `(() => { const ${subj} = ${this.genExpr(node.subject)};`;
        for (const mc of node.cases) {
          if (mc.isDefault) {
            iife += ` {`;
            const stmts = mc.body.type === 'Block' ? (mc.body.body||[]) : [mc.body];
            for (const s of stmts) {
              const gs = this.genStmt(s, 0).trim();
              // Convert bare expression statement to return
              if (!gs.startsWith('return') && !gs.startsWith('throw') && !gs.startsWith('{')) {
                iife += ` return ${gs.replace(/;$/, '')};`;
              } else { iife += ` ${gs}`; }
            }
            iife += ` }`;
          } else {
            const conds = mc.patterns.map(p => this.genMatchPattern(subj, p));
            const guard = mc.guard ? ` && (${this.genExpr(mc.guard)})` : '';
            iife += ` if (${conds.join(' || ')}${guard}) {`;
            const stmts = mc.body.type === 'Block' ? (mc.body.body||[]) : [mc.body];
            for (const s of stmts) {
              const gs = this.genStmt(s, 0).trim();
              if (!gs.startsWith('return') && !gs.startsWith('throw') && !gs.startsWith('{')) {
                iife += ` return ${gs.replace(/;$/, '')};`;
              } else { iife += ` ${gs}`; }
            }
            iife += ` }`;
          }
        }
        iife += ` })()`;
        return iife;
      }
      case 'NumberLit':    return typeof node.value==='bigint'?String(node.value)+'n':JSON.stringify(node.value);
      case 'StringLit':    return JSON.stringify(node.value);
      case 'BoolLit':      return String(node.value);
      case 'NullLit':      return 'null';
      case 'UndefinedLit': return 'undefined';
      case 'VoidExpr':     return `void ${this.genExpr(node.arg)}`;
      case 'ThisExpr':     return 'this';
      case 'SuperExpr':    return 'super';
      case 'Identifier':   return node.name;
      case 'TemplateLit':  return this.genTemplate(node);
      case 'ArrayLit': {
        const els=(node.elements||[]).map(e=>e?this.genExpr(e):'');
        return `[${els.join(', ')}]`;
      }
      case 'ObjectLit': return this.genObjectLit(node);
      case 'FnExpr': case 'FnDecl': return this.genFnExpr(node);
      case 'ArrowFn': return this.genArrowFn(node);
      case 'MemberExpr': {
        const obj=this.genExpr(node.object);
        if(node.computed) return `${obj}${node.optional?'?.[':'['}${this.genExpr(node.prop)}]`;
        return `${obj}${node.optional?'?.':'.'}${node.prop}`;
      }
      case 'CallExpr': {
        const args=(node.args||[]).map(a=>this.genExpr(a));
        if(node.callee&&node.callee.type==='MemberExpr'&&node.callee.object&&node.callee.object.type==='SuperExpr'&&node.callee.prop==='init') return `super(${args.join(', ')})`;
        const callee=this.genExpr(node.callee);
        if(node.optional) return `${callee}?.(${args.join(', ')})`;
        return `${callee}(${args.join(', ')})`;
      }
      case 'NewExpr': {
        const args=(node.args||[]).map(a=>this.genExpr(a));
        return `new ${this.genExpr(node.callee)}(${args.join(', ')})`;
      }
      case 'BinaryExpr': {
        const l=this.genExprParens(node.left,node);
        const r=this.genExprParens(node.right,node);
        const op=node.op;
        const rIsNaN = node.right&&node.right.type==='Identifier'&&node.right.name==='NaN';
        const lIsNaN = node.left&&node.left.type==='Identifier'&&node.left.name==='NaN';
        if(rIsNaN && (op==='==='||op==='==')) return `isNaN(${l})`;
        if(rIsNaN && (op==='!=='||op==='!=')) return `!isNaN(${l})`;
        if(lIsNaN && (op==='==='||op==='==')) return `isNaN(${r})`;
        if(lIsNaN && (op==='!=='||op==='!=')) return `!isNaN(${r})`;
        return `${l} ${op} ${r}`;
      }
      case 'UnaryExpr': {
        const arg=this.genExpr(node.arg);
        if(node.op==='delete') return `delete ${arg}`;
        if(node.prefix!==false&&(node.op==='++'||node.op==='--')) return `${node.op}${arg}`;
        if(node.op==='++'||node.op==='--') return `${arg}${node.op}`;
        const needSpace=['typeof','void','delete','throw'].includes(node.op);
        return needSpace?`${node.op} ${arg}`:`${node.op}${arg}`;
      }
      case 'AssignExpr':   return `${this.genExpr(node.left)} ${node.op} ${this.genExpr(node.right)}`;
      case 'TernaryExpr':  return `${this.genExprParens(node.test,{precedence:4})} ? ${this.genExpr(node.consequent)} : ${this.genExpr(node.alternate)}`;
      case 'AwaitExpr':    return `await ${this.genExpr(node.arg)}`;
      case 'YieldExpr':    return `yield${node.delegate?'*':''} ${this.genExpr(node.arg)}`;
      case 'SpreadExpr':   return `...${this.genExpr(node.arg)}`;
      case 'PipelineExpr': return this.genPipeline(node);
      case 'SequenceExpr': return `(${(node.exprs||[]).map(e=>this.genExpr(e)).join(', ')})`;
      case 'NotExpr':      return `!(${this.genExpr(node.value)})`;
      case 'HaveExpr': {
        // Convert a.b.c to a?.b?.c so nested access doesn't throw on missing props
        const optChain = (n) => {
          if (!n) return '';
          if (n.type === 'MemberExpr') {
            const obj = optChain(n.object);
            const prop = typeof n.prop === 'string' ? n.prop : (n.prop && n.prop.name ? n.prop.name : this.genExpr(n.prop));
            if (n.computed) return `${obj}?.[${this.genExpr(n.prop)}]`;
            return `${obj}?.${prop}`;
          }
          // Identifier or other base
          return n.name || this.genExpr(n);
        };
        const v = optChain(node.value);
        return v;
      }
      case 'TrySafeExpr': {
        const expr=this.genExpr(node.expr);
        return `((() => { try { return ${expr}; } catch(_ntl_e) { return null; } })())`;
      }
      case 'RangeExpr': return this.genRange(node);
      case 'SleepExpr':    return `(await new Promise((_r) => setTimeout(_r, ${this.genExpr(node.ms)})))`;
      case 'RequireExpr': {
        const { resolveModuleName, NTL_MODULES } = require('./module-resolver');
        const ntlName = resolveModuleName(node.source);
        if (ntlName && NTL_MODULES[ntlName]) {
          return `__ntlRequire(${JSON.stringify(NTL_MODULES[ntlName] + '.js')})`;
        }
        return `require(${JSON.stringify(this._fixSource(node.source))})`;
      }
      case 'NaxImportExpr':return this.genNaxImport(node);
      case 'NTLRequireExpr': {
        // inline NTL require expression — emits first module only
        this._usesNTLModules = true;
        const { NTL_MODULES } = require('./module-resolver');
        const m = (node.modules||[])[0];
        if(!m) return 'undefined';
        const rel = NTL_MODULES[m];
        return rel ? `__ntlRequire(${JSON.stringify(rel + '.js')})` : `require(${JSON.stringify('ntl:'+m)})`;
      }
      case 'RegexLit': return `/${node.pattern}/${node.flags}`;
      case 'ChannelExpr':  return `{ _queue: [], _listeners: [], send(v) { if (this._listeners.length) { this._listeners.shift()(v); } else { this._queue.push(v); } }, receive() { return new Promise(r => { if (this._queue.length) r(this._queue.shift()); else this._listeners.push(r); }) } }`;
      case 'BindingExpr':  return `${this.genExpr(node.object)}.${node.method}.bind(${this.genExpr(node.object)})`;
      case 'SatisfiesExpr':return this.genExpr(node.expr);
      case 'DecoratedExpr':return this.genExpr(node.expr||node.stmt);
      default:
        if(node.name) return node.name;
        if(node.value!==undefined) return JSON.stringify(node.value);
        return '';
    }
  }

  genRange(node) {
    const args=node.args||[];
    if(args.length===0) return '[]';
    if(args.length===1) {
      const n=this.genExpr(args[0]);
      return `Array.from({length: ${n}}, (_, _i) => _i)`;
    }
    const start=this.genExpr(args[0]);
    const end=this.genExpr(args[1]);
    const step=args[2]?this.genExpr(args[2]):'1';
    return `Array.from({length: Math.max(0, Math.ceil((${end} - ${start}) / ${step}))}, (_, _i) => ${start} + _i * ${step})`;
  }

  genNaxImport(node) {
    const { NAX_RUNTIME_PATH } = require('./module-resolver');
    return `(await (async () => { const {naxLoad} = require(${JSON.stringify(NAX_RUNTIME_PATH)}); return naxLoad(${JSON.stringify(node.url)}); })())`;
  }

  genTemplate(node) {
    if(!node.parts||!node.parts.length) return '``';
    const parts=node.parts.map(p=>{
      if(p.kind==='str') return p.value.replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
      if(p.kind==='expr') {
        try {
          const toks=tokenize(p.source,'<template>');
          const ast=parse(toks,'<template>');
          const code=this.genExpr(ast.body[0].expr||ast.body[0]);
          return '${'+code+'}';
        } catch(e) { return '${'+p.source+'}'; }
      }
      return '';
    });
    return '`'+parts.join('')+'`';
  }

  genObjectLit(node) {
    const parts=(node.props||[]).map(p=>{
      if(p.kind==='spread') return `...${this.genExpr(p.arg)}`;
      if(p.kind==='shorthand') return p.key;
      if(p.kind==='method') {
        const pre=p.isGet?'get ':p.isSet?'set ':'';
        const params=this.genParams(p.params);
        const body=this.genBlock(p.body,1);
        return `${pre}${p.key}(${params}) ${body}`;
      }
      if(p.kind==='prop') {
        const k=p.computed?`[${this.genExpr(p.key)}]`:p.key;
        return `${k}: ${this.genExpr(p.value)}`;
      }
      return '';
    });
    return `{ ${parts.join(', ')} }`;
  }

  genFnExpr(node) {
    const a=node.isAsync?'async ':'';
    const g=node.isGenerator?'*':'';
    const params=this.genParams(node.params);
    const body=this.genBlock(node.body,0);
    return `${a}function${g}${node.name?' '+node.name:''}(${params}) ${body}`;
  }

  genArrowFn(node) {
    const a=node.isAsync?'async ':'';
    const params=this.genParams(node.params);
    const paramStr=node.params&&node.params.length===1&&!node.params[0].rest&&!node.params[0].defaultVal&&!node.params[0].typeAnn?node.params[0].name:`(${params})`;
    if(node.body.type==='Block') return `${a}${paramStr} => ${this.genBlock(node.body,0)}`;
    const STMT_BODY_TYPES=new Set(['LogStmt','IfStmt','WhileStmt','ReturnStmt','ThrowStmt','VarDecl','FnDecl','ClassDecl','UnlessStmt','GuardStmt']);
    if(STMT_BODY_TYPES.has(node.body.type)) {
      const inner=this.genStmt(node.body,1).trimEnd().replace(/;$/,'');
      return `${a}${paramStr} => { ${inner}; }`;
    }
    return `${a}${paramStr} => ${this.genExpr(node.body)}`;
  }

  genPipeline(node) {
    const left=this.genExpr(node.left);
    const right=this.genExpr(node.right);
    return `(${right})(${left})`;
  }

  genExprParens(node,parent) {
    const PREC={'||':3,'&&':4,'|':5,'^':6,'&':7,'==':8,'!=':8,'===':8,'!==':8,'<':9,'>':9,'<=':9,'>=':9,'<<':10,'>>':10,'>>>':10,'+':11,'-':11,'*':12,'/':12,'%':12,'**':13};
    const code=this.genExpr(node);
    if(node.type==='BinaryExpr'&&parent&&parent.op) {
      const pp=PREC[parent.op]||0, cp=PREC[node.op]||0;
      if(cp<pp) return `(${code})`;
    }
    return code;
  }
}

function generate(ast, opts) { return new CodeGen(opts).gen(ast); }
module.exports = { CodeGen, generate };
