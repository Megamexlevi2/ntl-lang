'use strict';

// Lexer — tokenizes NTL source code
// Loads keyword list from config/keywords.yaml when available, otherwise falls back to built-in defaults
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

let _keywordsFromConfig = null;

function loadKeywordsFromConfig() {
  if (_keywordsFromConfig) return _keywordsFromConfig;
  try {
    const loader = require('../config/loader');
    const cfg    = loader.load('keywords');
    const all    = [];
    if (cfg && cfg.keywords) {
      for (const category of Object.values(cfg.keywords)) {
        if (Array.isArray(category)) all.push(...category);
        else if (category && typeof category === 'object') {
          for (const words of Object.values(category)) {
            if (Array.isArray(words)) all.push(...words);
          }
        }
      }
    }
    if (all.length) { _keywordsFromConfig = new Set(all); return _keywordsFromConfig; }
  } catch(_) {}
  return null;
}

const TokenType = {
  KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', NUMBER: 'NUMBER',
  STRING: 'STRING', TEMPLATE: 'TEMPLATE', OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION', REGEX: 'REGEX', EOF: 'EOF'
};

const BUILTIN_KEYWORDS = new Set([
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
  'ifset','have','ifhave','Not',
  'between','matches','startsWith','endsWith',
  'is','not',
  'enum','type','alias',
  'require','ntl','nax',
  'static','get','set','readonly','private','public','protected',
  'do','yield','spawn','select','channel','component',
  'macro','immutable','freeze',
  'delete',
  'with','using',
  'namespace','module',
  'satisfies','assert',
  'repeat','guard','defer','each','log','range','sleep',
  'state',
]);

function getKeywords() {
  return loadKeywordsFromConfig() || BUILTIN_KEYWORDS;
}

const MULTI_CHAR_OPS = [
  '===','!==','<<=','>>=',
  '**=','&&=','||=','??=',
  '==','!=','<=','>=',
  '&&','||','??','|>',
  '=>','->','++','--',
  '+=','-=','*=','/=','%=','**=',
  '<<','>>','>>>','?.','...',
  '::','**','@',
  '..',
];

const SINGLE_OPS    = new Set(['+','-','*','/','%','=','<','>','!','&','|','^','~','?',':','@','#']);
const PUNCTUATION   = new Set(['{','}','(',')',']','[',',','.', ';']);

class Token {
  constructor(type, value, line, col) {
    this.type  = type;
    this.value = value;
    this.line  = line;
    this.col   = col;
  }
}

class Lexer {
  constructor(source, filename) {
    this.source   = source;
    this.filename = filename || '<unknown>';
    this.pos      = 0;
    this.line     = 1;
    this.col      = 1;
    this.tokens   = [];
    this.lines    = source.split('\n');
    this._keywords = getKeywords();
  }

