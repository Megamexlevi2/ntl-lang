'use strict';
/**
 * Selective Embed — extracts ONLY the function/class/const bodies that are
 * actually used from a module, plus their transitive internal dependencies.
 *
 * Pipeline per module:
 *   1. extractDeclarations()  — scan the file character-by-character, brace-
 *      balanced, to collect every top-level declaration with its exact source span.
 *   2. parseExportsBlock()    — find the `module.exports = { ... }` block and
 *      map exported name → internal identifier.
 *   3. buildCallGraph()       — for each declaration, record which other
 *      top-level identifiers it references (transitive deps).
 *   4. resolveNeeded()        — starting from `usedNames`, walk the call graph
 *      to collect every declaration that must be included.
 *   5. assembleModule()       — emit only the needed declarations + a minimal
 *      module.exports object, wrapped in an IIFE.
 */

// ─── 1. Declaration extractor ─────────────────────────────────────────────────

/**
 * Scan `code` character-by-character and return an array of top-level
 * declarations:
 *   { name, kind, start, end, body }
 *
 * Handles:
 *   function foo(...)  { ... }
 *   async function foo(...) { ... }
 *   class Foo { ... }
 *   const/let/var foo = function(...) { ... }
 *   const/let/var foo = async function(...) { ... }
 *   const/let/var foo = (...) => { ... }        (block body)
 *   const/let/var foo = (...) => expr;          (expression body)
 *   const/let/var foo = new Something(...)      (expression, no braces)
 *   const/let/var CONST_NAME = { ... }          (object literal)
 *   const/let/var CONST_NAME = [ ... ]          (array literal)
 *   const/let/var CONST_NAME = value;           (primitive)
 */
