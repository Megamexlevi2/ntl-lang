'use strict';
class Type {
  constructor(kind, data) { this.kind=kind; Object.assign(this,data||{}); }
  toString() {
    switch(this.kind) {
      case 'primitive': return this.name;
      case 'union':     return this.types.map(t=>t.toString()).join(' | ');
      case 'array':     return this.elem.toString()+'[]';
      case 'tuple':     return '[ '+this.elems.map(t=>t.toString()).join(', ')+' ]';
      case 'object':    return '{ '+Object.entries(this.fields||{}).map(([k,v])=>`${k}: ${v}`).join(', ')+' }';
      case 'fn':        return `(${(this.params||[]).map(p=>p.type||'any').join(', ')}) -> ${this.ret||'any'}`;
      case 'class':     return this.name;
      case 'generic':   return `${this.name}<${(this.args||[]).join(', ')}>`;
      case 'literal':   return JSON.stringify(this.value);
      case 'null':      return 'null';
      case 'undefined': return 'undefined';
      case 'unknown':   return 'unknown';
      case 'never':     return 'never';
      case 'any':
      default:          return 'any';
    }
  }
  static any()        { return new Type('any'); }
  static never()      { return new Type('never'); }
  static unknown()    { return new Type('unknown'); }
  static prim(name)   { return new Type('primitive',{name}); }
  static literal(v)   { return new Type('literal',{value:v}); }
  static array(elem)  { return new Type('array',{elem}); }
  static union(...ts)  {
    const flat=ts.flatMap(t=>t.kind==='union'?t.types:[t]);
    const deduped=[];
    for(const t of flat) {
      if(!deduped.some(d=>d.toString()===t.toString())) deduped.push(t);
    }
    if(deduped.length===1) return deduped[0];
    return new Type('union',{types:deduped});
  }
  static fn(params,ret) { return new Type('fn',{params,ret}); }
  static obj(fields)  { return new Type('object',{fields}); }
  static cls(name,fields,methods) { return new Type('class',{name,fields:fields||{},methods:methods||{}}); }
}
const T_number  = Type.prim('number');
const T_string  = Type.prim('string');
const T_boolean = Type.prim('boolean');
const T_void    = Type.prim('void');
const T_any     = Type.any();
const T_null    = new Type('null');
const T_undefined = new Type('undefined');
const T_bigint  = Type.prim('bigint');
const GLOBAL_TYPES = {
  number:  T_number,
  string:  T_string,
  boolean: T_boolean,
  void:    T_void,
  any:     T_any,
  never:   Type.never(),
  unknown: Type.unknown(),
  null:    T_null,
  undefined: T_undefined,
  bigint:  T_bigint,
  object:  Type.prim('object'),
  symbol:  Type.prim('symbol'),
};
class TypeEnv {
  constructor(parent) { this.parent=parent||null; this.vars=new Map(); this.types=new Map(); }
  setVar(name,type) { this.vars.set(name,type); }
  getVar(name) {
    if(this.vars.has(name)) return this.vars.get(name);
    if(this.parent) return this.parent.getVar(name);
    return null;
  }
  setType(name,type) { this.types.set(name,type); }
  getType(name) {
    if(this.types.has(name)) return this.types.get(name);
    if(this.parent) return this.parent.getType(name);
    return GLOBAL_TYPES[name]||null;
  }
  child() { return new TypeEnv(this); }
}
class TypeInferer {
  constructor() {
    this.errors=[];
    this.warnings=[];
    this.env=new TypeEnv();
    this._setupGlobals();
    this.strict=false;
    this.inferredTypes=new Map();
  }
  _setupGlobals() {
    this.env.setVar('console', Type.obj({log:Type.fn([],T_void),error:Type.fn([],T_void),warn:Type.fn([],T_void),info:Type.fn([],T_void)}));
    this.env.setVar('Math', Type.obj({abs:Type.fn([],T_number),ceil:Type.fn([],T_number),floor:Type.fn([],T_number),round:Type.fn([],T_number),sqrt:Type.fn([],T_number),max:Type.fn([],T_number),min:Type.fn([],T_number),random:Type.fn([],T_number),PI:T_number,E:T_number}));
    this.env.setVar('JSON', Type.obj({parse:Type.fn([],T_any),stringify:Type.fn([],T_string)}));
    this.env.setVar('Date', Type.fn([],T_any));
    this.env.setVar('Promise', Type.fn([],T_any));
    this.env.setVar('Object', Type.obj({keys:Type.fn([],Type.array(T_string)),values:Type.fn([],Type.array(T_any)),entries:Type.fn([],Type.array(T_any)),assign:Type.fn([],T_any),freeze:Type.fn([],T_any),create:Type.fn([],T_any)}));
    this.env.setVar('Array', Type.obj({from:Type.fn([],T_any),isArray:Type.fn([],T_boolean)}));
    this.env.setVar('Error', Type.fn([],T_any));
    this.env.setVar('process', Type.obj({env:Type.obj({}),argv:Type.array(T_string),exit:Type.fn([],T_void),cwd:Type.fn([],T_string),stdout:T_any,stderr:T_any}));
    this.env.setVar('require', Type.fn([],T_any));
    for(const [k,v] of Object.entries(GLOBAL_TYPES)) this.env.setType(k,v);
  }
  parseTypeStr(s) {
    if(!s||s==='any') return T_any;
    if(GLOBAL_TYPES[s]) return GLOBAL_TYPES[s];
    if(s.endsWith('[]')) return Type.array(this.parseTypeStr(s.slice(0,-2)));
    if(s.includes('|')) return Type.union(...s.split('|').map(t=>this.parseTypeStr(t.trim())));
    return Type.prim(s);
  }
  infer(ast) {
    if(!ast) return T_any;
    const env=this.env;
    for(const stmt of (ast.body||[])) this._hoistDecls(stmt,env);
    for(const stmt of (ast.body||[])) this.inferStmt(stmt,env);
    return T_void;
  }
  _hoistDecls(node,env) {
    if(!node) return;
    if(node.type==='FnDecl') {
      const params=(node.params||[]).map(p=>({name:p.name,type:p.typeAnn?this.parseTypeStr(p.typeAnn):T_any}));
      const ret=node.returnType?this.parseTypeStr(node.returnType):T_any;
      const ft=Type.fn(params,ret);
      env.setVar(node.name,node.isAsync?Type.obj({then:Type.fn([],T_any)}):ft);
    }
    if(node.type==='ClassDecl'&&node.name) {
      const fields={}, methods={};
      for(const m of (node.members||[])) {
        if(m.kind==='field') fields[m.name]=m.typeAnn?this.parseTypeStr(m.typeAnn):T_any;
        if(m.kind==='method') {
          const rt=m.returnType?this.parseTypeStr(m.returnType):T_any;
          methods[m.name]=Type.fn((m.params||[]).map(p=>({name:p.name,type:p.typeAnn?this.parseTypeStr(p.typeAnn):T_any})),rt);
        }
      }
      env.setVar(node.name,Type.cls(node.name,fields,methods));
    }
    if(node.type==='EnumDecl') {
      const obj={};
      node.members.forEach((m,i)=>{ obj[m.name]=Type.literal(i); });
      env.setVar(node.name,Type.obj(obj));
    }
    if(node.type==='InterfaceDecl') {
      const fields={};
      for(const m of (node.members||[])) {
        if(m.kind==='field') fields[m.name]=m.typeAnn?this.parseTypeStr(m.typeAnn):T_any;
        if(m.kind==='method') fields[m.name]=Type.fn((m.params||[]).map(p=>({name:p.name,type:p.typeAnn?this.parseTypeStr(p.typeAnn):T_any})),m.returnType?this.parseTypeStr(m.returnType):T_any);
      }
      env.setType(node.name,Type.obj(fields));
    }
    if(node.type==='TypeAlias'&&node.name) {
      if(node.typeExpr&&node.typeExpr.kind==='type') env.setType(node.name,this.parseTypeStr(node.typeExpr.expr));
    }
  }
  inferStmt(node,env) {
    if(!node) return T_void;
    env=env||this.env;
    switch(node.type) {
      case 'VarDecl': return this.inferVarDecl(node,env);
      case 'MultiVarDecl': node.declarations.forEach(d=>this.inferVarDecl(Object.assign({type:'VarDecl'},d),env)); return T_void;
      case 'FnDecl': return this.inferFnDecl(node,env);
      case 'ClassDecl': return this.inferClassDecl(node,env);
      case 'InterfaceDecl': return T_void;
      case 'TypeAlias': return T_void;
      case 'EnumDecl': return T_void;
      case 'NamespaceDecl': { const ne=env.child(); node.body.forEach(s=>this.inferStmt(s,ne)); return T_void; }
      case 'ExprStmt': return this.inferExpr(node.expr,env);
      case 'ReturnStmt': return node.value?this.inferExpr(node.value,env):T_void;
      case 'ThrowStmt': return Type.never();
      case 'IfStmt': case 'UnlessStmt': return this.inferIf(node,env);
      case 'WhileStmt': case 'DoWhileStmt': case 'LoopStmt': return T_void;
      case 'ForOfStmt': return this.inferForOf(node,env);
      case 'ForInStmt': return T_void;
      case 'TryStmt': return this.inferTry(node,env);
      case 'MatchStmt': return this.inferMatch(node,env);
      case 'Block': { const be=env.child(); node.body.forEach(s=>this.inferStmt(s,be)); return T_void; }
      case 'BreakStmt': case 'ContinueStmt': return T_void;
      case 'ImportDecl': { env.setVar(node.defaultImport||node.namespace||'_',T_any); return T_void; }
      case 'ExportDecl': return node.declaration?this.inferStmt(node.declaration,env):T_void;
      case 'NTLRequire': { node.modules.forEach(m=>env.setVar(m,T_any)); return T_void; }
      case 'ImmutableDecl': return this.inferStmt(node.decl,env);
      case 'IfSetStmt': {
        const t=this.inferExpr(node.expr,env);
        const ie=env.child();
        if(node.alias) ie.setVar(node.alias,t);
        this.inferStmt(node.consequent,ie);
        if(node.alternate) this.inferStmt(node.alternate,env.child());
        return T_void;
      }
      default: return T_any;
    }
  }
  inferVarDecl(node,env) {
    let type=T_any;
    if(node.init) {
      type=this.inferExpr(node.init,env);
      if(node.typeAnn) {
        const ann=this.parseTypeStr(node.typeAnn);
        if(this.strict&&!this.isAssignable(type,ann)) {
          this.errors.push({message:`Type '${type}' is not assignable to type '${ann}'`,line:node.line,code:'TYPE_MISMATCH'});
        }
        type=ann;
      }
    } else if(node.typeAnn) {
      type=this.parseTypeStr(node.typeAnn);
    }
    if(node.name) {
      env.setVar(node.name,type);
      this.inferredTypes.set(node.name,type);
    }
    if(node.destructure) this._inferDestructure(node.destructure,type,env);
    return type;
  }
  _inferDestructure(d,type,env) {
    if(d.kind==='object') {
      for(const p of d.props) {
        if(p.nested) { this._inferDestructure(p.nested,T_any,env); continue; }
        env.setVar(p.alias||p.name,T_any);
      }
    } else if(d.kind==='array') {
      for(const item of d.items) {
        if(!item) continue;
        if(item.nested) { this._inferDestructure(item.nested,T_any,env); continue; }
        if(item.name) env.setVar(item.name,type.kind==='array'?type.elem:T_any);
      }
    }
  }
  inferFnDecl(node,env) {
    const fe=env.child();
    const params=(node.params||[]).map(p=>{
      const pt=p.typeAnn?this.parseTypeStr(p.typeAnn):T_any;
      fe.setVar(p.name,pt);
      return {name:p.name,type:pt};
    });
    const retAnn=node.returnType?this.parseTypeStr(node.returnType):null;
    if(node.body) this.inferStmt(node.body,fe);
    const ret=retAnn||T_any;
    const ft=Type.fn(params,ret);
    if(node.name) env.setVar(node.name,ft);
    return ft;
  }
  inferClassDecl(node,env) {
    const ce=env.child();
    const fields={},methods={};
    for(const m of (node.members||[])) {
      if(m.kind==='field') {
        const ft=m.typeAnn?this.parseTypeStr(m.typeAnn):m.init?this.inferExpr(m.init,ce):T_any;
        fields[m.name]=ft; ce.setVar(String(m.name),ft);
      }
      if(m.kind==='method') {
        const me=ce.child();
        const params=(m.params||[]).map(p=>{const pt=p.typeAnn?this.parseTypeStr(p.typeAnn):T_any; me.setVar(p.name,pt); return {name:p.name,type:pt};});
        if(m.body) this.inferStmt(m.body,me);
        const rt=m.returnType?this.parseTypeStr(m.returnType):T_any;
        methods[String(m.name)]=Type.fn(params,rt);
      }
    }
    if(node.name) env.setVar(node.name,Type.cls(node.name,fields,methods));
    return T_void;
  }
  inferIf(node,env) {
    this.inferExpr(node.test,env);
    this.inferStmt(node.consequent,env.child());
    if(node.alternate) this.inferStmt(node.alternate,env.child());
    return T_void;
  }
  inferForOf(node,env) {
    const iter=this.inferExpr(node.iterable,env);
    const fe=env.child();
    const elemType=iter.kind==='array'?iter.elem:T_any;
    if(node.id) fe.setVar(node.id,elemType);
    this.inferStmt(node.body,fe);
    return T_void;
  }
  inferTry(node,env) {
    this.inferStmt(node.block,env.child());
    if(node.catchBlock) {
      const ce=env.child();
      if(node.catchParam) ce.setVar(node.catchParam,T_any);
      this.inferStmt(node.catchBlock,ce);
    }
    if(node.finallyBlock) this.inferStmt(node.finallyBlock,env.child());
    return T_void;
  }
  inferMatch(node,env) {
    this.inferExpr(node.subject,env);
    for(const c of (node.cases||[])) {
      const ce=env.child();
      this.inferStmt(c.body,ce);
    }
    return T_any;
  }
  inferExpr(node,env) {
    if(!node) return T_any;
    env=env||this.env;
    switch(node.type) {
      case 'NumberLit':  return typeof node.value==='bigint'?T_bigint:T_number;
      case 'StringLit':  return T_string;
      case 'BoolLit':    return T_boolean;
      case 'NullLit':    return T_null;
      case 'UndefinedLit': return T_undefined;
      case 'TemplateLit':return T_string;
      case 'ArrayLit': {
        const elems=(node.elements||[]).filter(Boolean).map(e=>this.inferExpr(e,env));
        const elem=elems.length?Type.union(...elems):T_any;
        return Type.array(elem);
      }
      case 'ObjectLit': {
        const fields={};
        for(const p of (node.props||[])) {
          if(p.kind==='prop') fields[p.key]=this.inferExpr(p.value,env);
          else if(p.kind==='shorthand') fields[p.key]=env.getVar(p.key)||T_any;
        }
        return Type.obj(fields);
      }
      case 'Identifier': {
        const t=env.getVar(node.name);
        if(!t&&this.strict) this.warnings.push({message:`'${node.name}' may be undefined`,line:node.line,code:'MAYBE_UNDEF'});
        return t||T_any;
      }
      case 'BinaryExpr': return this.inferBinary(node,env);
      case 'UnaryExpr': {
        if(node.op==='typeof') return T_string;
        if(node.op==='!'||node.op==='~') return node.op==='!'?T_boolean:T_number;
        return this.inferExpr(node.arg,env);
      }
      case 'AssignExpr': {
        const right=this.inferExpr(node.right,env);
        if(node.left.type==='Identifier') {
          const existing=env.getVar(node.left.name);
          if(existing&&this.strict&&node.op==='=') {
            if(!this.isAssignable(right,existing)&&existing.kind!=='any') {
              this.errors.push({message:`Type '${right}' is not assignable to '${existing}'`,line:node.line,code:'TYPE_MISMATCH'});
            }
          }
        }
        return right;
      }
      case 'TernaryExpr': {
        const c=this.inferExpr(node.consequent,env);
        const a=this.inferExpr(node.alternate,env);
        return Type.union(c,a);
      }
      case 'CallExpr': return this.inferCall(node,env);
      case 'NewExpr': {
        const callee=this.inferExpr(node.callee,env);
        if(callee.kind==='class') return callee;
        return T_any;
      }
      case 'MemberExpr': return this.inferMember(node,env);
      case 'ArrowFn': case 'FnExpr': {
        const fe=env.child();
        const params=(node.params||[]).map(p=>{ const pt=p.typeAnn?this.parseTypeStr(p.typeAnn):T_any; fe.setVar(p.name,pt); return {name:p.name,type:pt}; });
        const ret=node.returnType?this.parseTypeStr(node.returnType):T_any;
        if(node.body) node.body.type==='Block'?this.inferStmt(node.body,fe):this.inferExpr(node.body,fe);
        return Type.fn(params,ret);
      }
      case 'AwaitExpr': return T_any;
      case 'PipelineExpr': return T_any;
      case 'SpreadExpr':   return T_any;
      case 'HaveExpr':     return T_boolean;
      case 'RequireExpr':  return T_any;
      case 'SequenceExpr': {
        const exprs=node.exprs||[];
        return exprs.length?this.inferExpr(exprs[exprs.length-1],env):T_void;
      }
      default: return T_any;
    }
  }
  inferBinary(node,env) {
    const l=this.inferExpr(node.left,env);
    const r=this.inferExpr(node.right,env);
    const op=node.op;
    if(['+','-','*','/','%','**','<<','>>','>>>','&','|','^'].includes(op)) {
      if(op==='+') {
        if(l.kind==='primitive'&&l.name==='string') return T_string;
        if(r.kind==='primitive'&&r.name==='string') return T_string;
        return T_number;
      }
      return T_number;
    }
    if(['===','!==','==','!=','<','>','<=','>=','instanceof','in'].includes(op)) return T_boolean;
    if(['&&','||'].includes(op)) return Type.union(l,r);
    if(op==='??') return Type.union(l.kind==='null'||l.kind==='undefined'?Type.never():l,r);
    return T_any;
  }
  inferCall(node,env) {
    const callee=this.inferExpr(node.callee,env);
    if(callee.kind==='fn') return this.parseTypeStr(callee.ret)||T_any;
    if(callee.kind==='class') return callee;
    return T_any;
  }
  inferMember(node,env) {
    const obj=this.inferExpr(node.object,env);
    const prop=node.computed?null:node.prop;
    if(!prop) return T_any;
    if(obj.kind==='object'&&obj.fields&&obj.fields[prop]) return obj.fields[prop];
    if(obj.kind==='class'&&obj.fields&&obj.fields[prop]) return obj.fields[prop];
    if(obj.kind==='class'&&obj.methods&&obj.methods[prop]) return obj.methods[prop];
    if(obj.kind==='array') {
      if(prop==='length') return T_number;
      if(['push','pop','shift','unshift','splice','slice','concat','map','filter','reduce','forEach','find','findIndex','includes','indexOf','some','every','flat','flatMap','sort','reverse','join'].includes(prop)) return T_any;
    }
    if(obj.kind==='primitive'&&obj.name==='string') {
      if(['length'].includes(prop)) return T_number;
      if(['toUpperCase','toLowerCase','trim','trimStart','trimEnd','replace','replaceAll','split','includes','startsWith','endsWith','indexOf','slice','substring','padStart','padEnd','repeat'].includes(prop)) return T_any;
    }
    return T_any;
  }
  isAssignable(from,to) {
    if(!from||!to) return true;
    if(to.kind==='any'||from.kind==='any') return true;
    if(to.kind==='unknown') return true;
    if(from.kind==='never') return true;
    if(from.toString()===to.toString()) return true;
    if(to.kind==='union') return to.types.some(t=>this.isAssignable(from,t));
    if(from.kind==='union') return from.types.every(t=>this.isAssignable(t,to));
    if(from.kind==='literal') {
      if(to.kind==='primitive') {
        if(to.name==='number'&&typeof from.value==='number') return true;
        if(to.name==='string'&&typeof from.value==='string') return true;
        if(to.name==='boolean'&&typeof from.value==='boolean') return true;
      }
    }
    return false;
  }
  check(ast,opts) {
    this.strict=opts&&opts.strict;
    this.errors=[];
    this.warnings=[];
    this.infer(ast);
    return {errors:this.errors,warnings:this.warnings,inferredTypes:this.inferredTypes};
  }
}
module.exports = { TypeInferer, Type, T_number, T_string, T_boolean, T_void, T_any };
