'use strict';

// ntl:cache — in-memory LRU cache with TTL, namespaces, and statistics
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

class CacheEntry {
  constructor(key, value, ttl) {
    this.key       = key;
    this.value     = value;
    this.ttl       = ttl || 0;
    this.expires   = ttl ? Date.now() + ttl : 0;
    this.hits      = 0;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.prev      = null;
    this.next      = null;
  }
  isExpired() { return this.expires > 0 && Date.now() > this.expires; }
  touch()     { this.hits++; return this; }
  refresh(ttl) {
    this.expires   = ttl ? Date.now() + ttl : this.expires;
    this.updatedAt = Date.now();
    return this;
  }
}

class Cache {
  constructor(opts) {
    opts           = opts || {};
    this._max      = opts.maxSize    || opts.max    || 1000;
    this._ttl      = opts.ttl        || 0;
    this._map      = new Map();
    this._head     = null;
    this._tail     = null;
    this._hits     = 0;
    this._misses   = 0;
    this._evictions = 0;
    this._onEvict  = opts.onEvict   || null;
    this._onExpire = opts.onExpire  || null;

    if (opts.checkInterval !== false) {
      const interval = opts.checkInterval || 60000;
      this._timer = setInterval(() => this._evictExpired(), interval);
      if (this._timer.unref) this._timer.unref();
    }
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry)         { this._misses++; return undefined; }
    if (entry.isExpired()) {
      this._delete(entry);
      this._misses++;
      if (this._onExpire) this._onExpire(key, entry.value);
      return undefined;
    }
    this._hits++;
    entry.touch();
    this._moveToFront(entry);
    return entry.value;
  }

  set(key, value, ttl) {
    const existingEntry = this._map.get(key);
    if (existingEntry) {
      existingEntry.value   = value;
      existingEntry.ttl     = ttl !== undefined ? ttl : this._ttl;
      existingEntry.expires = existingEntry.ttl ? Date.now() + existingEntry.ttl : 0;
      existingEntry.updatedAt = Date.now();
      this._moveToFront(existingEntry);
      return this;
    }
    const entry = new CacheEntry(key, value, ttl !== undefined ? ttl : this._ttl);
    this._map.set(key, entry);
    this._addToFront(entry);
    if (this._map.size > this._max) this._evictLRU();
    return this;
  }

  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (entry.isExpired()) { this._delete(entry); return false; }
    return true;
  }

  delete(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    this._delete(entry);
    return true;
  }

  clear() {
    this._map.clear();
    this._head = null;
    this._tail = null;
  }

  get size() { return this._map.size; }

  keys()   { return [...this._map.keys()]; }
  values() { return [...this._map.values()].map(e => e.value); }
  entries(){ return [...this._map.entries()].map(([k, e]) => [k, e.value]); }

  getEntry(key) { return this._map.get(key); }

  mget(keys) { return keys.map(k => this.get(k)); }

  mset(entries, ttl) {
    for (const [k, v] of entries) this.set(k, v, ttl);
    return this;
  }

  getOrSet(key, fn, ttl) {
    const v = this.get(key);
    if (v !== undefined) return v;
    const result = fn(key);
    if (result && typeof result.then === 'function') {
      return result.then(val => { this.set(key, val, ttl); return val; });
    }
    this.set(key, result, ttl);
    return result;
  }

  ttl(key) {
    const entry = this._map.get(key);
    if (!entry || entry.isExpired()) return -2;
    if (!entry.expires) return -1;
    return Math.max(0, entry.expires - Date.now());
  }

  expire(key, ttl) {
    const entry = this._map.get(key);
    if (!entry) return false;
    entry.refresh(ttl);
    return true;
  }

  rename(oldKey, newKey) {
    const entry = this._map.get(oldKey);
    if (!entry) return false;
    this._map.delete(oldKey);
    entry.key = newKey;
    this._map.set(newKey, entry);
    return true;
  }

  namespace(prefix) {
    const sep = ':';
    return {
      get:    (k)       => this.get(prefix + sep + k),
      set:    (k, v, t) => this.set(prefix + sep + k, v, t),
      has:    (k)       => this.has(prefix + sep + k),
      delete: (k)       => this.delete(prefix + sep + k),
      clear:  ()        => { for (const k of this._map.keys()) if (k.startsWith(prefix + sep)) this.delete(k.slice(prefix.length + 1)); },
      keys:   ()        => this.keys().filter(k => k.startsWith(prefix + sep)).map(k => k.slice(prefix.length + 1)),
      getOrSet: (k, fn, t) => this.getOrSet(prefix + sep + k, fn, t),
    };
  }

  wrap(fn, keyFn, ttl) {
    return async (...args) => {
      const key    = keyFn ? keyFn(...args) : JSON.stringify(args);
      const cached = this.get(key);
      if (cached !== undefined) return cached;
      const result = await fn(...args);
      this.set(key, result, ttl);
      return result;
    };
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      size:      this._map.size,
      maxSize:   this._max,
      hits:      this._hits,
      misses:    this._misses,
      hitRate:   total ? (this._hits / total).toFixed(3) : '0.000',
      evictions: this._evictions,
    };
  }

  _addToFront(entry) {
    entry.next = this._head;
    entry.prev = null;
    if (this._head) this._head.prev = entry;
    this._head = entry;
    if (!this._tail) this._tail = entry;
  }

  _moveToFront(entry) {
    if (entry === this._head) return;
    this._removeFromList(entry);
    this._addToFront(entry);
  }

  _removeFromList(entry) {
    if (entry.prev) entry.prev.next = entry.next;
    if (entry.next) entry.next.prev = entry.prev;
    if (entry === this._head) this._head = entry.next;
    if (entry === this._tail) this._tail = entry.prev;
    entry.prev = entry.next = null;
  }

  _delete(entry) {
    this._removeFromList(entry);
    this._map.delete(entry.key);
    if (this._onEvict) this._onEvict(entry.key, entry.value);
  }

  _evictLRU() {
    if (!this._tail) return;
    const evicted = this._tail;
    this._delete(evicted);
    this._evictions++;
  }

  _evictExpired() {
    const now = Date.now();
    for (const entry of this._map.values()) {
      if (entry.expires > 0 && now > entry.expires) {
        this._delete(entry);
        if (this._onExpire) this._onExpire(entry.key, entry.value);
      }
    }
  }

  destroy() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.clear();
  }
}

module.exports = { Cache };
