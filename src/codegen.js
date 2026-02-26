'use strict';
const { tokenize } = require('./lexer');
const { parse }    = require('./parser');
class CodeGen {
  constructor(opts) { this.opts=opts||{}; this.indent=0; this._macros={}; }
  pad(n) { n=n!==undefined?n:this.indent; return '  '.repeat(n); }
  gen(node, pad) {
    if(!node) return '';
    pad=pad!==undefined?pad:this.indent;
    switch(node.type) {
      case 'Program':     return node.body.map(s=>this.genStmt(s,0)).filter(Boolean).join('\n');
      default:            return this.genStmt(node,pad);
    }
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
      case 'WhileStmt': return `${p}while (${this.genExpr(node.test)}) ${this.genBlock(node.body,pad)}`;
      case 'DoWhileStmt': return `${p}do ${this.genBlock(node.body,pad)} while (${this.genExpr(node.test)});`;
      case 'ForOfStmt': return this.genForOf(node,pad);
      case 'ForInStmt': return `${p}for (const ${node.id||this.genDestructPat(node.destructure)} in ${this.genExpr(node.iterable)}) ${this.genBlock(node.body,pad)}`;
      case 'LoopStmt':  return `${p}while (true) ${this.genBlock(node.body,pad)}`;
      case 'ReturnStmt':return `${p}return${node.value?' '+this.genExpr(node.value):''};\n`;
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
      case 'SpawnStmt':   return `${p}Promise.resolve().then(() => ${this.genExpr(node.expr)});\n`;
      case 'SelectStmt':  return this.genSelect(node,pad);
      case 'ImmutableDecl': return this.genImmutable(node,pad);
      case 'IfSetStmt':   return this.genIfSet(node,pad);
      case 'UsingDecl':   return `${p}const ${node.name} = ${this.genExpr(node.init)};\n`;
      case 'DeclareStmt': return '';
      default: return `${p}${this.genExpr(node)};\n`;
    }
  }
  genVarDecl(node, pad) {
    const p=this.pad(pad);
    const kw=node.isConst?'const':'let';
    if(node.destructure) {
      const dp=this.genDestructPat(node.destructure);
      const init=node.init?` = ${this.genExpr(node.init)}`:'';
      return `${p}${kw} ${dp}${init};\n`;
    }
    const init=node.init?` = ${this.genExpr(node.init)}`:'';
    return `${p}${kw} ${node.name}${init};\n`;
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
    const params=this.genParams(node.params);
    const body=this.genBlock(node.body,pad);
    if(!node.name) return `${p}${a}function(${params}) ${body}`;
    return `${p}${a}function ${node.name}(${params}) ${body}\n`;
  }
  genParams(params) {
    return (params||[]).map(p=>{
      let s=p.rest?`...${p.name}`:p.name;
      if(p.defaultVal!==null&&p.defaultVal!==undefined) s+=` = ${this.genExpr(p.defaultVal)}`;
      return s;
    }).join(', ');
  }
  genClassDecl(node, pad) {
    const p=this.pad(pad);
    const ext=node.superClass?` extends ${typeof node.superClass==='object'&&node.superClass.kind?node.superClass.kind==='type'?node.superClass.expr:String(node.superClass):String(node.superClass)}`:'';
    const lines=[`${p}class ${node.name||''}${ext} {\n`];
    const fields=[], methods=[], staticBlocks=[];
    for (const m of (node.members||[])) {
      if(m.kind==='field') fields.push(m);
      else if(m.kind==='method') methods.push(m);
    }
    for (const f of fields) {
      if(f.isStatic) {
        const init=f.init?` = ${this.genExpr(f.init)}`:'';
        lines.push(`${p}  static ${typeof f.name==='object'&&f.name.computed?'['+this.genExpr(f.name.expr)+']':f.name}${init};\n`);
      } else {
        const init=f.init?` = ${this.genExpr(f.init)}`:'';
        lines.push(`${p}  ${typeof f.name==='object'&&f.name.computed?'['+this.genExpr(f.name.expr)+']':f.name}${init};\n`);
      }
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
    return `${p}const ${node.name} = (function() {\n${body}${p}  const __exports = {};\n${p}  return __exports;\n${p}})();\n`;
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
    const subj=`_ntl_m${node.line||Math.floor(Math.random()*9999)}`;
    const lines=[`${p}{\n`, `${p}  const ${subj} = ${this.genExpr(node.subject)};\n`];
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
        const hasBindings = mc.patterns.some(p=>p.kind==='object'||p.kind==='array'||p.kind==='binding'||p.kind==='variant');
        if(bindDecls.length>0||mc.guard||hasBindings) {
          lines.push(`${p}  ${kw} (${conds.join(' || ')}) {\n`);
          for(const bd of bindDecls) lines.push(`${p}    ${bd}\n`);
          if(mc.guard) {
            lines.push(`${p}    if(${this.genExpr(mc.guard)}) {\n`);
            if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+4)); }
            else lines.push(this.genStmt(mc.body,pad+4));
            lines.push(`${p}    }\n`);
          } else {
            if(mc.body.type==='Block'){ for(const s of (mc.body.body||[])) lines.push(this.genStmt(s,pad+2)); }
            else lines.push(this.genStmt(mc.body,pad+2));
          }
          lines.push(`${p}  }\n`);
        } else {
          lines.push(`${p}  ${kw} (${conds.join(' || ')}${guard}) ${this.genBlock(mc.body,pad+2)}\n`);
        }
      }
      first=false;
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
      case 'enumVal': {
        const parts=pat.path.split('.');
        if(parts.length===1) return `${subj} === ${pat.path}`;
        return `${subj} === ${pat.path}`;
      }
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
  genMatchBindings(subj, pat, pad) {
    const p=this.pad(pad);
    const bindings=[];
    if(!pat) return '';
    switch(pat.kind) {
      case 'binding': bindings.push(`${p}const ${pat.name} = ${subj};\n`); break;
      case 'variant': pat.fields.forEach((f,i)=>{ bindings.push(this.genMatchBindings(`${subj}._${i}`,f,pad)); }); break;
      case 'array': pat.items.forEach((item,i)=>{ if(item) bindings.push(this.genMatchBindings(`${subj}[${i}]`,item,pad)); }); break;
      case 'object': for(const prop of pat.props) { if(prop.alias&&prop.alias!==prop.key) bindings.push(`${p}const ${prop.alias} = ${subj}.${prop.key};\n`); } break;
    }
    return bindings.join('');
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
  genImport(node, pad) {
    const p=this.pad(pad);
    if(node.typeOnly) return '';
    const parts=[];
    if(node.namespace) return `${p}const ${node.namespace} = require(${JSON.stringify(node.source)});\n`;
    if(node.defaultImport&&!node.specifiers?.length) return `${p}const ${node.defaultImport} = require(${JSON.stringify(node.source)});\n`;
    if(node.defaultImport&&node.specifiers?.length) {
      parts.push(`${p}const ${node.defaultImport} = require(${JSON.stringify(node.source)});\n`);
      const specs=node.specifiers.map(s=>s.imported===s.local?s.imported:`${s.imported}: ${s.local}`).join(', ');
      parts.push(`${p}const { ${specs} } = require(${JSON.stringify(node.source)});\n`);
      return parts.join('');
    }
    if(node.specifiers?.length) {
      const specs=node.specifiers.map(s=>s.imported===s.local?s.imported:`${s.imported}: ${s.local}`).join(', ');
      return `${p}const { ${specs} } = require(${JSON.stringify(node.source)});\n`;
    }
    return `${p}require(${JSON.stringify(node.source)});\n`;
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
    const { generateNTLModuleImports } = require('./module-resolver');
    return p+generateNTLModuleImports(node.modules)+'\n';
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
  genIfSet(node, pad) {
    const p=this.pad(pad);
    const expr=this.genExpr(node.expr);
    const alias=node.alias||'_ntl_ifset';
    let s=`${p}const ${alias} = ${expr};\n${p}if (${alias} !== null && ${alias} !== undefined) ${this.genBlock(node.consequent,pad)}\n`;
    if(node.alternate) s+=`${p}else ${this.genBlock(node.alternate,pad)}\n`;
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
      case 'NumberLit':   return typeof node.value==='bigint'?String(node.value)+'n':JSON.stringify(node.value);
      case 'StringLit':   return JSON.stringify(node.value);
      case 'BoolLit':     return String(node.value);
      case 'NullLit':     return 'null';
      case 'UndefinedLit':return 'undefined';
      case 'VoidExpr':    return `void ${this.genExpr(node.arg)}`;
      case 'ThisExpr':    return 'this';
      case 'SuperExpr':   return 'super';
      case 'Identifier':  return node.name;
      case 'TemplateLit': return this.genTemplate(node);
      case 'ArrayLit': {
        const els=(node.elements||[]).map(e=>e?this.genExpr(e):'');
        return `[${els.join(', ')}]`;
      }
      case 'ObjectLit': return this.genObjectLit(node);
      case 'FnExpr':case 'FnDecl': return this.genFnExpr(node);
      case 'ArrowFn': return this.genArrowFn(node);
      case 'MemberExpr': {
        const obj=this.genExpr(node.object);
        const opt=node.optional?'?.':'.';
        if(node.computed) return `${obj}${node.optional?'?.[':  '['}${this.genExpr(node.prop)}]`;
        return `${obj}${opt}${node.prop}`;
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
        return `${l} ${node.op} ${r}`;
      }
      case 'UnaryExpr': {
        const arg=this.genExpr(node.arg);
        if(node.prefix!==false&&(node.op==='++'||node.op==='--')) return `${node.op}${arg}`;
        if(node.op==='++'||node.op==='--') return `${arg}${node.op}`;
        const needSpace=['typeof','void','delete','throw'].includes(node.op);
        return needSpace?`${node.op} ${arg}`:`${node.op}${arg}`;
      }
      case 'AssignExpr':  return `${this.genExpr(node.left)} ${node.op} ${this.genExpr(node.right)}`;
      case 'TernaryExpr': return `${this.genExprParens(node.test,{precedence:4})} ? ${this.genExpr(node.consequent)} : ${this.genExpr(node.alternate)}`;
      case 'AwaitExpr':   return `await ${this.genExpr(node.arg)}`;
      case 'YieldExpr':   return `yield${node.delegate?'*':''} ${this.genExpr(node.arg)}`;
      case 'SpreadExpr':  return `...${this.genExpr(node.arg)}`;
      case 'PipelineExpr':return this.genPipeline(node);
      case 'SequenceExpr':return `(${(node.exprs||[]).map(e=>this.genExpr(e)).join(', ')})`;
      case 'HaveExpr':    return `(${this.genExpr(node.value)} !== null && ${this.genExpr(node.value)} !== undefined)`;
      case 'RequireExpr': return `require(${JSON.stringify(node.source)})`;
      case 'NTLRequireExpr': {
        const {generateNTLModuleImports}=require('./module-resolver');
        return ``;
      }
      case 'ChannelExpr': return `{ _queue: [], _listeners: [], send(v) { if (this._listeners.length) { this._listeners.shift()(v); } else { this._queue.push(v); } }, receive() { return new Promise(r => { if (this._queue.length) r(this._queue.shift()); else this._listeners.push(r); }) } }`;
      case 'BindingExpr': return `${this.genExpr(node.object)}.${node.method}.bind(${this.genExpr(node.object)})`;
      case 'SatisfiesExpr': return this.genExpr(node.expr);
      case 'DecoratedExpr': return this.genExpr(node.expr||node.stmt);
      default: if(node.name) return node.name; if(node.value!==undefined) return JSON.stringify(node.value); return '';
    }
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
    const params=this.genParams(node.params);
    const body=this.genBlock(node.body,0);
    return `${a}function${node.name?' '+node.name:''}(${params}) ${body}`;
  }
  genArrowFn(node) {
    const a=node.isAsync?'async ':'';
    const params=this.genParams(node.params);
    const paramStr=node.params&&node.params.length===1&&!node.params[0].rest&&!node.params[0].defaultVal&&!node.params[0].typeAnn?node.params[0].name:`(${params})`;
    if(node.body.type==='Block') return `${a}${paramStr} => ${this.genBlock(node.body,0)}`;
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
