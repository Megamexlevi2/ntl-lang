'use strict';

// ntl:events — event emitter with typed events, wildcard, history replay
// Created by David Dev — https://github.com/Megamexlevi2/ntl-lang

class EventEmitter {
  constructor(opts) {
    opts              = opts || {};
    this._listeners   = new Map();
    this._onceMap     = new WeakSet();
    this._maxListeners = opts.maxListeners || 100;
    this._history     = opts.history ? [] : null;
    this._historyMax  = opts.historyMax || 100;
    this._wildcard    = opts.wildcard !== false;
    this._delimiter   = opts.delimiter || ':';
  }

  on(event, fn, opts) {
    if (typeof fn !== 'function') throw new TypeError('Listener must be a function');
    const listeners = this._listeners.get(event) || [];
    if (listeners.length >= this._maxListeners) {
      process.stderr.write(`[ntl:events] Warning: possible memory leak — ${event} has ${listeners.length + 1} listeners\n`);
    }
    if (opts && opts.once) this._onceMap.add(fn);
    if (opts && opts.prepend) listeners.unshift(fn);
    else listeners.push(fn);
    this._listeners.set(event, listeners);
    return this;
  }

  once(event, fn)   { return this.on(event, fn, { once: true }); }
  prependListener(event, fn) { return this.on(event, fn, { prepend: true }); }
  prependOnceListener(event, fn) { return this.on(event, fn, { prepend: true, once: true }); }

  off(event, fn) {
    if (!fn) { this._listeners.delete(event); return this; }
    const list = this._listeners.get(event);
    if (!list) return this;
    const idx = list.lastIndexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
    if (!list.length) this._listeners.delete(event);
    return this;
  }

  removeAllListeners(event) {
    if (event) this._listeners.delete(event);
    else       this._listeners.clear();
    return this;
  }

  emit(event, ...args) {
    if (this._history) {
      this._history.push({ event, args, ts: Date.now() });
      if (this._history.length > this._historyMax) this._history.shift();
    }

    const list   = this._listeners.get(event) || [];
    const remove = [];

    for (const fn of [...list]) {
      try { fn(...args); }
      catch (e) { process.nextTick(() => { throw e; }); }
      if (this._onceMap.has(fn)) remove.push(fn);
    }

    for (const fn of remove) { this.off(event, fn); this._onceMap.delete(fn); }

    if (this._wildcard && event.includes(this._delimiter)) {
      const parts = event.split(this._delimiter);
      const wildcards = this._getWildcardListeners(parts);
      for (const [fn, pattern] of wildcards) {
        try { fn(event, ...args); }
        catch (e) { process.nextTick(() => { throw e; }); }
        if (this._onceMap.has(fn)) { this.off(pattern, fn); this._onceMap.delete(fn); }
      }
    }

    return list.length > 0;
  }

  emitAsync(event, ...args) {
    const list    = this._listeners.get(event) || [];
    const results = list.map(fn => {
      try { return Promise.resolve(fn(...args)); }
      catch(e) { return Promise.reject(e); }
    });
    return Promise.allSettled(results);
  }

  emitError(err) { return this.emit('error', err); }

  waitFor(event, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      let timer;
      const handler = (...args) => {
        if (timer) clearTimeout(timer);
        resolve(args.length <= 1 ? args[0] : args);
      };
      if (opts.timeout) {
        timer = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, opts.timeout);
      }
      this.once(event, handler);
    });
  }

  replayHistory(listener) {
    if (!this._history) return;
    for (const { event, args } of this._history) {
      listener(event, ...args);
    }
  }

  clearHistory() { if (this._history) this._history.length = 0; }

  listenerCount(event) { return (this._listeners.get(event) || []).length; }
  listeners(event)     { return [...(this._listeners.get(event) || [])]; }
  eventNames()         { return [...this._listeners.keys()]; }

  setMaxListeners(n) { this._maxListeners = n; return this; }

  pipe(target) {
    for (const [event, list] of this._listeners.entries()) {
      list.forEach(fn => target.on(event, fn));
    }
    return this;
  }

  _getWildcardListeners(parts) {
    const result = [];
    for (const [pattern, list] of this._listeners.entries()) {
      if (!pattern.includes('*')) continue;
      const patParts = pattern.split(this._delimiter);
      if (this._matchWildcard(parts, patParts)) {
        list.forEach(fn => result.push([fn, pattern]));
      }
    }
    return result;
  }

  _matchWildcard(parts, pattern) {
    if (pattern[pattern.length - 1] === '**') {
      return parts.slice(0, pattern.length - 1).every((p, i) => pattern[i] === '*' || pattern[i] === p);
    }
    if (parts.length !== pattern.length) return false;
    return parts.every((p, i) => pattern[i] === '*' || pattern[i] === p);
  }
}

class TypedEmitter extends EventEmitter {
  constructor(schema, opts) {
    super(opts);
    this._schema = schema || {};
  }

  emit(event, ...args) {
    if (this._schema[event]) {
      const validator = this._schema[event];
      if (typeof validator === 'function') {
        const ok = validator(...args);
        if (ok === false) throw new TypeError(`Invalid payload for event: ${event}`);
      }
    }
    return super.emit(event, ...args);
  }
}

function createEmitter(opts) { return new EventEmitter(opts); }

module.exports = { EventEmitter, TypedEmitter, createEmitter };