function extractDeclarations(code) {
  const decls = [];
  const len   = code.length;
  let i       = 0;

  // Skip a string/template literal starting at i, return new i
  function skipString(quote) {
    i++; // skip opening quote
    while (i < len) {
      if (code[i] === '\\') { i += 2; continue; }
      if (code[i] === quote) { i++; return; }
      if (quote === '`' && code[i] === '$' && code[i+1] === '{') {
        i += 2; skipBalanced('{', '}'); continue;
      }
      i++;
    }
  }

  // Skip a block comment /* ... */
  function skipBlockComment() {
    i += 2;
    while (i < len) {
      if (code[i] === '*' && code[i+1] === '/') { i += 2; return; }
      i++;
    }
  }

  // Skip a line comment // ...
  function skipLineComment() {
    while (i < len && code[i] !== '\n') i++;
  }

  // Skip balanced open→close pair, already past the opening char
  function skipBalanced(open, close) {
    let depth = 1;
    while (i < len && depth > 0) {
      const ch = code[i];
      if (ch === '"' || ch === "'" || ch === '`') { skipString(ch); continue; }
      if (ch === '/' && code[i+1] === '*') { skipBlockComment(); continue; }
      if (ch === '/' && code[i+1] === '/') { skipLineComment();  continue; }
      if (ch === open)  depth++;
      if (ch === close) depth--;
      i++;
    }
  }

  // Read an identifier starting at i, return it (does NOT advance i)
  function peekIdent() {
    let j = i;
    while (j < len && /[\w$]/.test(code[j])) j++;
    return code.slice(i, j);
  }

  // Advance past whitespace
  function skipWS() { while (i < len && /\s/.test(code[i])) i++; }

  // Advance past an identifier
  function skipIdent() { while (i < len && /[\w$]/.test(code[i])) i++; }

  // Advance past a function parameter list (...)
  function skipParens() { i++; skipBalanced('(', ')'); }

  // Advance to end of expression (until ; or end of block), used for arrow
  // expression bodies and simple assignments
  function skipExpression() {
    let depth = 0;
    while (i < len) {
      const ch = code[i];
      if (ch === '"' || ch === "'" || ch === '`') { skipString(ch); continue; }
      if (ch === '/' && code[i+1] === '*') { skipBlockComment(); continue; }
      if (ch === '/' && code[i+1] === '/') { skipLineComment();  continue; }
      if ('({['.includes(ch)) { depth++; i++; continue; }
      if (')}'.includes(ch) && depth > 0) { depth--; i++; continue; }
      if (ch === ']' && depth > 0) { depth--; i++; continue; }
      if (depth === 0 && ch === ';') { i++; return; }
      if (depth === 0 && ch === '\n') { i++; return; } // for expression-body arrows
      i++;
    }
  }

  while (i < len) {
    const ch = code[i];

    // Skip strings and comments
    if (ch === '"' || ch === "'" || ch === '`') { skipString(ch); continue; }
    if (ch === '/' && code[i+1] === '*') { skipBlockComment(); continue; }
    if (ch === '/' && code[i+1] === '/') { skipLineComment();  continue; }

    // Skip non-identifier chars
    if (!/[a-zA-Z_$]/.test(ch)) { i++; continue; }

    // Peek at the keyword
    const kw = peekIdent();

    // ── function / async function ──────────────────────────────────────────
    if (kw === 'function' || kw === 'async') {
      const start = i;
      skipIdent(); skipWS();

      let isAsync = (kw === 'async');
      if (isAsync) {
        const next = peekIdent();
        if (next !== 'function') { skipExpression(); continue; } // async arrow, handled by const/let/var
        skipIdent(); skipWS(); // skip 'function'
      }

      const name = peekIdent();
      if (!name) { i++; continue; } // anonymous function expression — skip
      skipIdent(); skipWS();

      // Skip optional generic <...>
      if (code[i] === '<') { i++; skipBalanced('<', '>'); }

      // Skip parameter list
      if (code[i] !== '(') { i++; continue; }
      skipParens(); skipWS();

      // Skip optional return type annotation : Type
      if (code[i] === ':') { while (i < len && code[i] !== '{') i++; }

      if (code[i] !== '{') { i++; continue; }
      i++; // enter body
      skipBalanced('{', '}');

      decls.push({ name, kind: isAsync ? 'async function' : 'function', start, end: i, body: code.slice(start, i) });
      continue;
    }

    // ── class ──────────────────────────────────────────────────────────────
    if (kw === 'class') {
      const start = i;
      skipIdent(); skipWS();
      const name = peekIdent();
      if (!name) { i++; continue; }
      skipIdent(); skipWS();
      // Skip optional extends ...
      if (peekIdent() === 'extends') { skipIdent(); skipWS(); skipIdent(); skipWS(); }
      if (code[i] !== '{') { i++; continue; }
      i++;
      skipBalanced('{', '}');
      decls.push({ name, kind: 'class', start, end: i, body: code.slice(start, i) });
      continue;
    }

    // ── const / let / var ─────────────────────────────────────────────────
    if (kw === 'const' || kw === 'let' || kw === 'var') {
      const start = i;
      skipIdent(); skipWS();

      // Destructured: const { a, b } = ... — skip entirely (not a named export)
      if (code[i] === '{' || code[i] === '[') {
        skipExpression();
        continue;
      }

      const name = peekIdent();
      if (!name) { i++; continue; }
      skipIdent(); skipWS();

      if (code[i] !== '=') { skipExpression(); continue; }
      i++; skipWS(); // skip '='

      // What follows?
      const rhs = peekIdent();

      if (rhs === 'function' || rhs === 'async') {
        // const foo = function(...) { } or const foo = async function(...) { }
        skipIdent(); skipWS();
        if (rhs === 'async') { skipIdent(); skipWS(); } // skip 'function'
        // optional name after function keyword
        if (/[\w$]/.test(code[i])) { skipIdent(); skipWS(); }
        if (code[i] !== '(') { skipExpression(); continue; }
        skipParens(); skipWS();
        if (code[i] === ':') { while (i < len && code[i] !== '{') i++; }
        if (code[i] !== '{') { skipExpression(); continue; }
        i++; skipBalanced('{', '}');
        decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
        // swallow optional ;
        if (code[i] === ';') i++;
        continue;
      }

      if (rhs === 'class') {
        // const Foo = class { ... }
        skipIdent(); skipWS();
        if (/[\w$]/.test(code[i])) { skipIdent(); skipWS(); }
        if (peekIdent() === 'extends') { skipIdent(); skipWS(); skipIdent(); skipWS(); }
        if (code[i] !== '{') { skipExpression(); continue; }
        i++; skipBalanced('{', '}');
        if (code[i] === ';') i++;
        decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
        continue;
      }

      if (rhs === 'new') {
        // const foo = new Foo(...) — treat as whole-expression
        skipExpression();
        decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
        continue;
      }

      // Arrow function: could be  (a, b) => ...  or  a => ...
      // The RHS peek returns '' if code[i] is '(' — handle both
      if (code[i] === '(') {
        // possible arrow
        const saved = i;
        skipParens(); skipWS();
        if (code[i] === '=' && code[i+1] === '>') {
          i += 2; skipWS();
          if (code[i] === '{') { i++; skipBalanced('{', '}'); }
          else { skipExpression(); }
          if (code[i] === ';') i++;
          decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
          continue;
        }
        i = saved; // not an arrow — fall through to generic expression
      }

      // Plain identifier arrow:  name => ...
      if (rhs && code[i + rhs.length] === ' ' || code[i + rhs.length] === '\t') {
        const afterRhs = i + rhs.length;
        let j = afterRhs;
        while (j < len && (code[j] === ' ' || code[j] === '\t')) j++;
        if (code[j] === '=' && code[j+1] === '>') {
          // single-param arrow
          skipIdent(); skipWS(); i += 2; skipWS();
          if (code[i] === '{') { i++; skipBalanced('{', '}'); }
          else { skipExpression(); }
          if (code[i] === ';') i++;
          decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
          continue;
        }
      }

      // Generic expression (object literal, array, primitive, etc.)
      if (code[i] === '{') {
        i++; skipBalanced('{', '}');
        if (code[i] === ';') i++;
        decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
        continue;
      }
      if (code[i] === '[') {
        i++; skipBalanced('[', ']');
        if (code[i] === ';') i++;
        decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
        continue;
      }

      // Scalar / template literal / other expression
      skipExpression();
      decls.push({ name, kind: 'const', start, end: i, body: code.slice(start, i) });
      continue;
    }

    // ── module.exports = { ... } — skip, handled separately ───────────────
    if (kw === 'module') {
      skipExpression();
      continue;
    }

    // Anything else — skip the identifier
    skipIdent();
  }

  return decls;
}

