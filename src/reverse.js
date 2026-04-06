'use strict';

function reverseCompile(jsSource, filename) {
  filename = filename || '<unknown>';
  try {
    const code = _transform(jsSource);
    return { success: true, code, errors: [] };
  } catch (e) {
    return { success: false, code: null, errors: [{ message: e.message, file: filename, line: 0 }] };
  }
}

function _transform(src) {
  let out = src;

  // ── Require / imports ──────────────────────────────────────────────────────
  // const x = require("ntl:mod")  →  val x = require("ntl:mod")
  out = out.replace(/\bconst\s+(\{[^}]+\}|\w+)\s*=\s*require\((['"][^'"]+['"])\);?/g,
    (_, lhs, mod) => `val ${lhs.trim()} = require(${mod})`);

  // require("path") calls not assigned — leave as-is but strip ;
  // import x from "y"  →  val x = require("y")
  out = out.replace(/\bimport\s+\*\s+as\s+(\w+)\s+from\s+(['"][^'"]+['"])/g,
    (_, name, mod) => `val ${name} = require(${mod})`);
  out = out.replace(/\bimport\s+\{\s*([^}]+)\}\s+from\s+(['"][^'"]+['"])/g,
    (_, names, mod) => `val { ${names.trim()} } = require(${mod})`);
  out = out.replace(/\bimport\s+(\w+)\s+from\s+(['"][^'"]+['"])/g,
    (_, name, mod) => `val ${name} = require(${mod})`);

  // ── Variable declarations ──────────────────────────────────────────────────
  out = out.replace(/\bconst\s+/g, 'val ');
  out = out.replace(/\blet\s+/g, 'var ');

  // ── Functions ─────────────────────────────────────────────────────────────
  // async function name(...)  →  async fn name(...)
  out = out.replace(/\basync\s+function\s+(\w+)\s*\(/g, 'async fn $1(');
  // function name(...)  →  fn name(...)
  out = out.replace(/\bfunction\s+(\w+)\s*\(/g, 'fn $1(');
  // anonymous: function(  →  fn(
  out = out.replace(/\bfunction\s*\(/g, 'fn(');

  // ── Classes ────────────────────────────────────────────────────────────────
  // constructor(  →  init(
  out = out.replace(/\bconstructor\s*\(/g, 'init(');

  // ── module.exports ─────────────────────────────────────────────────────────
  // module.exports = { a, b }  →  export { a, b }
  out = out.replace(/module\.exports\s*=\s*\{([^}]+)\}/g, (_, names) => `export {\n${names}\n}`);
  // module.exports.name = name  →  export { name }  (collected below)
  out = out.replace(/module\.exports\.(\w+)\s*=\s*\1;?/g, '');
  // module.exports = X  →  export default X
  out = out.replace(/module\.exports\s*=\s*/g, 'export default ');

  // ── console.log  →  log ───────────────────────────────────────────────────
  out = out.replace(/\bconsole\.log\s*\(/g, 'log(');
  // Rewrite log(...) as statement (remove wrapping parens for simple cases)
  out = out.replace(/^(\s*)log\((.+)\);?$/gm, (_, indent, args) => `${indent}log ${args}`);

  // ── Control flow ──────────────────────────────────────────────────────────
  // } else if (  →  } elif
  out = out.replace(/\}\s*else\s+if\s*\(/g, '} elif (');
  // } else {  →  } else {  (already fine)

  // for (const x of y)  →  each x in y
  out = out.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+|\{[^}]+\})\s+of\s+([^)]+)\)/g,
    (_, id, iter) => `each ${id.trim()} in ${iter.trim()}`);

  // for (let i = 0; i < n; i++)  →  repeat n  (only simple 0-based loops)
  out = out.replace(/\bfor\s*\(\s*(?:let|var)\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g,
    (_, _v, n) => `repeat ${n.trim()}`);

  // while (true)  →  loop
  out = out.replace(/\bwhile\s*\(\s*true\s*\)/g, 'loop');

  // ── Operators ─────────────────────────────────────────────────────────────
  // === / !==  stay the same in NTL
  // Delete semicolons at end of statement lines
  out = _removeSemicolons(out);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  // Remove 'use strict'
  out = out.replace(/^['"]use strict['"];?\n?/gm, '');
  // Remove empty lines at start/end
  out = out.replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
  // Collapse 3+ blank lines to 2
  out = out.replace(/\n{3,}/g, '\n\n');

  return out;
}

function _removeSemicolons(src) {
  const lines = src.split('\n');
  return lines.map(line => {
    const trimmed = line.trimEnd();
    // Don't strip from for loops, empty lines, template literals
    if (!trimmed.endsWith(';')) return line;
    // Strip trailing semicolons from statement lines
    return trimmed.slice(0, -1);
  }).join('\n');
}

module.exports = { reverseCompile };
