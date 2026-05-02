'use strict';

// Lexer — tokenises NTL source code into a flat array of Token objects.
//
// Performance notes:
//   - Keywords are stored in a Set for O(1) lookup.
//   - Multi-character operators are sorted longest-first (greedy match, no backtrack).
//   - Hot-path character tests use direct string comparison, not regex.
//   - Config is loaded lazily and cached — only the first call pays the YAML parse cost.
//
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

let _keywordsFromConfig = null;

/**
 * Loads keywords from config/keywords.yaml, falling back to BUILTIN_KEYWORDS.
 * Result is module-level cached.
 * @returns {Set<string>|null}
 */
function loadKeywordsFromConfig() {
  if (_keywordsFromConfig) return _keywordsFromConfig;
  try {
    const loader = require('../config/loader');
    const cfg    = loader.load('keywords');
    const all    = [];
    if (cfg && cfg.keywords) {
      for (const category of Object.values(cfg.keywords)) {
        if (Array.isArray(category)) {
          all.push(...category);
        } else if (category && typeof category === 'object') {
          for (const words of Object.values(category)) {
            if (Array.isArray(words)) all.push(...words);
          }
        }
      }
    }
    if (all.length) {
      _keywordsFromConfig = new Set(all);
      return _keywordsFromConfig;
    }
  } catch (_) { /* fall back to built-in list */ }
  return null;
}

const TokenType = {
  KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', NUMBER: 'NUMBER',
  STRING: 'STRING', TEMPLATE: 'TEMPLATE', OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION', REGEX: 'REGEX', EOF: 'EOF',
};

/**
 * Complete set of reserved NTL keywords.
 * Fallback when config/keywords.yaml is absent.
 * @type {Set<string>}
 */
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

/**
 * Multi-character operators sorted longest-first for greedy matching.
 * The scanner tries each entry in order and takes the first match,
 * so longer operators always win over their shorter prefixes.
 * @type {string[]}
 */
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
].sort((a, b) => b.length - a.length);

const SINGLE_OPS  = new Set(['+','-','*','/','%','=','<','>','!','&','|','^','~','?',':','@','#']);
const PUNCTUATION = new Set(['{','}','(',')',']','[',',','.', ';']);

/** @returns {Set<string>} */
function getKeywords() {
  return loadKeywordsFromConfig() || BUILTIN_KEYWORDS;
}

// Fast character-class helpers — used in the tokenise hot path.
const isDigit      = c => c >= '0' && c <= '9';
const isIdentStart = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
const isIdentPart  = c => isIdentStart(c) || isDigit(c);
const isHexDigit   = c => isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');

class Token {
  /**
   * @param {string} type
   * @param {string|object} value
   * @param {number} line
   * @param {number} col
   */
  constructor(type, value, line, col) {
    this.type  = type;
    this.value = value;
    this.line  = line;
    this.col   = col;
  }
}

class Lexer {
  /**
   * @param {string} source
   * @param {string} [filename]
   */
  constructor(source, filename) {
    this.source    = source;
    this.filename  = filename || '<unknown>';
    this.pos       = 0;
    this.line      = 1;
    this.col       = 1;
    this.tokens    = [];
    this.lines     = source.split('\n');
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
    if (this.source.startsWith(str, this.pos)) {
      this.pos += str.length; this.col += str.length; return true;
    }
    return false;
  }

  /** Skips whitespace, // line comments, block comments, and ## NTL comments. */
  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { this.advance(); continue; }
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

