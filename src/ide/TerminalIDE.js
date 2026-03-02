'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const NTL_KEYWORDS = [
  'fn', 'val', 'var', 'let', 'const', 'return', 'if', 'else', 'while', 'for', 'each',
  'in', 'of', 'do', 'break', 'continue', 'class', 'new', 'extends', 'import', 'export',
  'from', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'true', 'false', 'null',
  'undefined', 'typeof', 'instanceof', 'void', 'delete', 'match', 'case', 'default',
  'guard', 'defer', 'repeat', 'log', 'assert', 'sleep', 'range', 'loop', 'unless',
  'trait', 'impl', 'enum', 'type', 'interface', 'namespace', 'macro', 'require',
];

const NTL_BUILTINS = [
  'console', 'process', 'Math', 'JSON', 'Date', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Promise', 'setTimeout', 'setInterval', 'clearTimeout', 'fetch', 'Buffer',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'Error',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
];

const NTL_SNIPPETS = {
  'fn':     'fn ${1:name}(${2:params}) {\n  ${3}\n}',
  'class':  'class ${1:Name} {\n  constructor(${2:params}) {\n    ${3}\n  }\n}',
  'if':     'if (${1:condition}) {\n  ${2}\n}',
  'async':  'async fn ${1:name}(${2:params}) {\n  ${3}\n}',
  'try':    'try {\n  ${1}\n} catch (${2:err}) {\n  ${3}\n}',
  'each':   'each ${1:item} in ${2:list} {\n  ${3}\n}',
  'guard':  'guard ${1:condition} else {\n  return ${2}\n}',
  'match':  'match ${1:expr} {\n  case ${2:value}: ${3}\n  default: ${4}\n}',
};

class SyntaxHighlighter {
  constructor() {
    this.kwRe      = new RegExp(`\\b(${NTL_KEYWORDS.join('|')})\\b`, 'g');
    this.builtinRe = new RegExp(`\\b(${NTL_BUILTINS.join('|')})\\b`, 'g');
    this.strRe     = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
    this.numRe     = /\b(\d+\.?\d*)\b/g;
    this.commentRe = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
    this.fnRe      = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
  }

  highlight(line) {
    const c = {
      kw:      '\x1b[35m', fn:      '\x1b[33m', str:     '\x1b[32m',
      num:     '\x1b[36m', comment: '\x1b[90m', builtin: '\x1b[34m',
      reset:   '\x1b[0m',
    };

    const placeholders = [];
    const protect = (match) => {
      const idx = placeholders.length;
      placeholders.push(match);
      return `\x00${idx}\x00`;
    };

    let out = line;
    out = out.replace(this.commentRe, m => protect(c.comment + m + c.reset));
    out = out.replace(this.strRe,     m => protect(c.str + m + c.reset));
    out = out.replace(this.kwRe,      m => protect(c.kw + m + c.reset));
    out = out.replace(this.builtinRe, m => protect(c.builtin + m + c.reset));
    out = out.replace(this.fnRe,      m => protect(c.fn + m + c.reset));
    out = out.replace(this.numRe,     m => protect(c.num + m + c.reset));
    out = out.replace(/\x00(\d+)\x00/g, (_, i) => placeholders[parseInt(i)]);

    return out;
  }
}

class Completer {
  constructor() {
    this.userDefined = new Map();
    this.history     = [];
  }

