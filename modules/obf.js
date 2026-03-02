// Created by David Dev
// GitHub: https://github.com/Megamexlevi2/ntl-lang
// © David Dev 2026. All rights reserved.

'use strict';
const crypto = require('crypto');

const JS_RESERVED = new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','let','new','null','return','static','super','switch','this','throw','try','typeof','undefined','var','void','while','with','yield','async','await','enum','abstract','boolean','byte','char','double','final','float','goto','int','long','native','package','private','protected','public','short','synchronized','throws','transient','volatile','true','false','NaN','Infinity','Array','Object','String','Number','Boolean','Function','Symbol','BigInt','Error','Promise','Map','Set','RegExp','Date','Math','JSON','console','require','module','exports','process','Buffer','global','globalThis','__filename','__dirname','arguments','eval','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','prototype','constructor','toString','valueOf','hasOwnProperty','length','name','call','apply','bind']);

function uid(seed, len) {
  const h = crypto.createHash('sha256').update(String(seed) + Math.random() + process.pid).digest('hex');
  return '_' + h.slice(0, len || 8);
}

function hexEncode(str) {
  return str.split('').map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function unicodeEncode(str) {
  return str.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
}

function rc4(key, data) {
  let s = [], j = 0, x, res = '';
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  let i = 0; j = 0;
  for (let y = 0; y < data.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    res += String.fromCharCode(data.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

function opaquePredicate() {
  const a = Math.PI * 2, b = 6.283185307179586;
  return Math.abs(a - b) < 1e-10;
}

function encodeNumber(n) {
  if (typeof n !== 'number' || isNaN(n) || !isFinite(n) || n < 0) return String(n);
  if (n === 0) return '(Math.PI-Math.PI)';
  if (n === 1) return '(Math.PI/Math.PI)';
  if (n === 2) return '(Math.PI/Math.PI+Math.PI/Math.PI)';
  if (Number.isInteger(n) && n <= 0xFFFFFF) {
    const r1 = Math.floor(Math.random() * 10000) + 1000;
    const r2 = r1 - n;
    return `((${r1})-(${r2}))`;
  }
  return String(n);
}

function chaoticString(str) {
  let parts = [];
  for (let i = 0; i < str.length; i += 3) {
    parts.push(str.slice(i, i+3));
  }
  return parts.map(p => {
    let enc = '';
    for (let j = 0; j < p.length; j++) {
      enc += '\\x' + p.charCodeAt(j).toString(16).padStart(2,'0');
    }
    return '"' + enc + '"';
  }).join('+');
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
      selfDefend: true,
      domainLock: null,
      debugProtect: true,
      stringArray: true,
      rotateStringArray: true,
      splitStrings: true,
      identifierPrefix: '_0x',
      seed: Date.now() + Math.random()
    }, opts || {});
    this._strings = [];
    this._strMap = new Map();
    this._counter = 0;
    this._key = crypto.createHash('sha256').update(String(this.opts.seed) + 'ntl').digest('hex').slice(0, 32);
  }

  _newId(hint) {
    const h = crypto.createHash('sha256').update(String(hint || '') + this._counter++ + this._key).digest('hex');
    return this.opts.identifierPrefix + h.slice(0, 8);
  }

  _addString(str) {
    if (this._strMap.has(str)) return this._strMap.get(str);
    const idx = this._strings.length;
    this._strings.push(str);
    this._strMap.set(str, idx);
    return idx;
  }

  _buildStringArray() {
    if (!this._strings.length) return '';
    const rc4Key = this._key.slice(0, 16);
    const arrName = this._newId('arr');
    const idxMapName = this._newId('map');
    const decodeName = this._newId('dec');
    const encoded = this._strings.map(s => rc4(rc4Key, s));
    const hexEncoded = encoded.map(s => '"' + Array.from(s).map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2,'0')).join('') + '"');
    const idxMap = {};
    const indices = [];
    for (let i = 0; i < encoded.length; i++) {
      const newIdx = Math.floor(Math.random() * 100000) + 10000;
      idxMap[newIdx] = i;
      indices.push(newIdx);
    }
    const idxMapStr = JSON.stringify(idxMap).replace(/"/g, '');
    const order = indices.map(i => '0x' + i.toString(16)).join(',');
    return `
var ${arrName}=[${hexEncoded.join(',')}];
var ${idxMapName}=${idxMapStr};
var ${decodeName}=function(k,i){
    var idx=${idxMapName}[i];
    var str=${arrName}[idx];
    var res='';
    for(var j=0;j<str.length;j++){
        res+=String.fromCharCode(str.charCodeAt(j)^k.charCodeAt(j%k.length));
    }
    return res;
};
`;
  }

  _controlFlowFlatten(code) {
    const stmts = code.split('\n').filter(l => l.trim()).map(l => l.trim() + ';');
    if (stmts.length < 3) return code;
    const order = stmts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const stateMap = {};
    order.forEach((origIdx, newIdx) => { stateMap[origIdx] = newIdx; });
    const key = this._newId('cfl');
    const stateVar = this._newId('st');
    const cases = order.map((origIdx, newIdx) => {
      return `case 0x${newIdx.toString(16)}:{${stmts[origIdx]}}break;`;
    }).join('\n');
    const mapStr = JSON.stringify(stateMap).replace(/"/g, '');
    return `
var ${stateVar}=0;
var ${key}=${mapStr};
while(true){
    switch(${key}[${stateVar}]){
        ${cases}
    }
    ${stateVar}++;
    if(${stateVar}>=${stmts.length})break;
}
`;
  }

  _injectDeadCode() {
    const junk = [
      `var ${this._newId('j')}=function(){return Math.random();};`,
      `if(false){var ${this._newId('j2')}=function(){}();}`,
      `void 0x0;`,
      `var ${this._newId('j3')}=(function(){var a=1;return a;})();`,
      `try{${this._newId('j4')}}catch(e){}`,
    ];
    return junk[Math.floor(Math.random() * junk.length)];
  }

  _selfDefendCode() {
    const fn = this._newId('sd');
    return `
(function(){
    var ${fn}=function(){
        try{return eval.toString().length!==33;}catch(e){return true;}
    };
    if(!${fn}()){while(true){debugger;}}
})();
`;
  }

  _debugProtectCode() {
    const fn = this._newId('dp');
    return `
setInterval(function(){
    if(typeof console !== 'undefined' && console.clear){
        console.clear();
        debugger;
    }
}, 100);
`;
  }

  _domainLockCode(domains) {
    const fn = this._newId('dl');
    const domsStr = JSON.stringify(domains);
    return `
if(typeof window !== 'undefined'){
    var ${fn}=${domsStr};
    var ok=false;
    try{
        var canvas=document.createElement('canvas');
        var ctx=canvas.getContext('2d');
        var txt=canvas.toDataURL();
        ok=${fn}.some(function(d){return location.hostname===d||location.hostname.endsWith('.'+d);});
    }catch(e){}
    if(!ok){document.body.innerHTML='';throw new Error('Invalid domain');}
}
`;
  }

  obfuscateJS(code) {
    let result = code;
    const varNames = new Map();

    // Renomear variáveis
    result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, (match) => {
      if (JS_RESERVED.has(match)) return match;
      if (!this.opts.renameVars) return match;
      if (!varNames.has(match)) varNames.set(match, this._newId(match));
      return varNames.get(match);
    });

    // Ofuscar números
    if (this.opts.encodeNumbers) {
      result = result.replace(/\b(\d+)\b/g, (match, n) => {
        const num = parseInt(n);
        return encodeNumber(num);
      });
    }

    // Coletar strings
    if (this.opts.encodeStrings) {
      result = result.replace(/"((?:[^"\\]|\\.)*)"/g, (match, str) => {
        if (!str) return match;
        const i = this._addString(str);
        const decName = this._newId('sdec');
        return `${decName}(this._key,0x${i.toString(16)})`;
      });
      result = result.replace(/'((?:[^'\\]|\\.)*)'/g, (match, str) => {
        if (!str) return match;
        const i = this._addString(str);
        const decName = this._newId('sdec');
        return `${decName}(this._key,0x${i.toString(16)})`;
      });
    }

    // Aplicar control flow flattening
    if (this.opts.controlFlow) {
      const lines = result.split(';').filter(l => l.trim());
      const blockSize = Math.ceil(lines.length / 5);
      const blocks = [];
      for (let i = 0; i < lines.length; i += blockSize) {
        blocks.push(lines.slice(i, i+blockSize).join(';\n') + ';');
      }
      result = this._controlFlowFlatten(blocks.join('\n'));
    }

    // Montar cabeçalho com proteções
    let header = '';
    if (this.opts.stringArray && this._strings.length) header += this._buildStringArray() + '\n';
    if (this.opts.selfDefend) header += this._selfDefendCode() + '\n';
    if (this.opts.debugProtect) header += this._debugProtectCode() + '\n';
    if (this.opts.domainLock) header += this._domainLockCode(Array.isArray(this.opts.domainLock) ? this.opts.domainLock : [this.opts.domainLock]) + '\n';
    if (this.opts.deadCode) {
      for (let i = 0; i < 5; i++) header += this._injectDeadCode() + '\n';
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
      return s + this._newId('r').slice(-4);
    };
    let out = code.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\b/g, (m) => {
      if (reserved.has(m)) return m;
      if (!renames.has(m)) renames.set(m, genName());
      return renames.get(m);
    });
    out = out.replace(/\b(\d+)\b/g, (m, n) => encodeNumber(parseInt(n)));
    out = out.replace(/"([^"]{2,})"/g, (m, s) => `"${hexEncode(s)}"`);
    out = out.replace(/'([^']{2,})'/g, (m, s) => `'${hexEncode(s)}'`);
    for (let i = 0; i < 8; i++) out += '\n' + this._injectDeadCode();
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