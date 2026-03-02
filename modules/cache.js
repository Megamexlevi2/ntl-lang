'use strict';
// ntl:cache — Production in-memory cache with TTL, LRU eviction

class CacheEntry {
  constructor(value, ttl) {
    this.value = value;
    this.expiresAt = ttl ? Date.now() + ttl : null;
    this.accessedAt = Date.now();
    this.hits = 0;
  }
  isExpired() { return this.expiresAt !== null && Date.now() > this.expiresAt; }
}

class Cache {
  constructor(options) {
    options = options || {};
    this._store = new Map();
    this._maxSize = options.maxSize || 1000;
    this._defaultTTL = options.ttl || null;
    this._stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
    this._onEvict = options.onEvict || null;
    // Auto-cleanup expired entries every minute
    if (options.cleanupInterval !== false) {
      this._cleanup = setInterval(() => this._purgeExpired(), options.cleanupInterval || 60000);
      if (this._cleanup.unref) this._cleanup.unref();
    }
  }

  set(key, value, ttl) {
    const effectiveTTL = ttl !== undefined ? ttl : this._defaultTTL;
    // Evict oldest if at max size
    if (this._store.size >= this._maxSize && !this._store.has(key)) {
      this._evictLRU();
    }
    this._store.set(key, new CacheEntry(value, effectiveTTL));
    this._stats.sets++;
    return this;
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry || entry.isExpired()) {
      if (entry) this._store.delete(key);
      this._stats.misses++;
      return null;
    }
    entry.accessedAt = Date.now();
    entry.hits++;
    this._stats.hits++;
    return entry.value;
  }

  has(key) {
    const entry = this._store.get(key);
    if (!entry || entry.isExpired()) {
      if (entry) this._store.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    const had = this._store.has(key);
    this._store.delete(key);
    if (had) this._stats.deletes++;
    return had;
  }

  clear() { this._store.clear(); return this; }

  async getOrSet(key, fn, ttl) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }

  getMany(keys) {
    const result = {};
    for (const k of keys) result[k] = this.get(k);
    return result;
  }

  setMany(entries, ttl) {
    for (const [k, v] of Object.entries(entries)) this.set(k, v, ttl);
    return this;
  }

  deleteMany(keys) {
    for (const k of keys) this.delete(k);
    return this;
  }

  deletePattern(pattern) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    let count = 0;
    for (const key of this._store.keys()) {
      if (re.test(key)) { this._store.delete(key); count++; }
    }
    return count;
  }

  keys()   { return [...this._store.keys()].filter(k => !this._store.get(k).isExpired()); }
  size()   { return this.keys().length; }
  stats()  { return Object.assign({}, this._stats, { size: this.size() }); }

  ttl(key) {
    const entry = this._store.get(key);
    if (!entry || entry.isExpired()) return -1;
    if (!entry.expiresAt) return Infinity;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  _evictLRU() {
    let oldest = null, oldestKey = null;
    for (const [key, entry] of this._store) {
      if (!oldest || entry.accessedAt < oldest.accessedAt) {
        oldest = entry; oldestKey = key;
      }
    }
    if (oldestKey) {
      if (this._onEvict) this._onEvict(oldestKey, oldest.value);
      this._store.delete(oldestKey);
      this._stats.evictions++;
    }
  }

  _purgeExpired() {
    for (const [key, entry] of this._store) {
      if (entry.isExpired()) this._store.delete(key);
    }
  }

  destroy() {
    if (this._cleanup) clearInterval(this._cleanup);
    this._store.clear();
  }

  // Wrap a function with caching
  wrap(fn, keyFn, ttl) {
    const self = this;
    return async function(...args) {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      return self.getOrSet(key, () => fn(...args), ttl);
    };
  }
}

// ── Namespace cache (partitioned) ────────────────────────────────────────────

class NamespacedCache {
  constructor(cache, namespace) {
    this._cache = cache;
    this._ns = namespace + ':';
  }
  set(key, value, ttl)   { return this._cache.set(this._ns + key, value, ttl); }
  get(key)               { return this._cache.get(this._ns + key); }
  has(key)               { return this._cache.has(this._ns + key); }
  delete(key)            { return this._cache.delete(this._ns + key); }
  getOrSet(key, fn, ttl) { return this._cache.getOrSet(this._ns + key, fn, ttl); }
  clear()                { return this._cache.deletePattern(new RegExp(`^${this._ns.replace(':','\\:')}`)); }
  wrap(fn, keyFn, ttl)   { return this._cache.wrap(fn, (...a) => this._ns + (keyFn ? keyFn(...a) : JSON.stringify(a)), ttl); }
}

const _global = new Cache({ maxSize: 5000, ttl: null });
function ns(namespace) { return new NamespacedCache(_global, namespace); }

module.exports = { Cache, NamespacedCache, ns, cache: _global };
