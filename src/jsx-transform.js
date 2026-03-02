// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.
//
// NTL JSX Transform — converts JSX syntax to React.createElement calls
// Supports: elements, fragments, self-closing, spread props, nested expressions

'use strict';

class JSXTransformer {
  constructor(opts) {
    opts = opts || {};
    this.pragma      = opts.pragma      || 'React.createElement';
    this.pragmaFrag  = opts.pragmaFrag  || 'React.Fragment';
    this.autoImport  = opts.importReact !== false;
    this._usedJSX    = false;
    this._filename   = opts.filename || '<unknown>';
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  transform(source) {
    this._src = source;
    this._pos = 0;
    this._usedJSX = false;

    const code = this._processSource();

    let output = code;
    if (this._usedJSX && this.autoImport) {
      if (!/require\(["']react["']\)|import\s+React/.test(source)) {
        output = `const React = require("react");\n` + output;
      }
    }
    return { success: true, code: output, usedJSX: this._usedJSX };
  }

  // ─── Top-level source processing ──────────────────────────────────────────

  _processSource() {
    let out = '';
    while (this._pos < this._src.length) {
      // Skip strings
      if (this._cur() === '"' || this._cur() === "'") {
        out += this._consumeStr(this._cur()); continue;
      }
      if (this._cur() === '`') {
        out += this._consumeTpl(); continue;
      }
      // Skip comments
      if (this._cur() === '/' && this._next() === '/') {
        out += this._consumeLineComment(); continue;
      }
      if (this._cur() === '/' && this._next() === '*') {
        out += this._consumeBlockComment(); continue;
      }
      // JSX element or fragment
      if (this._cur() === '<') {
        const jsx = this._tryJSX();
        if (jsx !== null) { out += jsx; this._usedJSX = true; continue; }
      }
      out += this._advance();
    }
    return out;
  }

  // Process an arbitrary expression string (recursively transforms JSX inside it)
  _transformExpr(expr) {
    const saved = { src: this._src, pos: this._pos };
    this._src = expr;
    this._pos = 0;
    const result = this._processSource();
    this._src = saved.src;
    this._pos = saved.pos;
    return result;
  }

  // ─── JSX Detection & Entry ─────────────────────────────────────────────────

  _tryJSX() {
    // Fragment: <>
    if (this._cur() === '<' && this._peek(1) === '>') {
      return this._parseFragment();
    }
    // Element: <TagName or <tag
    if (this._cur() === '<' && /[A-Za-z_$]/.test(this._peek(1))) {
      const savedPos = this._pos;
      const result = this._parseElement();
      if (result === null) { this._pos = savedPos; }
      return result;
    }
    return null;
  }

  // ─── Fragment <> ... </> ───────────────────────────────────────────────────

  _parseFragment() {
    this._advance(); this._advance(); // <>
    const children = this._parseChildren('');
    if (this._cur() === '<' && this._peek(1) === '/' && this._peek(2) === '>') {
      this._advance(); this._advance(); this._advance(); // </>
      const cArgs = children.length ? ', ' + children.join(', ') : '';
      return `${this.pragma}(${this.pragmaFrag}, null${cArgs})`;
    }
    return null;
  }

  // ─── Element <Tag ...> ... </Tag> or <Tag ... /> ───────────────────────────

  _parseElement() {
    if (this._cur() !== '<') return null;
    this._advance(); // <

    const tagName = this._readTagName();
    if (!tagName) return null;

    const props = this._readProps();
    this._skipWS();

    // Self-closing: />
    if (this._cur() === '/' && this._peek(1) === '>') {
      this._advance(); this._advance();
      const tag = this._tagRef(tagName);
      return `${this.pragma}(${tag}, ${this._propsToStr(props)})`;
    }

    // Opening tag close: >
    if (this._cur() !== '>') return null;
    this._advance();

    const children = this._parseChildren(tagName);

    // Closing tag: </TagName>
    if (this._cur() !== '<' || this._peek(1) !== '/') return null;
    this._advance(); this._advance(); // </
    const closeTag = this._readTagName();
    this._skipWS();
    if (this._cur() !== '>') return null;
    this._advance(); // >

    if (closeTag !== tagName) {
      throw new Error(`[ntl:jsx] Mismatched tags: <${tagName}> closed by </${closeTag}> in ${this._filename}`);
    }

    const tag = this._tagRef(tagName);
    const cArgs = children.length ? ', ' + children.join(', ') : '';
    return `${this.pragma}(${tag}, ${this._propsToStr(props)}${cArgs})`;
  }

  _tagRef(name) {
    // Uppercase or dotted (MyComp, React.Fragment) → reference; lowercase → string
    return /^[A-Z_$]|\./.test(name) ? name : `"${name}"`;
  }

  // ─── Props ─────────────────────────────────────────────────────────────────

  _readProps() {
    const props = [];
    while (this._pos < this._src.length) {
      this._skipWS();
      const ch = this._cur();
      if (ch === '/' || ch === '>') break;

      // Spread: {...obj}
      if (ch === '{' && this._peek(1) === '.' && this._peek(2) === '.' && this._peek(3) === '.') {
        this._advance(); this._advance(); this._advance(); this._advance(); // {...
        const expr = this._readBalanced('}');
        this._advance(); // }
        props.push({ spread: true, value: this._transformExpr(expr) });
        continue;
      }

      // Prop name (allows letters, digits, dash, colon for aria-*, data-*)
      let name = '';
      while (/[A-Za-z0-9_:.-]/.test(this._cur())) name += this._advance();
      if (!name) break;

      this._skipWS();

      // Boolean prop: <button disabled />
      if (this._cur() !== '=') {
        props.push({ name: this._normProp(name), value: 'true' });
        continue;
      }
      this._advance(); // =
      this._skipWS();

      let value;
      if (this._cur() === '{') {
        this._advance(); // {
        const expr = this._readBalanced('}');
        this._advance(); // }
        value = this._transformExpr(expr.trim());
      } else if (this._cur() === '"' || this._cur() === "'") {
        const q = this._advance();
        let s = '';
        while (this._cur() !== q && this._pos < this._src.length) {
          if (this._cur() === '\\') { s += this._advance(); }
          s += this._advance();
        }
        this._advance(); // closing quote
        value = `"${s}"`;
      } else {
        value = '';
        while (!/[\s/>]/.test(this._cur()) && this._pos < this._src.length) {
          value += this._advance();
        }
      }
      props.push({ name: this._normProp(name), value });
    }
    return props;
  }

  _normProp(name) {
    if (name === 'class') return 'className';
    if (name === 'for') return 'htmlFor';
    return name;
  }

  _propsToStr(props) {
    if (!props.length) return 'null';
    const spreads = props.filter(p => p.spread);
    const regular = props.filter(p => !p.spread);
    if (spreads.length) {
      const parts = [];
      if (regular.length) {
        parts.push(`{${regular.map(p => `${p.name}: ${p.value}`).join(', ')}}`);
      }
      spreads.forEach(s => parts.push(s.value));
      return `Object.assign({}, ${parts.join(', ')})`;
    }
    return `{${props.map(p => `${p.name}: ${p.value}`).join(', ')}}`;
  }

  // ─── Children ──────────────────────────────────────────────────────────────

  _parseChildren(tagName) {
    const children = [];
    let text = '';

    const flushText = () => {
      const t = text.replace(/\n\s*/g, ' ').trim();
      if (t) children.push(`"${t.replace(/"/g, '\\"')}"`);
      text = '';
    };

    while (this._pos < this._src.length) {
      // Closing tag detected
      if (this._cur() === '<' && this._peek(1) === '/') break;

      // Nested JSX element or fragment
      if (this._cur() === '<' && (this._peek(1) === '>' || /[A-Za-z_$]/.test(this._peek(1)))) {
        flushText();
        const jsx = this._tryJSX();
        if (jsx !== null) { children.push(jsx); this._usedJSX = true; continue; }
      }

      // Expression {expr} — recurse to transform any JSX inside
      if (this._cur() === '{') {
        flushText();
        this._advance(); // {
        const expr = this._readBalanced('}');
        this._advance(); // }
        const transformed = this._transformExpr(expr.trim());
        if (transformed) children.push(transformed);
        continue;
      }

      text += this._advance();
    }
    flushText();
    return children;
  }

  // ─── Character helpers ─────────────────────────────────────────────────────

  _cur()      { return this._src[this._pos] || '\0'; }
  _next()     { return this._src[this._pos + 1] || '\0'; }
  _peek(n)    { return this._src[this._pos + (n||0)] || '\0'; }
  _advance()  { return this._src[this._pos++] || ''; }
  _skipWS()   { while (/[ \t\r\n]/.test(this._cur())) this._advance(); }

  _readTagName() {
    let name = '';
    // Component names can have dots: React.Fragment, motion.div
    while (/[A-Za-z0-9_$.]/.test(this._cur())) name += this._advance();
    return name || null;
  }

  // Read until closeChar, respecting nesting of (), [], {}
  _readBalanced(closeChar) {
    const openOf = { '}': '{', ')': '(', ']': '[' };
    const open = openOf[closeChar];
    let depth = 1, result = '';
    while (this._pos < this._src.length) {
      const ch = this._cur();
      if (ch === '"' || ch === "'") { result += this._consumeStr(ch); continue; }
      if (ch === '`') { result += this._consumeTpl(); continue; }
      if (open && ch === open) { depth++; result += this._advance(); continue; }
      if (ch === closeChar) {
        depth--;
        if (depth === 0) break;
        result += this._advance(); continue;
      }
      result += this._advance();
    }
    return result;
  }

  _consumeStr(q) {
    let out = this._advance(); // opening quote
    while (this._pos < this._src.length) {
      const ch = this._cur();
      if (ch === '\\') { out += this._advance() + this._advance(); continue; }
      out += this._advance();
      if (ch === q) break;
    }
    return out;
  }

  _consumeTpl() {
    let out = this._advance(); // `
    while (this._pos < this._src.length) {
      const ch = this._cur();
      if (ch === '\\') { out += this._advance() + this._advance(); continue; }
      if (ch === '`') { out += this._advance(); break; }
      if (ch === '$' && this._peek(1) === '{') {
        out += this._advance() + this._advance(); // ${
        out += this._readBalanced('}');
        out += this._advance(); // }
        continue;
      }
      out += this._advance();
    }
    return out;
  }

  _consumeLineComment() {
    let out = '';
    while (this._pos < this._src.length && this._cur() !== '\n') out += this._advance();
    return out;
  }

  _consumeBlockComment() {
    let out = this._advance() + this._advance(); // /*
    while (this._pos < this._src.length) {
      if (this._cur() === '*' && this._peek(1) === '/') {
        out += this._advance() + this._advance(); break;
      }
      out += this._advance();
    }
    return out;
  }
}

function transformJSX(source, opts) {
  try {
    return new JSXTransformer(opts || {}).transform(source);
  } catch(e) {
    return { success: false, code: source, usedJSX: false, error: e.message };
  }
}

function hasJSX(source) {
  // Quick check: <Upper or <lower> or <>
  return /<[A-Za-z>]/.test(source);
}

module.exports = { JSXTransformer, transformJSX, hasJSX };
