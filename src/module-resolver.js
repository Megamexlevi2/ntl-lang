'use strict';
const path = require('path');
const NTL_MODULES = {
  http:    './modules/http',
  fs:      './modules/fs',
  crypto:  './modules/crypto',
  logger:  './modules/logger',
  test:    './modules/test',
  ai:      './modules/ai',
  game:    './modules/game',
  web:     './modules/web',
  obf:     './modules/obf',
};
function resolve(moduleName, fromFile) {
  if (moduleName.startsWith('ntl:')) {
    const name = moduleName.slice(4);
    if (NTL_MODULES[name]) {
      const base = path.resolve(__dirname, '..');
      return path.join(base, NTL_MODULES[name] + '.js');
    }
  }
  return null;
}
function generateNTLModuleImports(modules) {
  const base = path.resolve(__dirname, '..').replace(/\\/g, '/');
  return modules.map(m => {
    const modPath = NTL_MODULES[m];
    if (modPath) {
      const abs = path.join(base, modPath);
      return `const ${m} = require(${JSON.stringify(abs)});`;
    }
    return `const ${m} = require(${JSON.stringify('ntl:' + m)});`;
  }).join('\n');
}
module.exports = { resolve, generateNTLModuleImports, NTL_MODULES };
