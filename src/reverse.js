'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ReverseResult
 * @property {boolean} success - Whether the compilation was successful.
 * @property {string|null} code - The generated NTL code.
 * @property {Array<{message: string, file: string, line: number}>} errors - List of errors if any.
 */

/**
 * Reverses a given JavaScript source code string into NTL language.
 * * @param {string} jsSource - The original JavaScript source code.
 * @param {string} [filename='<unknown>'] - The name of the file being processed.
 * @returns {ReverseResult} The compilation result containing the NTL code.
 */
function reverseCompile(jsSource, filename = '<unknown>') {
  try {
    const code = _transform(jsSource);
    return { success: true, code, errors: [] };
  } catch (e) {
    return { 
      success: false, 
      code: null, 
      errors: [{ message: e.message, file: filename, line: 0 }] 
    };
  }
}

/**
 * Recursively processes a directory, converting all .js files to .ntl files.
 * * @param {string} inputPath - The path to the input directory or file.
 * @param {string} outputPath - The path to the output directory or file.
 */
function processDirectory(inputPath, outputPath) {
  const stat = fs.statSync(inputPath);

  if (stat.isFile()) {
    if (!inputPath.endsWith('.js')) return;
    
    const jsCode = fs.readFileSync(inputPath, 'utf8');
    const result = reverseCompile(jsCode, inputPath);
    
    if (result.success) {
      // Create output dir if it doesn't exist
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      
      const ntlFilePath = outputPath.replace(/\.js$/, '.ntl');
      fs.writeFileSync(ntlFilePath, result.code, 'utf8');
      console.log(`[SUCCESS] Converted: ${inputPath} -> ${ntlFilePath}`);
    } else {
      console.error(`[ERROR] Failed to convert ${inputPath}:`, result.errors[0].message);
    }
  } else if (stat.isDirectory()) {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    const files = fs.readdirSync(inputPath);
    for (const file of files) {
      const currentInput = path.join(inputPath, file);
      const currentOutput = path.join(outputPath, file);
      processDirectory(currentInput, currentOutput);
    }
  }
}

/**
 * Core transformation engine. Safely converts JS syntax to NTL syntax.
 * Uses a tokenization approach to protect strings and comments from bad regex replacements.
 * * @param {string} src - The raw JavaScript source code.
 * @returns {string} The transformed NTL source code.
 * @private
 */
