'use strict';
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const _fs = require('fs');

function getIndent(line) { let n=0; while(n<line.length&&line[n]===' ')n++; return n; }
function isBlank(line) { return line.trim()===''||line.trim().startsWith('#'); }

function parseScalar(s) {
  s = s.trim();
  if (s === '') return '';
  if (s === 'true'  || s === 'yes' || s === 'on')  return true;
  if (s === 'false' || s === 'no'  || s === 'off') return false;
  if (s === 'null'  || s === '~')                  return null;
  if (s === '.inf'  || s === '+.inf')              return Infinity;
  if (s === '-.inf')                               return -Infinity;
  if (s === '.nan')                                return NaN;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    if (s[0] === '"') {
      return inner
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
        .replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return inner.replace(/''/g, "'");
  }
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
  if (/^0o[0-7]+$/.test(s))       return parseInt(s, 8);
  if (/^0b[01]+$/.test(s))        return parseInt(s, 2);
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s)) { const n = Number(s); if (!isNaN(n)) return n; }
  return s;
}

function splitCSV(s) {
  const parts = []; let depth = 0, cur = '', inStr = false, strCh = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { cur += ch; if (ch === strCh && s[i-1] !== '\\') inStr = false; }
    else if (ch === '"' || ch === "'") { inStr = true; strCh = ch; cur += ch; }
    else if (ch === '{' || ch === '[') { depth++; cur += ch; }
    else if (ch === '}' || ch === ']') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseInlineSeq(s) {
  s = s.trim();
  if (!s.startsWith('[') || !s.endsWith(']')) return s;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return splitCSV(inner).map(x => {
    const t = x.trim();
    return t.startsWith('[') ? parseInlineSeq(t) : t.startsWith('{') ? parseInlineMap(t) : parseScalar(t);
  });
}

function parseInlineMap(s) {
  s = s.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return s;
  const inner = s.slice(1, -1).trim();
  if (!inner) return {};
  const r = {};
  for (const pair of splitCSV(inner)) {
    const ci = pair.indexOf(':');
    if (ci === -1) continue;
    r[pair.slice(0, ci).trim()] = parseScalar(pair.slice(ci + 1).trim());
  }
  return r;
}

class YAMLParser {
  constructor(text) {
    this.lines   = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    this.pos     = 0;
    this.anchors = {};
  }

  done()       { return this.pos >= this.lines.length; }
  skipBlanks() { while (!this.done() && isBlank(this.lines[this.pos])) this.pos++; }
  curIndent()  { this.skipBlanks(); return this.done() ? -1 : getIndent(this.lines[this.pos]); }

  parse() {
    this.skipBlanks();
    if (this.done()) return {};
    const t = this.lines[this.pos].trim();
    if (t === '---') { this.pos++; }
    this.skipBlanks();
    if (this.done()) return {};
    const line = this.lines[this.pos];
    const indent = getIndent(line);
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed === '-') return this.parseSeq(indent);
    if (trimmed.includes(': ') || trimmed.endsWith(':')) return this.parseMap(indent);
    this.pos++;
    return parseScalar(trimmed);
  }

  parseMap(baseIndent) {
    const result = {};
    while (!this.done()) {
      this.skipBlanks();
      if (this.done()) break;
      const line = this.lines[this.pos];
      const indent = getIndent(line);
      const t = line.trim();
      if (indent < baseIndent) break;
      if (t === '---' || t === '...') break;
      if (t.startsWith('- ') || t === '-') break;

      if (t.startsWith('<<:')) {
        this.pos++;
        const rest = t.slice(3).trim();
        const al = rest.match(/^\*(\S+)/);
        if (al && this.anchors[al[1]] && typeof this.anchors[al[1]] === 'object' && !Array.isArray(this.anchors[al[1]])) {
          Object.assign(result, this.anchors[al[1]]);
        }
        continue;
      }

      let anchor = null, work = t;
      const am = work.match(/^&(\S+)\s*/);
      if (am) { anchor = am[1]; work = work.slice(am[0].length); }

      const aliasM = work.match(/^\*(\S+)$/);
      if (aliasM) {
        this.pos++;
        const v = this.anchors[aliasM[1]];
        if (anchor) this.anchors[anchor] = v;
        if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(result, v);
        continue;
      }

      const ci = work.indexOf(':');
      if (ci === -1) { this.pos++; continue; }
      const key  = work.slice(0, ci).trim();
      const rawV = work.slice(ci + 1);
      this.pos++;

      let value;
      const rv = rawV.trim();
      if (rv === '|' || rv === '|-' || rv === '|+')   value = this.parseBlockLiteral(indent + 2, rv);
      else if (rv === '>' || rv === '>-' || rv === '>+') value = this.parseFolded(indent + 2, rv);
      else if (rv === '') {
        this.skipBlanks();
        if (this.done() || getIndent(this.lines[this.pos]) <= indent) {
          value = null;
        } else {
          const ni = getIndent(this.lines[this.pos]);
          const nt = this.lines[this.pos].trim();
          value = (nt.startsWith('- ') || nt === '-') ? this.parseSeq(ni) : this.parseMap(ni);
        }
      } else {
        const rs = rawV.startsWith(' ') ? rawV.slice(1) : rawV;
        const aliasR = rs.trim().match(/^\*(\S+)$/);
        if (aliasR)               value = this.anchors[aliasR[1]] ?? null;
        else if (rs.trim().startsWith('[')) value = parseInlineSeq(rs.trim());
        else if (rs.trim().startsWith('{')) value = parseInlineMap(rs.trim());
        else                      value = parseScalar(rs.trim());
      }

      if (anchor) this.anchors[anchor] = value;
      result[key] = value;
    }
    return result;
  }

  parseSeq(baseIndent) {
    const result = [];
    while (!this.done()) {
      this.skipBlanks();
      if (this.done()) break;
      const line = this.lines[this.pos];
      const indent = getIndent(line);
      const t = line.trim();
      if (indent < baseIndent) break;
      if (t === '---' || t === '...') break;
      if (!t.startsWith('- ') && t !== '-') break;
      this.pos++;
      const content = t === '-' ? '' : t.slice(2).trim();
      let item;
      if (!content) {
        this.skipBlanks();
        if (this.done() || getIndent(this.lines[this.pos]) <= baseIndent) { item = null; }
        else {
          const ni = getIndent(this.lines[this.pos]);
          const nt = this.lines[this.pos].trim();
          item = (nt.startsWith('- ') || nt === '-') ? this.parseSeq(ni) : this.parseMap(ni);
        }
      } else if (content.startsWith('[')) item = parseInlineSeq(content);
      else if (content.startsWith('{')) item = parseInlineMap(content);
      else if (content.includes(': ') || content.endsWith(':')) {
        const ci = content.indexOf(':');
        const k  = content.slice(0, ci).trim();
        const rv = content.slice(ci + 1).trim();
        const obj = {};
        obj[k] = rv ? parseScalar(rv) : null;
        this.skipBlanks();
        if (!this.done() && getIndent(this.lines[this.pos]) > baseIndent) {
          Object.assign(obj, this.parseMap(getIndent(this.lines[this.pos])));
        }
        item = obj;
      } else {
        const al = content.match(/^\*(\S+)$/);
        item = al ? this.anchors[al[1]] ?? null : parseScalar(content);
      }
      result.push(item);
    }
    return result;
  }

  parseBlockLiteral(contentIndent, mode) {
    const lines = []; let firstIndent = -1;
    while (!this.done()) {
      const line = this.lines[this.pos];
      const t    = line.trim();
      if (t === '' && lines.length === 0) { this.pos++; continue; }
      const ind  = getIndent(line);
      if (firstIndent === -1 && t !== '') firstIndent = ind;
      if (firstIndent !== -1 && ind < firstIndent && t !== '') break;
      lines.push(line.slice(firstIndent !== -1 ? firstIndent : 0));
      this.pos++;
    }
    let text = lines.join('\n');
    if (mode === '|-') text = text.trimEnd();
    else if (mode !== '|+') text = text.replace(/\n+$/, '\n');
    return text;
  }

  parseFolded(contentIndent, mode) {
    const raw = this.parseBlockLiteral(contentIndent, '|').split('\n');
    const out = []; let i = 0;
    while (i < raw.length) {
      if (raw[i] === '') { out.push(''); i++; }
      else { let block = raw[i]; i++; while (i < raw.length && raw[i] !== '' && !raw[i].startsWith(' ')) { block += ' ' + raw[i]; i++; } out.push(block); }
    }
    let text = out.join('\n');
    if (mode === '>-') text = text.trimEnd();
    else if (mode !== '>+') text = text.replace(/\n+$/, '\n');
    return text;
  }
}

