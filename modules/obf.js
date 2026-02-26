'use strict';
const crypto = require('crypto');
const vm = require('vm');
const JS_RESERVED = new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','let','new','null','return','static','super','switch','this','throw','try','typeof','undefined','var','void','while','with','yield','async','await','enum','abstract','boolean','byte','char','double','final','float','goto','int','long','native','package','private','protected','public','short','synchronized','throws','transient','volatile','true','false','NaN','Infinity','Array','Object','String','Number','Boolean','Function','Symbol','BigInt','Error','Promise','Map','Set','RegExp','Date','Math','JSON','console','require','module','exports','process','Buffer','global','globalThis','__filename','__dirname','arguments','eval','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','prototype','constructor','toString','valueOf','hasOwnProperty','length','name','call','apply','bind']);
function uid(seed, len) {
  const h = crypto.createHash('sha256').update(String(seed) + Math.random()).digest('hex');
  return '_' + h.slice(0, len || 8);
}
function hexEncode(str) {
  return str.split('').map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
function unicodeEncode(str) {
  return str.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
}
function buildStringArrayDecoder(key) {
  const k = key || uid('decoder', 16);
  return `
var ${k}=function(a,b){a=parseInt(a.replace(/^(0x|0X)/,''),16);b=b.split('');var c=[];for(var d=0;d<a;d++)c.push(String.fromCharCode(b[d].charCodeAt(0)^(a&0xFF)));return c.join('')};
`.trim();
}
function splitString(str) {
  if (str.length < 4) return `"${str}"`;
  const mid = Math.floor(str.length / 2);
  const a = str.slice(0, mid);
  const b = str.slice(mid);
  return `("${hexEncode(a)}"+"${hexEncode(b)}")`;
}
function encodeNumber(n) {
  if (typeof n !== 'number' || isNaN(n) || !isFinite(n) || n < 0) return String(n);
  if (n === 0) return '0x0';
  if (Number.isInteger(n) && n <= 0xFFFFFF) return '0x' + n.toString(16);
  return String(n);
}
class Obfuscator {
  constructor(opts) {
    this.opts = Object.assign({
      level: 'max',
      renameVars: true,
      encodeStrings: true,
      encodeNumbers: true,
      controlFlow: true,
      deadCode: true,
      selfDefend: false,
      domainLock: null,
      debugProtect: false,
      stringArray: true,
      rotateStringArray: true,
      splitStrings: true,
      identifierPrefix: '_',
      seed: Date.now()
    }, opts || {});
    this._map = new Map();
    this._strings = [];
    this._strMap = new Map();
    this._counter = 0;
    this._arrName = uid(this.opts.seed + 'arr', 10);
    this._decName = uid(this.opts.seed + 'dec', 10);
    this._rotName = uid(this.opts.seed + 'rot', 10);
  }
  _newId(hint) {
    const id = this.opts.identifierPrefix + uid((hint || '') + this._counter++, 6);
    return id;
  }
  _addString(str) {
    if (this._strMap.has(str)) return this._strMap.get(str);
    const idx = this._strings.length;
    this._strings.push(str);
    this._strMap.set(str, idx);
    return idx;
  }
  _strRef(idx) {
    if (this.opts.rotateStringArray) {
      return `${this._decName}(${this._arrName},${encodeNumber(idx)})`;
    }
    return `${this._arrName}[${encodeNumber(idx)}]`;
  }
  _buildStringArray() {
    if (!this._strings.length) return '';
    const encoded = this._strings.map(s => {
      const enc = s.split('').map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      return `"${enc}"`;
    });
    const arrDef = `var ${this._arrName}=[${encoded.join(',')}];`;
    const decFn = `var ${this._decName}=function(a,b){return a[b];};`;
    return arrDef + '\n' + decFn;
  }
  _controlFlowFlatten(code) {
    const stmts = code.split('\n').filter(l => l.trim());
    if (stmts.length < 3) return code;
    const order = stmts.map((_, i) => i);
    const key = uid('cfl', 8);
    const switchVar = uid('sw', 6);
    const orderStr = order.map(encodeNumber).join('|');
    const cases = order.map((i, j) => `case ${encodeNumber(j)}:${stmts[i]}\n${switchVar}++;break;`).join('\n');
    return `var ${key}="${hexEncode(orderStr)}".split('|');\nvar ${switchVar}=0;\nwhile(true){switch(${key}[${switchVar}]){\n${cases}\ndefault:break;\n}if(${switchVar}>=${encodeNumber(order.length)})break;}`;
  }
  _injectDeadCode() {
    const junk = [
      `var ${uid('j')}=function(){}();`,
      `if(false){var ${uid('j')}=${uid('j2')};}`,
      `void 0x0;`,
      `var ${uid('j')}=(function(){return;}());`,
      `try{if(${uid('j')}===undefined)throw 0;}catch(e){}`,
    ];
    return junk[Math.floor(Math.random() * junk.length)];
  }
  _selfDefendCode() {
    const fn = uid('sd', 10);
    return `
(function(){var ${fn}=function(){var test=function(){};var res=test.toString().replace(/\\s/g,'');return res.includes('[native code]');};if(!${fn}()){while(true){}}})();
`.trim();
  }
  _debugProtectCode() {
    const fn = uid('dp', 10);
    return `(function(){setInterval(function(){debugger;},${encodeNumber(100)});})();`;
  }
  _domainLockCode(domains) {
    const fn = uid('dl', 10);
    const domsStr = JSON.stringify(domains);
    return `(function(){var ${fn}=${domsStr};if(typeof window!=='undefined'){var ok=${fn}.some(function(d){return location.hostname===d||location.hostname.endsWith('.'+d);});if(!ok){document.body.innerHTML='';throw new Error('Domain not allowed');}}})();`;
  }
  obfuscateJS(code) {
    let result = code;
    const varNames = new Map();
    let idx = 0;
    result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, (match) => {
      if (JS_RESERVED.has(match)) return match;
      if (!this.opts.renameVars) return match;
      if (!varNames.has(match)) varNames.set(match, this._newId(match));
      return varNames.get(match);
    });
    if (this.opts.encodeNumbers) {
      result = result.replace(/\b(\d+)\b/g, (match, n) => {
        const num = parseInt(n);
        if (num === 0) return '0x0';
        return encodeNumber(num);
      });
    }
    const stringArr = [];
    if (this.opts.encodeStrings) {
      result = result.replace(/"((?:[^"\\]|\\.)*)"/g, (match, str) => {
        if (!str) return match;
        const i = this._addString(str);
        return this._strRef(i);
      });
      result = result.replace(/'((?:[^'\\]|\\.)*)'/g, (match, str) => {
        if (!str) return match;
        const i = this._addString(str);
        return this._strRef(i);
      });
    }
    let header = '';
    if (this.opts.stringArray && this._strings.length) header += this._buildStringArray() + '\n';
    if (this.opts.selfDefend) header += this._selfDefendCode() + '\n';
    if (this.opts.debugProtect) header += this._debugProtectCode() + '\n';
    if (this.opts.domainLock) header += this._domainLockCode(Array.isArray(this.opts.domainLock) ? this.opts.domainLock : [this.opts.domainLock]) + '\n';
    if (this.opts.deadCode) {
      for (let i = 0; i < 3; i++) header += this._injectDeadCode() + '\n';
    }
    const wrapped = `(function(){${header}${result}})();`;
    return wrapped;
  }
  obfuscateNTLRuntime(code) {
    const reserved = new Set([...JS_RESERVED]);
    const renames = new Map();
    let counter = 0;
    const genName = () => {
      const chars = 'lIiOo';
      let s = '_';
      let n = counter++;
      do { s += chars[n % chars.length]; n = Math.floor(n / chars.length); } while (n > 0);
      return s + uid('r', 4);
    };
    let out = code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\b/g, (m) => {
      if (reserved.has(m)) return m;
      if (!renames.has(m)) renames.set(m, genName());
      return renames.get(m);
    });
    out = out.replace(/\b(\d+)\b/g, (m, n) => encodeNumber(parseInt(n)));
    out = out.replace(/"([^"]{2,})"/g, (m, s) => `"${hexEncode(s)}"`);
    out = out.replace(/'([^']{2,})'/g, (m, s) => `'${hexEncode(s)}'`);
    for (let i = 0; i < 5; i++) out += '\n' + this._injectDeadCode();
    return `(function(){${out}})();`;
  }
}
function obfuscate(code, opts) {
  return new Obfuscator(opts).obfuscateJS(code);
}
function obfuscateRuntime(code, opts) {
  return new Obfuscator(opts).obfuscateNTLRuntime(code);
}
module.exports = { Obfuscator, obfuscate, obfuscateRuntime };