function _transform(src) {
  // 1. Protect Strings and Comments
  const dict = { strings: [], comments: [] };
  let protectedSrc = _protectStringsAndComments(src, dict);

  let out = protectedSrc;

  // ── 2. Require / Imports / Exports ─────────────────────────────────────────
  
  // module.exports = { a, b } -> export { a, b }
  out = out.replace(/module\.exports\s*=\s*\{([^}]+)\};?/g, 'export { $1 }');
  // module.exports = X -> export default X
  out = out.replace(/module\.exports\s*=\s*(.+);?/g, 'export default $1');
  // const { x } = require('y') -> import { x } from 'y'
  out = out.replace(/\bconst\s+\{\s*([^}]+)\s*\}\s*=\s*require\(([^)]+)\);?/g, 'import { $1 } from $2');
  // const x = require('y') -> import x from 'y'
  out = out.replace(/\bconst\s+(\w+)\s*=\s*require\(([^)]+)\);?/g, 'import $1 from $2');

  // ── 3. Variable Declarations ───────────────────────────────────────────────
  out = out.replace(/\bconst\b/g, 'val');
  out = out.replace(/\blet\b/g, 'var');

  // ── 4. Functions ───────────────────────────────────────────────────────────
  // async function name(...) -> async fn name(...)
  out = out.replace(/\basync\s+function\s+(\w+)\s*\(/g, 'async fn $1(');
  // function name(...) -> fn name(...)
  out = out.replace(/\bfunction\s+(\w+)\s*\(/g, 'fn $1(');
  // async function(...) -> async fn(...) (Anonymous)
  out = out.replace(/\basync\s+function\s*\(/g, 'async fn(');
  // function(...) -> fn(...) (Anonymous)
  out = out.replace(/\bfunction\s*\(/g, 'fn(');

  // ── 5. Classes & OOP ───────────────────────────────────────────────────────
  // constructor(...) -> init(...)
  out = out.replace(/\bconstructor\s*\(/g, 'init(');

  // ── 6. Control Flow & Loops ────────────────────────────────────────────────
  // } else if ( -> } elif (
  out = out.replace(/\}\s*else\s+if\s*\(/g, '} elif (');

  // for (const x of y) -> each x in y
  out = out.replace(/\bfor\s*\(\s*(?:val|var)\s+([\w{},\s]+)\s+of\s+([^)]+)\)/g, 
    (_, id, iter) => `each ${id.trim()} in ${iter.trim()}`);

  // for (let i = 0; i < n; i++) -> repeat n
  out = out.replace(/\bfor\s*\(\s*var\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*([^;]+);\s*\1\+\+\s*\)/g, 
    (_, _v, n) => `repeat ${n.trim()}`);

  // while (true) -> loop
  out = out.replace(/\bwhile\s*\(\s*true\s*\)/g, 'loop');

  // if (!condition) -> unless (condition)
  out = out.replace(/\bif\s*\(\s*!\s*\(([^)]+)\)\s*\)/g, 'unless ($1)');
  out = out.replace(/\bif\s*\(\s*!([\w.]+)\s*\)/g, 'unless ($1)');

  // ── 7. NTL Specifics & Built-ins ───────────────────────────────────────────
  // console.log(...) -> log(...)
  out = out.replace(/\bconsole\.log\s*\(/g, 'log(');
  // Re-format log as a command if simple (log "hello" instead of log("hello"))
  out = out.replace(/^(\s*)log\(([^,)]+)\);?$/gm, '$1log $2');

  // ── 8. Cleanup & Syntax Sugar ──────────────────────────────────────────────
  // Remove strict mode
  out = out.replace(/^['"]use strict['"];?\n?/gm, '');
  
  // Remove semicolons at the end of lines
  out = out.split('\n').map(line => {
    let t = line.trimEnd();
    if (t.endsWith(';') && !t.includes('for(') && !t.includes('for (')) {
      return t.slice(0, -1);
    }
    return line;
  }).join('\n');

  // 9. Restore Strings and Comments
  out = _restoreStringsAndComments(out, dict);

  // Final whitespace cleanup
  out = out.replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
  out = out.replace(/\n{3,}/g, '\n\n'); // Collapse multiple blank lines

  return out;
}

/**
 * Replaces strings and comments with placeholders to prevent Regex corruption.
 * * @param {string} src - The original source.
 * @param {Object} dict - Dictionary to store extracted items.
 * @returns {string} Source with placeholders.
 * @private
 */
function _protectStringsAndComments(src, dict) {
  let result = src;
  
  // Protect Multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, match => {
    dict.comments.push(match);
    return `__COMMENT_${dict.comments.length - 1}__`;
  });
  
  // Protect Single-line comments
  result = result.replace(/\/\/.*$/gm, match => {
    dict.comments.push(match);
    return `__COMMENT_${dict.comments.length - 1}__`;
  });

  // Protect Strings (Template literals, double quotes, single quotes)
  result = result.replace(/(`(?:\\`|[^`])*`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')/g, match => {
    dict.strings.push(match);
    return `__STRING_${dict.strings.length - 1}__`;
  });

  return result;
}

/**
 * Restores the protected strings and comments back into the code.
 * * @param {string} src - Source with placeholders.
 * @param {Object} dict - Dictionary containing the original items.
 * @returns {string} Fully restored code.
 * @private
 */
function _restoreStringsAndComments(src, dict) {
  let result = src;
  
  for (let i = 0; i < dict.strings.length; i++) {
    result = result.replace(`__STRING_${i}__`, dict.strings[i]);
  }
  
  for (let i = 0; i < dict.comments.length; i++) {
    result = result.replace(`__COMMENT_${i}__`, dict.comments[i]);
  }
  
  return result;
}

// ─── CLI / Runner execution ──────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log("Usage: node reverse.js <input.js | input_directory> [output_directory]");
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  // Default output directory is a folder named 'ntl_out' next to the input
  const outputPath = args[1] ? path.resolve(args[1]) : path.join(path.dirname(inputPath), 'ntl_out');

  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Input path does not exist: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[INFO] Starting NTL Reverse Compiler...`);
  processDirectory(inputPath, outputPath);
  console.log(`[INFO] Done! Output saved to: ${outputPath}`);
}

module.exports = { reverseCompile, processDirectory };