  peek(o) { o = o || 0; return this.source[this.pos + o] || '\0'; }

  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; }
    else             { this.col++; }
    return ch;
  }

  match(str) {
    if (this.source.startsWith(str, this.pos)) { this.pos += str.length; this.col += str.length; return true; }
    return false;
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') { this.advance(); continue; }
      if (ch === '\n') { this.advance(); continue; }
      if (ch === '/' && this.peek(1) === '/') {
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (this.pos < this.source.length && !(this.peek() === '*' && this.peek(1) === '/')) this.advance();
        if (this.pos < this.source.length) { this.advance(); this.advance(); }
        continue;
      }
      if (ch === '#' && this.peek(1) === '#') {
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }
      break;
    }
  }

  readString(quote) {
    let val = '';
    this.advance();
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        const escMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '`': '`', '0': '\0', 'b': '\b', 'f': '\f' };
        if (esc === 'u') {
          if (this.peek() === '{') {
            this.advance();
            let code = '';
            while (this.peek() !== '}') code += this.advance();
            this.advance();
            val += String.fromCodePoint(parseInt(code, 16));
          } else {
            let code = '';
            for (let i = 0; i < 4; i++) code += this.advance();
            val += String.fromCharCode(parseInt(code, 16));
          }
        } else if (esc === 'x') {
          let code = '';
          for (let i = 0; i < 2; i++) code += this.advance();
          val += String.fromCharCode(parseInt(code, 16));
        } else {
          val += escMap[esc] || esc;
        }
      } else {
        val += this.advance();
      }
    }
    this.advance();
    return val;
  }

  readTemplate() {
    let val = '';
    this.advance();
    while (this.pos < this.source.length && this.peek() !== '`') {
      if (this.peek() === '$' && this.peek(1) === '{') {
        val += '${';
        this.advance(); this.advance();
        let depth = 1;
        while (this.pos < this.source.length && depth > 0) {
          if (this.peek() === '{') depth++;
          else if (this.peek() === '}') depth--;
          if (depth > 0) val += this.advance();
          else this.advance();
        }
        val += '}';
      } else if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        const escMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', '`': '`' };
        val += escMap[esc] || esc;
      } else {
        val += this.advance();
      }
    }
    this.advance();
    return val;
  }

  readNumber() {
    const start = this.pos;
    if (this.peek() === '0') {
      if (this.peek(1) === 'x' || this.peek(1) === 'X') {
        this.advance(); this.advance();
        while (/[0-9a-fA-F_]/.test(this.peek())) this.advance();
        return this.source.slice(start, this.pos);
      }
      if (this.peek(1) === 'o' || this.peek(1) === 'O') {
        this.advance(); this.advance();
        while (/[0-7_]/.test(this.peek())) this.advance();
        return this.source.slice(start, this.pos);
      }
      if (this.peek(1) === 'b' || this.peek(1) === 'B') {
        this.advance(); this.advance();
        while (/[01_]/.test(this.peek())) this.advance();
        return this.source.slice(start, this.pos);
      }
    }
    while (/[\d_]/.test(this.peek())) this.advance();
    if (this.peek() === '.' && /\d/.test(this.peek(1))) {
      this.advance();
      while (/[\d_]/.test(this.peek())) this.advance();
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') this.advance();
      while (/\d/.test(this.peek())) this.advance();
    }
    if (this.peek() === 'n') this.advance();
    return this.source.slice(start, this.pos);
  }

  readIdentifier() {
    const start = this.pos;
    while (/[\w$]/.test(this.peek())) this.advance();
    return this.source.slice(start, this.pos);
  }

  couldBeRegex(prevToken) {
    if (!prevToken) return true;
    const t = prevToken.type, v = prevToken.value;
    if (t === 'NUMBER' || t === 'STRING' || t === 'TEMPLATE') return false;
    if (t === 'IDENTIFIER' || (t === 'KEYWORD' && (v === 'this' || v === 'null' || v === 'true' || v === 'false'))) return false;
    if (t === 'PUNCTUATION' && (v === ')' || v === ']')) return false;
    return true;
  }

  readRegex() {
    let val = '/';
    this.advance();
    let inClass = false;
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === '\\') { val += ch; this.advance(); val += this.advance(); continue; }
      if (ch === '[')  { inClass = true;  val += this.advance(); continue; }
      if (ch === ']')  { inClass = false; val += this.advance(); continue; }
      if (ch === '/' && !inClass) { this.advance(); break; }
      if (ch === '\n') break;
      val += this.advance();
    }
    val += '/';
    while (/[gimsuy]/.test(this.peek())) val += this.advance();
    return val;
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const line = this.line, col = this.col;
      const ch   = this.peek();

      if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.peek(1)))) {
        this.tokens.push(new Token(TokenType.NUMBER, this.readNumber(), line, col));
        continue;
      }

      if (ch === '"' || ch === "'") {
        this.tokens.push(new Token(TokenType.STRING, this.readString(ch), line, col));
        continue;
      }

      if (ch === '`') {
        this.tokens.push(new Token(TokenType.TEMPLATE, this.readTemplate(), line, col));
        continue;
      }

      if (/[$_a-zA-Z]/.test(ch)) {
        const word = this.readIdentifier();
        const type = this._keywords.has(word) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
        this.tokens.push(new Token(type, word, line, col));
        continue;
      }

      if (ch === '/' && this.couldBeRegex(this.tokens[this.tokens.length - 1])) {
        if (this.peek(1) !== '/' && this.peek(1) !== '*') {
          this.tokens.push(new Token(TokenType.REGEX, this.readRegex(), line, col));
          continue;
        }
      }

      let matched = false;
      for (const op of MULTI_CHAR_OPS) {
        if (this.source.startsWith(op, this.pos)) {
          this.tokens.push(new Token(TokenType.OPERATOR, op, line, col));
          this.pos += op.length; this.col += op.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      if (SINGLE_OPS.has(ch)) {
        this.tokens.push(new Token(TokenType.OPERATOR, ch, line, col));
        this.advance();
        continue;
      }

      if (PUNCTUATION.has(ch)) {
        this.tokens.push(new Token(TokenType.PUNCTUATION, ch, line, col));
        this.advance();
        continue;
      }

      this.advance();
    }

    this.tokens.push(new Token(TokenType.EOF, '', this.line, this.col));
    return this.tokens;
  }
}

function tokenize(source, filename) {
  return new Lexer(source, filename).tokenize();
}

module.exports = { Lexer, Token, TokenType, tokenize, BUILTIN_KEYWORDS, getKeywords };