// ─── 2. Exports block parser ───────────────────────────────────────────────────

/**
 * Parse `module.exports = { a, b, c: d, ... }` and return a Map of
 *   exportedName → internalName
 *
 * Also handles `module.exports.x = y` style (one per line).
 */
function parseExportsBlock(code) {
  const map = new Map();

  // Object literal form: module.exports = { foo, bar, baz: qux }
  const objRe = /module\.exports\s*=\s*\{([^}]*)\}/s;
  const objM  = objRe.exec(code);
  if (objM) {
    const inner = objM[1];
    // Each entry: `name` or `key: name` or `key: name,`
    const entryRe = /(\w+)\s*(?::\s*(\w+))?\s*(?:,|$)/g;
    let m;
    while ((m = entryRe.exec(inner)) !== null) {
      const exportedName  = m[1];
      const internalName  = m[2] || m[1];
      if (exportedName) map.set(exportedName, internalName);
    }
  }

  // Property-assignment form: module.exports.foo = bar;
  const propRe = /module\.exports\.(\w+)\s*=\s*(\w+)\s*;?/g;
  let m2;
  while ((m2 = propRe.exec(code)) !== null) {
    map.set(m2[1], m2[2]);
  }

  return map;
}

// ─── 3. Call-graph builder ────────────────────────────────────────────────────

/**
 * Strip string literals and comments from `code` so that identifier
 * scanning doesn't pick up names that appear only inside strings/comments.
 */