  learnFromCode(code) {
    const fnRe  = /(?:fn|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const varRe = /(?:val|var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let m;
    while ((m = fnRe.exec(code))  !== null) this.userDefined.set(m[1], { type: 'function', name: m[1] });
    while ((m = varRe.exec(code)) !== null) this.userDefined.set(m[1], { type: 'variable', name: m[1] });
  }

  suggest(prefix, fullCode) {
    if (!prefix) return [];
    const lower = prefix.toLowerCase();

    this.learnFromCode(fullCode || '');

    const candidates = [
      ...NTL_KEYWORDS.map(k   => ({ text: k,       kind: 'keyword',  score: 10 })),
      ...NTL_BUILTINS.map(b   => ({ text: b,       kind: 'builtin',  score: 8  })),
      ...[...this.userDefined.values()].map(d => ({ text: d.name,    kind: d.type, score: 15 })),
      ...Object.keys(NTL_SNIPPETS).map(s => ({ text: s,              kind: 'snippet', score: 12, snippet: NTL_SNIPPETS[s] })),
    ];

    return candidates
      .filter(c => c.text.toLowerCase().startsWith(lower) && c.text !== prefix)
      .sort((a, b) => {
        if (a.text.toLowerCase() === lower) return -1;
        if (b.text.toLowerCase() === lower) return 1;
        return (b.score - a.score) || a.text.localeCompare(b.text);
      })
      .slice(0, 8);
  }
}

class Linter {
  analyze(code) {
    const errors = [];
    const lines  = code.split('\n');

    lines.forEach((line, i) => {
      const opens  = (line.match(/[({[]/g) || []).length;
      const closes = (line.match(/[)}\]]/g) || []).length;
      if (opens !== closes) {
        const prevBrackets = lines.slice(0, i).join('').replace(/\/\/.*/g, '').replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '');
        const totalOpens  = (prevBrackets.match(/[({[]/g) || []).length;
        const totalCloses = (prevBrackets.match(/[)}\]]/g) || []).length;
        if (totalOpens === totalCloses) {
          if (Math.abs(opens - closes) > 1) {
            errors.push({ line: i + 1, col: 1, severity: 'warning', message: 'Unbalanced brackets on this line' });
          }
        }
      }

      if (/\t/.test(line)) {
        errors.push({ line: i + 1, col: line.indexOf('\t') + 1, severity: 'info', message: 'Tab indentation found (spaces recommended)' });
      }

      if (line.length > 120) {
        errors.push({ line: i + 1, col: 121, severity: 'info', message: `Line too long (${line.length} > 120 chars)` });
      }
    });

    const eqRe = /\bif\s*\(\s*\w+\s*=\s*[^=]/;
    lines.forEach((line, i) => {
      if (eqRe.test(line) && !/==/.test(line.slice(line.search(eqRe) + 3))) {
        errors.push({ line: i + 1, col: 1, severity: 'warning', message: 'Assignment in condition: did you mean == ?' });
      }
    });

    return errors;
  }
}

class ScreenBuffer {
  constructor() {
    this.cols = process.stdout.columns || 80;
    this.rows = process.stdout.rows    || 24;
  }

  clear()         { process.stdout.write('\x1b[2J\x1b[H'); }
  moveTo(r, c)    { process.stdout.write(`\x1b[${r};${c}H`); }
  hideCursor()    { process.stdout.write('\x1b[?25l'); }
  showCursor()    { process.stdout.write('\x1b[?25h'); }
  clearLine()     { process.stdout.write('\x1b[2K'); }
  saveCursor()    { process.stdout.write('\x1b[s'); }
  restoreCursor() { process.stdout.write('\x1b[u'); }
  bold(s)         { return '\x1b[1m' + s + '\x1b[0m'; }
  dim(s)          { return '\x1b[2m' + s + '\x1b[0m'; }
  cyan(s)         { return '\x1b[36m' + s + '\x1b[0m'; }
  green(s)        { return '\x1b[32m' + s + '\x1b[0m'; }
  red(s)          { return '\x1b[31m' + s + '\x1b[0m'; }
  yellow(s)       { return '\x1b[33m' + s + '\x1b[0m'; }
  gray(s)         { return '\x1b[90m' + s + '\x1b[0m'; }
  bgBlue(s)       { return '\x1b[44m' + s + '\x1b[0m'; }
  bgDark(s)       { return '\x1b[48;5;235m' + s + '\x1b[0m'; }
  stripAnsi(s)    { return s.replace(/\x1b\[[0-9;]*m/g, ''); }
  width(s)        { return this.stripAnsi(s).length; }
}

class TerminalIDE {
  constructor(filePath, opts) {
    this.filePath  = filePath ? path.resolve(filePath) : null;
    this.opts      = Object.assign({ comments: false, compiler: null }, opts || {});
    this.buf       = new ScreenBuffer();
    this.hl        = new SyntaxHighlighter();
    this.completer = new Completer();
    this.linter    = new Linter();

    this.lines        = [''];
    this.cursor       = { row: 0, col: 0 };
    this.scrollOffset = 0;
    this.suggestions  = [];
    this.suggIdx      = -1;
    this.showSugg     = false;
    this.diagnostics  = [];
    this.status       = '';
    this.modified     = false;
    this.running      = false;
    this.mode         = 'edit';
  }

  async start() {
    if (this.filePath && fs.existsSync(this.filePath)) {
      const src = fs.readFileSync(this.filePath, 'utf-8');
      this.lines = src.split('\n');
      if (!this.lines.length) this.lines = [''];
    }

    if (!process.stdin.setRawMode) {
      process.stderr.write('Terminal IDE requires a TTY. Run directly in a terminal.\n');
      process.exit(1);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    this.buf.hideCursor();
    this.running = true;
    this.render();

    process.stdin.on('data', (key) => this._handleKey(key));

    process.on('SIGWINCH', () => {
      this.buf.cols = process.stdout.columns || 80;
      this.buf.rows = process.stdout.rows    || 24;
      this.render();
    });

    process.on('SIGINT', () => this._quit());
  }

  _handleKey(key) {
    const ESC  = '\x1b';
    const CTRL = (c) => String.fromCharCode(c.charCodeAt(0) - 96);

    if (key === CTRL('q') || key === CTRL('c')) { this._quit(); return; }
    if (key === CTRL('s')) { this._save(); return; }
    if (key === CTRL('r')) { this._run(); return; }
    if (key === CTRL('b')) { this._build(); return; }
    if (key === CTRL('f')) { this._format(); return; }
    if (key === '\t')      { this._acceptSuggestion(); return; }

    if (key === ESC + '[A' || key === ESC + 'OA') { this._moveCursor(-1, 0); return; }
    if (key === ESC + '[B' || key === ESC + 'OB') { this._moveCursor(1, 0); return; }
    if (key === ESC + '[C' || key === ESC + 'OC') { this._moveCursor(0, 1); return; }
    if (key === ESC + '[D' || key === ESC + 'OD') { this._moveCursor(0, -1); return; }
    if (key === ESC + '[H') { this.cursor.col = 0; this.render(); return; }
    if (key === ESC + '[F') { this.cursor.col = this.lines[this.cursor.row].length; this.render(); return; }
    if (key === ESC + '[5~') { this._pageUp(); return; }
    if (key === ESC + '[6~') { this._pageDown(); return; }

    if (key === '\r' || key === '\n') { this._insertNewline(); return; }
    if (key === '\x7f' || key === '\b') { this._backspace(); return; }
    if (key === ESC + '[3~') { this._delete(); return; }

    if (key === ESC && this.showSugg) { this.showSugg = false; this.render(); return; }

    if (key.length === 1 && key.charCodeAt(0) >= 32) {
      this._insertChar(key);
      return;
    }
  }

  _insertChar(ch) {
    const line = this.lines[this.cursor.row];
    this.lines[this.cursor.row] = line.slice(0, this.cursor.col) + ch + line.slice(this.cursor.col);
    this.cursor.col++;
    this.modified = true;
    this._updateSuggestions();
    this._updateDiagnostics();
    this.render();
  }

  _insertNewline() {
    const line = this.lines[this.cursor.row];
    const before = line.slice(0, this.cursor.col);
    const after  = line.slice(this.cursor.col);
    const indent = (before.match(/^(\s*)/) || ['', ''])[1];
    const extraIndent = /[{(\[]$/.test(before.trimEnd()) ? '  ' : '';
    this.lines[this.cursor.row] = before;
    this.lines.splice(this.cursor.row + 1, 0, indent + extraIndent + after);
    this.cursor.row++;
    this.cursor.col = (indent + extraIndent).length;
    this.modified = true;
    this.showSugg = false;
    this._updateDiagnostics();
    this.render();
  }

  _backspace() {
    if (this.cursor.col > 0) {
      const line = this.lines[this.cursor.row];
      this.lines[this.cursor.row] = line.slice(0, this.cursor.col - 1) + line.slice(this.cursor.col);
      this.cursor.col--;
    } else if (this.cursor.row > 0) {
      const prev = this.lines[this.cursor.row - 1];
      const curr = this.lines[this.cursor.row];
      this.cursor.col = prev.length;
      this.lines[this.cursor.row - 1] = prev + curr;
      this.lines.splice(this.cursor.row, 1);
      this.cursor.row--;
    }
    this.modified = true;
    this._updateSuggestions();
    this._updateDiagnostics();
    this.render();
  }

  _delete() {
    const line = this.lines[this.cursor.row];
    if (this.cursor.col < line.length) {
      this.lines[this.cursor.row] = line.slice(0, this.cursor.col) + line.slice(this.cursor.col + 1);
    } else if (this.cursor.row < this.lines.length - 1) {
      this.lines[this.cursor.row] = line + this.lines[this.cursor.row + 1];
      this.lines.splice(this.cursor.row + 1, 1);
    }
    this.modified = true;
    this.render();
  }

  _moveCursor(dr, dc) {
    if (this.showSugg && dr !== 0) {
      this.suggIdx = Math.max(-1, Math.min(this.suggestions.length - 1, this.suggIdx + (dr > 0 ? 1 : -1)));
      this.render();
      return;
    }
    this.cursor.row = Math.max(0, Math.min(this.lines.length - 1, this.cursor.row + dr));
    if (dc !== 0) {
      const lineLen = this.lines[this.cursor.row].length;
      this.cursor.col = Math.max(0, Math.min(lineLen, this.cursor.col + dc));
    } else {
      this.cursor.col = Math.min(this.cursor.col, this.lines[this.cursor.row].length);
    }
    this._adjustScroll();
    this.render();
  }

  _pageUp()   { this._moveCursor(-(this.buf.rows - 4), 0); }
  _pageDown() { this._moveCursor(+(this.buf.rows - 4), 0); }

  _adjustScroll() {
    const viewH = this.buf.rows - 4;
    if (this.cursor.row < this.scrollOffset) this.scrollOffset = this.cursor.row;
    if (this.cursor.row >= this.scrollOffset + viewH) this.scrollOffset = this.cursor.row - viewH + 1;
  }

  _acceptSuggestion() {
    if (!this.showSugg || this.suggestions.length === 0) {
      this._insertChar('\t');
      return;
    }
    const idx  = Math.max(0, this.suggIdx);
    const sugg = this.suggestions[idx];
    const line = this.lines[this.cursor.row];
    const wordStart = this._getWordStart();
    const prefix = line.slice(wordStart, this.cursor.col);
    const completion = sugg.text.slice(prefix.length);
    for (const ch of completion) this._insertChar(ch);
    this.showSugg = false;
    this.render();
  }

  _getWordStart() {
    const line = this.lines[this.cursor.row];
    let i = this.cursor.col;
    while (i > 0 && /[a-zA-Z0-9_$]/.test(line[i - 1])) i--;
    return i;
  }

  _updateSuggestions() {
    const line   = this.lines[this.cursor.row];
    const prefix = line.slice(this._getWordStart(), this.cursor.col);
    if (prefix.length < 1) { this.showSugg = false; return; }
    const code = this.lines.join('\n');
    this.suggestions = this.completer.suggest(prefix, code);
    this.showSugg    = this.suggestions.length > 0;
    this.suggIdx     = 0;
  }

  _updateDiagnostics() {
    const code = this.lines.join('\n');
    this.diagnostics = this.linter.analyze(code);
  }

  _save() {
    if (!this.filePath) {
      this.status = '⚠ No file path set (use ntl ide <file.ntl>)';
      this.render();
      return;
    }
    fs.writeFileSync(this.filePath, this.lines.join('\n'), 'utf-8');
    this.modified = false;
    this.status   = '✔ Saved ' + path.basename(this.filePath);
    this.render();
  }

  _run() {
    if (!this.opts.compiler) { this.status = '✘ No compiler connected'; this.render(); return; }
    this._save();
    const code = this.lines.join('\n');
    try {
      const result = this.opts.compiler.compileSource(code, this.filePath || 'ide.ntl', {});
      if (!result.success) {
        this.status = '✘ ' + (result.errors[0] && result.errors[0].message || 'Compile error');
      } else {
        this.status = '✔ Compiled successfully (' + result.time + 'ms)';
      }
    } catch (e) {
      this.status = '✘ ' + e.message;
    }
    this.render();
  }

  _build() {
    this._run();
  }

  _format() {
    const code = this.lines.join('\n');
    const formatted = code
      .replace(/\{(\S)/g, '{ $1')
      .replace(/(\S)\}/g, '$1 }')
      .replace(/,([^\s])/g, ', $1')
      .replace(/  +/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
    this.lines = formatted.split('\n');
    this.cursor.row = Math.min(this.cursor.row, this.lines.length - 1);
    this.cursor.col = Math.min(this.cursor.col, this.lines[this.cursor.row].length);
    this.status = '✔ Formatted';
    this.render();
  }

  _quit() {
    this.running = false;
    process.stdin.setRawMode(false);
    this.buf.showCursor();
    this.buf.clear();
    this.buf.moveTo(1, 1);
    if (this.modified) {
      process.stdout.write('File has unsaved changes. Save before exit? [y/N] ');
      process.stdin.resume();
      process.stdin.setEncoding('utf-8');
      process.stdin.once('data', (key) => {
        if (key.toLowerCase() === 'y') this._save();
        process.stdout.write('\n');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }

  render() {
    if (!this.running) return;
    const { cols, rows } = this.buf;
    const lines = [];

    const titleFile = this.filePath ? path.basename(this.filePath) : 'untitled.ntl';
    const modMark   = this.modified ? ' ●' : '';
    const header    = this.buf.bgDark(this.buf.bold(' ⚡ NTL IDE') + ' — ' + this.buf.cyan(titleFile + modMark) + ' '.repeat(Math.max(0, cols - 12 - titleFile.length - modMark.length)) + this.buf.dim(' Ctrl+S Save  Ctrl+R Run  Ctrl+Q Quit  Tab Complete'));
    lines.push(header);

    const viewH    = rows - 4;
    const editorW  = Math.max(20, Math.floor(cols * 0.75));
    const sideW    = cols - editorW - 1;

    const errsByLine = new Map();
    for (const d of this.diagnostics) {
      if (!errsByLine.has(d.line)) errsByLine.set(d.line, []);
      errsByLine.get(d.line).push(d);
    }

    const sideLines = this._buildSidePanel(sideW, viewH);

    for (let vi = 0; vi < viewH; vi++) {
      const li = vi + this.scrollOffset;
      let   lineStr = '';

      if (li < this.lines.length) {
        const rawLine = this.lines[li];
        const lineNum = this.buf.dim((String(li + 1)).padStart(4) + ' ');
        const hl      = this.hl.highlight(rawLine);
        const errs    = errsByLine.get(li + 1) || [];
        const errMark = errs.length ? this.buf.red(' ← ' + errs[0].message.slice(0, 25)) : '';
        const available = editorW - 6;
        const rawDisplay = rawLine.slice(0, Math.max(0, available));
        const hlDisplay  = this.hl.highlight(rawDisplay);
        lineStr = lineNum + hlDisplay + errMark;
      }

      const stripped = this.buf.stripAnsi(lineStr);
      const padded   = lineStr + ' '.repeat(Math.max(0, editorW - stripped.length));

      const side = sideLines[vi] || '';
      const sideStripped = this.buf.stripAnsi(side);
      const sidePadded   = side + ' '.repeat(Math.max(0, sideW - sideStripped.length));

      lines.push(padded + this.buf.dim('│') + sidePadded);
    }

    const suggLine = this._renderSuggestions(cols);
    lines.push(suggLine);

    const errs  = this.diagnostics.filter(d => d.severity === 'warning' || d.severity === 'error');
    const errStr = errs.length ? this.buf.red(` ${errs.length} problem${errs.length > 1 ? 's' : ''}`) : this.buf.green(' ✔ No problems');
    const pos    = ` Ln ${this.cursor.row + 1}, Col ${this.cursor.col + 1}`;
    const st     = this.status ? '  ' + this.buf.cyan(this.status) : '';
    const statusBar = this.buf.bgDark(errStr + st + ' '.repeat(Math.max(0, cols - this.buf.width(errStr) - this.buf.width(st) - pos.length)) + this.buf.dim(pos));
    lines.push(statusBar);

    process.stdout.write('\x1b[H' + lines.join('\n'));

    const screenRow = this.cursor.row - this.scrollOffset + 2;
    const screenCol = this.cursor.col + 6;
    process.stdout.write(`\x1b[${screenRow};${screenCol}H`);
    this.buf.showCursor();

    this.status = '';
  }

  _buildSidePanel(width, height) {
    const lines = [];
    const w = width - 2;

    lines.push(this.buf.bold(this.buf.cyan(' OUTLINE')));
    let count = 1;

    for (const line of this.lines) {
      if (count >= height - 6) break;
      const fnMatch = line.match(/^\s*(?:async\s+)?fn\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      const clMatch = line.match(/^\s*class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (fnMatch) { lines.push(this.buf.yellow(' ƒ ') + fnMatch[1].slice(0, w - 3)); count++; }
      if (clMatch) { lines.push(this.buf.cyan(' ⬡ ') + clMatch[1].slice(0, w - 3)); count++; }
    }

    lines.push('');
    lines.push(this.buf.bold(this.buf.cyan(' PROBLEMS')));
    const errs = this.diagnostics.slice(0, height - count - 4);
    if (!errs.length) {
      lines.push(this.buf.green(' ✔ No issues'));
    } else {
      for (const e of errs) {
        const icon = e.severity === 'error' ? this.buf.red('✘') : e.severity === 'warning' ? this.buf.yellow('⚠') : this.buf.dim('ℹ');
        lines.push(` ${icon} ${String(e.line).padEnd(3)} ${e.message.slice(0, w - 6)}`);
      }
    }

    while (lines.length < height) lines.push('');
    return lines.slice(0, height);
  }

  _renderSuggestions(cols) {
    if (!this.showSugg || !this.suggestions.length) {
      return this.buf.dim('─'.repeat(cols));
    }
    const kinds  = { keyword: '🔵', builtin: '🟢', function: '🟡', variable: '🟣', snippet: '🟠' };
    const parts  = this.suggestions.slice(0, 6).map((s, i) => {
      const icon     = kinds[s.kind] || '⚪';
      const selected = i === this.suggIdx ? this.buf.bgDark(this.buf.bold(` ${icon} ${s.text} `)) : ` ${icon} ${s.text} `;
      return selected;
    });
    const hint = this.buf.dim('Tab to accept · ↑↓ to navigate · Esc to close');
    const content = parts.join(this.buf.dim('│')) + '  ' + hint;
    return content;
  }
}

module.exports = { TerminalIDE, SyntaxHighlighter, Completer, Linter };
