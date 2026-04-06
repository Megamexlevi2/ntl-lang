'use strict';
const { TokenType } = require('./lexer');
class ASTNode {
  constructor(type, data, line, col) {
    this.type = type;
    Object.assign(this, data||{});
    this.line = line||0; this.col = col||0;
  }
}
class Parser {
  constructor(tokens, filename) {
    this.tokens = tokens;
    this.filename = filename||'<unknown>';
    this.pos = 0;
    this._deferCounter = 0;
    this._ifsetCounter = 0;
  }
  peek(o)  { return this.tokens[this.pos+(o||0)]||{type:TokenType.EOF,value:null}; }
  advance(){ return this.tokens[this.pos++]||{type:TokenType.EOF,value:null}; }
  check(type,val) { const t=this.peek(); return t.type===type&&(val===undefined||t.value===val); }
  eat(type,val) {
    const t=this.peek();
    if (t.type!==type||(val!==undefined&&t.value!==val)) {
      this.parseError(`Expected ${val?`'${val}'`:type}, got ${t.type==='EOF'?'end of file':`'${t.value}'`}`, t.line, t.col);
    }
    return this.advance();
  }
  eatIf(type,val) { if(this.check(type,val)){this.advance();return true;} return false; }
  eatIfKw(kw) { return this.eatIf(TokenType.KEYWORD,kw); }
  checkKw(kw) { return this.check(TokenType.KEYWORD,kw); }
  parseError(msg,line,col) {
    const t=this.peek();
    throw Object.assign(new Error(msg+`\n  --> ${this.filename}:${line||t.line}:${col||t.col}`),{
      ntlError:true, phase:'parse', line:line||t.line, col:col||t.col, file:this.filename
    });
  }
  isLineEnd() {
    const t=this.peek();
    return t.type===TokenType.EOF||t.type===TokenType.PUNCTUATION&&t.value===';'||
           (this.pos>0&&this.tokens[this.pos-1]&&this.peek().line>(this.tokens[this.pos-1].line||0));
  }
  eatSemi() { this.eatIf(TokenType.PUNCTUATION,';'); }
  parse() {
    const body=[];
    while (!this.check(TokenType.EOF)) {
      const stmt=this.parseStmt();
      if(stmt) body.push(stmt);
    }
    return new ASTNode('Program',{body},1,1);
  }
  parseStmt() {
    this.eatSemi();
    if (this.check(TokenType.EOF)) return null;
    const t=this.peek();
    if (t.type===TokenType.KEYWORD) {
      switch(t.value) {
        case 'var':case 'let': return this.parseVarDecl(false);
        case 'val':case 'const': {
          const _p1 = this.peek(1); const _p2 = this.peek(2); const _p3 = this.peek(3);
          if (_p1 && _p1.value === 'require' && _p2 && _p2.value === '(' && _p3 && _p3.value === 'ntl') {
            this.advance(); return this.parseNTLRequire();
          }
          return this.parseVarDecl(true);
        }
        case 'fn': { this.advance(); return this.parseFnDecl(false, {fnAlreadyEaten: true}); }
        case 'async': {
          if (this.peek(1).value==='fn') { this.advance(); this.advance(); return this.parseFnDecl(true, {fnAlreadyEaten: true}); }
          break;
        }
        case 'class': return this.parseClassDecl();
        case 'abstract': {
          this.advance();
          if (this.checkKw('class')) return this.parseClassDecl(true);
          this.parseError("Expected 'class' after 'abstract'");
          break;
        }
        case 'interface': return this.parseInterface();
        case 'trait':     return this.parseTrait();
        case 'macro':     return this.parseMacro();
        case 'type':case 'alias': return this.parseTypeAlias();
        case 'enum':      return this.parseEnum();
        case 'if':        return this.parseIf();
        case 'unless':    return this.parseUnless();
        case 'while':     return this.parseWhile();
        case 'do':        return this.parseDoWhile();
        case 'for':       return this.parseFor();
        case 'each':      return this.parseEach();
        case 'loop':      return this.parseLoop();
        case 'return':    return this.parseReturn();
        case 'throw':case 'raise': return this.parseThrow();
        case 'try':       return this.parseTry();
        case 'match':     return this.parseMatch();
        case 'break':     this.advance(); this.eatSemi(); return new ASTNode('BreakStmt',{},t.line,t.col);
        case 'continue':  this.advance(); this.eatSemi(); return new ASTNode('ContinueStmt',{},t.line,t.col);
        case 'import':    return this.parseImport();
        case 'export':    return this.parseExport();
        case 'require':   return this.parseNTLRequire();
        case 'spawn':     return this.parseSpawn();
        case 'select':    return this.parseSelect();
        case 'immutable': return this.parseImmutable();
        case 'namespace': return this.parseNamespace();
        case 'with':      return this.parseWith();
        case 'ifset':     return this.parseIfSet();
        case 'ifhave':    return this.parseIfHave();
        case 'have':      return this.parseHaveStmt();
        case 'using':     return this.parseUsing();
        case 'declare':   return this.parseDeclare();
        case 'component': return this.parseComponent();
        case 'repeat':    return this.parseRepeat();
        case 'guard':     return this.parseGuard();
        case 'defer':     return this.parseDefer();
        case 'log': {
          if (this.peek(1) && this.peek(1).value === '.') break;
          return this.parseLog();
        }
        case 'assert':    return this.parseAssert();
        case 'sleep':     return this.parseSleep();
      }
    }
    return this.parseExprStatement();
  }
  parseVarDecl(isConst) {
    const t=this.advance(); const declarations=[];
    do {
      let name=null, typeAnn=null, init=null, destructure=null;
      if (this.check(TokenType.PUNCTUATION,'{')) {
        destructure=this.parseObjDestructure();
      } else if (this.check(TokenType.PUNCTUATION,'[')) {
        destructure=this.parseArrDestructure();
      } else {
        name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected variable name');
        if (this.check(TokenType.OPERATOR,':')) { this.advance(); typeAnn=this.parseTypeExpr(); }
      }
      if (this.eatIf(TokenType.OPERATOR,'=')) init=this.parseExpr();
      declarations.push({name,typeAnn,init,destructure,isConst});
    } while(this.eatIf(TokenType.PUNCTUATION,','));
    this.eatSemi();
    if (declarations.length===1) return new ASTNode('VarDecl',declarations[0],t.line,t.col);
    return new ASTNode('MultiVarDecl',{declarations,isConst},t.line,t.col);
  }
  parseObjDestructure() {
    this.eat(TokenType.PUNCTUATION,'{'); const props=[];
    while (!this.check(TokenType.PUNCTUATION,'}')) {
      if (this.check(TokenType.OPERATOR,'...')) { this.advance(); props.push({name:this.eat(TokenType.IDENTIFIER).value,rest:true}); this.eatIf(TokenType.PUNCTUATION,','); continue; }
      let key, alias=null, nested=null, defaultVal=null;
      if (this.check(TokenType.PUNCTUATION,'[')) { this.advance(); key=this.parseExpr(); this.eat(TokenType.PUNCTUATION,']'); }
      else { key=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected property name'); }
      if (this.eatIf(TokenType.OPERATOR,':')) {
        if (this.check(TokenType.PUNCTUATION,'{')) nested=this.parseObjDestructure();
        else if (this.check(TokenType.PUNCTUATION,'[')) nested=this.parseArrDestructure();
        else alias=this.eat(TokenType.IDENTIFIER).value;
      }
      if (this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
      props.push({name:key,alias:alias||key,nested,defaultVal});
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return {kind:'object',props};
  }
  parseArrDestructure() {
    this.eat(TokenType.PUNCTUATION,'['); const items=[];
    while (!this.check(TokenType.PUNCTUATION,']')) {
      if (this.check(TokenType.PUNCTUATION,',')) { items.push(null); this.advance(); continue; }
      if (this.check(TokenType.OPERATOR,'...')) { this.advance(); items.push({name:this.eat(TokenType.IDENTIFIER).value,rest:true}); this.eatIf(TokenType.PUNCTUATION,','); continue; }
      let name, defaultVal=null, nested=null;
      if (this.check(TokenType.PUNCTUATION,'{')) nested=this.parseObjDestructure();
      else if (this.check(TokenType.PUNCTUATION,'[')) nested=this.parseArrDestructure();
      else name=this.eat(TokenType.IDENTIFIER).value;
      if (this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
      items.push({name,defaultVal,nested});
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,']');
    return {kind:'array',items};
  }
  parseTypeExpr() {
    let base='';
    if (this.check(TokenType.PUNCTUATION,'(')) {
      this.advance(); const params=[]; let returnType=null;
      while(!this.check(TokenType.PUNCTUATION,')')){
        const pname=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'_';
        if(this.eatIf(TokenType.OPERATOR,':'))this.parseTypeExpr();
        this.eatIf(TokenType.PUNCTUATION,',');
      }
      this.eat(TokenType.PUNCTUATION,')');
      if(this.eatIf(TokenType.OPERATOR,'=>')||this.eatIf(TokenType.OPERATOR,'->')) returnType=this.parseTypeExpr();
      return `(${params.join(',')}) => ${returnType||'any'}`;
    }
    if (this.check(TokenType.PUNCTUATION,'{')) {
      this.advance(); let s='{';
      while(!this.check(TokenType.PUNCTUATION,'}')&&!this.check(TokenType.EOF)){
        const k=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'';
        const opt=this.eatIf(TokenType.OPERATOR,'?')?'?':'';
        this.eat(TokenType.OPERATOR,':');
        const vt=this.parseTypeExpr();
        s+=`${k}${opt}:${vt};`;
        this.eatIf(TokenType.PUNCTUATION,',');
        this.eatIf(TokenType.PUNCTUATION,';');
      }
      this.eat(TokenType.PUNCTUATION,'}');
      return s+'}';
    }
    if (this.checkKw('typeof')) { this.advance(); return 'typeof '+this.parseTypeExpr(); }
    if (this.checkKw('keyof'))  { this.advance(); return 'keyof '+this.parseTypeExpr(); }
    if (this.checkKw('infer'))  { this.advance(); return 'infer '+this.eat(TokenType.IDENTIFIER).value; }
    while(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)||this.check(TokenType.OPERATOR,'|')||this.check(TokenType.OPERATOR,'&')) {
      if(this.check(TokenType.OPERATOR,'|')||this.check(TokenType.OPERATOR,'&')) break;
      base+=(this.check(TokenType.KEYWORD)||this.check(TokenType.IDENTIFIER))?this.advance().value:'';
      if(this.check(TokenType.OPERATOR,'<')){
        this.advance(); let inner=''; let d=1;
        while(d>0&&!this.check(TokenType.EOF)){
          const tv=this.peek();
          if(tv.value==='<') d++; if(tv.value==='>'){d--;if(d===0){this.advance();break;}}
          inner+=this.advance().value;
        }
        base+=`<${inner}>`;
      }
      if(this.check(TokenType.PUNCTUATION,'[')&&this.peek(1).value===']'){this.advance();this.advance();base+='[]';}
      if(!this.check(TokenType.OPERATOR,'.')||this.peek(1).value==='.') break;
      this.advance(); base+='.';
    }
    if(this.eatIf(TokenType.OPERATOR,'?')) base+='?';
    while(this.check(TokenType.OPERATOR,'|')||this.check(TokenType.OPERATOR,'&')) {
      base+=' '+this.advance().value+' '+this.parseTypeExpr();
    }
    return base||'any';
  }
  parseFnDecl(isAsync, opts) {
    opts = opts || {};
    const t=this.peek();
    if (!opts.fnAlreadyEaten) this.eat(TokenType.KEYWORD,'fn');
    const isGenerator = !!(opts.isGenerator || this.eatIf(TokenType.OPERATOR,'*'));
    let name=null;
    if (this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)) name=this.advance().value;
    const typeParams=this.parseTypeParams();
    const params=this.parseFnParams();
    let returnType=null;
    if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) returnType=this.parseTypeExpr();
    const body=this.parseBlock();
    return new ASTNode('FnDecl',{name,params,typeParams,returnType,body,isAsync,isGenerator},t.line,t.col);
  }
  parseComponent() {
    const t = this.advance();
    const name = this.eat(TokenType.IDENTIFIER).value;
    const typeParams = this.parseTypeParams();
    const params = this.parseFnParams();
    if (this.eatIf(TokenType.OPERATOR, '->') || this.check(TokenType.OPERATOR, ':')) {
      this.advance(); this.parseTypeExpr();
    }
    const body = this.parseBlock();
    return new ASTNode('ComponentDecl', { name, params, typeParams, body, isAsync: false }, t.line, t.col);
  }
  parseTypeParams() {
    if (!this.check(TokenType.OPERATOR,'<')) return [];
    this.advance(); const params=[];
    while(!this.check(TokenType.OPERATOR,'>')&&!this.check(TokenType.EOF)){
      const name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'T';
      let constraint=null, defaultType=null;
      if(this.eatIf(TokenType.KEYWORD,'extends')) constraint=this.parseTypeExpr();
      if(this.eatIf(TokenType.OPERATOR,'=')) defaultType=this.parseTypeExpr();
      params.push({name,constraint,defaultType});
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eatIf(TokenType.OPERATOR,'>');
    return params;
  }
  parseFnParams() {
    this.eat(TokenType.PUNCTUATION,'('); const params=[];
    while(!this.check(TokenType.PUNCTUATION,')')){
      let rest=false, name, typeAnn=null, defaultVal=null, accessMod=null, destructure=null;
      if(this.check(TokenType.KEYWORD,'readonly')||this.check(TokenType.KEYWORD,'private')||this.check(TokenType.KEYWORD,'public')||this.check(TokenType.KEYWORD,'protected')){
        accessMod=this.advance().value;
      }
      if(this.check(TokenType.OPERATOR,'...')) { this.advance(); rest=true; }
      if(!rest && this.check(TokenType.PUNCTUATION,'{')) {
        destructure=this.parseObjDestructure();
        name='_d'+params.length;
        if(this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
        params.push({name,typeAnn:null,defaultVal,rest:false,optional:false,accessMod,destructure});
        if(!this.check(TokenType.PUNCTUATION,')')) this.eatIf(TokenType.PUNCTUATION,',');
        continue;
      }
      if(!rest && this.check(TokenType.PUNCTUATION,'[')) {
        destructure=this.parseArrDestructure();
        name='_d'+params.length;
        if(this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
        params.push({name,typeAnn:null,defaultVal,rest:false,optional:false,accessMod,destructure});
        if(!this.check(TokenType.PUNCTUATION,')')) this.eatIf(TokenType.PUNCTUATION,',');
        continue;
      }
      name=this.eat(TokenType.IDENTIFIER).value;
      const optional=this.eatIf(TokenType.OPERATOR,'?');
      if(this.check(TokenType.OPERATOR,':')) { this.advance(); typeAnn=this.parseTypeExpr(); }
      if(!rest&&this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
      params.push({name,typeAnn,defaultVal,rest,optional,accessMod});
      if(!this.check(TokenType.PUNCTUATION,')')) this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,')');
    return params;
  }
  parseClassDecl(isAbstract, decorators) {
    const t=this.advance(); isAbstract=isAbstract||false;
    let name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:null;
    const typeParams=this.parseTypeParams();
    let superClass=null, interfaces=[];
    if(this.eatIf(TokenType.KEYWORD,'extends')) superClass=this.parseTypeExpr();
    if(this.eatIf(TokenType.KEYWORD,'implements')) {
      do { interfaces.push(this.parseTypeExpr()); } while(this.eatIf(TokenType.PUNCTUATION,','));
    }
    this.eat(TokenType.PUNCTUATION,'{');
    const members=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      this.eatSemi();
      if(this.check(TokenType.PUNCTUATION,'}')) break;
      members.push(this.parseClassMember());
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('ClassDecl',{name,superClass,interfaces,typeParams,members,isAbstract,decorators:decorators||[]},t.line,t.col);
  }
  parseClassMember() {
    const t=this.peek();
    let isStatic=false,isAbstract=false,isReadonly=false,access='public';
    if(this.checkKw('state')) {
      this.advance();
      let name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:null;
      let typeAnn=null,init=null;
      if(this.eatIf(TokenType.OPERATOR,':')) typeAnn=this.parseTypeExpr();
      if(this.eatIf(TokenType.OPERATOR,'=')) init=this.parseExpr();
      this.eatSemi();
      return {kind:'field',name,typeAnn,init,isStatic:false,isReadonly:false,access:'public',optional:false};
    }
    if(this.checkKw('private')||this.checkKw('public')||this.checkKw('protected')) access=this.advance().value;
    if(this.eatIf(TokenType.KEYWORD,'static')) isStatic=true;
    if(this.eatIf(TokenType.KEYWORD,'abstract')) isAbstract=true;
    if(this.eatIf(TokenType.KEYWORD,'readonly')) isReadonly=true;
    if(this.checkKw('static')&&!isStatic) { isStatic=true; this.advance(); }
    const isGet=this.checkKw('get')&&this.peek(1).type===TokenType.IDENTIFIER;
    const isSet=this.checkKw('set')&&this.peek(1).type===TokenType.IDENTIFIER;
    if(isGet||isSet) this.advance();
    const isAsync=this.eatIf(TokenType.KEYWORD,'async');
    let name;
    if(this.check(TokenType.PUNCTUATION,'[')) {
      this.advance(); const expr=this.parseExpr(); this.eat(TokenType.PUNCTUATION,']');
      name={computed:true,expr};
    } else {
      name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)||this.check(TokenType.STRING))?this.advance().value:'init';
    }
    const typeParams=this.parseTypeParams();
    if(this.check(TokenType.PUNCTUATION,'(')) {
      const params=this.parseFnParams();
      let returnType=null;
      if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) returnType=this.parseTypeExpr();
      let body=null;
      if(!isAbstract) body=this.parseBlock(); else this.eatSemi();
      return {kind:'method',name,params,typeParams,returnType,body,isStatic,isGet,isSet,isAsync,isAbstract,access};
    }
    let typeAnn=null, init=null;
    const optional=this.eatIf(TokenType.OPERATOR,'?');
    if(this.eatIf(TokenType.OPERATOR,':')) typeAnn=this.parseTypeExpr();
    if(this.eatIf(TokenType.OPERATOR,'=')) init=this.parseExpr();
    this.eatSemi();
    return {kind:'field',name,typeAnn,init,isStatic,isReadonly,access,optional};
  }
  parseInterface() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    const typeParams=this.parseTypeParams(); const bases=[];
    if(this.eatIf(TokenType.KEYWORD,'extends')) do { bases.push(this.parseTypeExpr()); } while(this.eatIf(TokenType.PUNCTUATION,','));
    this.eat(TokenType.PUNCTUATION,'{'); const members=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      this.eatSemi();
      if(this.check(TokenType.PUNCTUATION,'}')) break;
      let mstatic=this.eatIf(TokenType.KEYWORD,'static');
      let mget=false,mset=false;
      if(this.checkKw('get')&&this.peek(1).type===TokenType.IDENTIFIER){mget=true;this.advance();}
      else if(this.checkKw('set')&&this.peek(1).type===TokenType.IDENTIFIER){mset=true;this.advance();}
      let mname;
      if(this.check(TokenType.PUNCTUATION,'[')) { this.advance(); mname={computed:true,expr:this.parseExpr()}; this.eat(TokenType.PUNCTUATION,']'); }
      else mname=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:null;
      const optional=this.eatIf(TokenType.OPERATOR,'?');
      if(this.check(TokenType.PUNCTUATION,'(')) {
        const params=this.parseFnParams();
        let returnType=null;
        if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) returnType=this.parseTypeExpr();
        this.eatSemi();
        members.push({kind:'method',name:mname,params,returnType,optional,isStatic:mstatic,isGet:mget,isSet:mset});
      } else {
        const optional2=this.eatIf(TokenType.OPERATOR,'?')||optional;
        this.eatIf(TokenType.OPERATOR,':');
        const typeAnn=this.parseTypeExpr();
        this.eatSemi();
        members.push({kind:'field',name:mname,typeAnn,optional:optional2,isStatic:mstatic});
      }
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('InterfaceDecl',{name,typeParams,bases,members},t.line,t.col);
  }
  parseTrait() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    this.eat(TokenType.PUNCTUATION,'{'); const methods=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      this.eatSemi();
      if(this.check(TokenType.PUNCTUATION,'}')) break;
      const isAsync=this.eatIf(TokenType.KEYWORD,'async');
      const mname=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:null;
      this.parseTypeParams();
      const params=this.parseFnParams();
      let returnType=null;
      if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) returnType=this.parseTypeExpr();
      let body=null;
      if(this.check(TokenType.PUNCTUATION,'{')) body=this.parseBlock(); else this.eatSemi();
      methods.push({name:mname,params,returnType,body,isAsync});
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('TraitDecl',{name,methods},t.line,t.col);
  }
  parseMacro() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    this.eat(TokenType.PUNCTUATION,'('); const params=[];
    while(!this.check(TokenType.PUNCTUATION,')')){
      params.push(this.eat(TokenType.IDENTIFIER).value);
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,')');
    const body=this.parseBlock();
    return new ASTNode('MacroDecl',{name,params,body},t.line,t.col);
  }
  parseTypeAlias() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    const typeParams=this.parseTypeParams();
    this.eat(TokenType.OPERATOR,'=');
    const typeExpr=this.parseAlgebraicTypeOrExpr();
    this.eatSemi();
    return new ASTNode('TypeAlias',{name,typeParams,typeExpr},t.line,t.col);
  }
  parseAlgebraicTypeOrExpr() {
    if (this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)) {
      const saved=this.pos;
      const name=this.advance().value;
      if(this.check(TokenType.PUNCTUATION,'(')) {
        this.pos=saved;
        const variants=[];
        while(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)) {
          const vn=this.advance().value; let fields=[];
          if(this.check(TokenType.PUNCTUATION,'(')) {
            this.advance();
            while(!this.check(TokenType.PUNCTUATION,')')){
              let fn='_',ft='any';
              if(this.check(TokenType.IDENTIFIER)&&this.peek(1).value===':') { fn=this.advance().value; this.advance(); ft=this.parseTypeExpr(); }
              else ft=this.parseTypeExpr();
              fields.push({name:fn,type:ft}); this.eatIf(TokenType.PUNCTUATION,',');
            }
            this.eat(TokenType.PUNCTUATION,')');
          }
          variants.push({name:vn,fields});
          if(!this.eatIf(TokenType.OPERATOR,'|')) break;
          if(!this.check(TokenType.IDENTIFIER)&&!this.check(TokenType.KEYWORD)) break;
        }
        if(variants.length>1||(variants.length===1&&variants[0].fields.length>0)) return {kind:'algebraic',variants};
        this.pos=saved;
      } else { this.pos=saved; }
    }
    return {kind:'type',expr:this.parseTypeExpr()};
  }
  parseEnum() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    const members=[];
    this.eat(TokenType.PUNCTUATION,'{');
    while(!this.check(TokenType.PUNCTUATION,'}')){
      const mname=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected enum member');
      let init=null;
      if(this.eatIf(TokenType.OPERATOR,'=')) init=this.parseExpr();
      members.push({name:mname,init});
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('EnumDecl',{name,members,isConst:false},t.line,t.col);
  }
  parseIf() {
    const t=this.advance();
    const test=this.parseExpr();
    const consequent=this.parseBlock();
    let alternate=null;
    if(this.checkKw('elif')) {
      const et=this.advance();
      const etest=this.parseExpr();
      const econseq=this.parseBlock();
      const ealt=this._parseElseChain();
      alternate=new ASTNode('IfStmt',{test:etest,consequent:econseq,alternate:ealt},et.line,et.col);
    } else if(this.eatIf(TokenType.KEYWORD,'else')) {
      alternate=this.checkKw('if')?this.parseIf():this.parseBlock();
    }
    return new ASTNode('IfStmt',{test,consequent,alternate},t.line,t.col);
  }
  _parseElseChain() {
    if(this.checkKw('elif')) {
      const et=this.advance();
      const etest=this.parseExpr();
      const econseq=this.parseBlock();
      const ealt=this._parseElseChain();
      return new ASTNode('IfStmt',{test:etest,consequent:econseq,alternate:ealt},et.line,et.col);
    }
    if(this.eatIf(TokenType.KEYWORD,'else')) {
      return this.checkKw('if')?this.parseIf():this.parseBlock();
    }
    return null;
  }
  parseUnless() {
    const t=this.advance(); const test=this.parseExpr();
    const consequent=this.parseBlock(); let alternate=null;
    if(this.eatIf(TokenType.KEYWORD,'else')) alternate=this.parseBlock();
    return new ASTNode('UnlessStmt',{test,consequent,alternate},t.line,t.col);
  }
  parseWhile() {
    const t=this.advance(); const test=this.parseExpr();
    const body=this.parseBlock();
    return new ASTNode('WhileStmt',{test,body},t.line,t.col);
  }
  parseDoWhile() {
    const t=this.advance(); const body=this.parseBlock();
    this.eat(TokenType.KEYWORD,'while'); const test=this.parseExpr(); this.eatSemi();
    return new ASTNode('DoWhileStmt',{test,body},t.line,t.col);
  }
  parseFor() {
    const t=this.advance();
    const isConst=this.eatIf(TokenType.KEYWORD,'val')||this.eatIf(TokenType.KEYWORD,'const');
    if(!isConst) this.eatIf(TokenType.KEYWORD,'var')||this.eatIf(TokenType.KEYWORD,'let');
    let id=null, destructure=null;
    if(this.check(TokenType.PUNCTUATION,'{')) destructure=this.parseObjDestructure();
    else if(this.check(TokenType.PUNCTUATION,'[')) destructure=this.parseArrDestructure();
    else id=this.eat(TokenType.IDENTIFIER).value;
    if(this.eatIf(TokenType.KEYWORD,'of')) {
      const iterable=this.parseExpr(); const body=this.parseBlock();
      return new ASTNode('ForOfStmt',{id,destructure,iterable,body,isConst},t.line,t.col);
    }
    if(this.eatIf(TokenType.KEYWORD,'in')) {
      const iterable=this.parseExpr(); const body=this.parseBlock();
      return new ASTNode('ForInStmt',{id,destructure,iterable,body,isConst},t.line,t.col);
    }
    this.parseError("Expected 'of' or 'in' after for loop variable");
  }
  parseEach() {
    const t=this.advance();
    let id=null, destructure=null;
    if(this.check(TokenType.PUNCTUATION,'{')) destructure=this.parseObjDestructure();
    else if(this.check(TokenType.PUNCTUATION,'[')) destructure=this.parseArrDestructure();
    else id=this.eat(TokenType.IDENTIFIER).value;
    this.eat(TokenType.KEYWORD,'in');
    const iterable=this.parseExpr();
    const body=this.parseBlock();
    return new ASTNode('ForOfStmt',{id,destructure,iterable,body,isConst:true},t.line,t.col);
  }
  parseRepeat() {
    const t=this.advance();
    let count=null;
    if(!this.check(TokenType.PUNCTUATION,'{')) count=this.parseExpr();
    const body=this.parseBlock();
    return new ASTNode('RepeatStmt',{count,body},t.line,t.col);
  }
  parseGuard() {
    const t=this.advance();
    const test=this.parseExpr();
    this.eat(TokenType.KEYWORD,'else');
    const alternate=this.parseBlock();
    return new ASTNode('GuardStmt',{test,alternate},t.line,t.col);
  }
  parseDefer() {
    const t=this.advance();
    const body=this.parseBlock();
    const id=this._deferCounter++;
    return new ASTNode('DeferStmt',{body,id},t.line,t.col);
  }
  parseLog() {
    const t=this.advance();
    const args=[];
    if(!this.isLineEnd()&&!this.check(TokenType.PUNCTUATION,'}')&&!this.check(TokenType.EOF)){
      args.push(this.parseExpr());
      while(this.eatIf(TokenType.PUNCTUATION,',')) args.push(this.parseExpr());
    }
    this.eatSemi();
    return new ASTNode('LogStmt',{args},t.line,t.col);
  }
  parseAssert() {
    const t=this.advance();
    const test=this.parseExpr();
    let message=null;
    if(this.eatIf(TokenType.PUNCTUATION,',')) message=this.parseExpr();
    this.eatSemi();
    return new ASTNode('AssertStmt',{test,message},t.line,t.col);
  }
  parseSleep() {
    const t=this.advance();
    const ms=this.parseExpr();
    this.eatSemi();
    return new ASTNode('SleepStmt',{ms},t.line,t.col);
  }
  parseLoop() {
    const t=this.advance(); const body=this.parseBlock();
    return new ASTNode('LoopStmt',{body},t.line,t.col);
  }
  parseReturn() {
    const t=this.advance(); let value=null;
    if(!this.isLineEnd()&&!this.check(TokenType.PUNCTUATION,'}')&&!this.check(TokenType.EOF)) value=this.parseExpr();
    this.eatSemi();
    return new ASTNode('ReturnStmt',{value},t.line,t.col);
  }
  parseThrow() {
    const t=this.advance(); const value=this.parseExpr(); this.eatSemi();
    return new ASTNode('ThrowStmt',{value},t.line,t.col);
  }
  parseTry() {
    const t=this.advance();
    if(this.check(TokenType.OPERATOR,'?')) {
      this.advance(); const expr=this.parseExpr(); this.eatSemi();
      return new ASTNode('ExprStmt',{expr:new ASTNode('TrySafeExpr',{expr},t.line,t.col)},t.line,t.col);
    }
    const block=this.parseBlock();
    let catchParam=null, catchBlock=null, finallyBlock=null;
    if(this.eatIf(TokenType.KEYWORD,'catch')) {
      if(this.check(TokenType.PUNCTUATION,'(')) { this.advance(); catchParam=this.eat(TokenType.IDENTIFIER).value; this.eat(TokenType.PUNCTUATION,')'); }
      else if(this.check(TokenType.IDENTIFIER)) catchParam=this.advance().value;
      catchBlock=this.parseBlock();
    }
    if(this.eatIf(TokenType.KEYWORD,'finally')) finallyBlock=this.parseBlock();
    if(!catchBlock&&!finallyBlock) this.parseError("'try' requires 'catch' or 'finally'");
    return new ASTNode('TryStmt',{block,catchParam,catchBlock,finallyBlock},t.line,t.col);
  }
  parseMatch() {
    const t=this.advance(); const subject=this.parseExpr();
    this.eat(TokenType.PUNCTUATION,'{'); const cases=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      this.eatSemi();
      if(this.check(TokenType.PUNCTUATION,'}')) break;
      const isDefault=this.eatIf(TokenType.KEYWORD,'default');
      const isElse=!isDefault&&this.eatIf(TokenType.KEYWORD,'else');
      let patterns=[]; let guard=null;
      if(!isDefault&&!isElse) {
        this.eat(TokenType.KEYWORD,'case');
        do { patterns.push(this.parseMatchPattern()); } while(this.eatIf(TokenType.OPERATOR,'|'));
        if(this.eatIf(TokenType.KEYWORD,'when')) guard=this.parseExpr();
      }
      this.eat(TokenType.OPERATOR,'=>');
      const body=this.check(TokenType.PUNCTUATION,'{')?this.parseBlock():this.parseExprAsBlock();
      cases.push({patterns,guard,body,isDefault:isDefault||isElse});
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('MatchStmt',{subject,cases},t.line,t.col);
  }
  parseMatchPattern() {
    const t=this.peek();
    if(this.checkKw('null')) { this.advance(); return {kind:'literal',value:null}; }
    if(this.checkKw('true')) { this.advance(); return {kind:'literal',value:true}; }
    if(this.checkKw('false')) { this.advance(); return {kind:'literal',value:false}; }
    if(this.checkKw('undefined')) { this.advance(); return {kind:'literal',value:undefined}; }
    if(t.type===TokenType.NUMBER) { this.advance(); return {kind:'literal',value:t.value}; }
    if(t.type===TokenType.STRING) { this.advance(); return {kind:'literal',value:t.value}; }
    if(this.check(TokenType.OPERATOR,'...')) { this.advance(); return {kind:'rest',name:this.eat(TokenType.IDENTIFIER).value}; }
    if(this.check(TokenType.PUNCTUATION,'[')) {
      this.advance(); const items=[];
      while(!this.check(TokenType.PUNCTUATION,']')){ items.push(this.parseMatchPattern()); this.eatIf(TokenType.PUNCTUATION,','); }
      this.eat(TokenType.PUNCTUATION,']');
      return {kind:'array',items};
    }
    if(this.check(TokenType.PUNCTUATION,'{')) {
      this.advance(); const props=[];
      while(!this.check(TokenType.PUNCTUATION,'}')){
        const k=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:null;
        let alias=k;
        if(this.eatIf(TokenType.OPERATOR,':')) { if(this.check(TokenType.IDENTIFIER)) alias=this.advance().value; }
        props.push({key:k,alias}); this.eatIf(TokenType.PUNCTUATION,',');
      }
      this.eat(TokenType.PUNCTUATION,'}');
      return {kind:'object',props};
    }
    if(t.type===TokenType.IDENTIFIER) {
      this.advance();
      if(this.check(TokenType.PUNCTUATION,'(')) {
        this.advance(); const fields=[];
        while(!this.check(TokenType.PUNCTUATION,')')){fields.push(this.parseMatchPattern());this.eatIf(TokenType.PUNCTUATION,',');}
        this.eat(TokenType.PUNCTUATION,')');
        return {kind:'variant',name:t.value,fields};
      }
      if(this.check(TokenType.OPERATOR,'.')) {
        let path=t.value;
        while(this.eatIf(TokenType.OPERATOR,'.')||this.eatIf(TokenType.PUNCTUATION,'.')) {
          path+='.'+((this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'');
        }
        return {kind:'enumVal',path};
      }
      if(t.value[0]===t.value[0].toUpperCase()) return {kind:'enumVal',path:t.value};
      return {kind:'binding',name:t.value};
    }
    return {kind:'wildcard'};
  }
  parseExprAsBlock() {
    const t=this.peek();
    const stmtKws=['log','assert','return','throw','raise','break','continue'];
    if(stmtKws.includes(t.value)&&t.type==='KEYWORD') {
      const stmt=this.parseStmt();
      if(!stmt) return new ASTNode('Block',{body:[]},t.line,t.col);
      return new ASTNode('Block',{body:[stmt]},t.line,t.col);
    }
    const expr=this.parseExpr(); this.eatSemi();
    return new ASTNode('Block',{body:[new ASTNode('ExprStmt',{expr},t.line,t.col)]},t.line,t.col);
  }
  parseImport() {
    const t=this.advance();
    if(this.checkKw('type')) {
      this.advance();
      const specifiers=this.parseImportSpecifiers();
      this.eat(TokenType.KEYWORD,'from');
      const source=this.eat(TokenType.STRING).value; this.eatSemi();
      return new ASTNode('ImportDecl',{specifiers,source,typeOnly:true},t.line,t.col);
    }
    let defaultImport=null, specifiers=[], namespace=null;
    if(this.check(TokenType.OPERATOR,'*')) {
      this.advance(); this.eat(TokenType.KEYWORD,'as'); namespace=this.eat(TokenType.IDENTIFIER).value;
    } else if(this.check(TokenType.IDENTIFIER)&&this.peek(1).value!==',') {
      defaultImport=this.advance().value;
      if(this.eatIf(TokenType.PUNCTUATION,',')) specifiers=this.parseImportSpecifiers();
    } else if(this.check(TokenType.PUNCTUATION,'{')) {
      specifiers=this.parseImportSpecifiers();
    } else if(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD,'default')) {
      defaultImport=this.advance().value;
      if(this.eatIf(TokenType.PUNCTUATION,',')) specifiers=this.parseImportSpecifiers();
    }
    this.eat(TokenType.KEYWORD,'from');
    const source=this.eat(TokenType.STRING).value; this.eatSemi();
    return new ASTNode('ImportDecl',{defaultImport,specifiers,namespace,source},t.line,t.col);
  }
  parseImportSpecifiers() {
    this.eat(TokenType.PUNCTUATION,'{'); const specs=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      const imported=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'';
      const local=this.eatIf(TokenType.KEYWORD,'as')?this.eat(TokenType.IDENTIFIER).value:imported;
      specs.push({imported,local}); this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return specs;
  }
  parseExport() {
    const t=this.advance();
    if(this.eatIf(TokenType.KEYWORD,'default')) {
      const val=this.parseExpr(); this.eatSemi();
      return new ASTNode('ExportDecl',{default:true,value:val},t.line,t.col);
    }
    if(this.check(TokenType.PUNCTUATION,'{')) {
      this.advance(); const specs=[];
      while(!this.check(TokenType.PUNCTUATION,'}')){
        const local=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:'';
        const exported=this.eatIf(TokenType.KEYWORD,'as')?this.advance().value:local;
        specs.push({local,exported}); this.eatIf(TokenType.PUNCTUATION,',');
      }
      this.eat(TokenType.PUNCTUATION,'}'); this.eatSemi();
      return new ASTNode('ExportDecl',{specifiers:specs},t.line,t.col);
    }
    const decl=this.parseStmt();
    return new ASTNode('ExportDecl',{declaration:decl},t.line,t.col);
  }
  parseNTLRequire() {
    const t=this.peek();
    if (t.type === 'KEYWORD' && t.value === 'require') this.advance();
    this.eat(TokenType.PUNCTUATION,'(');
    this.eat(TokenType.KEYWORD,'ntl');
    this.eat(TokenType.PUNCTUATION,',');
    const modules=[];
    while(!this.check(TokenType.PUNCTUATION,')')){
      modules.push(this.advance().value);
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,')'); this.eatSemi();
    return new ASTNode('NTLRequire',{modules},t.line,t.col);
  }
  parseSpawn() {
    const t=this.advance(); const expr=this.parseExpr(); this.eatSemi();
    return new ASTNode('SpawnStmt',{expr},t.line,t.col);
  }
  parseSelect() {
    const t=this.advance();
    this.eat(TokenType.PUNCTUATION,'{'); const cases=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      this.eatSemi();
      if(this.check(TokenType.PUNCTUATION,'}')) break;
      this.eat(TokenType.KEYWORD,'case');
      let binding=null, channel=null;
      if(this.check(TokenType.IDENTIFIER)&&this.peek(1).value==='=') {
        binding=this.advance().value; this.advance();
        channel=this.parseExpr();
      } else { channel=this.parseExpr(); }
      this.eat(TokenType.OPERATOR,'=>');
      const body=this.parseExprAsBlock();
      cases.push({binding,channel,body});
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('SelectStmt',{cases},t.line,t.col);
  }
  parseImmutable() {
    const t=this.advance();
    const decl=this.parseVarDecl(true);
    return new ASTNode('ImmutableDecl',{decl},t.line,t.col);
  }
  parseNamespace() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    this.eat(TokenType.PUNCTUATION,'{'); const body=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){const s=this.parseStmt();if(s) body.push(s);}
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('NamespaceDecl',{name,body},t.line,t.col);
  }
  parseWith() {
    const t=this.advance(); const expr=this.parseExpr(); const body=this.parseBlock();
    return new ASTNode('WithStmt',{expr,body},t.line,t.col);
  }
  parseUsing() {
    const t=this.advance(); const name=this.eat(TokenType.IDENTIFIER).value;
    this.eat(TokenType.OPERATOR,'='); const init=this.parseExpr(); this.eatSemi();
    return new ASTNode('UsingDecl',{name,init},t.line,t.col);
  }
  parseDeclare() {
    this.advance(); const stmt=this.parseStmt();
    return new ASTNode('DeclareStmt',{stmt},this.peek().line,this.peek().col);
  }
  parseHaveStmt() {
    const t=this.advance();
    const id=this._ifsetCounter++;
    const expr=this.parsePostfix();
    let inExpr=null, matchMode=null;
    if(this.checkKw('in')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='in';
    } else if(this.checkKw('not')) {
      this.advance();
      if(this.checkKw('in')) { this.advance(); inExpr=this.parsePostfix(); matchMode='not_in'; }
    } else if(this.checkKw('matches')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='matches';
    } else if(this.checkKw('is')) {
      this.advance();
      if(this.checkKw('not')) { this.advance(); inExpr=this.parsePostfix(); matchMode='is_not'; }
      else { inExpr=this.parsePostfix(); matchMode='is'; }
    } else if(this.checkKw('between')) {
      this.advance();
      const lo=this.parsePostfix(); const hi=this.parsePostfix();
      inExpr={lo,hi}; matchMode='between';
    } else if(this.checkKw('startsWith')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='startsWith';
    } else if(this.checkKw('endsWith')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='endsWith';
    }
    let alias=null;
    if(this.checkKw('as')) { this.advance(); alias=this.eat(TokenType.IDENTIFIER).value; }
    const isGuard=this.eatIf(TokenType.KEYWORD,'else');
    let consequent=null, alternate=null;
    if(isGuard) {
      alternate=this.parseBlock();
    } else {
      consequent=this.parseBlock();
      if(this.eatIf(TokenType.KEYWORD,'else')) alternate=this.parseBlock();
    }
    return new ASTNode('HaveStmt',{expr,inExpr,matchMode,alias,isGuard,consequent,alternate,id},t.line,t.col);
  }
  parseIfHave() {
    const t=this.advance();
    const id=this._ifsetCounter++;
    let expr=this.parsePostfix();
    let alias=null;
    let inExpr=null;
    let matchMode=null;
    if(this.checkKw('in')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='in';
    } else if(this.checkKw('not')) {
      this.advance();
      if(this.checkKw('in')) { this.advance(); inExpr=this.parsePostfix(); matchMode='not_in'; }
    } else if(this.checkKw('matches')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='matches';
    } else if(this.checkKw('is')) {
      this.advance();
      if(this.checkKw('not')) { this.advance(); inExpr=this.parsePostfix(); matchMode='is_not'; }
      else { inExpr=this.parsePostfix(); matchMode='is'; }
    } else if(this.checkKw('between')) {
      this.advance();
      const lo=this.parsePostfix(); const hi=this.parsePostfix();
      inExpr={lo,hi}; matchMode='between';
    } else if(this.checkKw('startsWith')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='startsWith';
    } else if(this.checkKw('endsWith')) {
      this.advance(); inExpr=this.parsePostfix(); matchMode='endsWith';
    }
    if(this.checkKw('as')) { this.advance(); alias=this.eat(TokenType.IDENTIFIER).value; }
    const consequent=this.parseBlock(); let alternate=null;
    if(this.eatIf(TokenType.KEYWORD,'else')) alternate=this.parseBlock();
    return new ASTNode('IfHaveStmt',{expr,alias,inExpr,matchMode,consequent,alternate,id},t.line,t.col);
  }
  parseIfSet() {
    const t=this.advance();
    const id=this._ifsetCounter++;
    let expr=this.parsePostfix();
    let alias=null;
    if(this.checkKw('as')) { this.advance(); alias=this.eat(TokenType.IDENTIFIER).value; }
    const consequent=this.parseBlock(); let alternate=null;
    if(this.eatIf(TokenType.KEYWORD,'else')) alternate=this.parseBlock();
    return new ASTNode('IfSetStmt',{expr,alias,consequent,alternate,id},t.line,t.col);
  }
  parsePostfix() { return this._parsePostfix(this.parsePrimary()); }
  _parsePostfix(expr) {
    while(true) {
      const t=this.peek();
      if(t.type===TokenType.PUNCTUATION&&t.value==='(') {
        this.advance(); const args=[];
        while(!this.check(TokenType.PUNCTUATION,')'))  { args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
        this.eat(TokenType.PUNCTUATION,')');
        expr=new ASTNode('CallExpr',{callee:expr,args,optional:false},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.OPERATOR&&t.value==='?.'&&this.peek(1).value==='(') {
        this.advance(); this.advance(); const args=[];
        while(!this.check(TokenType.PUNCTUATION,')'))  { args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
        this.eat(TokenType.PUNCTUATION,')');
        expr=new ASTNode('CallExpr',{callee:expr,args,optional:true},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.PUNCTUATION&&t.value==='[') {
        this.advance(); const prop=this.parseExpr(); this.eat(TokenType.PUNCTUATION,']');
        expr=new ASTNode('MemberExpr',{object:expr,prop,computed:true,optional:false},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.OPERATOR&&t.value==='?.'&&this.peek(1).value==='[') {
        this.advance(); this.advance(); const prop=this.parseExpr(); this.eat(TokenType.PUNCTUATION,']');
        expr=new ASTNode('MemberExpr',{object:expr,prop,computed:true,optional:true},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.PUNCTUATION&&t.value==='.'&&this.peek(1).value!=='.') {
        this.advance(); const prop=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected property name');
        expr=new ASTNode('MemberExpr',{object:expr,prop,computed:false,optional:false},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.OPERATOR&&t.value==='?.'&&this.peek(1).type===TokenType.IDENTIFIER) {
        this.advance(); const prop=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected property name');
        expr=new ASTNode('MemberExpr',{object:expr,prop,computed:false,optional:true},expr.line,expr.col);
        continue;
      }
      if(t.type===TokenType.OPERATOR&&t.value==='::'&&this.peek(1).type===TokenType.IDENTIFIER) {
        this.advance(); const method=this.advance().value;
        expr=new ASTNode('BindingExpr',{object:expr,method},expr.line,expr.col);
        continue;
      }
      break;
    }
    return expr;
  }
  parseBlock() {
    const t=this.peek(); this.eat(TokenType.PUNCTUATION,'{'); const body=[];
    while(!this.check(TokenType.PUNCTUATION,'}')){
      const s=this.parseStmt();
      if(s) body.push(s);
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('Block',{body},t.line,t.col);
  }
  parseExprStatement() {
    const t=this.peek();
    const decorators=this.parseDecorators();
    if(decorators.length>0) {
      
      let inner;
      if(this.checkKw('fn')) {
        const _isGen=this.tokens[this.pos+1]&&this.tokens[this.pos+1].value==='*';
        inner=this.parseFnDecl(false,{isGenerator:_isGen});
      }
      else if(this.checkKw('async')&&this.peek(1).value==='fn') { this.advance(); inner=this.parseFnDecl(true); }
      else if(this.checkKw('class')) inner=this.parseClassDecl(false,decorators);
      else if(this.checkKw('abstract')) { this.advance(); inner=this.parseClassDecl(true,decorators); }
      else { inner=this.parseExpr(); this.eatSemi(); }
      return new ASTNode('DecoratedExpr',{decorators,expr:inner},t.line,t.col);
    }
    const expr=this.parseExpr();
    this.eatSemi();
    return new ASTNode('ExprStmt',{expr},t.line,t.col);
  }
  parseDecorators() {
    const decs=[];
    while(this.check(TokenType.OPERATOR,'@')) {
      this.advance();
      const name=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.eat(TokenType.IDENTIFIER).value;
      let args=null;
      if(this.check(TokenType.PUNCTUATION,'(')) {
        this.advance(); args=[];
        while(!this.check(TokenType.PUNCTUATION,')')){ args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
        this.eat(TokenType.PUNCTUATION,')');
      }
      decs.push({name,args});
    }
    return decs;
  }
  parseExpr() { return this.parseAssign(); }
  parseAssign() {
    const left=this.parseTernary();
    const ASSIGN_OPS=['=','+=','-=','*=','/=','%=','**=','&&=','||=','??=','<<=','>>='];
    if(ASSIGN_OPS.includes(this.peek().value)&&this.peek().type===TokenType.OPERATOR) {
      const op=this.advance().value;
      const right=this.parseAssign();
      return new ASTNode('AssignExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseTernary() {
    const test=this.parsePipeline();
    if(this.check(TokenType.OPERATOR,'?')&&!this.check(TokenType.OPERATOR,'?.')) {
      this.advance();
      const consequent=this.parseExpr();
      this.eat(TokenType.OPERATOR,':');
      const alternate=this.parseExpr();
      return new ASTNode('TernaryExpr',{test,consequent,alternate},test.line,test.col);
    }
    return test;
  }
  parsePipeline() {
    let left=this.parseNullCoalesce();
    while(this.check(TokenType.OPERATOR,'|>')) {
      this.advance();
      const right=this.parseNullCoalesce();
      left=new ASTNode('PipelineExpr',{left,right},left.line,left.col);
    }
    return left;
  }
  parseNullCoalesce() {
    let left=this.parseOr();
    while(this.check(TokenType.OPERATOR,'??')) {
      const t=this.advance();
      const right=this.parseOr();
      left=new ASTNode('BinaryExpr',{left,op:'??',right},t.line,t.col);
    }
    return left;
  }
  parseOr() {
    let left=this.parseAnd();
    while(this.check(TokenType.OPERATOR,'||')) {
      const op=this.advance().value;
      const right=this.parseAnd();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseAnd() {
    let left=this.parseBitOr();
    while(this.check(TokenType.OPERATOR,'&&')) {
      const op=this.advance().value;
      const right=this.parseBitOr();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseBitOr() {
    let left=this.parseBitXor();
    while(this.check(TokenType.OPERATOR,'|')&&!this.check(TokenType.OPERATOR,'||')&&!this.check(TokenType.OPERATOR,'|>')) {
      const t=this.peek();
      if(t.value==='|'&&(this.peek(1).value==='|'||this.peek(1).value==='>')) break;
      this.advance();
      const right=this.parseBitXor();
      left=new ASTNode('BinaryExpr',{left,op:'|',right},left.line,left.col);
    }
    return left;
  }
  parseBitXor() {
    let left=this.parseBitAnd();
    while(this.check(TokenType.OPERATOR,'^')) {
      this.advance(); const right=this.parseBitAnd();
      left=new ASTNode('BinaryExpr',{left,op:'^',right},left.line,left.col);
    }
    return left;
  }
  parseBitAnd() {
    let left=this.parseEquality();
    while(this.check(TokenType.OPERATOR,'&')&&!this.check(TokenType.OPERATOR,'&&')) {
      const t=this.peek();
      if(t.value==='&'&&this.peek(1).value==='&') break;
      this.advance(); const right=this.parseEquality();
      left=new ASTNode('BinaryExpr',{left,op:'&',right},left.line,left.col);
    }
    return left;
  }
  parseEquality() {
    let left=this.parseRelational();
    while(['===','!==','==','!='].includes(this.peek().value)&&this.peek().type===TokenType.OPERATOR) {
      const op=this.advance().value;
      const right=this.parseRelational();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseRelational() {
    let left=this.parseShift();
    while(['<','>','<=','>='].includes(this.peek().value)&&this.peek().type===TokenType.OPERATOR||
          (this.peek().type===TokenType.KEYWORD&&(this.peek().value==='instanceof'||this.peek().value==='in'||this.peek().value==='of'))) {
      const op=this.advance().value;
      const right=this.parseShift();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseShift() {
    let left=this.parseAdd();
    while(['<<','>>','>>>'].includes(this.peek().value)) {
      const op=this.advance().value; const right=this.parseAdd();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseAdd() {
    let left=this.parseMul();
    while(['+','-'].includes(this.peek().value)&&this.peek().type===TokenType.OPERATOR) {
      const op=this.advance().value; const right=this.parseMul();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseMul() {
    let left=this.parseUnary();
    while(['*','/','%','**'].includes(this.peek().value)&&this.peek().type===TokenType.OPERATOR) {
      const op=this.advance().value; const right=this.parseUnary();
      left=new ASTNode('BinaryExpr',{left,op,right},left.line,left.col);
    }
    return left;
  }
  parseUnary() {
    const t=this.peek();
    if(t.type===TokenType.KEYWORD&&t.value==='delete') {
      this.advance(); return new ASTNode('UnaryExpr',{op:'delete',arg:this.parsePostfix()},t.line,t.col);
    }
    if(t.type===TokenType.OPERATOR&&['!','~','-','+'].includes(t.value)) {
      this.advance(); return new ASTNode('UnaryExpr',{op:t.value,arg:this.parseUnary()},t.line,t.col);
    }
    if(t.type===TokenType.OPERATOR&&(t.value==='++'||t.value==='--')) {
      this.advance(); return new ASTNode('UnaryExpr',{op:t.value,arg:this.parsePostfix(),prefix:true},t.line,t.col);
    }
    if(t.type===TokenType.KEYWORD&&t.value==='typeof') {
      this.advance(); return new ASTNode('UnaryExpr',{op:'typeof',arg:this.parseUnary()},t.line,t.col);
    }
    if(t.type===TokenType.KEYWORD&&t.value==='await') {
      this.advance(); return new ASTNode('AwaitExpr',{arg:this.parseUnary()},t.line,t.col);
    }
    if(t.type===TokenType.KEYWORD&&t.value==='yield') {
      this.advance(); const delegate=this.eatIf(TokenType.OPERATOR,'*');
      return new ASTNode('YieldExpr',{arg:this.parseUnary(),delegate},t.line,t.col);
    }
    if(t.type===TokenType.OPERATOR&&t.value==='...') {
      this.advance(); return new ASTNode('SpreadExpr',{arg:this.parseUnary()},t.line,t.col);
    }
    let expr=this.parsePostfix();
    if(this.peek().value==='++'||this.peek().value==='--') {
      const op=this.advance().value;
      return new ASTNode('UnaryExpr',{op,arg:expr,prefix:false},expr.line,expr.col);
    }
    if(this.peek().type===TokenType.KEYWORD&&(this.peek().value==='instanceof'||this.peek().value==='as')) {
      const op=this.advance().value;
      const right=op==='as'?this.parseTypeExpr():this.parsePostfix();
      return new ASTNode('BinaryExpr',{left:expr,op,right},expr.line,expr.col);
    }
    if(this.peek().type===TokenType.KEYWORD&&this.peek().value==='satisfies') {
      this.advance(); const type=this.parseTypeExpr();
      return new ASTNode('SatisfiesExpr',{expr,type},expr.line,expr.col);
    }
    return expr;
  }
  parsePrimary() {
    const t=this.peek();
    if(t.type===TokenType.KEYWORD) {
      switch(t.value) {
        case 'true':  this.advance(); return new ASTNode('BoolLit',{value:true},t.line,t.col);
        case 'false': this.advance(); return new ASTNode('BoolLit',{value:false},t.line,t.col);
        case 'null':  this.advance(); return new ASTNode('NullLit',{},t.line,t.col);
        case 'undefined': this.advance(); return new ASTNode('UndefinedLit',{},t.line,t.col);
        case 'void':  { this.advance(); const _va=this.parseUnary(); return new ASTNode('VoidExpr',{arg:_va},t.line,t.col); }
        case 'this':  this.advance(); return new ASTNode('ThisExpr',{},t.line,t.col);
        case 'super': this.advance(); return new ASTNode('SuperExpr',{},t.line,t.col);
        case 'new': {
          this.advance();
          let callee=this.parsePrimary();
          while(this.check(TokenType.PUNCTUATION,'.')&&this.peek(1).value!=='.') {
            this.advance(); const prop=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD))?this.advance().value:this.parseError('Expected property name');
            callee=new ASTNode('MemberExpr',{object:callee,prop,computed:false},t.line,t.col);
          }
          const args=[];
          if(this.check(TokenType.PUNCTUATION,'(')) {
            this.advance();
            while(!this.check(TokenType.PUNCTUATION,')')){ args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
            this.eat(TokenType.PUNCTUATION,')');
          }
          return new ASTNode('NewExpr',{callee,args},t.line,t.col);
        }
        case 'fn': {
          this.advance();
          let name=null;
          if(this.check(TokenType.IDENTIFIER)) name=this.advance().value;
          const tp=this.parseTypeParams(); const params=this.parseFnParams();
          let rt=null;
          if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) rt=this.parseTypeExpr();
          const body=this.parseBlock();
          return new ASTNode('FnExpr',{name,params,typeParams:tp,returnType:rt,body,isAsync:false},t.line,t.col);
        }
        case 'async': {
          if(this.peek(1).value==='fn') {
            this.advance(); this.advance();
            const _isGen=this.eatIf(TokenType.OPERATOR,'*');
            let name=null;
            if(this.check(TokenType.IDENTIFIER)) name=this.advance().value;
            const tp=this.parseTypeParams(); const params=this.parseFnParams();
            let rt=null;
            if(this.eatIf(TokenType.OPERATOR,'->')||this.eatIf(TokenType.OPERATOR,':')) rt=this.parseTypeExpr();
            const body=this.parseBlock();
            return new ASTNode('FnExpr',{name,params,typeParams:tp,returnType:rt,body,isAsync:true,isGenerator:!!_isGen},t.line,t.col);
          }
          if(this.peek(1).value==='(' || this.peek(1).type==='IDENTIFIER') {
            this.advance();
            let params;
            if(this.check(TokenType.PUNCTUATION,'(')) {
              this.advance();
              params=[];
              while(!this.check(TokenType.PUNCTUATION,')')) {
                const rest=this.eatIf(TokenType.OPERATOR,'...');
                const pname=this.advance().value;
                let typeAnn=null, defaultVal=null;
                if(this.eatIf(TokenType.OPERATOR,'?')) {}
                if(this.eatIf(TokenType.OPERATOR,':')) typeAnn=this.parseTypeExpr();
                if(this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
                params.push({name:pname,typeAnn,defaultVal,rest:!!rest});
                this.eatIf(TokenType.PUNCTUATION,',');
              }
              this.eat(TokenType.PUNCTUATION,')');
              this.eat(TokenType.OPERATOR,'=>');
            } else {
              const pname=this.advance().value;
              params=[{name:pname,typeAnn:null,defaultVal:null,rest:false}];
              this.eat(TokenType.OPERATOR,'=>');
            }
            const body=this.check(TokenType.PUNCTUATION,'{')?this.parseBlock():this.parseExpr();
            return new ASTNode('ArrowFn',{params,body,isAsync:true},t.line,t.col);
          }
          break;
        }
        case 'channel': {
          this.advance(); const args=[];
          if(this.check(TokenType.PUNCTUATION,'(')) {
            this.advance();
            while(!this.check(TokenType.PUNCTUATION,')')) { args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
            this.eat(TokenType.PUNCTUATION,')');
          }
          return new ASTNode('ChannelExpr',{args},t.line,t.col);
        }
        case 'require': {
          this.advance();
          this.eat(TokenType.PUNCTUATION,'(');
          if(this.checkKw('ntl')) {
            this.eat(TokenType.KEYWORD,'ntl'); this.eat(TokenType.PUNCTUATION,',');
            const mods=[];
            while(!this.check(TokenType.PUNCTUATION,')')) { mods.push(this.advance().value); this.eatIf(TokenType.PUNCTUATION,','); }
            this.eat(TokenType.PUNCTUATION,')');
            return new ASTNode('NTLRequireExpr',{modules:mods},t.line,t.col);
          }
          const source=this.eat(TokenType.STRING).value; this.eat(TokenType.PUNCTUATION,')');
          return new ASTNode('RequireExpr',{source},t.line,t.col);
        }
        case 'have': {
          this.advance();
          const value=this.parsePostfix();
          let inExpr=null, matchMode=null;
          if(this.checkKw('in')) {
            this.advance(); inExpr=this.parsePostfix(); matchMode='in';
          } else if(this.checkKw('matches')) {
            this.advance(); inExpr=this.parsePostfix(); matchMode='matches';
          } else if(this.checkKw('is')) {
            this.advance(); inExpr=this.parsePostfix(); matchMode='is';
          } else if(this.checkKw('between')) {
            this.advance();
            const lo=this.parsePostfix(); const hi=this.parsePostfix();
            inExpr={lo,hi}; matchMode='between';
          }
          return new ASTNode('HaveExpr',{value,inExpr,matchMode},t.line,t.col);
        }
        case 'error': {
          this.advance();
          return new ASTNode('Identifier',{name:t.value},t.line,t.col);
        }
        case 'log': {
          this.advance();
          return new ASTNode('Identifier',{name:t.value},t.line,t.col);
        }
        case 'assert': {
          this.advance();
          return new ASTNode('Identifier',{name:t.value},t.line,t.col);
        }
        case 'Not': {
          this.advance(); const value=this.parsePrimary();
          return new ASTNode('NotExpr',{value},t.line,t.col);
        }
        case 'nax': {
          this.advance();
          this.eat(TokenType.PUNCTUATION,'(');
          const url=this.eat(TokenType.STRING).value;
          this.eat(TokenType.PUNCTUATION,')');
          return new ASTNode('NaxImportExpr',{url},t.line,t.col);
        }
        case 'range': {
          this.advance();
          this.eat(TokenType.PUNCTUATION,'(');
          const args=[];
          while(!this.check(TokenType.PUNCTUATION,')')) { args.push(this.parseExpr()); this.eatIf(TokenType.PUNCTUATION,','); }
          this.eat(TokenType.PUNCTUATION,')');
          return new ASTNode('RangeExpr',{args},t.line,t.col);
        }
        case 'sleep': {
          this.advance();
          this.eat(TokenType.PUNCTUATION,'(');
          const ms=this.parseExpr();
          this.eat(TokenType.PUNCTUATION,')');
          return new ASTNode('SleepExpr',{ms},t.line,t.col);
        }
        case 'typeof': {
          this.advance(); const arg=this.parseUnary();
          return new ASTNode('UnaryExpr',{op:'typeof',arg},t.line,t.col);
        }
        case 'instanceof': {
          this.advance(); const arg=this.parseUnary();
          return new ASTNode('UnaryExpr',{op:'instanceof',arg},t.line,t.col);
        }
        case 'try': {
          if(this.peek(1).value==='?') {
            this.advance(); this.advance();
            const expr=this.parseExpr();
            return new ASTNode('TrySafeExpr',{expr},t.line,t.col);
          }
          break;
        }
        case 'match': {
          return this.parseMatch();
        }
        case 'fn': {
          return this.parseFnDecl(false);
        }
        case 'async': {
          if(this.peek(1).value==='fn') { this.advance(); return this.parseFnDecl(true); }
          break;
        }
        case 'new': {
          break;
        }
      }
    }
    if(t.type===TokenType.REGEX) {
      this.advance();
      return new ASTNode('RegexLit',{pattern:t.value.pattern,flags:t.value.flags},t.line,t.col);
    }
    if(t.type===TokenType.IDENTIFIER) {
      this.advance();
      if(this.check(TokenType.OPERATOR,'=>')) {
        this.advance();
        const body=this.check(TokenType.PUNCTUATION,'{')?this.parseBlock():this._parseArrowBody();
        return new ASTNode('ArrowFn',{params:[{name:t.value,typeAnn:null,defaultVal:null,rest:false}],body,isAsync:false},t.line,t.col);
      }
      return new ASTNode('Identifier',{name:t.value},t.line,t.col);
    }
    if(t.type===TokenType.NUMBER) { this.advance(); return new ASTNode('NumberLit',{value:t.value},t.line,t.col); }
    if(t.type===TokenType.STRING) { this.advance(); return new ASTNode('StringLit',{value:t.value},t.line,t.col); }
    if(t.type===TokenType.TEMPLATE) { this.advance(); return new ASTNode('TemplateLit',{parts:t.value},t.line,t.col); }
    if(t.type===TokenType.REGEX) { this.advance(); return new ASTNode('RegexLit',{pattern:t.value.pattern,flags:t.value.flags},t.line,t.col); }
    if(t.type===TokenType.PUNCTUATION&&t.value==='(') {
      this.advance();
      if(this.check(TokenType.PUNCTUATION,')')) {
        this.advance();
        if(this.check(TokenType.OPERATOR,'=>')) {
          this.advance();
          const body=this.check(TokenType.PUNCTUATION,'{')?this.parseBlock():this._parseArrowBody();
          return new ASTNode('ArrowFn',{params:[],body,isAsync:false},t.line,t.col);
        }
        return new ASTNode('ArrayLit',{elements:[]},t.line,t.col);
      }
      if(this._lookAheadArrow()) {
        const params=this._parseArrowParams();
        this.eat(TokenType.OPERATOR,'=>');
        const body=this.check(TokenType.PUNCTUATION,'{')?this.parseBlock():this._parseArrowBody();
        return new ASTNode('ArrowFn',{params,body,isAsync:false},t.line,t.col);
      }
      const expr=this.parseExpr();
      if(this.check(TokenType.PUNCTUATION,',')) {
        const exprs=[expr];
        while(this.eatIf(TokenType.PUNCTUATION,',')) exprs.push(this.parseExpr());
        this.eat(TokenType.PUNCTUATION,')');
        return new ASTNode('SequenceExpr',{exprs},t.line,t.col);
      }
      this.eat(TokenType.PUNCTUATION,')');
      return expr;
    }
    if(t.type===TokenType.PUNCTUATION&&t.value==='[') { return this.parseArrayLit(); }
    if(t.type===TokenType.PUNCTUATION&&t.value==='{') { return this.parseObjectLit(); }
    if(t.type===TokenType.OPERATOR&&t.value==='@') {
      const decs=this.parseDecorators();
      const stmt=this.parseStmt();
      return new ASTNode('DecoratedExpr',{decorators:decs,expr:stmt},t.line,t.col);
    }
    this.parseError(`Unexpected token '${t.value}' (${t.type})`);
  }

  _parseArrowBody() {
    const t = this.peek();
    if (t.type === TokenType.KEYWORD) {
      if (t.value === 'log') return this.parseStmt();
      if (t.value === 'if') return this.parseStmt();
      if (t.value === 'unless') return this.parseStmt();
      if (t.value === 'return') return this.parseStmt();
      if (t.value === 'throw') return this.parseStmt();
      if (t.value === 'raise') return this.parseStmt();
      if (t.value === 'var' || t.value === 'val' || t.value === 'let' || t.value === 'const') return this.parseStmt();
    }
    return this.parseExpr();
  }
  _lookAheadArrow() {
    let d=0, i=this.pos;
    const toks=this.tokens;
    while(i<toks.length) {
      const tok=toks[i];
      if(tok.value==='('||tok.value==='[') d++;
      if(tok.value===')'||tok.value===']') {
        if(d===0) { const nx=toks[i+1]; return nx&&nx.type===TokenType.OPERATOR&&nx.value==='=>'; }
        d--;
      }
      i++;
    }
    return false;
  }
  _parseArrowParams() {
    const params=[];
    while(!this.check(TokenType.PUNCTUATION,')')) {
      let rest=false, name, typeAnn=null, defaultVal=null;
      if(this.check(TokenType.OPERATOR,'...')) { this.advance(); rest=true; }
      if(this.check(TokenType.IDENTIFIER)) name=this.advance().value;
      else name='_';
      const opt=this.eatIf(TokenType.OPERATOR,'?');
      if(this.check(TokenType.OPERATOR,':')) { this.advance(); typeAnn=this.parseTypeExpr(); }
      if(!rest&&this.eatIf(TokenType.OPERATOR,'=')) defaultVal=this.parseExpr();
      params.push({name,typeAnn,defaultVal,rest,optional:opt});
      if(!this.check(TokenType.PUNCTUATION,')')) this.eat(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,')');
    return params;
  }
  parseArrayLit() {
    const t=this.eat(TokenType.PUNCTUATION,'['); const els=[];
    while(!this.check(TokenType.PUNCTUATION,']')) {
      if(this.check(TokenType.PUNCTUATION,',')) { els.push(null); this.advance(); continue; }
      els.push(this.parseExpr());
      if(!this.check(TokenType.PUNCTUATION,']')) this.eat(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,']');
    return new ASTNode('ArrayLit',{elements:els},t.line,t.col);
  }
  parseObjectLit() {
    const t=this.eat(TokenType.PUNCTUATION,'{'); const props=[];
    while(!this.check(TokenType.PUNCTUATION,'}')) {
      if(this.check(TokenType.OPERATOR,'...')) { this.advance(); props.push({kind:'spread',arg:this.parseExpr()}); this.eatIf(TokenType.PUNCTUATION,','); continue; }
      let key, computed=false;
      if(this.check(TokenType.PUNCTUATION,'[')) { this.advance(); key=this.parseExpr(); this.eat(TokenType.PUNCTUATION,']'); computed=true; }
      else { key=(this.check(TokenType.IDENTIFIER)||this.check(TokenType.KEYWORD)||this.check(TokenType.STRING))?this.advance().value:this.parseError('Expected object key'); }
      const isGet=key==='get'&&this.check(TokenType.IDENTIFIER);
      const isSet=key==='set'&&this.check(TokenType.IDENTIFIER);
      if(isGet||isSet) {
        const mname=this.advance().value;
        const params=this.parseFnParams(); const body=this.parseBlock();
        props.push({kind:'method',key:mname,params,body,isGet,isSet}); this.eatIf(TokenType.PUNCTUATION,','); continue;
      }
      if(this.check(TokenType.PUNCTUATION,'(')) {
        const params=this.parseFnParams(); const body=this.parseBlock();
        props.push({kind:'method',key,params,body,computed}); this.eatIf(TokenType.PUNCTUATION,','); continue;
      }
      if(this.eatIf(TokenType.OPERATOR,':')) {
        const value=this.parseExpr();
        props.push({kind:'prop',key,value,computed});
      } else {
        props.push({kind:'shorthand',key,computed});
      }
      this.eatIf(TokenType.PUNCTUATION,',');
    }
    this.eat(TokenType.PUNCTUATION,'}');
    return new ASTNode('ObjectLit',{props},t.line,t.col);
  }
}
function parse(tokens, filename) { return new Parser(tokens, filename).parse(); }
module.exports = { parse, Parser, ASTNode };