function stripStringsAndComments(code) {
  let out = '';
  let i   = 0;
  const len = code.length;
  while (i < len) {
    const ch = code[i];
    if (ch === '/' && code[i+1] === '*') {
      const start = i; i += 2;
      while (i < len && !(code[i] === '*' && code[i+1] === '/')) i++;
      i += 2;
      out += ' '.repeat(i - start);
      continue;
    }
    if (ch === '/' && code[i+1] === '/') {
      const start = i;
      while (i < len && code[i] !== '\n') i++;
      out += ' '.repeat(i - start);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i; const q = ch; i++;
      while (i < len) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === q)    { i++; break; }
        i++;
      }
      out += ' '.repeat(i - start);
      continue;
    }
    if (ch === '`') {
      // For template literals: blank the string parts but keep ${...} contents
      i++; // skip opening backtick
      while (i < len) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '`')  { i++; break; }
        if (code[i] === '$' && code[i+1] === '{') {
          out += '${'; i += 2;
          let depth = 1;
          while (i < len && depth > 0) {
            const c = code[i];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            if (depth > 0) out += c;
            i++;
          }
          out += '}';
          continue;
        }
        out += ' '; i++;
      }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

/**
 * For each declaration, collect which other top-level declaration names
 * are *referenced as values* (not just as property keys) inside its body.
 * Uses a stripped body (no strings/comments) for accuracy.
 * Returns Map<name, Set<name>>.
 */
function buildCallGraph(decls) {
  const allNames = new Set(decls.map(d => d.name));
  const graph    = new Map();

  for (const decl of decls) {
    const cleanBody = stripStringsAndComments(decl.body);
    const refs = new Set();

    for (const name of allNames) {
      if (name === decl.name) continue;

      const re = new RegExp(`(?<![\\w$.])${escapeRegex(name)}(?![\\w$])`, 'g');
      let m;
      while ((m = re.exec(cleanBody)) !== null) {
        const after = cleanBody[m.index + name.length] || '';
        // Skip if it's only used as an object literal key:  { name: value }
        if (after === ':') continue;
        refs.add(name);
        break;
      }
    }
    graph.set(decl.name, refs);
  }

  return graph;
}

// ─── 4. Transitive resolver ───────────────────────────────────────────────────

/**
 * Starting from `seeds` (Set of names), walk the call graph and return
 * a Set of all names that need to be included.
 */
function resolveNeeded(seeds, graph) {
  const needed = new Set(seeds);
  const queue  = [...seeds];
  while (queue.length > 0) {
    const name = queue.shift();
    const deps = graph.get(name);
    if (!deps) continue;
    for (const dep of deps) {
      if (!needed.has(dep)) {
        needed.add(dep);
        queue.push(dep);
      }
    }
  }
  return needed;
}

// ─── 5. Module assembler ──────────────────────────────────────────────────────

/**
 * Given the module source, a set of exported names the caller uses,
 * and the absolute path, return a self-contained IIFE string that:
 *   - includes ONLY the declarations needed (direct + transitive)
 *   - includes ONLY the module.exports entries for `usedNames`
 *   - is wrapped so it evaluates to the exports object
 *
 * If `usedNames` is null, keep everything (fallback).
 *
 * @param {string}      moduleCode  - full source of the .js module
 * @param {Set<string>|null} usedNames - exported names the caller actually uses
 * @param {string}      absPath     - absolute path (used for __dirname/__filename)
 * @returns {string}  IIFE expression
 */
