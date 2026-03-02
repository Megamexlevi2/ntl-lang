'use strict';
process.title = 'ntl-android';

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const vm      = require('vm');
const readline = require('readline');
const { Compiler, NTL_VERSION } = require('../src/compiler');
const { formatError } = require('../src/error');

const IS_TERMUX = fs.existsSync('/data/data/com.termux');
const HOME = os.homedir();

const ESC = '\x1b';
const C = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  cyan:  '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red:   '\x1b[31m',
  blue:  '\x1b[34m',
  magenta: '\x1b[35m',
  gray:  '\x1b[90m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgDark: '\x1b[48;5;235m',
  clear: '\x1b[2J\x1b[H',
  up:    '\x1b[1A',
  down:  '\x1b[1B',
  right: '\x1b[1C',
  left:  '\x1b[1D',
  saveCursor:   '\x1b[s',
  restoreCursor: '\x1b[u',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearLine: '\x1b[2K\r',
};

function write(s) { process.stdout.write(s); }
function writeln(s) { write((s || '') + '\n'); }

const NTL_KEYWORDS = [
  'var','val','let','const','fn','async','await','if','else','unless','elif',
  'while','for','loop','in','of','break','continue','return','raise','throw',
  'class','extends','new','this','super','try','catch','finally','match','case',
  'default','import','export','from','as','true','false','null','void','typeof',
  'instanceof','ifset','have','ifhave','Not','enum','type','require','nax',
  'static','get','set','readonly','private','public','protected','spawn',
  'component','immutable','namespace','module'
];

const BUILTIN_COMPLETIONS = [
  'console.log','console.error','console.warn','process.exit','process.cwd',
  'Math.random','Math.floor','Math.ceil','Math.round','Math.abs','Math.max','Math.min',
  'JSON.stringify','JSON.parse','Object.keys','Object.values','Object.entries',
  'Array.from','Array.isArray','String','Number','Boolean','Date',
  'setTimeout','setInterval','clearTimeout','clearInterval','Promise.all','Promise.race',
  'fetch','Buffer','fs','path','os',
];

class AndroidREPL {
  constructor() {
    this.compiler = new Compiler({ target: 'node', treeShake: false, typeCheck: false });
    this.ctx = vm.createContext({
      console, require, process, __filename: 'repl.ntl', __dirname: process.cwd(),
      setTimeout, setInterval, clearTimeout, clearInterval, Buffer, global, globalThis,
      Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, RegExp,
      Error, TypeError, RangeError, Map, Set, WeakMap, WeakSet, Symbol, fetch: global.fetch,
    });
    this.history = [];
    this.historyIndex = -1;
    this.currentLine = '';
    this.cursorPos = 0;
    this.multiLine = '';
    this.inBlock = 0;
    this.cwd = process.cwd();
    this.suggestions = [];
    this.suggestionIndex = -1;
    this.showingSuggestions = false;
    this.lastInput = '';
    this.inputBuffer = '';
    this.mode = 'repl';
  }

  start() {
    writeln('');
    writeln(`  ${C.bold}${C.cyan}NTL${C.reset} ${C.gray}Android REPL v${NTL_VERSION}${C.reset}`);
    if (IS_TERMUX) writeln(`  ${C.green}Termux detected — optimized mode active${C.reset}`);
    writeln(`  ${C.gray}Type ${C.cyan}.help${C.gray} for commands, ${C.cyan}.exit${C.gray} to quit${C.reset}`);
    writeln('');

    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    this._renderPrompt();
    process.stdin.on('data', (key) => this._handleKey(key));
    process.stdin.on('end', () => this._exit());
  }

  _handleKey(key) {
    const code = key.charCodeAt(0);

    if (key === '\x03') { this._exit(); return; }
    if (key === '\x04') { this._exit(); return; }

    if (key === '\r' || key === '\n') { this._submit(); return; }
    if (key === '\x7f' || key === '\b') { this._backspace(); return; }

    if (key === '\x1b[A') { this._historyUp(); return; }
    if (key === '\x1b[B') { this._historyDown(); return; }
    if (key === '\x1b[C') { this._moveCursorRight(); return; }
    if (key === '\x1b[D') { this._moveCursorLeft(); return; }
    if (key === '\x1b[H' || key === '\x1b[1~') { this._home(); return; }
    if (key === '\x1b[F' || key === '\x1b[4~') { this._end(); return; }
    if (key === '\t') { this._tab(); return; }

    if (this.showingSuggestions) {
      if (key === '\x1b[A') { this._suggestionUp(); return; }
      if (key === '\x1b[B') { this._suggestionDown(); return; }
    }

    if (code >= 32) {
      this.currentLine = this.currentLine.slice(0, this.cursorPos) + key + this.currentLine.slice(this.cursorPos);
      this.cursorPos += key.length;
      this._triggerAutocomplete();
      this._rerenderLine();
    }
  }

  _triggerAutocomplete() {
    const line = this.currentLine;
    if (!line.trim()) { this._hideSuggestions(); return; }

    const word = this._getCurrentWord();
    if (!word || word.length < 1) { this._hideSuggestions(); return; }

    const all = [...NTL_KEYWORDS, ...BUILTIN_COMPLETIONS, ...Object.keys(this.ctx)];
    const suggestions = [...new Set(all.filter(s => s.startsWith(word) && s !== word))];

    if (suggestions.length > 0) {
      this.suggestions = suggestions.slice(0, 8);
      this.suggestionIndex = 0;
      this.showingSuggestions = true;
      this._renderSuggestions();
    } else {
      this._hideSuggestions();
    }
  }

  _getCurrentWord() {
    const before = this.currentLine.slice(0, this.cursorPos);
    const m = before.match(/[a-zA-Z_$][a-zA-Z0-9_$.]*$/);
    return m ? m[0] : '';
  }

  _tab() {
    if (this.showingSuggestions && this.suggestions.length > 0) {
      this._applySuggestion(this.suggestions[this.suggestionIndex]);
    } else {
      this._triggerAutocomplete();
      if (this.suggestions.length === 1) {
        this._applySuggestion(this.suggestions[0]);
      }
    }
  }

  _applySuggestion(suggestion) {
    const word = this._getCurrentWord();
    const before = this.currentLine.slice(0, this.cursorPos - word.length);
    const after = this.currentLine.slice(this.cursorPos);
    const suffix = suggestion.endsWith('(') ? '' : (this._isMethod(suggestion) ? '(' : ' ');
    this.currentLine = before + suggestion + suffix + after;
    this.cursorPos = before.length + suggestion.length + suffix.length;
    this._hideSuggestions();
    this._rerenderLine();
  }

  _isMethod(s) { return s.includes('.') || NTL_KEYWORDS.includes(s.split('.').pop()); }

  _suggestionUp() {
    if (this.suggestionIndex > 0) {
      this.suggestionIndex--;
      this._renderSuggestions();
    }
  }
  _suggestionDown() {
    if (this.suggestionIndex < this.suggestions.length - 1) {
      this.suggestionIndex++;
      this._renderSuggestions();
    }
  }

  _hideSuggestions() {
    this.showingSuggestions = false;
    this.suggestions = [];
    this.suggestionIndex = -1;
  }

  _renderSuggestions() {
    if (!this.showingSuggestions || this.suggestions.length === 0) return;
    let out = '\n';
    this.suggestions.forEach((s, i) => {
      const selected = i === this.suggestionIndex;
      if (selected) {
        out += `  ${C.bgBlue}${C.white} ${s} ${C.reset}\n`;
      } else {
        out += `  ${C.gray} ${s} ${C.reset}\n`;
      }
    });
    out += `\x1b[${this.suggestions.length + 1}A\r`;
    write(out);
  }

  _backspace() {
    if (this.cursorPos > 0) {
      this.currentLine = this.currentLine.slice(0, this.cursorPos - 1) + this.currentLine.slice(this.cursorPos);
      this.cursorPos--;
      this._triggerAutocomplete();
      this._rerenderLine();
    }
  }

  _moveCursorLeft() {
    if (this.cursorPos > 0) { this.cursorPos--; this._rerenderLine(); }
  }
  _moveCursorRight() {
    if (this.cursorPos < this.currentLine.length) { this.cursorPos++; this._rerenderLine(); }
  }
  _home() { this.cursorPos = 0; this._rerenderLine(); }
  _end() { this.cursorPos = this.currentLine.length; this._rerenderLine(); }

  _historyUp() {
    if (this.history.length === 0) return;
    if (this.historyIndex < this.history.length - 1) this.historyIndex++;
    this.currentLine = this.history[this.history.length - 1 - this.historyIndex] || '';
    this.cursorPos = this.currentLine.length;
    this._rerenderLine();
  }
  _historyDown() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentLine = this.history[this.history.length - 1 - this.historyIndex] || '';
    } else {
      this.historyIndex = -1;
      this.currentLine = '';
    }
    this.cursorPos = this.currentLine.length;
    this._rerenderLine();
  }

  _renderPrompt() {
    const prefix = this.inBlock > 0
      ? `${C.gray}...${C.reset} ${C.yellow}›${C.reset} `
      : `${C.cyan}ntl${C.reset} ${C.cyan}›${C.reset} `;
    write(C.clearLine + prefix + this._colorize(this.currentLine));
    const lineLen = this.currentLine.length;
    if (this.cursorPos < lineLen) {
      write('\x1b[' + (lineLen - this.cursorPos) + 'D');
    }
  }

  _rerenderLine() {
    this._renderPrompt();
  }

  _colorize(line) {
    let result = line;
    for (const kw of NTL_KEYWORDS) {
      const re = new RegExp('\\b' + kw + '\\b', 'g');
      result = result.replace(re, `${C.cyan}${kw}${C.reset}`);
    }
    result = result.replace(/(["'`][^"'`]*["'`])/g, `${C.green}$1${C.reset}`);
    result = result.replace(/\b(\d+\.?\d*)\b/g, `${C.yellow}$1${C.reset}`);
    return result;
  }

  async _submit() {
    const line = this.currentLine;
    this.currentLine = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    this._hideSuggestions();
    writeln('');

    if (!line.trim()) { this._renderPrompt(); return; }

    if (line.trim().startsWith('.')) {
      await this._handleCommand(line.trim());
      this._renderPrompt();
      return;
    }

    for (const ch of line) {
      if (ch === '{') this.inBlock++;
      if (ch === '}') this.inBlock--;
    }
    if (this.inBlock > 0) {
      this.multiLine += line + '\n';
      this._renderPrompt();
      return;
    }

    const source = this.multiLine + line;
    this.multiLine = '';
    this.inBlock = 0;

    if (source.trim()) this.history.push(source);

    await this._eval(source);
    this._renderPrompt();
  }

  async _eval(source) {
    try {
      const result = this.compiler.compileSource(source, 'repl.ntl');
      if (!result.success) {
        for (const err of result.errors) {
          writeln(`${C.red}✗ ${err.message}${C.reset}`);
          if (err.suggestion) writeln(`  ${C.yellow}→ ${err.suggestion}${C.reset}`);
        }
        return;
      }
      const val = vm.runInContext(result.code, this.ctx, { filename: 'repl.ntl', timeout: 10000, displayErrors: false });
      const resolved = val instanceof Promise ? await val : val;
      if (resolved !== undefined && resolved !== null) {
        const display = typeof resolved === 'object' ? JSON.stringify(resolved, null, 2) : String(resolved);
        writeln(`${C.green}← ${C.yellow}${display}${C.reset}`);
      }
    } catch (e) {
      writeln(`${C.red}✗ ${e.message}${C.reset}`);
    }
  }

  async _handleCommand(cmd) {
    const parts = cmd.slice(1).trim().split(/\s+/);
    const name = parts[0];
    const args = parts.slice(1);

    switch (name) {
      case 'help':
        writeln('');
        writeln(`  ${C.bold}${C.cyan}NTL Android REPL Commands${C.reset}`);
        writeln(`  ${C.cyan}.help${C.reset}              Show this help`);
        writeln(`  ${C.cyan}.exit${C.reset}              Exit`);
        writeln(`  ${C.cyan}.clear${C.reset}             Clear screen`);
        writeln(`  ${C.cyan}.history${C.reset}           Show history`);
        writeln(`  ${C.cyan}.ls [dir]${C.reset}          List directory`);
        writeln(`  ${C.cyan}.cd <dir>${C.reset}          Change directory`);
        writeln(`  ${C.cyan}.pwd${C.reset}               Current directory`);
        writeln(`  ${C.cyan}.cat <file>${C.reset}        View file contents`);
        writeln(`  ${C.cyan}.edit <file>${C.reset}       Edit a file`);
        writeln(`  ${C.cyan}.run <file>${C.reset}        Run an .ntl file`);
        writeln(`  ${C.cyan}.rm <file>${C.reset}         Delete a file`);
        writeln(`  ${C.cyan}.mkdir <dir>${C.reset}       Create directory`);
        writeln(`  ${C.cyan}.new <file>${C.reset}        Create new file`);
        writeln(`  ${C.cyan}.reset${C.reset}             Reset context`);
        writeln(`  ${C.cyan}.nax list${C.reset}          List cached nax modules`);
        writeln(`  ${C.cyan}.nax clear${C.reset}         Clear nax module cache`);
        writeln('');
        break;

      case 'exit': case 'quit':
        this._exit();
        break;

      case 'clear':
        write(C.clear);
        writeln(`  ${C.bold}${C.cyan}NTL${C.reset} ${C.gray}Android REPL v${NTL_VERSION}${C.reset}\n`);
        break;

      case 'history':
        if (this.history.length === 0) { writeln(`  ${C.gray}(empty)${C.reset}`); break; }
        this.history.slice(-20).forEach((h, i) => {
          writeln(`  ${C.gray}${String(i+1).padStart(2)}${C.reset}  ${h}`);
        });
        break;

      case 'pwd':
        writeln(`  ${C.cyan}${this.cwd}${C.reset}`);
        break;

      case 'ls':
        await this._ls(args[0] || this.cwd);
        break;

      case 'cd':
        this._cd(args[0]);
        break;

      case 'cat':
        this._cat(args.join(' '));
        break;

      case 'edit':
        await this._edit(args.join(' '));
        break;

      case 'run':
        await this._runFile(args.join(' '));
        break;

      case 'rm':
        this._rm(args.join(' '));
        break;

      case 'mkdir':
        this._mkdir(args.join(' '));
        break;

      case 'new':
        await this._newFile(args.join(' '));
        break;

      case 'reset':
        Object.keys(this.ctx).forEach(k => {
          if (!['console','require','process','__filename','__dirname',
                'setTimeout','setInterval','clearTimeout','clearInterval',
                'Buffer','global','globalThis','Date','Math','JSON',
                'Object','Array','String','Number','Boolean','Promise',
                'RegExp','Error','TypeError','RangeError','Map','Set',
                'WeakMap','WeakSet','Symbol'].includes(k)) {
            delete this.ctx[k];
          }
        });
        writeln(`  ${C.green}Context reset.${C.reset}`);
        break;

      case 'nax':
        if (args[0] === 'list') {
          const { naxList } = require('../src/nax-modules');
          const mods = naxList();
          if (mods.length === 0) writeln(`  ${C.gray}(no cached modules)${C.reset}`);
          else mods.forEach(m => writeln(`  ${C.cyan}${m.name}${C.reset} ${C.gray}by ${m.author}${C.reset} — ${m.description}`));
        } else if (args[0] === 'clear') {
          const { naxClear } = require('../src/nax-modules');
          naxClear();
        }
        break;

      default:
        writeln(`  ${C.red}Unknown command: .${name}${C.reset}`);
        writeln(`  ${C.gray}Type .help for available commands${C.reset}`);
    }
  }

  async _ls(dir) {
    const target = path.isAbsolute(dir) ? dir : path.join(this.cwd, dir);
    try {
      const entries = fs.readdirSync(target, { withFileTypes: true });
      writeln('');
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      }).forEach(e => {
        if (e.isDirectory()) {
          writeln(`  ${C.blue}📁 ${e.name}/${C.reset}`);
        } else if (e.name.endsWith('.ntl')) {
          writeln(`  ${C.cyan}📄 ${e.name}${C.reset}`);
        } else {
          writeln(`  ${C.gray}   ${e.name}${C.reset}`);
        }
      });
      writeln('');
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  _cd(dir) {
    if (!dir) { this.cwd = HOME; return; }
    if (dir === '-') return;
    const target = path.isAbsolute(dir) ? dir : path.join(this.cwd, dir);
    try {
      const stat = fs.statSync(target);
      if (!stat.isDirectory()) { writeln(`  ${C.red}Not a directory: ${dir}${C.reset}`); return; }
      this.cwd = target;
      process.chdir(target);
      writeln(`  ${C.green}${target}${C.reset}`);
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  _cat(file) {
    if (!file) { writeln(`  ${C.red}Usage: .cat <file>${C.reset}`); return; }
    const target = path.isAbsolute(file) ? file : path.join(this.cwd, file);
    try {
      const content = fs.readFileSync(target, 'utf-8');
      writeln('');
      content.split('\n').forEach((line, i) => {
        writeln(`  ${C.gray}${String(i+1).padStart(3)}${C.reset}  ${line}`);
      });
      writeln('');
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  async _edit(file) {
    if (!file) { writeln(`  ${C.red}Usage: .edit <file>${C.reset}`); return; }
    const target = path.isAbsolute(file) ? file : path.join(this.cwd, file);

    let content = '';
    if (fs.existsSync(target)) {
      content = fs.readFileSync(target, 'utf-8');
    }

    writeln('');
    writeln(`  ${C.cyan}Editing: ${target}${C.reset}`);
    writeln(`  ${C.gray}Enter code line by line. Type ${C.cyan}:save${C.gray} to save, ${C.cyan}:quit${C.gray} to cancel, ${C.cyan}:show${C.gray} to view.${C.reset}`);
    writeln('');

    const lines = content ? content.split('\n') : [];

    await new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
      const showLines = () => {
        writeln('');
        lines.forEach((l, i) => writeln(`  ${C.gray}${String(i+1).padStart(3)}${C.reset}  ${l}`));
        writeln('');
      };

      rl.setPrompt(`  ${C.green}→${C.reset} `);
      rl.prompt();
      rl.on('line', input => {
        if (input === ':save') {
          fs.writeFileSync(target, lines.join('\n'), 'utf-8');
          writeln(`  ${C.green}✓ Saved to ${target}${C.reset}`);
          rl.close();
        } else if (input === ':quit') {
          writeln(`  ${C.yellow}Cancelled.${C.reset}`);
          rl.close();
        } else if (input === ':show') {
          showLines();
          rl.prompt();
        } else if (input.startsWith(':del ')) {
          const idx = parseInt(input.slice(5)) - 1;
          if (idx >= 0 && idx < lines.length) {
            lines.splice(idx, 1);
            writeln(`  ${C.yellow}Line ${idx+1} deleted.${C.reset}`);
          }
          rl.prompt();
        } else {
          lines.push(input);
          rl.prompt();
        }
      });
      rl.on('close', resolve);
    });
  }

  async _newFile(file) {
    if (!file) { writeln(`  ${C.red}Usage: .new <file>${C.reset}`); return; }
    const target = path.isAbsolute(file) ? file : path.join(this.cwd, file);
    fs.writeFileSync(target, '', 'utf-8');
    writeln(`  ${C.green}Created: ${target}${C.reset}`);
    await this._edit(target);
  }

  async _runFile(file) {
    if (!file) { writeln(`  ${C.red}Usage: .run <file>${C.reset}`); return; }
    const target = path.isAbsolute(file) ? file : path.join(this.cwd, file);
    try {
      const source = fs.readFileSync(target, 'utf-8');
      await this._eval(source);
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  _rm(file) {
    if (!file) { writeln(`  ${C.red}Usage: .rm <file>${C.reset}`); return; }
    const target = path.isAbsolute(file) ? file : path.join(this.cwd, file);
    try {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        fs.rmdirSync(target, { recursive: true });
        writeln(`  ${C.green}✓ Removed directory: ${target}${C.reset}`);
      } else {
        fs.unlinkSync(target);
        writeln(`  ${C.green}✓ Removed: ${target}${C.reset}`);
      }
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  _mkdir(dir) {
    if (!dir) { writeln(`  ${C.red}Usage: .mkdir <dir>${C.reset}`); return; }
    const target = path.isAbsolute(dir) ? dir : path.join(this.cwd, dir);
    try {
      fs.mkdirSync(target, { recursive: true });
      writeln(`  ${C.green}✓ Created: ${target}${C.reset}`);
    } catch (e) {
      writeln(`  ${C.red}Error: ${e.message}${C.reset}`);
    }
  }

  _exit() {
    writeln(`\n  ${C.gray}Goodbye!${C.reset}\n`);
    if (process.stdin.setRawMode) process.stdin.setRawMode(false);
    process.exit(0);
  }
}

if (require.main === module) {
  const repl = new AndroidREPL();
  repl.start();
}

module.exports = { AndroidREPL };
