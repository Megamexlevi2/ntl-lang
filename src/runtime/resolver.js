'use strict';
const path = require('path');

const NTL_DIR = path.resolve(__dirname, '..', '..');

const NTL_MODULES = {
  http:       'modules/http',
  fs:         'modules/fs',
  crypto:     'modules/crypto',
  logger:     'modules/logger',
  test:       'modules/test',
  ai:         'modules/ai',
  game:       'modules/game',
  web:        'modules/web',
  obf:        'modules/obf',
  android:    'modules/android',
  db:         'modules/db',
  env:        'modules/env',
  cache:      'modules/cache',
  ws:         'modules/ws',
  events:     'modules/events',
  validate:   'modules/validate',
  queue:      'modules/queue',
  mail:       'modules/mail',
  utils:      'modules/utils',
  gameengine: 'modules/game',
};

const NTL_ALIASES = Object.fromEntries(
  Object.keys(NTL_MODULES).flatMap(k => [
    ['ntl:' + k, k],
    ['ntl-lang/' + k, k],
    ['@ntl-team/ntl-lang/' + k, k],
  ])
);

function resolveModuleName(source) {
  if (NTL_ALIASES[source]) return NTL_ALIASES[source];
  if (source && source.startsWith('ntl:')) return source.slice(4);
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
    const { loadStdlibModule } = require('./loader');
    return loadStdlibModule(name);
  } catch (_) {
    const p = resolveToPath(source);
    return p ? require(p) : null;
  }
}

const PREAMBLE = '';
const NAX_RUNTIME_PATH = path.join(__dirname, 'nax.js');

module.exports = {
  resolveModuleName, resolveToPath, loadModule,
  PREAMBLE, NTL_MODULES, NTL_ALIASES, NTL_DIR, NAX_RUNTIME_PATH,
};
