'use strict';
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
function findSimilar(name, candidates, maxDist) {
  maxDist = maxDist || 2;
  return candidates.filter(c => c !== name && levenshtein(name.toLowerCase(), c.toLowerCase()) <= maxDist).slice(0, 3);
}
function padStart(str, len, char) {
  char = char || ' ';
  return str.length >= len ? str : char.repeat(len - str.length) + str;
}
function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const copy = {};
  for (const k of Object.keys(obj)) copy[k] = deepClone(obj[k]);
  return copy;
}
function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function isValidIdentifier(name) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}
function randomId(len) {
  len = len || 8;
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '_';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
function flatten(arr) {
  return arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
}
function unique(arr) {
  return [...new Set(arr)];
}
function groupBy(arr, fn) {
  const groups = {};
  for (const item of arr) {
    const key = fn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
module.exports = {
  levenshtein, findSimilar, padStart, formatTime, formatBytes,
  deepClone, escapeString, slugify, capitalize, camelToSnake, snakeToCamel,
  isValidIdentifier, randomId, chunk, flatten, unique, groupBy
};
