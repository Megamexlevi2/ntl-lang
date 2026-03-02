'use strict';
// NTL Formatter — formats .ntl source code

const { tokenize, TokenType } = require('./lexer');

class Formatter {
  constructor(options) {
    options = options || {};
    this.indent    = options.indent || '  ';
    this.maxWidth  = options.maxWidth || 100;
    this.semi      = options.semi !== false;
    this.quotes    = options.quotes || 'double';
    this.trailingComma = options.trailingComma || false;
  }

  format(source, filename) {
    try {
      const tokens = tokenize(source, filename || 'stdin');
      return this._format(source, tokens);
    } catch (e) {
      // If we can't parse, return original (fail safe)
      return source;
    }
  }

  _format(source, tokens) {
    // Simple line-by-line formatter since we have tokens
    const lines = source.split('\n');
    const result = [];
    let depth = 0;
    let prev = '';
    let inMultilineString = false;
    const q = this.quotes === 'single' ? "'" : '"';

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      // Pass through empty lines (max 2 consecutive)
      if (!line) {
        if (prev !== '') result.push('');
        prev = '';
        continue;
      }

      // Count brace depth
      const opens  = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      const startClose = line.startsWith('}') || line.startsWith(']') || line.startsWith(')');

      if (startClose) depth = Math.max(0, depth - 1);

      // Build indented line
      let formatted = this.indent.repeat(depth) + this._formatLine(line, q);

      result.push(formatted);
      prev = line;

      depth += (opens - closes);
      if (startClose) depth = Math.max(0, depth);
      depth = Math.max(0, depth);
    }

    return result.join('\n').trimEnd() + '\n';
  }

  _formatLine(line, q) {
    let s = line;

    // Normalize spacing around operators
    s = s.replace(/([^=!<>])==([^=])/g, '$1 == $2');
    s = s.replace(/([^=!<>])===([^=])/g, '$1 === $2');
    s = s.replace(/([^!])!=([^=])/g, '$1 != $2');
    s = s.replace(/\s+/g, ' ');

    // Fix spacing after keywords
    s = s.replace(/\b(if|while|for|unless|guard|repeat|match|return|throw|await)\(/g, '$1 (');

    // Normalize comma spacing
    s = s.replace(/,(?!\s)/g, ', ');
    s = s.replace(/\s{2,}/g, ' ');

    // Normalize quote style (careful not to break template strings)
    if (q === '"') {
      // Replace single quotes with double where safe
      s = s.replace(/(?<![\\])'([^'\n]*?)'/g, (m, inner) => {
        if (!inner.includes('"') && !inner.includes('\\')) return `"${inner}"`;
        return m;
      });
    }

    return s;
  }
}

function format(source, options) {
  return new Formatter(options).format(source);
}

module.exports = { Formatter, format };