function selectiveWrap(moduleCode, usedNames, absPath) {
  const path = require('path');

  // ── Parse what the module exports and what the internal name is ──────────
  const exportsMap  = parseExportsBlock(moduleCode);   // exportedName → internalName
  const declList    = extractDeclarations(moduleCode);
  const declByName  = new Map(declList.map(d => [d.name, d]));

  // ── Determine which exported names we want ───────────────────────────────
  let wantedExports;
  if (!usedNames || usedNames.size === 0) {
    wantedExports = new Set(exportsMap.keys()); // keep everything
  } else {
    wantedExports = new Set([...usedNames].filter(n => exportsMap.has(n)));
    // If caller asked for names not in exportsMap (e.g. whole-object usage), keep all
    if (wantedExports.size === 0) wantedExports = new Set(exportsMap.keys());
  }

  // ── Collect the internal identifiers we need ─────────────────────────────
  const internalSeeds = new Set();
  for (const exp of wantedExports) {
    const internal = exportsMap.get(exp);
    if (internal) internalSeeds.add(internal);
  }

  // ── Build call graph and resolve transitive deps ─────────────────────────
  const graph  = buildCallGraph(declList);
  const needed = resolveNeeded(internalSeeds, graph);

  // ── Extract the top-level require() lines (always keep those) ───────────
  const requireLines = [];
  const requireRe = /^(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\([^)]+\);?\s*$/gm;
  let m;
  while ((m = requireRe.exec(moduleCode)) !== null) {
    requireLines.push(m[0].trimEnd());
  }

  // ── Assemble the body ────────────────────────────────────────────────────
  const parts = [];

  // 1. All require() lines (de-duped)
  const seenReqs = new Set();
  for (const r of requireLines) {
    if (!seenReqs.has(r)) { seenReqs.add(r); parts.push(r); }
  }
  if (parts.length) parts.push('');

  // 2. Only the needed declarations, in their original order
  for (const decl of declList) {
    if (needed.has(decl.name)) {
      parts.push(decl.body.trimEnd());
      parts.push('');
    }
  }

  // 3. Minimal module.exports object
  const exportEntries = [];
  for (const [exp, internal] of exportsMap) {
    if (wantedExports.has(exp)) {
      exportEntries.push(exp === internal ? exp : `${exp}: ${internal}`);
    }
  }
  if (exportEntries.length > 0) {
    parts.push(`module.exports = { ${exportEntries.join(', ')} };`);
  }

  const innerBody = parts.join('\n');
  const id        = absPath.replace(/\\/g, '/').replace(/[^a-zA-Z0-9_]/g, '_');

  return [
    `(function() {`,
    `  const _ntl_mod_${id} = (function() {`,
    `    const module = { exports: {} };`,
    `    const exports = module.exports;`,
    `    const __filename = ${JSON.stringify(absPath)};`,
    `    const __dirname  = ${JSON.stringify(path.dirname(absPath))};`,
    innerBody.split('\n').map(l => '    ' + l).join('\n'),
    `    return module.exports;`,
    `  })();`,
    `  return _ntl_mod_${id};`,
    `})()`,
  ].join('\n');
}

// ─── Public helpers (used by _cmdBuildEmbed) ──────────────────────────────────

/**
 * Scans caller code for identifiers that look like they come from a module object.
 * e.g.  `http.createServer(` → 'createServer',  `const { fetch } = http` → 'fetch'
 */
function detectUsedNames(callerCode, moduleVarName) {
  const used = new Set();

  // namespace access: mod.name
  const re = new RegExp(`(?<![\\w$])${escapeRegex(moduleVarName)}\\.(\\w+)`, 'g');
  let m;
  while ((m = re.exec(callerCode)) !== null) used.add(m[1]);

  // destructured: const { a, b: c } = mod
  const destructRe = new RegExp(
    `(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${escapeRegex(moduleVarName)}`,
    'g'
  );
  while ((m = destructRe.exec(callerCode)) !== null) {
    m[1].split(',').forEach(s => {
      const trimmed = s.trim();
      // handle `key: alias` — we want the key (exported name)
      const colonIdx = trimmed.indexOf(':');
      const key = colonIdx >= 0 ? trimmed.slice(0, colonIdx).trim() : trimmed;
      if (key) used.add(key);
    });
  }

  return used;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Legacy: kept for compatibility (no longer used internally)
function stripUnusedExports(code, needed, allExported) {
  const neededSet = new Set(needed);
  return code.replace(
    /([ \t]*)module\.exports\.(\w+)\s*=\s*\w+;([ \t]*)(\n|$)/g,
    (line, _pad, name, _trail, nl) => neededSet.has(name) ? line : nl
  );
}

module.exports = { selectiveWrap, detectUsedNames, stripUnusedExports, extractDeclarations, parseExportsBlock };
