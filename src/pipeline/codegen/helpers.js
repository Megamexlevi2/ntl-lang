'use strict';

// Shared utilities used by every other codegen module.
// Keeps the main generator thin — only logic that is truly cross-cutting
// (indentation, safe identifiers, destructure patterns) lives here.

/**
 * Returns a string of two-space indentation repeated `n` times.
 * @param {number} n - Indentation level.
 * @returns {string}
 */
function pad(n) {
  return '  '.repeat(n < 0 ? 0 : n);
}

/**
 * Converts an absolute file path into a safe JavaScript identifier fragment.
 * Used when embedding compiled modules inline.
 * @param {string} absPath
 * @returns {string}
 */
function safeId(absPath) {
  return absPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, '');
}

/**
 * Serialises a destructure pattern node into a JS destructure string.
 * Handles both object `{ a, b: c }` and array `[ x, y ]` patterns,
 * including rest elements and nested patterns.
 * @param {object|null} d - Destructure AST node.
 * @param {function} genExpr - Expression generator from the parent CodeGen.
 * @returns {string}
 */
function genDestructPat(d, genExpr) {
  if (!d) return '_';
  if (d.kind === 'object') {
    const parts = d.props.map(p => {
      if (p.rest) return `...${p.name}`;
      if (p.nested) return `${p.name}: ${genDestructPat(p.nested, genExpr)}`;
      const def = p.defaultVal ? ` = ${genExpr(p.defaultVal)}` : '';
      if (p.name === p.alias) return `${p.name}${def}`;
      return `${p.name}: ${p.alias}${def}`;
    });
    return `{ ${parts.join(', ')} }`;
  }
  if (d.kind === 'array') {
    const parts = d.items.map(item => {
      if (!item) return '';
      if (item.rest) return `...${item.name}`;
      if (item.nested) return genDestructPat(item.nested, genExpr);
      const def = item.defaultVal ? ` = ${genExpr(item.defaultVal)}` : '';
      return `${item.name}${def}`;
    });
    return `[ ${parts.join(', ')} ]`;
  }
  return '_';
}

/**
 * Variant of genDestructPat used specifically for function parameters,
 * where alias/default syntax differs slightly from variable declarations.
 * @param {object|null} d
 * @param {function} genExpr
 * @returns {string}
 */
function genDestructurePattern(d, genExpr) {
  if (!d) return '_';
  if (d.kind === 'object') {
    const props = (d.props || []).map(p => {
      if (p.nested) return `${p.name}: ${genDestructurePattern(p.nested, genExpr)}`;
      if (p.alias && p.alias !== p.name) return `${p.name}: ${p.alias}`;
      if (p.default !== undefined && p.default !== null) return `${p.alias || p.name} = ${genExpr(p.default)}`;
      return p.alias || p.name;
    });
    return `{${props.join(', ')}}`;
  }
  if (d.kind === 'array') {
    const items = (d.items || []).map(item => {
      if (!item) return '';
      if (item.rest) return `...${item.name}`;
      if (item.nested) return genDestructurePattern(item.nested, genExpr);
      return item.name;
    });
    return `[${items.join(', ')}]`;
  }
  return '_';
}

/**
 * Serialises a function parameter list to a JS parameter string.
 * Handles rest params, default values, and destructure patterns.
 * @param {Array} params
 * @param {function} genExpr
 * @param {function} genDestructFn - Either genDestructPat or genDestructurePattern.
 * @returns {string}
 */
function genParams(params, genExpr, genDestructFn) {
  return (params || []).map(p => {
    if (p.destructure) {
      let s = genDestructFn(p.destructure);
      if (p.defaultVal !== null && p.defaultVal !== undefined) s += ` = ${genExpr(p.defaultVal)}`;
      return s;
    }
    let s = p.rest ? `...${p.name}` : p.name;
    if (p.defaultVal !== null && p.defaultVal !== undefined) s += ` = ${genExpr(p.defaultVal)}`;
    return s;
  }).join(', ');
}

/**
 * Walks the AST and collects the names of every variable that is ever
 * reassigned (via `=` or `++`/`--`). Used by the variable declaration
 * generator to decide `const` vs `let`.
 * @param {object} node
 * @param {Set<string>} [set]
 * @returns {Set<string>}
 */
function collectReassigned(node, set) {
  set = set || new Set();
  if (!node || typeof node !== 'object') return set;
  if (node.type === 'AssignExpr') {
    if (node.left && node.left.type === 'Identifier') set.add(node.left.name);
  }
  if (node.type === 'UpdateExpr' || node.type === 'UnaryExpr') {
    if (node.operand && node.operand.type === 'Identifier') set.add(node.operand.name);
    if (node.arg    && node.arg.type    === 'Identifier') set.add(node.arg.name);
  }
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'line' || key === 'col') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const child of val) collectReassigned(child, set);
    } else if (val && typeof val === 'object' && val.type) {
      collectReassigned(val, set);
    }
  }
  return set;
}

module.exports = { pad, safeId, genDestructPat, genDestructurePattern, genParams, collectReassigned };
