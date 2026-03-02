'use strict';
const path = require('path');

const NTL_DIR = path.resolve(__dirname, '..');

const NTL_MODULES = {
  http:     'modules/http',
  fs:       'modules/fs',
  crypto:   'modules/crypto',
  logger:   'modules/logger',
  test:     'modules/test',
  ai:       'modules/ai',
  game:     'modules/game',
  web:      'modules/web',
  obf:      'modules/obf',
  android:  'modules/android',
  db:       'modules/db',
  env:      'modules/env',
  cache:    'modules/cache',
  ws:       'modules/ws',
  events:   'modules/events',
  validate: 'modules/validate',
  queue:    'modules/queue',
  mail:     'modules/mail',
  utils:    'modules/utils',
  queue:    'modules/queue',
  validate: 'modules/validate',
  mail:     'modules/mail',
  utils:    'modules/utils',
};

function _aliases(mods) {
  const out = {};
  for (const [k, v] of Object.entries(mods)) {
    out['ntl:' + k] = k;
    out['ntl-lang/' + k] = k;
    out['@david0dev/ntl-lang/' + k] = k;
  }
  return out;
}

const NTL_ALIASES = _aliases(NTL_MODULES);

function resolveModuleName(source) {
  if (NTL_ALIASES[source]) return NTL_ALIASES[source];
  if (source.startsWith('ntl:')) return source.slice(4);
  return null;
}

function resolveToPath(source) {
  const name = resolveModuleName(source);
  if (!name) return null;
  if (NTL_MODULES[name]) return path.join(NTL_DIR, NTL_MODULES[name] + '.js');
  return null;
}

function loadModule(source) {
  const name = resolveModuleName(source);
  if (!name) return null;
  try {
    const { loadStdlibModule } = require('./stdlib-loader');
    return loadStdlibModule(name);
  } catch (_) {
    const p = resolveToPath(source);
    return p ? require(p) : null;
  }
}

function makePreamble(ntlDir) {
  const escaped = JSON.stringify(ntlDir || NTL_DIR);
  const lines = [
    '/* ntl-lang runtime - github.com/Megamexlevi2/ntl-lang */',
    'var __ntlDir=(function(){',
    "  var _p=require('path');",
    "  try{return _p.dirname(require.resolve('ntl-lang/package.json'));}catch(_){}",
    '  try{',
    "    var _r=require('fs').realpathSync(process.argv[1]||'');",
    "    var _m=_r.match(/^(.*?node_modules[\\/\\\\]ntl-lang)/);",
    '    if(_m)return _m[1];',
    '  }catch(_){}',
    '  return ' + escaped + ';',
    '})();',
    "var __ntlSelfHosted=new Set([" + "'cache','events','logger','validate','env','queue'" + "]);" ,
    "var __ntlRequire=function(m){",
    "  var _base=m.replace(/\\.js$/,'').split('/').pop();",
    "  if(__ntlSelfHosted.has(_base)){",
    "    var _loaded=require(require('path').join(__ntlDir,'src','stdlib-loader.js')).loadStdlibModule(_base);",
    "    return _loaded;",
    "  }",
    "  return require(require('path').join(__ntlDir,m));",
    "};",
  ];
  return lines.join('\n');
}

const PREAMBLE = makePreamble(NTL_DIR);

function generateNTLModuleImports(modules) {
  return modules.map(m => {
    const relPath = NTL_MODULES[m];
    if (relPath) return "const " + m + " = __ntlRequire('" + relPath + ".js');";
    return "const " + m + " = require('ntl:' + " + JSON.stringify(m) + ");";
  }).join('\n');
}

const NAX_RUNTIME_PATH = path.join(__dirname, 'nax-modules.js');

module.exports = {
  resolveModuleName, resolveToPath, loadModule, generateNTLModuleImports,
  makePreamble, PREAMBLE, NTL_MODULES, NTL_ALIASES, NTL_DIR, NAX_RUNTIME_PATH,
};
