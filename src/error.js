// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';
const USE_COLOR = process.stderr && process.stderr.isTTY !== false && !process.env.NO_COLOR;
const c = (code, t) => USE_COLOR ? `\x1b[${code}m${t}\x1b[0m` : t;
const R = {
  bold:    t => c('1', t),
  dim:     t => c('2', t),
  red:     t => c('31', t),
  green:   t => c('32', t),
  yellow:  t => c('33', t),
  blue:    t => c('34', t),
  cyan:    t => c('36', t),
  white:   t => c('37', t),
  gray:    t => c('90', t),
};
const PHASE_LABEL = {
  lex:     'error[lex]',
  parse:   'error[parse]',
  compile: 'error[compile]',
  type:    'error[type]',
  runtime: 'error',
  scope:   'error[scope]',
  macro:   'error[macro]',
  resolve: 'error[module]',
};
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m + 1}, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
function findSimilar(name, names) {
  const nl = name.toLowerCase();
  const scored = names
    .filter(n => n !== name && n.length > 1)
    .map(n => {
      const nl2 = n.toLowerCase();
      const dist = levenshtein(nl, nl2);
      const maxLen = Math.max(nl.length, nl2.length);
      const sharePrefix = nl.length >= 3 && nl2.length >= 3 &&
        (nl.startsWith(nl2.slice(0, 4)) || nl2.startsWith(nl.slice(0, 4)));
      const shareSuffix = nl.length >= 3 && nl2.length >= 3 &&
        (nl.endsWith(nl2.slice(-4)) || nl2.endsWith(nl.slice(-4)));
      const threshold = Math.max(3, Math.floor(maxLen / 2));
      if (dist <= threshold || sharePrefix || shareSuffix) return { n, dist };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(x => x.n);
  return scored;
}
function buildSourceView(lines, line, col, underlineLabel) {
  if (!lines || !line || line < 1 || !lines[line - 1]) return null;
  const w = Math.max(String(line + 1).length, 3);
  const numPad  = n => R.blue(` ${String(n).padStart(w)} │`);
  const blankNum = R.blue(` ${' '.repeat(w)} │`);
  const rows = [];
  if (line > 2) rows.push(R.dim(numPad(line - 2) + ' ' + (lines[line - 3] || '')));
  if (line > 1) rows.push(R.dim(numPad(line - 1) + ' ' + (lines[line - 2] || '')));
  rows.push(numPad(line) + ' ' + R.white(lines[line - 1] || ''));
  const safeCol = Math.max(0, (col || 1) - 1);
  const srcLine = lines[line - 1] || '';
  const tokenLength = Math.max(3, (() => {
    let l = safeCol;
    while (l < srcLine.length && /\w/.test(srcLine[l])) l++;
    return l - safeCol || 3;
  })());
  const arrowLine = ' '.repeat(safeCol) + R.red('┬' + '─'.repeat(tokenLength - 1));
  const caret     = ' '.repeat(safeCol) + R.red('╰── ') + R.yellow(underlineLabel || 'here');
  rows.push(blankNum + ' ' + arrowLine);
  rows.push(blankNum + ' ' + caret);
  return rows.join('\n');
}
function getSuggestionsForCode(code, name, msg, similar) {
  const sugs = [];
  const lmsg = (msg || '').toLowerCase();
  if (name === 'print' || name === 'println') {
    return [
      `try: console.log(${name === 'println' ? '"your message\\n"' : '"your message"'})`,
      `or define an alias:  val print = console.log`,
    ];
  }
  if (code === 'UNDEF_VAR' || lmsg.includes('not declared') || lmsg.includes('not defined')) {
    sugs.push(`declare it first:  val ${name} = <value>`);
    if (similar && similar.length)
      sugs.push(`did you mean ${similar.slice(0, 2).map(s => "'"+s+"'").join(' or ')}?`);
    sugs.push(`or pass it as a parameter to the function that needs it`);
  } else if (code === 'CONST_REASSIGN') {
    sugs.push(`use var instead of val if you need to reassign:\n     var ${name} = <value>`);
    sugs.push(`or shadow it with a new binding:\n     val ${name}2 = newValue`);
  } else if (code === 'TYPE_MISMATCH') {
    sugs.push(`make sure both sides have the same type`);
    sugs.push(`use 'as any' to opt out of type checking if you're sure it's correct`);
  } else if (code === 'NOT_FUNCTION') {
    sugs.push(`'${name}' is not a function — check what it actually holds before calling it`);
    sugs.push(`if it comes from an import, make sure the module exports it correctly`);
  } else if (lmsg.includes('null') || lmsg.includes('undefined')) {
    sugs.push(`guard against null first:\n     ifset ${name} as v { v.property }`);
    sugs.push(`or use optional chaining:  ${name}?.property`);
    sugs.push(`or a fallback:  ${name} ?? defaultValue`);
  }
  return sugs;
}
function format(err, src) {
  if (typeof src === 'string') src = src.split('\n');
  const isNTL    = err && err.ntlError;
  const phase    = (isNTL && err.phase) || 'runtime';
  const rawMsg   = isNTL ? err.message.replace(/^\[NTL[^\]]*\]\s*/, '') : translateJS(err);
  const file     = isNTL ? err.file : null;
  const line     = (isNTL && err.line) || 0;
  const col      = (isNTL && err.col)  || 1;
  const code     = (isNTL && err.code) || null;
  const srcLines = src || (isNTL && err.sourceLines) || null;
  const name     = extractName(rawMsg, code);
  const similar  = (isNTL && err.similar) || [];
  let sugs       = (isNTL && err.suggestion) ? (Array.isArray(err.suggestion) ? err.suggestion : [err.suggestion]) : getSuggestionsForCode(code, name, rawMsg, similar);
  const exBad    = (isNTL && err.exBad)  || null;
  const exGood   = (isNTL && err.exGood) || null;
  const label  = PHASE_LABEL[phase] || 'error';
  const lines_ = [];
  lines_.push('');

  // Header: "error[parse]: message"
  lines_.push(R.bold(R.red(label)) + R.bold(': ' + rawMsg));

  // Location:  --> src/app.ntl:12:5
  if (file || line > 0) {
    const loc = [file, line > 0 ? String(line) : null, col > 1 ? String(col) : null].filter(Boolean).join(':');
    lines_.push(R.blue('  --> ') + loc);
  }

  // Source snippet with arrows
  if (srcLines && line > 0) {
    lines_.push('');
    const underLabel = getUnderlineLabel(code, rawMsg, name);
    const view = buildSourceView(srcLines, line, col, underLabel);
    if (view) lines_.push(view);
  }

  // Explanation (only if it adds something new)
  const explanation = buildExplanation(code, name, rawMsg, phase);
  if (explanation && explanation !== rawMsg) {
    lines_.push('');
    lines_.push(R.blue('  = note: ') + R.gray(explanation.replace(/\n\s*/g, '  ')));
  }

  // Suggestions
  if (sugs && sugs.length > 0) {
    lines_.push('');
    sugs.forEach((s, i) => {
      const prefix = i === 0 ? R.green('  help: ') : R.green('     or: ');
      lines_.push(prefix + s.replace(/\n\s*/g, '\n          '));
    });
  }

  // Similar names
  if (similar && similar.length > 0) {
    lines_.push('');
    lines_.push(R.yellow('  note: ') + 'similar names in scope:');
    for (const s of similar) lines_.push('        ' + R.cyan(s));
  }

  // Example (bad / good)
  if (exBad && exGood) {
    lines_.push('');
    lines_.push(R.red('  bad:  ') + R.dim(exBad));
    lines_.push(R.green('  good: ') + R.green(exGood));
  }

  lines_.push('');
  return lines_.join('\n') + '\n';
}
function getUnderlineLabel(code, msg, name) {
  if (code === 'UNDEF_VAR' || code === 'UNDEF_FUNC') return `'${name}' is not defined in this scope`;
  if (code === 'CONST_REASSIGN') return `'${name}' is declared as val (immutable)`;
  if (code === 'TYPE_MISMATCH') return 'type mismatch here';
  if (code === 'NOT_FUNCTION') return `'${name}' is not a function`;
  if (code === 'NULL_ACCESS')  return 'value may be null or undefined';
  if (msg && msg.includes('not declared')) return `not declared in this scope`;
  if (msg && msg.includes('type')) return 'type error here';
  return 'error originates here';
}
function buildExplanation(code, name, msg, phase) {
  if (name === 'print' || name === 'println') return `'${name}' doesn't exist — NTL uses console.log`;
  if (code === 'UNDEF_VAR')      return `'${name}' is not in scope here`;
  if (code === 'UNDEF_FUNC')     return `'${name}' is not defined — declare it or import it before calling`;
  if (code === 'CONST_REASSIGN') return `'${name}' was declared with val, which is immutable`;
  if (code === 'TYPE_MISMATCH')  return `value doesn't match the declared type`;
  if (code === 'NOT_FUNCTION')   return `'${name}' is not callable`;
  if (code === 'NULL_ACCESS')    return `value is null or undefined`;
  return msg;
}
function extractName(msg, code) {
  const m = msg && (msg.match(/'([^']+)'/) || msg.match(/"([^"]+)"/));
  return m ? m[1] : '';
}
function translateJS(err) {
  const m = (err && err.message) || String(err);
  if (/Cannot read propert/i.test(m)) {
    const x = m.match(/Cannot read propert\w* '?([^'"\s]+)'?/);
    return `Cannot access property '${x ? x[1] : 'unknown'}' — value is null or undefined`;
  }
  if (/is not a function/i.test(m)) {
    const x = m.match(/'?([^']+)'? is not a function/);
    return `'${x ? x[1] : 'value'}' is not a function`;
  }
  if (/is not defined/i.test(m)) {
    const x = m.match(/(\w+) is not defined/);
    return `'${x ? x[1] : 'variable'}' is not defined`;
  }
  if (/Maximum call stack/.test(m)) return 'Call stack overflow — infinite recursion detected';
  if (/Cannot assign to read/.test(m)) return 'Cannot reassign a constant — use var instead of val';
  if (/already been declared/.test(m)) {
    const x = m.match(/'([^']+)'/);
    return `Identifier '${x ? x[1] : 'variable'}' has already been declared`;
  }
  return m;
}
function print(err, src) { process.stderr.write(format(err, src)); }
class NTLError extends Error {
  constructor(msg, opts) {
    super(msg);
    opts = opts || {};
    this.ntlError = true;
    this.name = 'NTLError';
    this.phase = opts.phase || 'runtime';
    this.line = opts.line || 0;
    this.col = opts.col || 1;
    this.file = opts.file || null;
    this.suggestion = opts.suggestion || null;
    this.code = opts.code || 'NTL_ERROR';
    this.sourceLines = opts.sourceLines || null;
    this.similar = opts.similar || [];
    this.exBad = opts.exBad || null;
    this.exGood = opts.exGood || null;
  }
  format(src) { return format(this, src || this.sourceLines); }
  print(src)  { print(this, src || this.sourceLines); }
}
class CompileError extends NTLError {
  constructor(msg, opts) { super(msg, Object.assign({}, opts, { phase: 'compile' })); this.name = 'CompileError'; }
  static undeclaredVar(name, opts) {
    return new CompileError(`'${name}' is not declared`, Object.assign({ code: 'UNDEF_VAR', suggestion: `Declare it first:\n     > const ${name} = <value>` }, opts || {}));
  }
  static constReassign(name, opts) {
    return new CompileError(`Cannot reassign val binding '${name}'`, Object.assign({ code: 'CONST_REASSIGN' }, opts || {}));
  }
  static typeMismatch(exp, got, opts) {
    return new CompileError(`Type mismatch: expected '${exp}', got '${got}'`, Object.assign({ code: 'TYPE_MISMATCH' }, opts || {}));
  }
}
class ParseError extends NTLError {
  constructor(msg, opts) { super(msg, Object.assign({}, opts, { phase: 'parse' })); this.name = 'ParseError'; }
}
class TypeError_ extends NTLError {
  constructor(msg, opts) { super(msg, Object.assign({}, opts, { phase: 'type' })); this.name = 'NTLTypeError'; }
  static mismatch(exp, got, opts) { return new TypeError_(`Type '${got}' is not assignable to type '${exp}'`, Object.assign({ code: 'TYPE_MISMATCH' }, opts || {})); }
}
class RuntimeError extends NTLError {
  constructor(msg, opts) { super(msg, Object.assign({}, opts, { phase: 'runtime' })); this.name = 'NTLRuntimeError'; }
  static nullAccess(prop, opts) { return new RuntimeError(`Cannot access '${prop}' on null or undefined`, Object.assign({ code: 'NULL_ACCESS' }, opts || {})); }
}
module.exports = { NTLError, CompileError, ParseError, TypeError_, RuntimeError, format, print, R, translateJS, findSimilar };
