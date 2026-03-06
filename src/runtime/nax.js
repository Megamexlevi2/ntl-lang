'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CACHE_DIR = path.join(os.homedir(), '.ntl', 'nax_cache');

function ensureCache() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath(name, version) {
  return path.join(CACHE_DIR, `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}${version ? '_' + version : ''}`);
}

function parseGithubUrl(url) {
  const clean = url.replace(/^https?:\/\
  const [repoPath, tag] = clean.split('@');
  const parts = repoPath.split('/');
  if (parts.length < 2) throw new Error(`Invalid nax module URL: ${url}`);
  return { user: parts[0], repo: parts[1], subdir: parts.slice(2).join('/'), tag };
}

async function fetchJson(url) {
  if (typeof fetch !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
  }
  return new Promise((resolve, reject) => {
    const mod = require('https');
    let data = '';
    const req = mod.get(url, { headers: { 'User-Agent': 'ntl-lang/2.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject);
        return;
      }
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
  });
}

async function fetchText(url) {
  if (typeof fetch !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text();
  }
  return new Promise((resolve, reject) => {
    const mod = require('https');
    let data = '';
    const req = mod.get(url, { headers: { 'User-Agent': 'ntl-lang/2.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function naxLoad(url) {
  ensureCache();
  const { user, repo, subdir, tag } = parseGithubUrl(url);
  const cacheName = `${user}_${repo}${tag ? '_' + tag : ''}`;
  const cacheDir = getCachePath(cacheName);

  if (fs.existsSync(path.join(cacheDir, 'module.json'))) {
    return loadFromCache(cacheDir);
  }

  const branch = tag || 'main';
  const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}${subdir ? '/' + subdir : ''}`;

  let meta;
  try {
    meta = await fetchJson(`${rawBase}/module.json`);
  } catch(e) {
    const rawBaseMaster = `https://raw.githubusercontent.com/${user}/${repo}/master${subdir ? '/' + subdir : ''}`;
    meta = await fetchJson(`${rawBaseMaster}/module.json`);
  }

  validateModuleJson(meta);

  if (meta.antiSteal || meta.protected) {
    throw new Error(`Module "${meta.name}" has anti-steal protection enabled. You cannot view or modify this module.`);
  }

  const rawBase2 = `https://raw.githubusercontent.com/${user}/${repo}/${branch}${subdir ? '/' + subdir : ''}`;
  const mainSource = await fetchText(`${rawBase2}/${meta.main}`);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'module.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(cacheDir, 'index.js'), mainSource);

  return loadFromCache(cacheDir);
}

function loadFromCache(cacheDir) {
  const metaPath = path.join(cacheDir, 'module.json');
  const indexPath = path.join(cacheDir, 'index.js');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  if (meta.antiSteal || meta.protected) {
    throw new Error(`Module "${meta.name}" has anti-steal protection enabled.`);
  }

  if (meta.main && meta.main.endsWith('.ntl') && fs.existsSync(indexPath.replace('.js', '.ntl'))) {
    const { Compiler } = require('../compiler');
    const ntlSource = fs.readFileSync(indexPath.replace('.js', '.ntl'), 'utf-8');
    const result = new Compiler().compileSource(ntlSource, meta.main);
    if (!result.success) throw new Error(`Failed to compile nax module ${meta.name}: ${result.errors[0]?.message}`);
    fs.writeFileSync(indexPath, result.code);
  }

  try {
    delete require.cache[indexPath];
    return require(indexPath);
  } catch(e) {
    throw new Error(`Failed to load nax module "${meta.name}": ${e.message}`);
  }
}

function validateModuleJson(meta) {
  const required = ['name', 'main'];
  for (const key of required) {
    if (!meta[key]) throw new Error(`module.json is missing required field: "${key}"`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(meta.name)) {
    throw new Error(`module.json "name" must only contain letters, numbers, - and _`);
  }
}

function naxClear() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('nax cache cleared.');
  }
}

function naxList() {
  const result = [];
  if (!fs.existsSync(CACHE_DIR)) return result;
  const entries = fs.readdirSync(CACHE_DIR);
  for (const e of entries) {
    const metaPath = path.join(CACHE_DIR, e, 'module.json');
    if (fs.existsSync(metaPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        result.push({ name: m.name, version: m.version || 'latest', description: m.description || '', author: m.author || '' });
      } catch {}
    }
  }
  return result;
}

function createModuleJson({ name, description, main, license, author, antiSteal }) {
  const meta = { name: name || 'my-nax-module', version: '1.0.0', description: description || '', main: main || 'index.ntl', license: license || 'MIT', author: author || '' };
  if (antiSteal) meta.antiSteal = true;
  return JSON.stringify(meta, null, 2);
}

module.exports = { naxLoad, naxClear, naxList, createModuleJson, CACHE_DIR };
