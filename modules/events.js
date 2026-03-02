'use strict';
// ntl:events — Production event emitter / pub-sub

class EventEmitter {
  constructor(options) {
    options = options || {};
    this._events = new Map();
    this._maxListeners = options.maxListeners || 100;
    this._onError = null;
  }

  on(event, listener, options) {
    options = options || {};
    if (!this._events.has(event)) this._events.set(event, []);
    const listeners = this._events.get(event);
    if (listeners.length >= this._maxListeners) {
      console.warn(`[ntl:events] MaxListeners (${this._maxListeners}) exceeded for event "${event}"`);
    }
    listeners.push({ fn: listener, once: options.once || false, priority: options.priority || 0 });
    // Sort by priority descending
    listeners.sort((a, b) => b.priority - a.priority);
    return this;
  }

  once(event, listener) { return this.on(event, listener, { once: true }); }
  prependListener(event, listener) { return this.on(event, listener, { priority: 1 }); }

  off(event, listener) {
    if (!this._events.has(event)) return this;
    if (!listener) { this._events.delete(event); return this; }
    const listeners = this._events.get(event);
    const idx = listeners.findIndex(l => l.fn === listener);
    if (idx >= 0) listeners.splice(idx, 1);
    if (listeners.length === 0) this._events.delete(event);
    return this;
  }

  removeAllListeners(event) {
    if (event) this._events.delete(event);
    else this._events.clear();
    return this;
  }

  emit(event, ...args) {
    if (!this._events.has(event)) {
      if (event === 'error' && args[0] instanceof Error) throw args[0];
      return false;
    }
    const listeners = [...this._events.get(event)];
    const toRemove = [];
    for (const l of listeners) {
      try {
        l.fn(...args);
        if (l.once) toRemove.push(l.fn);
      } catch (err) {
        if (this._onError) this._onError(err, event);
        else throw err;
      }
    }
    for (const fn of toRemove) this.off(event, fn);
    return true;
  }

  async emitAsync(event, ...args) {
    if (!this._events.has(event)) return false;
    const listeners = [...this._events.get(event)];
    const toRemove = [];
    for (const l of listeners) {
      try {
        await l.fn(...args);
        if (l.once) toRemove.push(l.fn);
      } catch (err) {
        if (this._onError) await this._onError(err, event);
        else throw err;
      }
    }
    for (const fn of toRemove) this.off(event, fn);
    return true;
  }

  emitParallel(event, ...args) {
    if (!this._events.has(event)) return Promise.resolve(false);
    const listeners = [...this._events.get(event)];
    const toRemove = listeners.filter(l => l.once).map(l => l.fn);
    const promises = listeners.map(l => Promise.resolve().then(() => l.fn(...args)));
    return Promise.all(promises).then(() => {
      for (const fn of toRemove) this.off(event, fn);
      return true;
    });
  }

  listenerCount(event) {
    return this._events.has(event) ? this._events.get(event).length : 0;
  }

  eventNames() { return [...this._events.keys()]; }

  waitFor(event, timeout) {
    return new Promise((resolve, reject) => {
      let timer;
      const handler = (...args) => {
        if (timer) clearTimeout(timer);
        resolve(args.length === 1 ? args[0] : args);
      };
      this.once(event, handler);
      if (timeout) {
        timer = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`[ntl:events] Timeout waiting for "${event}" after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  pipe(target, event) {
    this.on(event || '*', (...args) => target.emit(event || args[0], ...(event ? args : args.slice(1))));
    return this;
  }

  onError(handler) { this._onError = handler; return this; }
  setMaxListeners(n) { this._maxListeners = n; return this; }
}

// ── Event Bus (global singleton for app-wide events) ────────────────────────

class EventBus extends EventEmitter {
  constructor() { super(); this._namespaces = new Map(); }

  namespace(name) {
    if (!this._namespaces.has(name)) {
      this._namespaces.set(name, new EventEmitter());
    }
    return this._namespaces.get(name);
  }

  ns(name) { return this.namespace(name); }
}

const bus = new EventBus();

module.exports = { EventEmitter, EventBus, bus };
