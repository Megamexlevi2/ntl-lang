'use strict';
const TokenType = {
  KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', NUMBER: 'NUMBER',
  STRING: 'STRING', TEMPLATE: 'TEMPLATE', OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION', EOF: 'EOF'
};
const KEYWORDS = new Set([
  'var','val','let','const','fn','async','await',
  'if','else','unless','elif',
  'while','for','loop','in','of','break','continue',
  'return','raise','throw',
  'class','extends','new','this','super','abstract','override',
  'interface','implements','trait',
  'try','catch','finally',
  'match','case','default','when',
  'import','export','from','as',
  'true','false','null','void','undefined',
  'typeof','instanceof','keyof','infer',
  'ifset','have',
  'enum','type','alias',
  'require','ntl',
  'static','get','set','readonly','private','public','protected',
  'do','yield','spawn','select','channel',
  'macro','immutable','freeze',
  'with','using',
  'namespace','module',
  'satisfies','assert'
]);
const MULTI_CHAR_OPS = [
  '===','!==','<<=','>>=',
  '**=','&&=','||=','??=',
  '==','!=','<=','>=',
  '&&','||','??','|>',
  '=>','->','++','--',
  '+=','-=','*=','/=','%=','**=',
  '<<','>>','>>>','?.','...',
  '::', '**', '@'
];
const SINGLE_OPS = new Set(['+','-','*','/','%','=','<','>','!','&','|','^','~','?',':','@','#']);
const PUNCTUATION = new Set(['{','}','(',')',']','[',',','.', ';']);
class Token {
  constructor(type, value, line, col) { this.type = type; this.value = value; this.line = line; this.col = col; }
}
class Lexer {
  constructor(source, filename) {
    this.source = source;
    this.filename = filename || '<unknown>';
    this.pos = 0; this.line = 1; this.col = 1;
    this.tokens = [];
    this.lines = source.split('\n');
  }
  peek(o) { o = o || 0; return this.source[this.pos + o] || '\0'; }
  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }
  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { this.advance(); continue; }
      if (ch === '/' && this.peek(1) === '/') { while (this.peek() !== '\n' && this.pos < this.source.length) this.advance(); continue; }
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (!(this.peek() === '*' && this.peek(1) === '/') && this.pos < this.source.length) this.advance();
        if (this.pos < this.source.length) { this.advance(); this.advance(); }
        continue;
      }
      if (ch === '#') { while (this.peek() !== '\n' && this.pos < this.source.length) this.advance(); continue; }
      break;
    }
  }
  readString(q) {
    const sl = this.line, sc = this.col;
    this.advance();
    let raw = '', parts = [];
    while (this.peek() !== q && this.pos < this.source.length) {
      if (this.peek() === '\n') this.lexError('Unterminated string', sl, sc);
      if (this.peek() === '\\') {
        this.advance();
        const e = this.advance();
        const ESC = {'n':'\n','t':'\t','r':'\r','\\':'\\','"':'"',"'":'\'','0':'\0'};
        if (e === 'u') {
          if (this.peek() === '{') {
            this.advance(); let hex = '';
            while (this.peek() !== '}') hex += this.advance();
            this.advance(); raw += String.fromCodePoint(parseInt(hex,16));
          } else { let hex=''; for (let i=0;i<4;i++) hex+=this.advance(); raw+=String.fromCharCode(parseInt(hex,16)); }
        } else { raw += ESC[e] !== undefined ? ESC[e] : e; }
        continue;
      }
      if (this.peek() === '{' && q !== "'") {
        if (raw) { parts.push({kind:'str',value:raw}); raw=''; }
        this.advance(); let depth=1, expr='';
        while (depth>0 && this.pos<this.source.length) {
          const c=this.peek();
          if(c==='{') depth++; if(c==='}'){depth--;if(depth===0){this.advance();break;}}
          expr+=this.advance();
        }
        parts.push({kind:'expr',source:expr}); continue;
      }
      raw += this.advance();
    }
    if (this.peek() !== q) this.lexError('Unterminated string', sl, sc);
    this.advance();
    if (parts.filter(p=>p.kind==='expr').length > 0) {
      if (raw) parts.push({kind:'str',value:raw});
      return new Token(TokenType.TEMPLATE, parts, sl, sc);
    }
    return new Token(TokenType.STRING, raw, sl, sc);
  }
  readTemplateLiteral() {
    const sl=this.line, sc=this.col;
    this.advance(); let raw='', parts=[];
    while (this.peek() !== '`' && this.pos < this.source.length) {
      if (this.peek() === '\\') {
        this.advance(); const e=this.advance();
        const ESC={'n':'\\n','t':'\\t','`':'`','$':'$','\\':'\\\\'};
        raw += ESC[e] !== undefined ? ESC[e] : '\\'+e; continue;
      }
      if (this.peek() === '$' && this.peek(1) === '{') {
        if (raw) { parts.push({kind:'str',value:raw}); raw=''; }
        this.advance(); this.advance(); let depth=1, expr='';
        while (depth>0 && this.pos<this.source.length) {
          const c=this.peek();
          if(c==='{') depth++; if(c==='}'){depth--;if(depth===0){this.advance();break;}}
          expr+=this.advance();
        }
        parts.push({kind:'expr',source:expr}); continue;
      }
      raw += this.advance();
    }
    if (this.peek() !== '`') this.lexError('Unterminated template literal', sl, sc);
    this.advance();
    if (raw) parts.push({kind:'str',value:raw});
    return new Token(TokenType.TEMPLATE, parts, sl, sc);
  }
  readNumber() {
    const sl=this.line, sc=this.col; let val='';
    if (this.peek()==='0' && /[xX]/.test(this.peek(1))) {
      val+=this.advance()+this.advance();
      while(/[0-9a-fA-F_]/.test(this.peek())) { const c=this.advance(); if(c!=='_') val+=c; }
      return new Token(TokenType.NUMBER, parseInt(val,16), sl, sc);
    }
    if (this.peek()==='0' && /[bB]/.test(this.peek(1))) {
      val+=this.advance()+this.advance();
      while(/[01_]/.test(this.peek())) { const c=this.advance(); if(c!=='_') val+=c; }
      return new Token(TokenType.NUMBER, parseInt(val.slice(2),2), sl, sc);
    }
    if (this.peek()==='0' && /[oO]/.test(this.peek(1))) {
      val+=this.advance()+this.advance();
      while(/[0-7_]/.test(this.peek())) { const c=this.advance(); if(c!=='_') val+=c; }
      return new Token(TokenType.NUMBER, parseInt(val.slice(2),8), sl, sc);
    }
    while(/[0-9_]/.test(this.peek())) { const c=this.advance(); if(c!=='_') val+=c; }
    if (this.peek()==='.' && /[0-9]/.test(this.peek(1))) {
      val+=this.advance();
      while(/[0-9_]/.test(this.peek())) { const c=this.advance(); if(c!=='_') val+=c; }
    }
    if (/[eE]/.test(this.peek())) {
      val+=this.advance();
      if(/[+\-]/.test(this.peek())) val+=this.advance();
      while(/[0-9]/.test(this.peek())) val+=this.advance();
    }
    if (this.peek()==='n') { this.advance(); return new Token(TokenType.NUMBER, BigInt(val), sl, sc); }
    return new Token(TokenType.NUMBER, parseFloat(val), sl, sc);
  }
  readIdent() {
    const sl=this.line, sc=this.col; let val='';
    while(/[a-zA-Z0-9_$]/.test(this.peek())) val+=this.advance();
    return new Token(KEYWORDS.has(val)?TokenType.KEYWORD:TokenType.IDENTIFIER, val, sl, sc);
  }
  readOp() {
    const sl=this.line, sc=this.col;
    for (const op of MULTI_CHAR_OPS) {
      let match=true;
      for (let i=0;i<op.length;i++) if(this.peek(i)!==op[i]){match=false;break;}
      if(match) { for(let i=0;i<op.length;i++) this.advance(); return new Token(TokenType.OPERATOR,op,sl,sc); }
    }
    const ch=this.peek();
    if(SINGLE_OPS.has(ch)) { this.advance(); return new Token(TokenType.OPERATOR,ch,sl,sc); }
    return null;
  }
  lexError(msg, line, col) {
    const l=line||this.line, c=col||this.col;
    const src=this.lines[l-1]||'';
    throw Object.assign(new Error(`${msg}\n  --> ${this.filename}:${l}:${c}\n   |\n ${String(l).padStart(3)} | ${src}\n   | ${' '.repeat(c-1)}^`), {
      ntlError:true, phase:'lex', line:l, col:c, file:this.filename
    });
  }
  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;
      const ch=this.peek(), line=this.line, col=this.col;
      if (ch==='"'||ch==="'") { this.tokens.push(this.readString(ch)); continue; }
      if (ch==='`') { this.tokens.push(this.readTemplateLiteral()); continue; }
      if (/[0-9]/.test(ch)||(ch==='.'&&/[0-9]/.test(this.peek(1)))) { this.tokens.push(this.readNumber()); continue; }
      if (/[a-zA-Z_$]/.test(ch)) { this.tokens.push(this.readIdent()); continue; }
      if (ch==='.'&&this.peek(1)==='.'&&this.peek(2)==='.') {
        this.advance();this.advance();this.advance();
        this.tokens.push(new Token(TokenType.OPERATOR,'...',line,col)); continue;
      }
      if (PUNCTUATION.has(ch)) { this.tokens.push(new Token(TokenType.PUNCTUATION,this.advance(),line,col)); continue; }
      const op=this.readOp();
      if (op) { this.tokens.push(op); continue; }
      this.lexError(`Unexpected character '${ch}'`);
    }
    this.tokens.push(new Token(TokenType.EOF,null,this.line,this.col));
    return this.tokens;
  }
}
function tokenize(source, filename) { return new Lexer(source, filename).tokenize(); }
module.exports = { tokenize, Lexer, Token, TokenType, KEYWORDS };
