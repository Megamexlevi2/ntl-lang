'use strict';

// src/config/loader.js — loads YAML config files for the compiler pipeline
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

const path = require('path');
const yaml = require('../yaml');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

const _cache = {};

function load(name) {
  if (_cache[name]) return _cache[name];
  const p = path.join(CONFIG_DIR, name.endsWith('.yaml') ? name : name + '.yaml');
  try {
    const data = yaml.loadFile(p);
    _cache[name] = data;
    return data;
  } catch (e) {
    throw new Error(`Failed to load config '${name}': ${e.message}`);
  }
}

function clearCache() { Object.keys(_cache).forEach(k => delete _cache[k]); }

function getKeywords() {
  const cfg = load('keywords');
  const all = [];
  for (const group of Object.values(cfg)) {
    if (Array.isArray(group)) all.push(...group);
  }
  return all;
}

function getKeywordSet() { return new Set(getKeywords()); }

function getOperators() {
  const cfg = load('operators');
  return {
    multi: cfg.multi_char || [],
    single: cfg.single_char || [],
    punctuation: cfg.punctuation || [],
  };
}

function getErrorMessages() { return load('error-messages'); }
function getCompilerDefaults() { return load('compiler'); }
function getLintRules() { return load('lint'); }
function getTargets() { return load('targets'); }
function getStdlib() { return load('stdlib'); }
function getModuleMap() { return load('modules'); }
function getNaxConfig() { return load('nax'); }
function getTokenTypes() { return load('tokens'); }

module.exports = {
  load,
  clearCache,
  getKeywords,
  getKeywordSet,
  getOperators,
  getErrorMessages,
  getCompilerDefaults,
  getLintRules,
  getTargets,
  getStdlib,
  getModuleMap,
  getNaxConfig,
  getTokenTypes,
  CONFIG_DIR,
};