  /**
   * Reads a single- or double-quoted string, handling all escape sequences.
   * @param {string} quote
   * @returns {string}
   */
  readString(quote) {
    let val = '';
    this.advance(); // consume opening quote
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc    = this.advance();
        const escMap = { n:'\n', t:'\t', r:'\r', '\\':'\\', "'"  :"'", '"':'"', '`':'`', '0':'\0', b:'\b', f:'\f' };
        if (esc === 'u') {
          if (this.peek() === '{') {
            this.advance(); let code = '';
            while (this.peek() !== '}') code += this.advance();
            this.advance(); val += String.fromCodePoint(parseInt(code, 16));
          } else {
            let code = ''; for (let i = 0; i < 4; i++) code += this.advance();
            val += String.fromCharCode(parseInt(code, 16));
          }
        } else if (esc === 'x') {
          let code = ''; for (let i = 0; i < 2; i++) code += this.advance();
          val += String.fromCharCode(parseInt(code, 16));
        } else {
          val += escMap[esc] || esc;
        }
      } else {
        val += this.advance();
      }
    }
    this.advance(); // consume closing quote
    return val;
  }

  /**
   * Reads a backtick template literal.
   * `${...}` interpolation segments are preserved verbatim for later code-gen.
   * @returns {string}
   */
  readTemplate() {
    let val = '';
    this.advance(); // consume opening backtick
    while (this.pos < this.source.length && this.peek() !== '`') {
      if (this.peek() === '$' && this.peek(1) === '{') {
        val += '${'; this.advance(); this.advance();
        let depth = 1;
        while (this.pos < this.source.length && depth > 0) {
          if      (this.peek() === '{') depth++;
          else if (this.peek() === '}') depth--;
          if (depth > 0) val += this.advance(); else this.advance();
        }
        val += '}';
      } else if (this.peek() === '\\') {
        this.advance(); const esc = this.advance();
        const escMap = { n:'\n', t:'\t', r:'\r', '\\':'\\', '`':'`' };
        val += escMap[esc] || esc;
      } else {
        val += this.advance();
      }
    }
    this.advance(); // consume closing backtick
    return val;
  }

  /**
   * Reads an integer or floating-point literal.
   * Supports decimal, hex (`0x`), octal (`0o`), binary (`0b`),
   * numeric separators (`_`), exponents, and BigInt suffix (`n`).
   * @returns {string} Raw lexeme text.
   */
  readNumber() {
    const start = this.pos;
    if (this.peek() === '0') {
      const next = this.peek(1);
      if (next === 'x' || next === 'X') {
        this.advance(); this.advance();
        while (isHexDigit(this.peek()) || this.peek() === '_') this.advance();
        return this.source.slice(start, this.pos);
      }
      if (next === 'o' || next === 'O') {
        this.advance(); this.advance();
        while ((this.peek() >= '0' && this.peek() <= '7') || this.peek() === '_') this.advance();
        return this.source.slice(start, this.pos);
      }
      if (next === 'b' || next === 'B') {
        this.advance(); this.advance();
        while (this.peek() === '0' || this.peek() === '1' || this.peek() === '_') this.advance();
        return this.source.slice(start, this.pos);
      }
    }
    while (isDigit(this.peek()) || this.peek() === '_') this.advance();
    if (this.peek() === '.' && isDigit(this.peek(1))) {
      this.advance();
      while (isDigit(this.peek()) || this.peek() === '_') this.advance();
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') this.advance();
      while (isDigit(this.peek())) this.advance();
    }
    if (this.peek() === 'n') this.advance(); // BigInt
    return this.source.slice(start, this.pos);
  }

  /** Reads an identifier or keyword name. */
  readIdentifier() {
    const start = this.pos;
    while (isIdentPart(this.peek())) this.advance();
    return this.source.slice(start, this.pos);
  }

  /**
   * Returns true if `/` at the current position should start a regex.
   * Uses the same heuristic as V8 and esprima: a `/` after a value
   * (number, string, identifier, `)`, `]`) is division; otherwise regex.
   * @param {Token|undefined} prevToken
   * @returns {boolean}
   */
  couldBeRegex(prevToken) {
    if (!prevToken) return true;
    const t = prevToken.type, v = prevToken.value;
    if (t === 'NUMBER' || t === 'STRING' || t === 'TEMPLATE') return false;
    if (t === 'IDENTIFIER' || (t === 'KEYWORD' && (v === 'this' || v === 'null' || v === 'true' || v === 'false'))) return false;
    if (t === 'PUNCTUATION' && (v === ')' || v === ']')) return false;
    return true;
  }

  /**
   * Reads a regex literal after the opening `/` is confirmed.
   * Correctly handles `[…]` character classes and `\/` escapes.
   * @returns {{ pattern: string, flags: string }}
   */
  readRegex() {
    this.advance(); // consume opening `/`
    let pattern = '', inClass = false;
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === '\\') { pattern += ch; this.advance(); pattern += this.advance(); continue; }
      if (ch === '[')  { inClass = true;  pattern += this.advance(); continue; }
      if (ch === ']')  { inClass = false; pattern += this.advance(); continue; }
      if (ch === '/' && !inClass) { this.advance(); break; }
      if (ch === '\n') break; // unterminated — parser will report
      pattern += this.advance();
    }
    let flags = '';
    while (/[gimsuy]/.test(this.peek())) flags += this.advance();
    return { pattern, flags };
  }

  /**
   * Main tokenisation pass.
   * @returns {Token[]}
   */
  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const line = this.line, col = this.col;
      const ch   = this.peek();

      // Numbers
      if (isDigit(ch) || (ch === '.' && isDigit(this.peek(1)))) {
        this.tokens.push(new Token(TokenType.NUMBER, this.readNumber(), line, col)); continue;
      }
      // Strings
      if (ch === '"' || ch === "'") {
        this.tokens.push(new Token(TokenType.STRING, this.readString(ch), line, col)); continue;
      }
      if (ch === '`') {
        this.tokens.push(new Token(TokenType.TEMPLATE, this.readTemplate(), line, col)); continue;
      }
      // Identifiers & keywords
      if (isIdentStart(ch)) {
        const word = this.readIdentifier();
        const type = this._keywords.has(word) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
        this.tokens.push(new Token(type, word, line, col)); continue;
      }
      // Regex (must be checked before `/` operator)
      if (ch === '/' && this.couldBeRegex(this.tokens[this.tokens.length - 1])) {
        if (this.peek(1) !== '/' && this.peek(1) !== '*') {
          this.tokens.push(new Token(TokenType.REGEX, this.readRegex(), line, col)); continue;
        }
      }
      // Multi-character operators (greedy, sorted longest-first)
      let matched = false;
      for (const op of MULTI_CHAR_OPS) {
        if (this.source.startsWith(op, this.pos)) {
          this.tokens.push(new Token(TokenType.OPERATOR, op, line, col));
          this.pos += op.length; this.col += op.length;
          matched = true; break;
        }
      }
      if (matched) continue;
      // Single-character operators
      if (SINGLE_OPS.has(ch)) {
        this.tokens.push(new Token(TokenType.OPERATOR, ch, line, col)); this.advance(); continue;
      }
      // Punctuation
      if (PUNCTUATION.has(ch)) {
        this.tokens.push(new Token(TokenType.PUNCTUATION, ch, line, col)); this.advance(); continue;
      }
      this.advance(); // unknown character — skip
    }
    this.tokens.push(new Token(TokenType.EOF, '', this.line, this.col));
    return this.tokens;
  }
}

/**
 * Tokenises NTL source and returns the token array.
 * @param {string} source
 * @param {string} [filename]
 * @returns {Token[]}
 */
function tokenize(source, filename) {
  return new Lexer(source, filename).tokenize();
}

module.exports = { Lexer, Token, TokenType, tokenize, BUILTIN_KEYWORDS, getKeywords };