function parse(text) {
  if (typeof text !== 'string') throw new TypeError('yaml.parse expects a string');
  return new YAMLParser(text).parse();
}

function parseAll(text) {
  if (typeof text !== 'string') throw new TypeError('yaml.parseAll expects a string');
  return text.replace(/\r\n/g, '\n').split(/^---\s*$/m).filter(p => p.trim()).map(p => new YAMLParser(p).parse());
}

function stringify(obj, indent, level) {
  indent = indent || 2; level = level || 0;
  const pad  = ' '.repeat(indent * level);
  const pad1 = ' '.repeat(indent * (level + 1));
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return !isFinite(obj) ? (obj > 0 ? '.inf' : obj < 0 ? '-.inf' : '.nan') : String(obj);
  if (typeof obj === 'string') {
    if (obj === '') return "''";
    if (obj.includes('\n')) return '|\n' + obj.split('\n').map(l => pad1 + l).join('\n');
    const needsQ = /[:#\[\]{}&*!|>'"@`]/.test(obj) || ['true','false','null','yes','no','on','off'].includes(obj) || /^\s|\s$/.test(obj);
    return needsQ ? '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"' : obj;
  }
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    return obj.map(x => {
      if (x !== null && typeof x === 'object') {
        const inner = stringify(x, indent, level + 1);
        return pad + '- ' + inner.trimStart();
      }
      return pad + '- ' + stringify(x, indent, level);
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const ents = Object.entries(obj);
    if (!ents.length) return '{}';
    return ents.map(([k, v]) => {
      const ks = /[:#\[\]{}&*\s]/.test(k) ? '"' + k + '"' : k;
      if (v === null || v === undefined) return pad + ks + ': null';
      if (Array.isArray(v))   return v.length ? pad + ks + ':\n' + stringify(v, indent, level + 1) : pad + ks + ': []';
      if (typeof v === 'object') return pad + ks + ':\n' + stringify(v, indent, level + 1);
      return pad + ks + ': ' + stringify(v, indent, level);
    }).join('\n');
  }
  return String(obj);
}

function loadFile(p)    { return parse(_fs.readFileSync(p, 'utf-8')); }
function loadFileAll(p) { return parseAll(_fs.readFileSync(p, 'utf-8')); }

module.exports = { parse, parseAll, stringify, loadFile, loadFileAll, YAMLParser };
